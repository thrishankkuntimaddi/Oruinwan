import { describe, it, expect } from 'vitest';
import { parseSearchQuery, matchesMessage, queryChips, utcDayKey, MAX_TOKENS } from '../utils/searchQuery';
import { currentSearchUser } from '../services/searchService';

// Mirrors the server parser rules in docs/api/search.md.
describe('search syntax matches the server parser', () => {
    it('splits a quote out of the middle of a word', () => {
        const p = parseSearchQuery('abc"def" xyz');
        expect(p.terms).toEqual(['abc', 'xyz']);
        expect(p.phrases).toEqual(['def']);
    });

    it('treats an unknown key with a quoted value as a word and a phrase', () => {
        const p = parseSearchQuery('ratio:"3 to 1"');
        expect(p.terms).toEqual(['ratio:']);
        expect(p.phrases).toEqual(['3 to 1']);
    });

    it('accepts the server type aliases', () => {
        expect(parseSearchQuery('type:docs type:people type:msg type:channels').type).toEqual(['page', 'person', 'message', 'channel']);
        expect(parseSearchQuery('type:song').terms).toEqual(['type:song']);
    });

    it('lower-cases operator values like the server, so chips show what was searched', () => {
        const p = parseSearchQuery('from:@Sam in:#Eng');
        expect(p.from).toEqual(['sam']);
        expect(p.in).toEqual(['#eng']);
        expect(queryChips(p).map(c => c.label)).toEqual(['from: @sam', 'in: #eng']);
    });

    it('reads at most 64 tokens and 512 characters', () => {
        const many = Array.from({ length: 80 }, (_, i) => `w${i}`).join(' ');
        expect(parseSearchQuery(many).terms).toHaveLength(MAX_TOKENS);
        expect(parseSearchQuery('a'.repeat(600)).terms[0]).toHaveLength(512);
    });

    it('compares dates as UTC days', () => {
        const p = parseSearchQuery('on:2026-03-10');
        // 23:30 UTC on the 10th is still the 10th for the server, whatever the local zone.
        expect(matchesMessage(p, { text: 'x', createdAt: '2026-03-10T23:30:00Z' })).toBe(true);
        expect(matchesMessage(p, { text: 'x', createdAt: '2026-03-11T00:30:00Z' })).toBe(false);
        expect(utcDayKey('2026-03-10T23:30:00Z')).toBe('2026-03-10');
        expect(matchesMessage(parseSearchQuery('after:2026-03-10'), { text: 'x', createdAt: '2026-03-10T23:59:00Z' })).toBe(false);
        expect(matchesMessage(parseSearchQuery('before:2026-03-10'), { text: 'x', createdAt: '2026-03-09T23:59:00Z' })).toBe(true);
    });

    it('matches from:me against the signed-in user', () => {
        const p = parseSearchQuery('from:me budget');
        const msg = { text: 'Budget draft', sender: { _id: 'u1', username: 'ada' } };
        expect(matchesMessage(p, msg, {}, { id: 'u1' })).toBe(true);
        expect(matchesMessage(p, msg, {}, { username: 'ADA' })).toBe(true);
        expect(matchesMessage(p, msg, {}, { id: 'u2', username: 'bob' })).toBe(false);
        expect(matchesMessage(p, msg, {}, null)).toBe(false);
    });

    it('reads the signed-in user from the access token', () => {
        const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
        expect(currentSearchUser(`h.${b64({ sub: 'u1', username: 'ada' })}.s`)).toEqual({ id: 'u1', username: 'ada' });
        expect(currentSearchUser('nope')).toBeNull();
        expect(currentSearchUser(null)).toBeNull();
    });
});
