import { describe, expect, it } from 'vitest';
import { conversationMenuItems, matchExcerpt, searchConversation } from './conversationMenu.js';

const ids = (opts) => conversationMenuItems(opts).map((i) => i.id);

describe('conversationMenuItems (the web header menu, on the phone)', () => {
  it('a DM: name → profile, reminders, pinned, saved, mute; ⋮ → search, video, block, clear, delete', () => {
    expect(ids({ kind: 'dm', huddles: true })).toEqual(['profile', 'reminders', 'pinned', 'saved', 'mute', 'search', 'video', 'block', 'clear', 'delete']);
    const sections = Object.fromEntries(conversationMenuItems({ kind: 'dm', huddles: true }).map((i) => [i.id, i.section]));
    expect(sections).toMatchObject({ profile: 'hub', mute: 'hub', search: 'actions', block: 'actions', delete: 'actions' });
  });

  it('a channel: name → info, members, threads, pinned, saved, reminders, mute; ⋮ → search, poll, video', () => {
    expect(ids({ kind: 'channel', huddles: true, polls: true })).toEqual(['channelInfo', 'members', 'threads', 'reminders', 'pinned', 'saved', 'mute', 'search', 'poll', 'video']);
  });

  it('no option appears twice and the voice huddle is only the header button', () => {
    for (const opts of [{ kind: 'dm', huddles: true }, { kind: 'channel', huddles: true, polls: true }, { kind: 'dm', isGroup: true, huddles: true }]) {
      const list = ids(opts);
      expect(new Set(list).size).toBe(list.length);
      expect(list).not.toContain('voice');
      expect(list).not.toContain('huddle');
    }
  });

  it('a group DM offers group info instead of profile and block', () => {
    const list = ids({ kind: 'dm', isGroup: true, huddles: true });
    expect(list).toContain('groupInfo');
    expect(list).not.toContain('profile');
    expect(list).not.toContain('block');
    expect(list).toContain('clear');
  });

  it('leaves out what is unavailable: calls without huddles, polls without permission, threads when off, calls with an agent', () => {
    expect(ids({ kind: 'channel', threads: false })).toEqual(['channelInfo', 'members', 'reminders', 'pinned', 'saved', 'mute', 'search']);
    const agent = ids({ kind: 'dm', isAgent: true, huddles: true });
    expect(agent).not.toContain('video');
    expect(agent).not.toContain('profile');
    expect(agent).not.toContain('block');
  });

  it('labels follow state, and destructive actions ask first', () => {
    const items = conversationMenuItems({ kind: 'dm', muted: true, blocked: true });
    const by = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(by.mute.label).toBe('Unmute notifications');
    expect(by.block.label).toBe('Unblock user');
    expect(by.block.confirm).toBe(false);
    expect(by.clear).toMatchObject({ danger: true, confirm: true });
    expect(by.delete).toMatchObject({ danger: true, confirm: true });
    const fresh = Object.fromEntries(conversationMenuItems({ kind: 'dm' }).map((i) => [i.id, i]));
    expect(fresh.mute.label).toBe('Mute notifications');
    expect(fresh.block).toMatchObject({ label: 'Block user', confirm: true });
  });
});

describe('searchConversation', () => {
  const items = [
    { id: 'a', text: 'Deploy on Friday', state: 'ok' },
    { id: 'b', text: 'locked', state: 'locked' },
    { id: 'c', text: 'friday lunch?', state: 'ok' },
    { id: 'd', text: 'Friday draft', state: 'ok', pending: true },
    { id: 'e', text: '', state: 'ok', attachments: [{ name: 'friday-notes.pdf' }] },
  ];
  it('finds decrypted, sent messages (and file names), newest first, case-insensitively', () => {
    expect(searchConversation(items, 'FRIDAY').map((m) => m.id)).toEqual(['e', 'c', 'a']);
  });
  it('returns nothing for an empty query', () => {
    expect(searchConversation(items, '  ')).toEqual([]);
  });
});

describe('matchExcerpt', () => {
  it('cuts around the match', () => {
    const text = `${'x'.repeat(100)} the needle here ${'y'.repeat(100)}`;
    const out = matchExcerpt(text, 'needle', 10);
    expect(out.startsWith('…')).toBe(true);
    expect(out.endsWith('…')).toBe(true);
    expect(out).toContain('needle');
  });
  it('keeps short text whole', () => {
    expect(matchExcerpt('hello   world', 'world')).toBe('hello world');
  });
});
