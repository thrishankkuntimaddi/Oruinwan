// The meeting page (same tabs as the web), the Huddles lists, the recap banner after a call and
// the "My tasks" view — against a fake adapter.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { create } from 'zustand';

const me = { id: 'me', name: 'Me', username: 'me' };
const meeting = (over = {}) => ({
  id: 'm1',
  kind: 'huddle',
  title: 'Huddle in #design',
  status: 'completed',
  workspaceId: 'w1',
  start: '2026-10-20T10:00:00.000Z',
  end: null,
  duration: 30,
  startedAt: '2026-10-20T10:00:00.000Z',
  endedAt: '2026-10-20T10:30:00.000Z',
  durationSec: 1800,
  conversation: { kind: 'channel', id: 'c1', name: 'design' },
  huddleId: 'h1',
  organizer: { id: 'me', name: 'Me' },
  participants: [],
  participantIds: ['me'],
  invitees: [],
  attendees: [],
  agenda: [],
  actionItems: [{ id: 'a1', text: 'Draft the release notes', status: 'pending', done: false, assigneeId: null, assignee: null, dueDate: null, taskId: null }],
  noteId: 'n1',
  summary: { text: 'We agreed to ship Monday.', source: 'ai', generatedAt: null },
  hasRecording: true,
  link: null,
  transcript: '',
  notes: '',
  raw: {},
  ...over,
});

const fake = {
  members: vi.fn(async () => [me]),
  meeting: vi.fn(async () => meeting()),
  joinMeetingRoom: vi.fn(async () => true),
  leaveMeetingRoom: vi.fn(),
  toggleActionItem: vi.fn(async () => [{ ...meeting().actionItems[0], done: true, status: 'done' }]),
  mapActionItem: (x) => x,
  mapSummary: (x) => x,
  meetingsPage: vi.fn(async () => ({ meetings: [], hasMore: false, cursor: null })),
  callRecording: vi.fn(async () => null),
};

const mockSession = create(() => ({ user: me, workspaceId: 'w1', mode: 'live', server: 'https://api.example' }));
vi.mock('../../data/session.js', () => ({ api: () => fake, useSession: mockSession, useWorkspace: () => ({ id: 'w1', name: 'Acme' }) }));

const { useLayout } = await import('../../app/layout.js');
const { useNav } = await import('../../app/nav.js');
const { clearQueries } = await import('../../data/query.js');
const { emit } = await import('../../lib/bus.js');
const { prefs } = await import('../../native/storage.js');
const { MeetingScreen } = await import('./screens.jsx');
const { MEETING_TABS, meetingTab, visibleTabs } = await import('./meetingsUi.js');
const { HuddlesScreen } = await import('../huddles/HuddlesScreen.jsx');
const { RecapBanner } = await import('../huddles/HuddleLayer.jsx');
const { bindRecap, useRecap, __resetRecap } = await import('./recap.js');
const { filterView } = await import('../tasks/screens.jsx');

beforeEach(() => {
  cleanup();
  clearQueries();
  vi.clearAllMocks();
  __resetRecap();
  useNav.getState().resetAll();
  useLayout.setState({ kind: 'phone', wide: false, split: false });
  prefs.set('huddles.list', 'live');
});

describe('meeting page tabs', () => {
  it('has the web tabs, in the web order, and old tab names still open the right one', () => {
    expect(MEETING_TABS.map((t) => t.label)).toEqual(['Overview', 'Agenda', 'Notes', 'Transcript', 'Summary & actions', 'Whiteboard', 'Brainstorm']);
    expect(meetingTab('actions')).toBe('summary');
    expect(meetingTab('board')).toBe('brainstorm');
    expect(meetingTab('nope')).toBe('overview');
  });

  it('opens on Overview with status, conversation and the recording badge', async () => {
    render(<MeetingScreen id="m1" />);
    expect(await screen.findByTestId('meeting-status')).toHaveProperty('textContent', 'Ended');
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent.replace(/\d+$/, ''));
    // Over: tabs nobody used (no agenda, no transcript) are left out.
    expect(tabs).toEqual(visibleTabs(await fake.meeting.mock.results[0].value).map((t) => t.label));
    expect(screen.getByText('# design')).toBeTruthy();
    expect(screen.getByTestId('meeting-recording-badge').textContent).toContain('Recorded');
    // An ended quick huddle can't be rejoined; nothing to end either.
    expect(screen.queryByRole('button', { name: /Join huddle|Start huddle/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'End for everyone' })).toBeNull();
  });

  it('a live meeting offers Join huddle and End for everyone', async () => {
    fake.meeting.mockResolvedValueOnce(meeting({ status: 'live', endedAt: null }));
    render(<MeetingScreen id="m1" />);
    expect(await screen.findByRole('button', { name: 'Join huddle' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'End for everyone' })).toBeTruthy();
  });

  it('Summary & actions shows the summary object and toggles an action item', async () => {
    render(<MeetingScreen id="m1" tab="summary" />);
    expect(await screen.findByText('We agreed to ship Monday.')).toBeTruthy();
    const list = screen.getByTestId('action-items');
    const box = within(list).getByRole('checkbox');
    expect(box.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(box);
    expect(fake.toggleActionItem).toHaveBeenCalledWith('m1', 'a1');
    await waitFor(() => expect(within(screen.getByTestId('action-items')).getByRole('checkbox').getAttribute('aria-checked')).toBe('true'));
  });

  it('live action item and summary events update the page', async () => {
    render(<MeetingScreen id="m1" tab="summary" />);
    await screen.findByText('We agreed to ship Monday.');
    act(() => {
      emit('meeting', { event: 'meeting:summary_updated', payload: { meetingId: 'm1', summary: { text: 'New summary' } } });
      emit('meeting', { event: 'meeting:action_items_updated', payload: { meetingId: 'm1', actionItems: [{ id: 'a9', text: 'From the call', done: false, status: 'pending' }] } });
    });
    expect(await screen.findByText('New summary')).toBeTruthy();
    expect(screen.getByText('From the call')).toBeTruthy();
  });

  it("says when the meeting isn't open to me", async () => {
    fake.meeting.mockRejectedValueOnce(Object.assign(new Error('No access'), { status: 403 }));
    render(<MeetingScreen id="m1" />);
    expect(await screen.findByText("You don't have access to this meeting")).toBeTruthy();
  });
});

describe('Huddles: Live now · Upcoming · Past', () => {
  it('lists each status from the server, with paging', async () => {
    fake.meetingsPage.mockImplementation(async (_ws, { status, cursor }) => {
      if (status === 'live') return { meetings: [meeting({ id: 'L1', title: 'Standup', status: 'live' })], hasMore: false, cursor: null };
      if (status === 'past' && !cursor) return { meetings: [meeting({ id: 'P1', title: 'Huddle in #design' })], hasMore: true, cursor: 'next' };
      if (status === 'past') return { meetings: [meeting({ id: 'P2', title: 'Retro', kind: 'scheduled' })], hasMore: false, cursor: null };
      return { meetings: [], hasMore: false, cursor: null };
    });
    render(<HuddlesScreen />);
    expect(await screen.findByText('Standup')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Join huddle' })).toBeTruthy();
    expect(screen.getAllByText('Schedule').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Past' }));
    expect(await screen.findByText('Huddle in #design')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Retro')).toBeTruthy();
    expect(fake.meetingsPage).toHaveBeenCalledWith('w1', { status: 'past', q: '', cursor: 'next' });

    // A past row opens the meeting on its recap.
    fireEvent.click(screen.getByText('Retro'));
    expect(useNav.getState().stacks.home.at(-1)).toMatchObject({ name: 'meeting', params: { id: 'P2', tab: 'summary' } });

    fireEvent.click(screen.getByRole('button', { name: 'Upcoming' }));
    expect(await screen.findByText('Nothing scheduled')).toBeTruthy();
  });
});

describe('after a call: Meeting ended · View recap', () => {
  it('shows a banner for meeting:ended and opens the recap without moving me first', async () => {
    const off = bindRecap();
    useNav.getState().setTab('chats');
    render(<RecapBanner />);
    act(() => emit('meeting', { event: 'meeting:ended', payload: { meetingId: 'm1', title: 'Planning', kind: 'scheduled' } }));
    expect(await screen.findByText('Meeting ended · View recap')).toBeTruthy();
    expect(screen.getByText('Planning')).toBeTruthy();
    expect(useNav.getState().tab).toBe('chats');
    // The same meeting again doesn't stack a second banner.
    act(() => emit('meeting', { event: 'meeting:ended', payload: { meetingId: 'm1', title: 'Planning' } }));
    expect(screen.getAllByTestId('meeting-recap-banner')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'View recap' }));
    expect(useNav.getState().stacks.chats.at(-1)).toMatchObject({ name: 'meeting', params: { id: 'm1', tab: 'summary' } });
    expect(useRecap.getState().recaps).toHaveLength(0);
    off();
  });
});

describe('My tasks means what it means on the web', () => {
  it('is tasks I created that are assigned to me', () => {
    const tasks = [
      { id: 'mine', status: 'todo', createdBy: 'me', assigneeIds: ['me'] },
      { id: 'incoming', status: 'todo', createdBy: 'sam', assigneeIds: ['me'] },
      { id: 'given', status: 'todo', createdBy: 'me', assigneeIds: ['sam'] },
      { id: 'done', status: 'done', createdBy: 'me', assigneeIds: ['me'] },
    ];
    expect(filterView(tasks, 'mine', 'me').map((t) => t.id)).toEqual(['mine']);
    expect(filterView(tasks, 'incoming', 'me').map((t) => t.id)).toEqual(['incoming']);
  });
});
