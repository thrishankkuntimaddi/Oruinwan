// @mentions in the AI tab: suggestions while typing, a structured mention (with our DM,
// decrypted on the phone) sent with the question, chips, and what was sent shown back.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { create } from 'zustand';
import { mapAiActions, mentionParts, peopleInText, withTranscripts } from '../../lib/aiPeople.js';

const me = { id: 'me', name: 'Thrishank', username: 'thrishank' };
const members = [me, { id: 'u-muz', name: 'Muzamil Ahmed', username: 'muzamil' }, { id: 'u-maya', name: 'Maya Rao', username: 'maya' }];

const known = {
  members: vi.fn(async () => members),
  assistants: vi.fn(async () => [{ id: 'default', name: 'Oruinwan AI' }]),
  aiMentionTranscript: vi.fn(async () => [{ from: 'Muzamil Ahmed', isMe: false, text: 'invoice approved', at: '2026-10-12' }]),
  aiAsk: vi.fn(async () => ({
    text: 'Done, I told Muzamil.',
    actions: mapAiActions([{ function: 'send_direct_message', parameters: {}, result: { success: true, to: 'Muzamil Ahmed', toUserId: 'u-muz', sent: 'The build is green', dmSessionId: 'dm1' } }]),
    sources: [],
  })),
};
// Everything else the screen may touch (history, quota…) answers with nothing.
const fake = new Proxy(known, { get: (t, k) => (k in t ? t[k] : k === 'askKnowledge' ? undefined : vi.fn(async () => null)) });

const mockSession = create(() => ({ user: me, workspaceId: 'w1', workspaces: [{ id: 'w1', role: 'member' }] }));
vi.mock('../../data/session.js', () => ({
  api: () => fake,
  useSession: mockSession,
  useWorkspace: () => ({ id: 'w1', role: 'member' }),
}));
vi.mock('../../data/e2ee.js', () => ({ useE2ee: create(() => ({ status: 'ready' })) }));
vi.mock('./aiHistory.js', () => ({
  saveConversation: vi.fn(), listConversations: vi.fn(async () => []), openConversation: vi.fn(), renameConversation: vi.fn(), deleteConversation: vi.fn(),
}));

const { AiScreen } = await import('./AiScreen.jsx');
const { clearQueries } = await import('../../data/query.js');

beforeEach(() => {
  cleanup();
  clearQueries();
  vi.clearAllMocks();
});

describe('aiPeople helpers', () => {
  it('finds picked and typed people, skipping assistants, strangers and me', () => {
    expect(peopleInText('@ai tell @Muzamil and @nobody, cc @thrishank', { people: members, me: 'me' })).toEqual([
      { id: 'u-muz', name: 'Muzamil Ahmed', username: 'muzamil' },
    ]);
  });

  it('splits text into chips for mentioned people only', () => {
    expect(mentionParts('hi @muzamil and @maya', [{ id: 'u-muz', username: 'muzamil' }])).toEqual([
      'hi ', { person: { id: 'u-muz', username: 'muzamil' }, text: '@muzamil' }, ' and @maya',
    ]);
  });

  it('adds a transcript only when one is available', async () => {
    const out = await withTranscripts([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], async (p) => (p.id === 'a' ? [{ text: 'x' }] : []));
    expect(out).toEqual([{ id: 'a', name: 'A', transcript: [{ text: 'x' }] }, { id: 'b', name: 'B' }]);
    expect(await withTranscripts([{ id: 'a', name: 'A' }], async () => { throw new Error('locked'); })).toEqual([{ id: 'a', name: 'A' }]);
  });

  it('labels actions from the server result, failures included', () => {
    expect(mapAiActions([
      { function: 'send_direct_message', result: { success: true, to: 'Muzamil', toUserId: 'u', sent: 'hi', dmSessionId: 'd' } },
      { function: 'send_direct_message', result: { success: false, error: "You can't send messages to Bea." } },
      { function: 'create_task', result: { success: true } },
    ])).toEqual([
      { ok: true, label: 'Sent to Muzamil', sent: { to: 'Muzamil', toUserId: 'u', text: 'hi', dmId: 'd' } },
      { ok: false, label: 'Sent a message', error: "You can't send messages to Bea." },
      { ok: true, label: 'Created a task' },
    ]);
  });
});

describe('AI tab composer', () => {
  it('suggests people on @, sends the picked person as a structured mention and shows what was sent', async () => {
    render(<AiScreen />);
    const box = screen.getByLabelText('Message Oruinwan AI');
    await waitFor(() => expect(known.members).toHaveBeenCalled());
    fireEvent.change(box, { target: { value: 'tell @mu', selectionStart: 8 } });
    const option = await screen.findByText('Muzamil Ahmed');
    fireEvent.click(option);
    expect(box.value).toBe('tell @muzamil ');
    fireEvent.change(box, { target: { value: 'tell @muzamil the build is green', selectionStart: 32 } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Send' })));
    await waitFor(() => expect(known.aiAsk).toHaveBeenCalled());
    expect(known.aiMentionTranscript).toHaveBeenCalledWith('w1', 'u-muz');
    const opts = known.aiAsk.mock.calls[0][2];
    expect(opts.mentions).toEqual([{ id: 'u-muz', name: 'Muzamil Ahmed', transcript: [{ from: 'Muzamil Ahmed', isMe: false, text: 'invoice approved', at: '2026-10-12' }] }]);
    // The question shows the person as a chip; the answer shows exactly what was sent.
    expect(screen.getByTestId('ai-person-chip').textContent).toBe('@muzamil');
    const sent = await screen.findByTestId('ai-sent-message');
    expect(sent.textContent).toContain('Muzamil Ahmed');
    expect(sent.textContent).toContain('The build is green');
  });

  it('sends no mentions for a plain question', async () => {
    render(<AiScreen />);
    const box = screen.getByLabelText('Message Oruinwan AI');
    fireEvent.change(box, { target: { value: 'what is on my plate?', selectionStart: 20 } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Send' })));
    await waitFor(() => expect(known.aiAsk).toHaveBeenCalled());
    expect(known.aiAsk.mock.calls[0][2].mentions).toEqual([]);
    expect(known.aiMentionTranscript).not.toHaveBeenCalled();
  });
});
