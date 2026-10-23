// Thread replies carry mentionText; editing never brings back a sent prefilled draft.
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

const { ThreadScreen } = await import('./index.js');
const { clearQueries } = await import('../../data/query.js');

const { Composer } = await import('./messages.jsx');

beforeEach(() => {
  cleanup();
  clearQueries();
  vi.clearAllMocks();
});

describe('thread replies', () => {
  it('send the plaintext @mentions with the reply (mentionText)', async () => {
    render(<ThreadScreen kind="channel" convId="c1" messageId="m1" />);
    await screen.findByText('2 people');
    const box = screen.getByPlaceholderText('Reply in thread');
    fireEvent.change(box, { target: { value: 'ping @ana please' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Send' })));
    await waitFor(() => expect(fake.sendMessage).toHaveBeenCalled());
    const [, text, opts] = fake.sendMessage.mock.calls[0];
    expect(text).toBe('ping @ana please');
    expect(opts).toEqual(expect.objectContaining({ parentId: 'm1', mentionText: expect.stringContaining('@ana') }));
  });
});

describe('Composer drafts and editing', () => {
  it('does not put a sent prefilled reply back when an edit is cancelled', async () => {
    const onSend = vi.fn();
    const props = { placeholder: 'Reply', onSend, initial: 'Prefilled reply', onCancelEdit: () => {} };
    const { rerender } = render(<Composer {...props} />);
    const box = screen.getByPlaceholderText('Reply');
    expect(box.value).toBe('Prefilled reply');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Send' })));
    expect(onSend).toHaveBeenCalledWith('Prefilled reply');
    expect(box.value).toBe('');
    // Edit the reply just sent, then cancel.
    rerender(<Composer {...props} editing editText="Prefilled reply" />);
    expect(box.value).toBe('Prefilled reply');
    rerender(<Composer {...props} editing={false} editText="" />);
    expect(box.value).toBe('');
  });

  it('puts back what was being typed when an edit ends', () => {
    const props = { placeholder: 'Reply', onSend: () => {}, onCancelEdit: () => {} };
    const { rerender } = render(<Composer {...props} />);
    const box = screen.getByPlaceholderText('Reply');
    fireEvent.change(box, { target: { value: 'half a thought' } });
    rerender(<Composer {...props} editing editText="old message" />);
    expect(box.value).toBe('old message');
    rerender(<Composer {...props} editing={false} editText="" />);
    expect(box.value).toBe('half a thought');
  });
});

describe('Composer formatting and emoji', () => {
  it('shows the formatting row on demand and wraps the selection in Markdown', async () => {
    const onSend = vi.fn();
    render(<Composer placeholder="Message" onSend={onSend} />);
    expect(screen.queryByRole('toolbar', { name: 'Formatting' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show formatting' }));
    expect(screen.getByRole('toolbar', { name: 'Formatting' })).toBeTruthy();
    const box = screen.getByPlaceholderText('Message');
    fireEvent.change(box, { target: { value: 'ship it' } });
    box.setSelectionRange(0, 4);
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(box.value).toBe('**ship** it');
    fireEvent.click(screen.getByRole('button', { name: 'Hide formatting' }));
    expect(screen.queryByRole('toolbar', { name: 'Formatting' })).toBeNull();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Send' })));
    expect(onSend).toHaveBeenCalledWith('**ship** it');
  });

  it('adds a link from its own field', () => {
    render(<Composer placeholder="Message" onSend={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show formatting' }));
    const box = screen.getByPlaceholderText('Message');
    fireEvent.change(box, { target: { value: 'see docs' } });
    box.setSelectionRange(4, 8);
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    fireEvent.change(screen.getByLabelText('Link address'), { target: { value: 'example.com/docs' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    expect(box.value).toBe('see [docs](https://example.com/docs)');
  });

  it('inserts an emoji from the web set at the caret', async () => {
    render(<Composer placeholder="Message" onSend={() => {}} />);
    const box = screen.getByPlaceholderText('Message');
    fireEvent.change(box, { target: { value: 'great job' } });
    box.setSelectionRange(5, 5);
    fireEvent.click(screen.getByRole('button', { name: 'Emoji' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Insert 🎉' }));
    expect(box.value).toBe('great🎉 job');
  });
});
