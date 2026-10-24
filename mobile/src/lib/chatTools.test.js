import { describe, expect, it } from 'vitest';
import { applyMention, canBroadcast, mentionAt, mentionSuggestions, mentionTextFor } from './mentions.js';
import { wordDiff } from './textDiff.js';
import { customReminder, reminderLabel, reminderPresets } from './reminders.js';

const people = [
  { id: 'me', name: 'Me Myself', username: 'me' },
  { id: 'u1', name: 'Ana Silva', username: 'ana' },
  { id: 'u2', name: 'Andre Costa', username: 'andre' },
  { id: 'u3', name: 'Ben Ode', username: 'ben' },
];
const channels = [
  { id: 'c1', name: 'general', isMember: true },
  { id: 'c2', name: 'design', isMember: false },
  { id: 'c3', name: 'dev', isMember: true },
];

describe('mentions', () => {
  it('finds the mention being typed', () => {
    expect(mentionAt('hi @an', 6)).toEqual({ trigger: '@', query: 'an', start: 3, end: 6 });
    expect(mentionAt('see #de', 7)).toMatchObject({ trigger: '#', query: 'de' });
    expect(mentionAt('mail a@b', 8)).toBeNull();
    expect(mentionAt('done', 4)).toBeNull();
  });

  it('suggests people (not me), then @channel/@here in channels', () => {
    const s = mentionSuggestions(mentionAt('@'), { people, me: 'me', inChannel: true });
    expect(s.filter((x) => x.kind === 'person').map((x) => x.id)).toEqual(['u1', 'u2', 'u3']);
    expect(s.filter((x) => x.kind === 'broadcast').map((x) => x.insert)).toEqual(['@channel', '@here']);
    const an = mentionSuggestions(mentionAt('@an'), { people, me: 'me', inChannel: true });
    expect(an.map((x) => x.id)).toEqual(['u1', 'u2']);
    expect(mentionSuggestions(mentionAt('@ch'), { people, inChannel: false })).toEqual([]);
  });

  it('marks @channel unavailable when only admins may use it', () => {
    const s = mentionSuggestions(mentionAt('@he'), { people, inChannel: true, allowBroadcast: false });
    expect(s[0]).toMatchObject({ insert: '@here', disabled: true });
    expect(canBroadcast({ broadcastMentions: 'admins' }, {})).toBe(false);
    expect(canBroadcast({ broadcastMentions: 'admins' }, { canManage: true })).toBe(true);
    expect(canBroadcast({ broadcastMentions: 'admins' }, { workspaceRole: 'owner' })).toBe(true);
    expect(canBroadcast({ broadcastMentions: 'everyone' }, {})).toBe(true);
    expect(canBroadcast(null)).toBe(true);
  });

  it('suggests channels for #', () => {
    expect(mentionSuggestions(mentionAt('#de'), { channels }).map((x) => x.insert)).toEqual(['#dev', '#design']);
  });

  it('inserts a suggestion', () => {
    const text = 'hey @an how';
    const at = mentionAt(text, 7);
    expect(applyMention(text, at, { insert: '@ana' })).toEqual({ text: 'hey @ana how', caret: 9 });
  });

  it('collects handles for the server', () => {
    const names = new Set(['ana', 'ben']);
    expect(mentionTextFor('@ana and @ben, also @nobody and email x@ana.com @channel', names)).toBe('@ana @ben @channel');
    expect(mentionTextFor('@here please', names, { allowBroadcast: false })).toBe('');
    expect(mentionTextFor('no mentions', names)).toBe('');
    // @everyone is sent too (the server treats it as @channel), only when broadcasts are allowed.
    expect(mentionTextFor('heads up @everyone', names)).toBe('@everyone');
    expect(mentionTextFor('heads up @everyone', names, { allowBroadcast: false })).toBe('');
  });
});

describe('wordDiff', () => {
  it('marks added and removed words', () => {
    expect(wordDiff('ship it today', 'ship it tomorrow')).toEqual([
      { type: 'same', text: 'ship it ' },
      { type: 'del', text: 'today' },
      { type: 'add', text: 'tomorrow' },
    ]);
    expect(wordDiff('', 'new')).toEqual([{ type: 'add', text: 'new' }]);
    expect(wordDiff('same', 'same')).toEqual([{ type: 'same', text: 'same' }]);
  });

  it('falls back to replace for very long texts', () => {
    expect(wordDiff('a b c', 'd e f', { maxCells: 2 })).toEqual([
      { type: 'del', text: 'a b c' },
      { type: 'add', text: 'd e f' },
    ]);
  });
});

describe('reminders', () => {
  it('offers presets in the future', () => {
    const now = new Date(2026, 0, 14, 10, 0); // a Wednesday morning
    const presets = reminderPresets(now);
    expect(presets.map((p) => p.id)).toEqual(['20m', '1h', '3h', 'evening', 'tomorrow', 'monday']);
    expect(presets.every((p) => p.at > now)).toBe(true);
    const monday = presets.find((p) => p.id === 'monday').at;
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(19);
    expect(reminderPresets(new Date(2026, 0, 14, 20)).some((p) => p.id === 'evening')).toBe(false);
    // On a Monday, "next Monday" is a week later.
    expect(reminderPresets(new Date(2026, 0, 19, 8)).find((p) => p.id === 'monday').at.getDate()).toBe(26);
  });

  it('validates custom times', () => {
    const now = new Date(2026, 0, 14, 10, 0);
    expect(customReminder('2026-01-15', '08:30', now)).toEqual(new Date(2026, 0, 15, 8, 30));
    expect(customReminder('2026-01-13', '08:30', now)).toBeNull();
    expect(customReminder('2026-02-31', '08:30', now)).toBeNull();
    expect(customReminder('bad', '08:30', now)).toBeNull();
  });

  it('labels times', () => {
    const now = new Date(2026, 0, 14, 10, 0);
    expect(reminderLabel(new Date(2026, 0, 14, 18), now)).toMatch(/^Today /);
    expect(reminderLabel(new Date(2026, 0, 15, 9), now)).toMatch(/^Tomorrow /);
  });
});
