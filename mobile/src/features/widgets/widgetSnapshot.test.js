import { describe, expect, it } from 'vitest';
import { buildWidgetSnapshot, signedOutSnapshot } from './widgetSnapshot.js';
import { parseWidgetLink } from './widgetLinks.js';

const NOW = new Date('2026-11-14T10:00:00').getTime();
const row = (kind, id, item = {}, extra = {}) => ({ kind, key: `${kind}:${id}`, pinnedAt: null, archivedAt: null, item: { id, ...item }, ...extra });

describe('widget snapshot', () => {
  it('is empty when nobody is signed in', () => {
    expect(buildWidgetSnapshot({ workspace: null })).toMatchObject({ signedIn: false });
    expect(signedOutSnapshot(NOW)).toEqual({ v: 1, signedIn: false, updatedAt: NOW });
  });

  it('lists unread chats first with previews, links and counts; skips archived', () => {
    const rows = [
      row('channel', 'c1', { name: 'general', lastAt: '2026-11-14T09:50:00', lastText: 'Ship it', lastSender: { id: 'u2', name: 'Ben Hall' }, unread: 0 }),
      row('dm', 'd1', { user: { name: 'Ana' }, lastAt: '2026-11-14T09:00:00', lastText: 'See you at 3', unread: 2 }),
      row('dm', 'd2', { user: { name: 'Old' }, lastAt: '2026-11-14T09:59:00', unread: 5 }, { archivedAt: '2026-11-01' }),
    ];
    const s = buildWidgetSnapshot({ workspace: { id: 'w1', name: 'Acme' }, me: 'u1', rows, now: NOW });
    expect(s.chats.unread).toBe(2);
    expect(s.chats.items.map((c) => c.title)).toEqual(['Ana', '#general']);
    expect(s.chats.items[0]).toMatchObject({ preview: 'See you at 3', unread: 2, initial: 'A', link: 'oruinwan://workspace/w1/dm/d1' });
    expect(s.chats.items[1]).toMatchObject({ preview: 'Ben: Ship it', link: 'oruinwan://workspace/w1/channel/c1' });
  });

  it('shows my open tasks, overdue first, with counts', () => {
    const tasks = [
      { id: 't1', title: 'Later', assigneeIds: ['u1'], status: 'todo', due: '2026-11-20' },
      { id: 't2', title: 'Late', assigneeIds: ['u1'], status: 'todo', due: '2026-11-12' },
      { id: 't3', title: 'Today', assigneeIds: ['u1'], status: 'in_progress', due: '2026-11-14' },
      { id: 't4', title: 'Done', assigneeIds: ['u1'], status: 'done', due: '2026-11-10' },
      { id: 't5', title: 'Not mine', assigneeIds: ['u2'], status: 'todo' },
    ];
    const s = buildWidgetSnapshot({ workspace: { id: 'w1' }, me: 'u1', tasks, now: NOW });
    expect(s.tasks.items.map((t) => t.title)).toEqual(['Late', 'Today', 'Later']);
    expect(s.tasks).toMatchObject({ overdue: 1, today: 1, open: 3 });
    expect(s.tasks.items[0]).toMatchObject({ tone: 'overdue', link: 'oruinwan://workspace/w1/tasks/t2' });
  });

  it('shows live huddles and the next meeting', () => {
    const s = buildWidgetSnapshot({
      workspace: { id: 'w1' }, me: 'u1', now: NOW,
      live: [{ title: '#design', count: 3, kind: 'channel', id: 'c9' }],
      meetings: [{ id: 'm2', title: 'Later', start: '2026-11-15T09:00:00', duration: 30 }, { id: 'm1', title: 'Standup', start: '2026-11-14T11:00:00', duration: 15 }],
    });
    expect(s.huddles.live[0]).toMatchObject({ title: '#design', people: 3, link: 'oruinwan://workspace/w1/channel/c9' });
    expect(s.huddles.next).toMatchObject({ title: 'Standup', link: 'oruinwan://widget/meeting/m1' });
    expect(s.huddles.next.when).toMatch(/^Today /);
  });

  it('quick widget: pinned chats then recent people, and the four actions', () => {
    const rows = [
      row('dm', 'd1', { user: { name: 'Zoe' }, lastAt: '2026-11-14T08:00:00' }),
      row('channel', 'c1', { name: 'ops' }, { pinnedAt: '2026-11-01' }),
      row('dm', 'g1', { name: 'Group', isGroup: true, lastAt: '2026-11-14T09:00:00' }),
    ];
    const s = buildWidgetSnapshot({ workspace: { id: 'w1' }, me: 'u1', rows, now: NOW });
    expect(s.quick.contacts.map((c) => c.title)).toEqual(['ops', 'Zoe']);
    expect(s.quick.actions.map((a) => a.link)).toEqual(['oruinwan://widget/new-message', 'oruinwan://widget/new-task', 'oruinwan://widget/new-note', 'oruinwan://widget/start-huddle']);
  });
});

describe('widget links', () => {
  it('parses actions and ignores other links', () => {
    expect(parseWidgetLink('oruinwan://widget/tab/tasks')).toEqual({ action: 'tab', id: 'tasks' });
    expect(parseWidgetLink('oruinwan://widget/new-note')).toEqual({ action: 'new-note', id: null });
    expect(parseWidgetLink('oruinwan://workspace/w1/dm/d1')).toBeNull();
    expect(parseWidgetLink('https://example.com/widget/x')).toBeNull();
  });
});
