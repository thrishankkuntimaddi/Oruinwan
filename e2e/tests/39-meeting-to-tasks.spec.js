'use strict';

const { test, expect } = require('@playwright/test');
const { E2E, seedData, withPg } = require('./helpers');

/**
 * The product's wedge, end to end against the real databases: a call's transcript becomes
 * a recap and action items, each action item becomes a task that points back to the meeting,
 * the right person owns it, and nothing is created twice. (Posting the recap into the channel
 * is done by the client, because the message is encrypted on the sender's device; the web and
 * phone unit tests cover that step.)
 */
async function tokenOf(api, key) {
  const res = await api.post('/api/auth/login', { data: { email: E2E.users[key].email, password: E2E.password } });
  expect(res.ok(), `login ${key}`).toBeTruthy();
  return (await res.json()).accessToken;
}

test.describe('a call becomes tasks', () => {
  test('transcript → action items → summary → tasks linked to the meeting, owners kept, no duplicates', async ({ playwright }) => {
    const { workspaceId, users } = seedData();
    const api = await playwright.request.newContext({ baseURL: E2E.apiUrl });
    const alice = await tokenOf(api, 'alice');
    const bob = await tokenOf(api, 'bob');
    const as = (t) => ({ headers: { Authorization: `Bearer ${t}` } });
    const ok = async (resP, label) => {
      const res = await resP;
      expect(res.status(), `${label}: ${await res.text()}`).toBeLessThan(300);
      return res.json();
    };
    const stamp = Date.now() % 100000;

    // A channel with both people, and a meeting in it that starts now.
    const ch = await ok(api.post('/api/channels', { ...as(alice), data: { name: `launch-${stamp}`, workspaceId, memberIds: [users.bob.id] } }), 'channel');
    const channelId = String(ch.channel?._id || ch._id || ch.id);
    const made = await ok(api.post('/api/scheduled-meetings', {
      ...as(alice),
      data: { workspaceId, channelId, title: `Launch sync ${stamp}`, startTime: new Date().toISOString(), duration: 30, participants: [users.bob.id] },
    }), 'meeting');
    const meetingId = String(made.meeting?._id || made._id || made.id);
    await ok(api.post(`/api/v2/meetings/${meetingId}/join`, as(alice)), 'join');

    // What was said (the live transcript the apps send while the call runs).
    const t0 = Date.now();
    const at = (s) => new Date(t0 + s * 1000).toISOString();
    await ok(api.post(`/api/v2/meetings/${meetingId}/transcript/segments`, {
      ...as(alice),
      data: {
        segments: [
          { speakerId: users.alice.id, speakerName: 'alice', text: 'We pick Monday for the launch.', startedAt: at(0), endedAt: at(4) },
          { speakerId: users.bob.id, speakerName: 'bob', text: "I'll send the launch checklist to the team.", startedAt: at(5), endedAt: at(9) },
          { speakerId: users.alice.id, speakerName: 'alice', text: 'Action item: update the pricing page.', startedAt: at(10), endedAt: at(14) },
        ],
      },
    }), 'segments');
    const transcript = await ok(api.get(`/api/v2/meetings/${meetingId}/transcript`, as(bob)), 'transcript');
    expect(JSON.stringify(transcript)).toContain('launch checklist');

    // Action items from the transcript land in the meeting's one list; "I'll …" belongs to its speaker.
    const extracted = await ok(api.post(`/api/v2/meetings/${meetingId}/action-items/extract`, { ...as(alice), data: { apply: true } }), 'extract');
    expect(extracted.added).toBeGreaterThanOrEqual(2);
    const { actionItems } = await ok(api.get(`/api/v2/meetings/${meetingId}/action-items`, as(bob)), 'list');
    const checklist = actionItems.find((a) => /launch checklist/i.test(a.text));
    const pricing = actionItems.find((a) => /pricing page/i.test(a.text));
    expect(checklist, JSON.stringify(actionItems)).toBeTruthy();
    expect(pricing, JSON.stringify(actionItems)).toBeTruthy();
    expect(String(checklist.assigneeId || checklist.assignedTo || '')).toBe(users.bob.id);

    // Extracting again adds nothing (deduped by text).
    const again = await ok(api.post(`/api/v2/meetings/${meetingId}/action-items/extract`, { ...as(alice), data: { apply: true } }), 'extract again');
    expect(again.added).toBe(0);

    // A recap is saved on the meeting, from AI when it is set up, otherwise from the transcript.
    const summary = await ok(api.post(`/api/v2/meetings/${meetingId}/summarize`, as(alice)), 'summarize');
    expect(String(summary.summary || '').length).toBeGreaterThan(0);

    // Each action item becomes a task that points back to the meeting.
    const c1 = await ok(api.post(`/api/v2/meetings/${meetingId}/action-items/${checklist.id}/convert`, as(alice)), 'convert checklist');
    const c2 = await ok(api.post(`/api/v2/meetings/${meetingId}/action-items/${pricing.id}/convert`, as(alice)), 'convert pricing');
    const taskIds = [c1.actionItem.taskId, c2.actionItem.taskId].map(String);
    expect(taskIds.every(Boolean)).toBeTruthy();

    const rows = await withPg((sql) => sql('SELECT id, title, description, workspace_id FROM tasks WHERE id = ANY($1)', [taskIds]));
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(String(r.workspace_id)).toBe(workspaceId);
      expect(r.description).toContain(`/meetings/${meetingId}`);
    }
    expect(rows.map((r) => r.title).join(' | ')).toMatch(/launch checklist/i);

    // The task from bob's "I'll …" is bob's: it shows up in his tasks.
    const bobTasks = await ok(api.get(`/api/v2/tasks?workspaceId=${workspaceId}`, as(bob)), 'bob tasks');
    expect(JSON.stringify(bobTasks)).toContain(String(c1.actionItem.taskId));

    // Converting twice never makes a second task.
    const dup = await ok(api.post(`/api/v2/meetings/${meetingId}/action-items/${checklist.id}/convert`, as(alice)), 'convert again');
    expect(dup.alreadyConverted).toBe(true);
    const [{ n }] = await withPg((sql) => sql('SELECT count(*)::int AS n FROM tasks WHERE description LIKE $1', [`%/meetings/${meetingId}%`]));
    expect(n).toBe(2);

    // Ending the call keeps the recap and the linked action items on the meeting page.
    await ok(api.patch(`/api/v2/meetings/${meetingId}/end`, as(alice)), 'end');
    const view = (await ok(api.get(`/api/v2/meetings/${meetingId}`, as(bob)), 'view')).meeting;
    expect(view.status).toBe('completed');
    expect(view.summary?.text || view.summary).toBeTruthy();
    expect(view.actionItems.filter((a) => a.taskId).map((a) => String(a.taskId)).sort()).toEqual([...taskIds].sort());

    await api.dispose();
  });
});
