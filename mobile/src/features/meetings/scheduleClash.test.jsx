// Scheduling on the phone: the clash warning (who is busy, the other meeting's priority), free
// times to tap, "Schedule anyway", priority, rescheduling — against a fake adapter.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { create } from 'zustand';

const me = { id: 'me', name: 'Me', username: 'me' };
const future = (h, m = 0) => {
  const d = new Date(Date.now() + 2 * 86400e3);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const clash = () => ({
  hasConflicts: true,
  attendees: [
    { userId: 'me', name: 'Me', isOrganizer: true, conflicts: [] },
    { userId: 'asha', name: 'Asha', isOrganizer: false, conflicts: [{ meetingId: 'x1', title: 'Design review', start: future(9), end: future(9, 30), priority: 'high' }] },
  ],
  suggestions: [{ start: future(10), end: future(10, 30), allAvailable: true }],
});

const fake = {
  members: vi.fn(async () => [me]),
  meetingConflicts: vi.fn(async () => clash()),
  scheduleMeeting: vi.fn(async () => ({ id: 'new1', status: 'scheduled', conflicts: [{ meetingId: 'x1', userIds: ['asha'], mine: false }] })),
  updateMeeting: vi.fn(async () => ({ id: 'm1', status: 'scheduled', conflicts: [] })),
  suggestTimes: vi.fn(async () => []),
};

const mockSession = create(() => ({ user: me, workspaceId: 'w1', mode: 'live', server: 'https://api.example' }));
vi.mock('../../data/session.js', () => ({ api: () => fake, useSession: mockSession, useWorkspace: () => ({ id: 'w1', name: 'Acme' }) }));

const { ScheduleMeetingSheet } = await import('./screens.jsx');
const { clashLines, clashMarker, clashSuggestions, priorityLabel, normalizePriority } = await import('./meetingsUi.js');
const { mapMeeting } = await import('../../data/live/adapter.work.js');

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('clash helpers', () => {
  it('writes who is busy with the other meeting and its priority', () => {
    const lines = clashLines(clash());
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toMatch(/^Asha is busy .+ \(Design review · High priority\)$/);
    expect(clashSuggestions(clash())).toHaveLength(1);
    expect(priorityLabel('urgent')).toBe('Urgent');
    expect(normalizePriority('whatever')).toBe('normal');
  });

  it('marks list rows with the clash', () => {
    expect(clashMarker({ status: 'scheduled', conflicts: [] })).toBeNull();
    expect(clashMarker({ status: 'scheduled', conflicts: [{ mine: true, title: 'Standup' }] })).toBe('Clashes with Standup');
    expect(clashMarker({ status: 'scheduled', conflicts: [{ mine: false, userIds: ['a'] }] })).toBe('1 person double-booked');
    expect(clashMarker({ status: 'cancelled', conflicts: [{ mine: true, title: 'x' }] })).toBeNull();
  });

  it('maps priority and clashes from the server', () => {
    const m = mapMeeting({ _id: 'm1', title: 'Sync', startTime: future(9), priority: 'high', conflicts: [{ meetingId: 'x', userIds: ['u'], mine: true, title: 'Standup', priority: 'urgent' }] });
    expect(m.priority).toBe('high');
    expect(m.conflicts[0]).toMatchObject({ meetingId: 'x', mine: true, title: 'Standup', priority: 'urgent' });
    expect(mapMeeting({ _id: 'm2', title: 'Old' }).priority).toBe('normal');
  });
});

describe('ScheduleMeetingSheet', () => {
  it('warns about a clash and still schedules with the priority', async () => {
    render(<ScheduleMeetingSheet open onClose={vi.fn()} channelId="c1" />);
    await waitFor(() => expect(fake.meetingConflicts).toHaveBeenCalledWith('w1', expect.objectContaining({ duration: 30, channelId: 'c1' })), { timeout: 2000 });
    expect((await screen.findByTestId('clash-warning')).textContent).toContain('Asha is busy');
    expect(screen.getByTestId('clash-warning').textContent).toContain('Design review · High priority');

    fireEvent.click(screen.getByRole('tab', { name: 'Urgent' }));
    fireEvent.change(screen.getByPlaceholderText('Weekly sync'), { target: { value: 'Planning' } });
    fireEvent.click(screen.getByRole('button', { name: 'Schedule anyway' }));
    await waitFor(() => expect(fake.scheduleMeeting).toHaveBeenCalled());
    expect(fake.scheduleMeeting.mock.calls[0][1]).toMatchObject({ title: 'Planning', priority: 'urgent', channelId: 'c1' });
  });

  it('reschedules: leaves the meeting out of its own check and saves the new time', async () => {
    fake.meetingConflicts.mockResolvedValue({ hasConflicts: false, attendees: [], suggestions: [] });
    const meeting = { id: 'm1', title: 'Sync', start: future(14), duration: 45, priority: 'high', invitees: ['asha'], participantIds: [] };
    render(<ScheduleMeetingSheet open onClose={vi.fn()} meeting={meeting} />);
    await waitFor(() => expect(fake.meetingConflicts).toHaveBeenCalledWith('w1', expect.objectContaining({ excludeMeetingId: 'm1', participantIds: ['asha'], duration: 45 })), { timeout: 2000 });
    expect(await screen.findByTestId('clash-free')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(fake.updateMeeting).toHaveBeenCalledWith('m1', { title: 'Sync', start: future(14), duration: 45, priority: 'high' }));
  });
});
