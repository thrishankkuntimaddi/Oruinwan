import { describe, expect, it } from 'vitest';
import { allChats, archivedChats, chatListFor, previewText, segmentCounts } from './chatList.js';
import { chatListTime } from '../../lib/time.js';

const at = (min) => new Date(Date.UTC(2026, 9, 25, 12, 0) - min * 60_000).toISOString();
const channels = [
  { id: 'c1', name: 'general', isMember: true, unread: 0, lastAt: at(5) },
  { id: 'c2', name: 'design', isMember: true, unread: 3, lastAt: at(30), lastText: 'hi', lastSender: { id: 'u2', name: 'Ben Carter' } },
  { id: 'c3', name: 'nope', isMember: false, lastAt: at(1) },
];
const dms = [
  { id: 'd1', user: { name: 'Ben' }, unread: 2, lastAt: at(3), lastText: 'yo', lastSender: { id: 'me' } },
  { id: 'd2', user: { name: 'Claude' }, agentId: 'claude', unread: 1, lastAt: at(10) },
];

describe('chat list', () => {
  it('mixes channels, DMs and agents newest first, leaving out channels I am not in', () => {
    expect(chatListFor(allChats(channels, dms)).map((r) => r.key)).toEqual(['dm:d1', 'channel:c1', 'dm:d2', 'channel:c2']);
  });

  it('pinned chats come first, in the order pinned; archived ones leave the list', () => {
    const prefs = new Map([
      ['channel:c2', { pinnedAt: '2026-10-25T10:00:00Z' }],
      ['dm:d2', { pinnedAt: '2026-10-25T09:00:00Z' }],
      ['channel:c1', { archivedAt: '2026-10-25T09:00:00Z' }],
    ]);
    const rows = allChats(channels, dms, prefs);
    expect(chatListFor(rows).map((r) => r.key)).toEqual(['dm:d2', 'channel:c2', 'dm:d1']);
    expect(archivedChats(rows).map((r) => r.key)).toEqual(['channel:c1']);
  });

  it('filters by segment and counts unread per segment', () => {
    const rows = allChats(channels, dms);
    expect(chatListFor(rows, 'channels').map((r) => r.key)).toEqual(['channel:c1', 'channel:c2']);
    expect(chatListFor(rows, 'dms').map((r) => r.key)).toEqual(['dm:d1']);
    expect(chatListFor(rows, 'agents').map((r) => r.key)).toEqual(['dm:d2']);
    expect(segmentCounts(rows)).toEqual({ all: 6, channels: 3, dms: 2, agents: 1 });
  });

  it('previews say who wrote the last message in channels, and "You" for mine', () => {
    const rows = allChats(channels, dms);
    const plain = (t) => t;
    expect(previewText(rows.find((r) => r.key === 'channel:c2'), 'me', plain)).toBe('Ben: hi');
    expect(previewText(rows.find((r) => r.key === 'dm:d1'), 'me', plain)).toBe('You: yo');
    expect(previewText(rows.find((r) => r.key === 'dm:d2'), 'me', plain)).toBe('New message');
  });
});

describe('chat list time', () => {
  const now = new Date(2026, 9, 25, 15, 30).getTime();
  it('shows the time today, Yesterday, then dd/mm/yyyy', () => {
    expect(chatListTime(new Date(2026, 9, 25, 9, 5), now)).toMatch(/9.05|09.05/);
    expect(chatListTime(new Date(2026, 9, 24, 23, 59), now)).toBe('Yesterday');
    expect(chatListTime(new Date(2026, 9, 23, 8, 0), now)).toBe('23/10/2026');
    expect(chatListTime(new Date(2025, 0, 2, 8, 0), now)).toBe('02/01/2025');
  });
});
