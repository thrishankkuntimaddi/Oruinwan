import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

const mockAdapter = { votePoll: vi.fn(), closePoll: vi.fn(), toggleChecklistItem: vi.fn() };
vi.mock('../../data/session.js', () => ({ api: () => mockAdapter, useSession: { getState: () => ({ workspaceId: 'w1' }) } }));

const { PollCard, ChecklistCard, applyVote } = await import('./rich.jsx');
const { languageOf } = await import('../../ui/highlight.js');

const poll = (votes = [[], []]) => ({
  question: 'Lunch?',
  options: [
    { text: 'Pizza', votes: votes[0] },
    { text: 'Salad', votes: votes[1] },
  ],
  allowMultiple: false,
  anonymous: false,
  endDate: null,
  active: true,
  totalVotes: new Set(votes.flat().map((v) => v.id)).size,
  createdBy: 'u1',
});

beforeEach(() => vi.clearAllMocks());

describe('applyVote', () => {
  it('moves my vote and recounts voters', () => {
    const p = applyVote(poll([[{ id: 'me' }, { id: 'u2' }], []]), 'me', [1]);
    expect(p.options[0].votes.map((v) => v.id)).toEqual(['u2']);
    expect(p.options[1].votes.map((v) => v.id)).toEqual(['me']);
    expect(p.totalVotes).toBe(2);
  });
});

describe('PollCard', () => {
  it('shows the result right away and keeps the server answer', async () => {
    let resolve;
    mockAdapter.votePoll.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<PollCard m={{ id: 'p1', poll: poll() }} me="me" directory={{}} />);
    fireEvent.click(screen.getByRole('button', { name: /Pizza/ }));
    expect(screen.getByRole('button', { name: /Pizza/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('100%')).toBeTruthy();
    expect(mockAdapter.votePoll).toHaveBeenCalledWith(null, 'p1', [0]);
    await act(async () => resolve(poll([[{ id: 'me' }, { id: 'u2' }], [{ id: 'u3' }]])));
    expect(screen.getByText('67%')).toBeTruthy();
  });

  it('rolls back when the vote fails', async () => {
    mockAdapter.votePoll.mockRejectedValue(new Error('closed'));
    render(<PollCard m={{ id: 'p1', poll: poll() }} me="me" directory={{}} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Salad/ })));
    expect(screen.getByRole('button', { name: /Salad/ }).getAttribute('aria-pressed')).toBe('false');
  });

  it('lets only the creator end it', () => {
    const { rerender } = render(<PollCard m={{ id: 'p1', poll: poll() }} me="u1" directory={{}} />);
    expect(screen.getByRole('button', { name: 'End poll' })).toBeTruthy();
    rerender(<PollCard m={{ id: 'p1', poll: poll() }} me="u2" directory={{}} />);
    expect(screen.queryByRole('button', { name: 'End poll' })).toBeNull();
  });
});

describe('ChecklistCard', () => {
  it('shows the decrypted labels and ticks an item', async () => {
    mockAdapter.toggleChecklistItem.mockResolvedValue([{ checked: true }, { checked: false }]);
    render(<ChecklistCard m={{ id: 'k1', state: 'ok', text: '{"title":"Launch","items":["Docs","Tweet"]}', checklist: [{ checked: false }, { checked: false }] }} />);
    expect(screen.getByText('Launch')).toBeTruthy();
    expect(screen.getByText('0 of 2 done')).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('checkbox', { name: /Docs/ })));
    expect(mockAdapter.toggleChecklistItem).toHaveBeenCalledWith(null, 'k1', 0);
    expect(screen.getByText('1 of 2 done')).toBeTruthy();
  });
});

describe('code languages', () => {
  it('maps fences to highlight.js languages', () => {
    expect(languageOf('js')).toBe('javascript');
    expect(languageOf('TSX')).toBe('typescript');
    expect(languageOf('python title="x"')).toBe('python');
    expect(languageOf('brainfuck')).toBeNull();
    expect(languageOf('')).toBeNull();
  });
});
