// Renders the chat screens with a fake adapter in the phone, split and wide layouts, and
// drives the new message tools (polls, checklists, saved, threads, search filters).
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { create } from 'zustand';

const me = { id: 'me', name: 'Me', username: 'me' };
const members = [me, { id: 'u1', name: 'Ana Silva', username: 'ana', presence: 'active' }];
const channel = { id: 'c1', name: 'general', topic: 'All hands', isMember: true, memberIds: ['me', 'u1'], memberCount: 2, unread: 1 };
const msg = (over) => ({ id: 'm1', convId: 'c1', authorId: 'u1', text: 'Hello team', state: 'ok', at: new Date().toISOString(), reactions: {}, replyCount: 0, type: 'message', ...over });

const fake = {
  channels: vi.fn(async () => [channel]),
  dms: vi.fn(async () => []),
  members: vi.fn(async () => members),
  assistants: vi.fn(async () => []),
  tasks: vi.fn(async () => []),
  notes: vi.fn(async () => []),
  notifications: vi.fn(async () => []),
  messages: vi.fn(async () => ({
    items: [
      msg({ id: 'm1', text: 'Hello team\n```js\nconst a = 1;\n```', editCount: 1, edited: true }),
      msg({ id: 'm2', type: 'poll', state: 'attachment', text: 'Poll', poll: { question: 'Lunch?', options: [{ text: 'Pizza', votes: [] }, { text: 'Salad', votes: [] }], allowMultiple: false, anonymous: false, active: true, totalVotes: 0, createdBy: 'u1' } }),
      msg({ id: 'm3', type: 'checklist', text: '{"title":"Ship","items":["Docs"]}', checklist: [{ checked: false }] }),
    ],
    hasMore: false,
  })),
  threadInfo: vi.fn(async () => ({
    parent: msg({ id: 'm1', replyCount: 1 }),
    replies: [msg({ id: 'r1', parentId: 'm1', authorId: 'me', text: 'On it' })],
    participants: [{ id: 'u1', username: 'ana', replyCount: 0 }, { id: 'me', username: 'me', replyCount: 1 }],
    resolved: false,
    resolvedBy: null,
    following: false,
    followerCount: 1,
  })),
  markRead: vi.fn(async () => {}),
  channelPolicy: vi.fn(async () => ({ broadcastMentions: 'admins', canManage: false, postingPolicy: 'everyone' })),
  smartReplies: vi.fn(async () => ['Sounds good', 'Thanks!']),
  toggleSave: vi.fn(async () => true),
  remindMe: vi.fn(),
  translate: vi.fn(async () => ({ text: 'Hola equipo', detectedLang: 'en' })),
  messageVersions: vi.fn(async () => ({ canRestore: false, versions: [{ index: 0, version: 1, text: 'Hello', state: 'ok' }, { index: null, version: 2, text: 'Hello team', state: 'ok', current: true }] })),
  createPoll: vi.fn(async (conv, poll) => msg({ id: 'p9', type: 'poll', state: 'attachment', authorId: 'me', poll: { ...poll, options: poll.options.map((t) => ({ text: t, votes: [] })), active: true, totalVotes: 0, createdBy: 'me' } })),
  sendChecklist: vi.fn(),
  convertToTask: vi.fn(),
  followThread: vi.fn(async (id, f) => ({ following: f, followerCount: 2 })),
  resolveThread: vi.fn(async () => true),
  summarizeConversation: vi.fn(async () => 'A short summary'),
  summarizeThread: vi.fn(async () => 'Thread summary'),
  savedMessages: vi.fn(async () => [{ conv: { kind: 'channel', id: 'c1', name: '#general' }, message: msg({ id: 's1', text: 'Saved one', saved: true }) }]),
  reminders: vi.fn(async () => []),
  searchMessages: vi.fn(async () => []),
  searchServer: vi.fn(async () => ({ knowledge: [{ id: 'k1', title: 'Roadmap', icon: '🗺', snippet: 'Q3' }], files: [], tasks: [], notes: [] })),
  sendMessage: vi.fn(async (conv, text) => msg({ id: 'n1', authorId: 'me', text })),
};

const mockSession = create(() => ({ user: me, workspaceId: 'w1', workspaces: [{ id: 'w1', role: 'member' }] }));
vi.mock('../../data/session.js', () => ({
  api: () => fake,
  useSession: mockSession,
  useWorkspace: () => ({ id: 'w1', role: 'member' }),
}));
vi.mock('../../data/e2ee.js', () => ({ useE2ee: create(() => ({ status: 'ready' })) }));

const { useLayout } = await import('../../app/layout.js');
const { ConversationScreen, ThreadScreen, SavedScreen } = await import('./index.js');
const { SearchScreen } = await import('../search/SearchScreen.jsx');
const { clearQueries } = await import('../../data/query.js');

const LAYOUTS = { phone: { wide: false, split: false }, split: { wide: false, split: true }, wide: { wide: true, split: true } };

beforeEach(() => {
  cleanup();
  clearQueries();
  vi.clearAllMocks();
});

describe.each(Object.keys(LAYOUTS))('chat screens (%s layout)', (layout) => {
  beforeEach(() => useLayout.setState(LAYOUTS[layout]));

  it('shows polls, checklists, code and smart replies in a conversation', async () => {
    render(<ConversationScreen kind="channel" id="c1" />);
    expect(await screen.findByTestId('poll-card')).toBeTruthy();
    expect(screen.getByTestId('checklist-card')).toBeTruthy();
    expect(screen.getByText('Ship')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeTruthy();
    expect(await screen.findByText('Sounds good')).toBeTruthy();
    // The last message is someone else's: suggestions use the decrypted transcript.
    expect(fake.smartReplies).toHaveBeenCalledWith('w1', expect.arrayContaining([expect.objectContaining({ text: expect.any(String), isMe: false })]));
  });

  it('suggests @mentions and blocks @channel when only admins may use it', async () => {
    render(<ConversationScreen kind="channel" id="c1" />);
    await screen.findByTestId('poll-card');
    const box = screen.getByPlaceholderText('Message #general');
    fireEvent.change(box, { target: { value: '@an', selectionStart: 3 } });
    expect(screen.getAllByTestId('mention-suggestion').map((b) => b.textContent)).toEqual(['ASAna Silva@ana']);
    fireEvent.change(box, { target: { value: '@ch', selectionStart: 3 } });
    await waitFor(() => expect(fake.channelPolicy).toHaveBeenCalled());
    expect(await screen.findByText('Only channel admins can use this here')).toBeTruthy();
  });

  it('creates a poll from the plus sheet', async () => {
    render(<ConversationScreen kind="channel" id="c1" />);
    await screen.findByTestId('poll-card');
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByText('Ask everyone to vote'));
    fireEvent.change(screen.getByPlaceholderText('What should we decide?'), { target: { value: 'Where?' } });
    fireEvent.change(screen.getByPlaceholderText('Option 1'), { target: { value: 'Here' } });
    fireEvent.change(screen.getByPlaceholderText('Option 2'), { target: { value: 'There' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Post poll' })));
    expect(fake.createPoll).toHaveBeenCalledWith({ kind: 'channel', id: 'c1' }, expect.objectContaining({ question: 'Where?', options: ['Here', 'There'] }));
  });

  it('summarizes the channel with AI', async () => {
    render(<ConversationScreen kind="channel" id="c1" />);
    await screen.findByTestId('poll-card');
    fireEvent.click(screen.getByRole('button', { name: 'Summarize with AI' }));
    expect(await screen.findByText('A short summary')).toBeTruthy();
    expect(fake.summarizeConversation).toHaveBeenCalledWith('w1', expect.any(Array), expect.objectContaining({ title: '#general' }));
  });

  it('opens the edit history from (edited)', async () => {
    render(<ConversationScreen kind="channel" id="c1" />);
    await screen.findByTestId('poll-card');
    fireEvent.click(screen.getByRole('button', { name: 'Edited. Show edit history' }));
    expect(await screen.findByText('Version 1')).toBeTruthy();
  });

  it('follows, resolves and lists people in a thread', async () => {
    render(<ThreadScreen kind="channel" convId="c1" messageId="m1" />);
    expect(await screen.findByText('2 people')).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Follow thread' })));
    expect(fake.followThread).toHaveBeenCalledWith('m1', true);
    fireEvent.click(screen.getByRole('button', { name: 'Thread options' }));
    await act(async () => fireEvent.click(screen.getByText('Mark as resolved')));
    expect(fake.resolveThread).toHaveBeenCalledWith('m1');
    expect(await screen.findByText(/^Resolved/)).toBeTruthy();
  });

  it('lists saved messages', async () => {
    render(<SavedScreen />);
    expect(await screen.findByText('Saved one')).toBeTruthy();
  });

  it('searches pages on the server with filters', async () => {
    render(<SearchScreen q="roadmap after:2026-01-01" />);
    expect(await screen.findByText('Roadmap')).toBeTruthy();
    expect(fake.searchServer).toHaveBeenCalledWith('w1', expect.objectContaining({ q: 'roadmap', type: 'knowledge', from: expect.any(String) }));
    expect(screen.getByRole('button', { name: /after 2026-01-01/ })).toBeTruthy();
  });
});
