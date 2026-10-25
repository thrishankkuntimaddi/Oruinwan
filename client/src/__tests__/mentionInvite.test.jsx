// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

vi.mock('../services/messageService', () => ({ messageService: { getDMMessages: vi.fn() } }));
vi.mock('../services/messageEncryptionService', () => ({ batchDecryptMessages: vi.fn() }));
import { mentionCandidates, mentionedOutsiders, outsidersSentence } from '../features/messaging/mentionInvite';

const ws = [
  { _id: 'u1', username: 'teja' },
  { _id: 'u2', username: 'nikhil' },
  { _id: 'u3', username: 'yasin' },
  { _id: 'me', username: 'nani' },
];

describe('mentioning people outside the channel', () => {
  it('suggests channel members first, then the rest of the workspace', () => {
    const list = mentionCandidates([{ user: { _id: 'u1', username: 'teja' } }], ws);
    expect(list.map((m) => m.username)).toEqual(['teja', 'nikhil', 'yasin', 'nani']);
  });

  it('finds who was mentioned but is not in the channel', () => {
    const out = mentionedOutsiders('@nikhil is new, say hi @teja @here @ai @nobody', ws, ['u1', 'me'], 'me');
    expect(out.map((p) => p.username)).toEqual(['nikhil']);
  });

  it('says it plainly', () => {
    expect(outsidersSentence([{ username: 'nikhil' }], 'design')).toBe("@nikhil isn't in #design.");
    expect(outsidersSentence([{ username: 'a' }, { username: 'b' }, { username: 'c' }], 'x')).toBe("@a, @b and @c aren't in #x.");
  });
});
