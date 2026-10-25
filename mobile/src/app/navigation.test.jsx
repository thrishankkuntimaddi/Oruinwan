// The phone navigation: Home · Chats · Tasks · Notes · Activity on the tab bar, AI · Search ·
// Profile in every tab's header, AI as a screen you leave with Back, and the Home, Chats,
// Unread and Tasks screens built on it.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { create } from 'zustand';

const me = { id: 'me', name: 'Ada Lovelace' };
const ago = (min) => new Date(Date.now() - min * 60_000).toISOString();
const ch = (id, name, over = {}) => ({ id, name, isMember: true, memberCount: 3, unread: 0, lastAt: ago(60), ...over });
const dm = (id, name, over = {}) => ({ id, isGroup: false, user: { id: `u-${id}`, name }, unread: 0, lastAt: ago(90), agentId: null, ...over });

const channels = [
  ch('c1', 'general', { lastAt: ago(5) }),
  ch('c2', 'design', { unread: 3, lastAt: ago(30) }),
  ch('c3', 'random', { lastAt: ago(1) }),
  ch('c4', 'muted-one', { unread: 9, muted: true, lastAt: ago(2) }),
  ch('c5', 'not-joined', { isMember: false, unread: 4 }),
];
const dms = [
  dm('d1', 'Ben Carter', { unread: 2, lastAt: ago(3) }),
  dm('d2', 'Cleo Diaz', { lastAt: ago(4) }),
  dm('d3', 'Claude', { agentId: 'anthropic', unread: 1, lastAt: ago(10) }),
];
const tasks = [
  { id: 't1', title: 'Write launch post', status: 'todo', assigneeIds: ['me'], createdBy: 'me', due: null, description: '' },
  { id: 't2', title: 'Fix login bug', issueKey: 'ORU-7', status: 'in_progress', assigneeIds: ['u-d1'], createdBy: 'u-d1', due: null, description: 'Safari only' },
  { id: 't3', title: 'Old thing', status: 'done', assigneeIds: ['me'], createdBy: 'me', due: null, description: '' },
];

const fake = {
  channels: vi.fn(async () => channels),
  dms: vi.fn(async () => dms),
  members: vi.fn(async () => [me]),
  agents: vi.fn(async () => [{ id: 'anthropic', name: 'Claude', icon: '', tagline: 'By Anthropic' }]),
  assistants: vi.fn(async () => []),
  tasks: vi.fn(async () => tasks),
  notes: vi.fn(async () => []),
  notifications: vi.fn(async () => [{ id: 'n1', type: 'mention', read: false, at: ago(1), text: 'mentioned you' }, { id: 'n2', type: 'task', read: true, at: ago(5) }]),
  savedMessages: vi.fn(async () => [{ conv: { kind: 'channel', id: 'c1' }, message: { id: 'm1' } }]),
  reminders: vi.fn(async () => []),
  meetingsPage: vi.fn(async () => ({ meetings: [], hasMore: false })),
  openAgentDm: vi.fn(async () => 'd3'),
  huddles: vi.fn(async () => []),
};

const mockSession = create(() => ({ user: me, workspaceId: 'w1', workspaces: [{ id: 'w1', role: 'member' }], mode: 'live', server: 'https://oru.test' }));
vi.mock('../data/session.js', () => ({
  api: () => fake,
  useSession: mockSession,
  useWorkspace: () => ({ id: 'w1', name: 'Acme', role: 'member' }),
}));
vi.mock('../data/e2ee.js', () => ({ useE2ee: create(() => ({ status: 'ready' })) }));

const { useLayout } = await import('./layout.js');
const { useNav, nav, BAR_TABS, TABS } = await import('./nav.js');
const { TabBar } = await import('./TabBar.jsx');
const { TabHeader } = await import('./TabHeader.jsx');
const { HomeScreen, recentConversations } = await import('../features/home/HomeScreen.jsx');
const { ChatsScreen, chatSections } = await import('../features/chats/ChatsScreen.jsx');
const { UnreadScreen, unreadSections } = await import('../features/chats/UnreadScreen.jsx');
const { TasksScreen, searchTasks } = await import('../features/tasks/screens.jsx');
const { openPush } = await import('../features/home/openTarget.js');
const { clearQueries } = await import('../data/query.js');
const { prefs } = await import('../native/storage.js');

beforeEach(() => {
  cleanup();
  clearQueries();
  vi.clearAllMocks();
  useNav.getState().resetAll();
  useLayout.setState({ kind: 'phone', wide: false, split: false });
  mockSession.setState({ status: 'signed-in', pickingWorkspace: false });
});

describe('tabs', () => {
  it('the tab bar is Home · Chats · Tasks · Notes · Activity, with AI off it', async () => {
    expect(BAR_TABS).toEqual(['home', 'chats', 'tasks', 'notes', 'activity']);
    expect(TABS).toContain('ai');
    render(<TabBar />);
    const bar = screen.getByRole('navigation', { name: 'Main' });
    const labels = [...bar.querySelectorAll('[data-tour]')].map((b) => b.textContent.replace(/\d+/g, '').trim());
    expect(labels).toEqual(['Home', 'Chats', 'Tasks', 'Notes', 'Activity']);
    // Unread notifications badge the Activity tab.
    expect(await within(bar).findByRole('button', { name: 'Activity, 1 new' })).toBeTruthy();
  });

  it('the handle above the bar opens the drawer with more places; Edit puts Files on the bar', async () => {
    const { setBarItems } = await import('./tabBarPrefs.js');
    render(<TabBar />);
    const handle = screen.getByTestId('tabbar-handle');
    expect(handle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.pointerDown(handle, { clientY: 700 });
    fireEvent.pointerUp(handle, { clientY: 700 });
    expect(handle.getAttribute('aria-expanded')).toBe('true');
    const drawer = screen.getByTestId('tabbar-drawer');
    for (const name of ['Files', 'Knowledge', 'Huddles', 'Automations', 'Integrations', 'Settings']) expect(within(drawer).getByText(name)).toBeTruthy();
    fireEvent.click(within(drawer).getByText('Files'));
    expect(useNav.getState().tab).toBe('files');
    // Edit: swap Activity for Files.
    fireEvent.pointerDown(handle, { clientY: 700 });
    fireEvent.pointerUp(handle, { clientY: 700 });
    fireEvent.click(screen.getByTestId('tabbar-edit'));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove Activity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Files' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const bar = screen.getByRole('navigation', { name: 'Main' });
    expect([...bar.querySelectorAll('[data-tour]')].map((b) => b.dataset.tour)).toEqual(['home', 'chats', 'tasks', 'notes', 'files']);
    setBarItems(['home', 'chats', 'tasks', 'notes', 'activity']);
  });

  it('AI opens over any tab, and Back (or the Android back button) returns to that tab', () => {
    nav.setTab('tasks');
    nav.openAi();
    expect(useNav.getState().tab).toBe('ai');
    nav.leaveAi();
    expect(useNav.getState().tab).toBe('tasks');

    nav.open('chats', 'conversation', { kind: 'dm', id: 'd1' });
    useNav.getState().open('ai');
    expect(useNav.getState().back()).toBe(true);
    expect(useNav.getState().tab).toBe('chats');
    expect(useNav.getState().stacks.chats).toHaveLength(1);
  });

  it('a push that points at nothing to open lands on the Activity tab', () => {
    openPush({ type: 'something-new' });
    expect(useNav.getState().tab).toBe('activity');
  });
});

describe('tab header', () => {
  it('has Search and Profile on the right; AI is the floating button, not in the header', () => {
    render(<TabHeader title="Chats" />);
    const buttons = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(buttons.slice(-2)).toEqual(['Search', 'Profile and settings']);
    expect(screen.queryByRole('button', { name: 'Oruinwan AI' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Notifications/ })).toBeNull();
  });

  it('Search grows in the header and searches the tab you are on, without leaving it', async () => {
    useNav.getState().setTab('chats');
    render(<TabHeader title="Chats" />);
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    const input = screen.getByRole('searchbox', { name: 'Search chats and people' });
    expect(useNav.getState().stacks.chats).toEqual([]);
    fireEvent.change(input, { target: { value: 'be' } });
    const panel = await screen.findByRole('region', { name: 'Search results' });
    expect(await within(panel).findByText('Ben Carter')).toBeTruthy();
    // See all results opens the full search with the same words.
    fireEvent.click(await within(panel).findByTestId('quick-search-all'));
    expect(useNav.getState().stacks.chats.at(-1)).toMatchObject({ name: 'search', params: { q: 'be' } });
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('Cancel closes the search', () => {
    render(<TabHeader title="Tasks" />);
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getByRole('searchbox', { name: 'Search tasks' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('the AI button is small above + on Chats, Tasks and Notes and full size on Home and Activity', async () => {
    const { AiFab } = await import('./AiFab.jsx');
    const { rerender } = render(<AiFab tab="chats" />);
    expect(screen.getByRole('button', { name: 'Oruinwan AI' }).dataset.size).toBe('small');
    rerender(<AiFab tab="home" />);
    expect(screen.getByRole('button', { name: 'Oruinwan AI' }).dataset.size).toBe('big');
    fireEvent.click(screen.getByRole('button', { name: 'Oruinwan AI' }));
    expect(useNav.getState().tab).toBe('ai');
  });
});

describe('Chats', () => {
  it('keeps every conversation in its own section, unread first', () => {
    const s = chatSections(channels, dms);
    expect(s.channels.map((c) => c.name)).toEqual(['design', 'random', 'muted-one', 'general']);
    expect(s.people.map((d) => d.id)).toEqual(['d1', 'd2']);
    expect(s.agentDms.map((d) => d.id)).toEqual(['d3']);
  });

  it('All is one list, newest first, no sections; unread rows stay in place with a badge', async () => {
    render(<ChatsScreen />);
    const list = await screen.findByRole('list', { name: 'Chats' });
    const names = within(list).getAllByRole('listitem').map((li) => li.querySelector('[data-testid]').dataset.testid);
    // random (1m), muted-one (2m), Ben (3m), Cleo (4m), general (5m), Claude (10m), design (30m)
    expect(names).toEqual(['chat-channel:c3', 'chat-channel:c4', 'chat-dm:d1', 'chat-dm:d2', 'chat-channel:c1', 'chat-dm:d3', 'chat-channel:c2']);
    expect(screen.getByTestId('chat-dm:d1').dataset.unread).toBe('true');
    expect(screen.getByTestId('chat-channel:c2').dataset.unread).toBe('true');
    expect(screen.queryByRole('region', { name: 'Direct messages' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Unread' })).toBeNull();
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'New message' }).length).toBeGreaterThan(0);
  });

  it('the Agents filter lists agent chats and offers to connect your own', async () => {
    const { useChatsUi } = await import('../features/chats/chatsUi.js');
    useChatsUi.getState().setSegment('agents');
    render(<ChatsScreen />);
    expect(await screen.findByTestId('chat-dm:d3')).toBeTruthy();
    expect(screen.queryByTestId('chat-dm:d1')).toBeNull();
    fireEvent.click(screen.getByTestId('agents-manage'));
    expect(useNav.getState().stacks.home.at(-1)).toMatchObject({ name: 'agents', params: { connect: true } });
    useChatsUi.getState().setSegment('all');
  });
});

describe('Home', () => {
  it('lists the five most recent conversations, channels and DMs mixed', () => {
    expect(recentConversations(channels, dms).map((r) => r.item.id)).toEqual(['c3', 'c4', 'd1', 'd2', 'c1']);
  });

  it('shows tiles instead of activity, and Unread opens the grouped unread list', async () => {
    render(<HomeScreen />);
    expect(screen.queryByText(/caught up/)).toBeNull();
    expect(screen.queryByText('Activity')).toBeNull();
    expect(screen.getByTestId('home-tasks')).toBeTruthy();
    expect(screen.getByTestId('home-saved')).toBeTruthy();
    expect(screen.getByTestId('home-huddles')).toBeTruthy();
    // 3 (design) + 2 (Ben) + 1 (Claude); muted channels don't count.
    await waitFor(() => expect(screen.getByTestId('home-unread').getAttribute('aria-label')).toBe('Unread: 6, in 3 conversations'));
    expect(await screen.findByText('Jump to')).toBeTruthy();
    fireEvent.click(screen.getByTestId('home-unread'));
    expect(useNav.getState().stacks.home.at(-1).name).toBe('unread');
    fireEvent.click(screen.getByTestId('home-saved'));
    expect(useNav.getState().stacks.home.at(-1).name).toBe('saved');
  });

  it('the Unread screen groups channels, DMs and agents and opens a conversation in Chats', async () => {
    const g = unreadSections(channels, dms);
    expect([g.channels, g.people, g.agentDms].map((l) => l.map((x) => x.id))).toEqual([['c2'], ['d1'], ['d3']]);
    render(<UnreadScreen />);
    expect(await screen.findByText('Channels')).toBeTruthy();
    expect(screen.getByText('Direct messages')).toBeTruthy();
    expect(screen.getByText('Agents')).toBeTruthy();
    fireEvent.click(screen.getByText('Ben Carter'));
    expect(useNav.getState().tab).toBe('chats');
    expect(useNav.getState().stacks.chats.at(-1)).toMatchObject({ name: 'conversation', params: { kind: 'dm', id: 'd1' } });
  });
});

describe('Tasks', () => {
  it('opens on All tasks and searches within them', async () => {
    prefs.set('tasks.view', null); // never picked a view
    expect(searchTasks(tasks, 'oru-7 safari').map((t) => t.id)).toEqual(['t2']);
    render(<TasksScreen />);
    expect(await screen.findByText('Fix login bug')).toBeTruthy();
    expect(screen.getByText('Write launch post')).toBeTruthy();
    // One search (the header's); the view is a dropdown, and New task sits bottom right.
    expect(screen.queryByRole('button', { name: 'Search tasks' })).toBeNull();
    expect(screen.getByTestId('task-view').textContent).toContain('All tasks');
    fireEvent.click(screen.getByTestId('task-view'));
    fireEvent.click(await screen.findByText(/^Completed/));
    expect(await screen.findByText('Old thing')).toBeTruthy();
    expect(screen.queryByText('Fix login bug')).toBeNull();
    expect(screen.getByRole('button', { name: 'New task' }).className).toContain('right-4');
  });
});

describe('back returns to where you came from', () => {
  it('Activity → a DM → Back lands on Activity, not the Chats list', () => {
    nav.setTab('activity');
    nav.open('chats', 'conversation', { kind: 'dm', id: 'd1' });
    expect(useNav.getState().tab).toBe('chats');
    expect(useNav.getState().back()).toBe(true);
    expect(useNav.getState().tab).toBe('activity');
    expect(useNav.getState().stacks.chats).toEqual([]);
  });

  it('Home → a conversation pushed into Chats → thread → Back, Back lands on Home', () => {
    nav.push('conversation', { kind: 'channel', id: 'c1' }, { tab: 'chats' });
    nav.push('thread', { kind: 'channel', convId: 'c1', messageId: 'm1' });
    nav.pop();
    expect(useNav.getState().tab).toBe('chats');
    nav.pop();
    expect(useNav.getState().tab).toBe('home');
  });

  it('after picking a tab yourself, Back stays in that tab', () => {
    nav.setTab('activity');
    nav.open('chats', 'conversation', { kind: 'dm', id: 'd1' });
    nav.setTab('home');
    nav.setTab('chats');
    nav.pop();
    expect(useNav.getState().tab).toBe('chats');
  });

  it('New message → Browse channels → Back returns to New message', () => {
    nav.setTab('chats');
    nav.push('newMessage');
    nav.push('browseChannels');
    nav.pop();
    expect(useNav.getState().stacks.chats.map((r) => r.name)).toEqual(['newMessage']);
  });
});
