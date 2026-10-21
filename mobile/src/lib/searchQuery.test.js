import { describe, expect, it } from 'vitest';
import { dateRange, filterValue, freeText, isEmptyQuery, matchMessage, parseDay, parseSearchQuery, serverParams, setFilter } from './searchQuery.js';
import { clearMessageIndex, indexMessages, nameConversation, searchIndex } from '../data/live/messageIndex.js';

describe('phone message index with a parsed query', () => {
  it('matches decrypted messages and attachments by filters', () => {
    clearMessageIndex();
    nameConversation('c1', { kind: 'channel', name: '#release', ws: 'w1' });
    indexMessages({ kind: 'channel', id: 'c1' }, [
      { id: 'a', state: 'ok', text: 'notes at https://x.y', authorId: 'u1', at: '2026-01-10T10:00:00Z', pinned: true },
      { id: 'b', state: 'attachment', text: 'plan.pdf', authorId: 'u2', at: '2026-01-11T10:00:00Z', attachments: [{ type: 'file', mimeType: 'application/pdf' }] },
      { id: 'c', state: 'locked', text: '', authorId: 'u2', at: '2026-01-12T10:00:00Z' },
    ]);
    const ctx = { usernameOf: (id) => ({ u1: 'ana', u2: 'ben' })[id] };
    const find = (q) => searchIndex('w1', (m, conv) => matchMessage(m, conv, parseSearchQuery(q), ctx)).map((m) => m.id);
    expect(find('has:link in:#release')).toEqual(['a']);
    expect(find('has:file')).toEqual(['b']);
    expect(find('from:@ben')).toEqual(['b']);
    expect(find('is:pinned')).toEqual(['a']);
    expect(searchIndex('w1', 'notes').map((m) => m.id)).toEqual(['a']);
    clearMessageIndex();
  });
});

describe('parseSearchQuery', () => {
  it('reads every filter', () => {
    const q = parseSearchQuery('deploy from:@Ana in:#release before:2026-02-01 after:2026-01-01 has:link is:pinned type:message "go live"');
    expect(q.terms).toEqual(['deploy']);
    expect(q.phrases).toEqual(['go live']);
    expect(q.from).toEqual(['ana']);
    expect(q.in).toEqual(['release']);
    expect(q.before).toBe('2026-02-01');
    expect(q.after).toBe('2026-01-01');
    expect(q.has).toEqual(['link']);
    expect(q.is).toEqual(['pinned']);
    expect(q.type).toBe('message');
  });

  it('accepts names without @ and #, and on:', () => {
    const q = parseSearchQuery('from:ana in:general on:2026-03-04');
    expect(q.from).toEqual(['ana']);
    expect(q.in).toEqual(['general']);
    expect(q.on).toBe('2026-03-04');
  });

  it('keeps unknown keys and bad values as words', () => {
    const q = parseSearchQuery('time:10 has:video type:song is:');
    expect(q.terms).toEqual(['time:10', 'has:video', 'type:song', 'is:']);
    expect(q.has).toEqual([]);
    expect(q.type).toBeNull();
  });

  it('reports dates that are not real days', () => {
    const q = parseSearchQuery('before:2026-02-30 after:yesterday');
    expect(q.before).toBeNull();
    expect(q.after).toBeNull();
    expect(q.errors).toHaveLength(2);
  });

  it('handles an unfinished quote and empty input', () => {
    expect(parseSearchQuery('"half open').phrases).toEqual(['half open']);
    expect(isEmptyQuery(parseSearchQuery('   '))).toBe(true);
    expect(isEmptyQuery(parseSearchQuery('is:pinned'))).toBe(false);
  });

  it('collects free text', () => {
    expect(freeText(parseSearchQuery('roadmap "q3 plan" from:@x'))).toBe('roadmap q3 plan');
  });
});

describe('dates', () => {
  it('parses calendar days', () => {
    expect(parseDay('2026-01-31')).toBeInstanceOf(Date);
    expect(parseDay('2026-13-01')).toBeNull();
    expect(parseDay('31-01-2026')).toBeNull();
  });

  it('turns on/after/before into a range', () => {
    const on = dateRange(parseSearchQuery('on:2026-01-15'));
    expect(new Date(on.from).getDate()).toBe(15);
    expect(new Date(on.to).getDate()).toBe(15);
    const between = dateRange(parseSearchQuery('after:2026-01-01 before:2026-01-10'));
    expect(new Date(between.from).getDate()).toBe(2);
    expect(new Date(between.to).getDate()).toBe(9);
    expect(dateRange(parseSearchQuery('hello'))).toEqual({ from: null, to: null });
  });
});

describe('matchMessage', () => {
  const ctx = { usernameOf: (id) => ({ u1: 'ana', u2: 'ben' })[id], nameOf: (id) => ({ u1: 'Ana Silva', u2: 'Ben Ode' })[id] };
  const channel = { kind: 'channel', name: '#release' };
  const dm = { kind: 'dm', name: 'Ben Ode' };
  const m = (over = {}) => ({ id: 'm', text: 'Ship it: https://example.com/notes', authorId: 'u1', at: new Date(2026, 0, 15, 12).toISOString(), ...over });

  it('matches words and phrases', () => {
    expect(matchMessage(m(), channel, parseSearchQuery('ship'), ctx)).toBe(true);
    expect(matchMessage(m(), channel, parseSearchQuery('"ship it"'), ctx)).toBe(true);
    expect(matchMessage(m(), channel, parseSearchQuery('"it ship"'), ctx)).toBe(false);
  });

  it('filters by person and channel', () => {
    expect(matchMessage(m(), channel, parseSearchQuery('from:@ana'), ctx)).toBe(true);
    expect(matchMessage(m(), channel, parseSearchQuery('from:anasilva'), ctx)).toBe(true);
    expect(matchMessage(m(), channel, parseSearchQuery('from:@ben'), ctx)).toBe(false);
    expect(matchMessage(m(), channel, parseSearchQuery('in:#release'), ctx)).toBe(true);
    expect(matchMessage(m(), dm, parseSearchQuery('in:#release'), ctx)).toBe(false);
  });

  it('filters by date', () => {
    expect(matchMessage(m(), channel, parseSearchQuery('on:2026-01-15'), ctx)).toBe(true);
    expect(matchMessage(m(), channel, parseSearchQuery('before:2026-01-15'), ctx)).toBe(false);
    expect(matchMessage(m(), channel, parseSearchQuery('after:2026-01-14'), ctx)).toBe(true);
  });

  it('filters by has: and is:', () => {
    expect(matchMessage(m(), channel, parseSearchQuery('has:link'), ctx)).toBe(true);
    expect(matchMessage(m({ text: 'no link' }), channel, parseSearchQuery('has:link'), ctx)).toBe(false);
    expect(matchMessage(m(), channel, parseSearchQuery('has:file'), ctx)).toBe(false);
    expect(matchMessage(m({ attachments: [{ type: 'image', mimeType: 'image/png' }] }), channel, parseSearchQuery('has:image'), ctx)).toBe(true);
    expect(matchMessage(m({ pinned: true }), channel, parseSearchQuery('is:pinned'), ctx)).toBe(true);
    expect(matchMessage(m(), channel, parseSearchQuery('is:thread'), ctx)).toBe(false);
    expect(matchMessage(m({ replyCount: 2 }), channel, parseSearchQuery('is:thread'), ctx)).toBe(true);
  });

  it('skips messages when another type is asked for', () => {
    expect(matchMessage(m(), channel, parseSearchQuery('ship type:task'), ctx)).toBe(false);
  });
});

describe('serverParams and chip helpers', () => {
  it('builds /api/search params', () => {
    const p = serverParams(parseSearchQuery('budget on:2026-01-15'), 'knowledge');
    expect(p).toMatchObject({ q: 'budget', type: 'knowledge', semantic: 'false' });
    expect(p.from).toBeTruthy();
    expect(p.to).toBeTruthy();
  });

  it('sets and reads filters in the text', () => {
    let text = setFilter('budget "q3 plan" ', 'from', '@ana');
    expect(text).toBe('budget "q3 plan" from:@ana ');
    text = setFilter(text, 'from', '@ben');
    expect(filterValue(text, 'from')).toBe('@ben');
    expect(setFilter(text, 'from', '')).toBe('budget "q3 plan" ');
  });
});
