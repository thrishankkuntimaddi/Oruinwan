import { describe, expect, it } from 'vitest';
import { chatSections } from './chatGroups.js';

const channels = [
  { id: 'c1', name: 'general', isMember: true, unread: 3, lastAt: '2026-10-24T10:00:00Z' },
  { id: 'c2', name: 'random', isMember: true, unread: 0, lastAt: '2026-10-24T11:00:00Z' },
  { id: 'c3', name: 'muted', isMember: true, unread: 5, muted: true, lastAt: '2026-10-24T09:00:00Z' },
  { id: 'c4', name: 'other', isMember: false, unread: 0 },
];
const dms = [
  { id: 'd1', user: { name: 'Ana' }, unread: 1, lastAt: '2026-10-24T12:00:00Z' },
  { id: 'd2', user: { name: 'Ben' }, unread: 0 },
  { id: 'd3', user: { name: 'Helper' }, unread: 2, agentId: 'default' },
];

describe('chatSections', () => {
  it('keeps unread conversations in their own sections', () => {
    const s = chatSections({ channels, dms });
    expect(s.channels.map((c) => c.id)).toEqual(['c2', 'c1', 'c3']);
    expect(s.dms.map((d) => d.id)).toEqual(['d1', 'd2']);
  });

  it('mirrors unread ones (not muted) in Unread, newest first', () => {
    const s = chatSections({ channels, dms });
    expect(s.unread.map((u) => `${u.kind}:${u.item.id}`)).toEqual(['dm:d1', 'channel:c1']);
  });

  it('filters every section by the search', () => {
    const s = chatSections({ channels, dms, query: 'an' });
    expect(s.dms.map((d) => d.id)).toEqual(['d1']);
    expect(s.channels.map((c) => c.id)).toEqual(['c2']); // r-an-dom
  });

  it('copes with lists that have not loaded yet', () => {
    expect(chatSections({ channels: null, dms: undefined })).toEqual({ channels: [], dms: [], unread: [] });
  });
});
