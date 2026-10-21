import { describe, it, expect } from 'vitest';
import {
    parseSearchQuery, buildSearchQuery, queryChips, setQueryOperator, removeQueryOperator,
    matchesMessage, hasOperators, isValidDay, dayKey,
} from '../utils/searchQuery';

describe('parseSearchQuery', () => {
    it('reads every operator and keeps free text', () => {
        const p = parseSearchQuery('budget from:@alice in:#general before:2026-03-01 after:2026-01-01 has:file is:pinned type:message "q1 plan"');
        expect(p).toMatchObject({
            terms: ['budget'], phrases: ['q1 plan'], from: ['alice'], in: ['#general'],
            before: '2026-03-01', after: '2026-01-01', on: null, has: ['file'], is: ['pinned'], type: ['message'],
            text: 'budget "q1 plan"',
        });
    });

    it('accepts from: without @, on:, and upper-case keys and values', () => {
        const p = parseSearchQuery('FROM:bob On:2026-02-03 HAS:Image IS:Thread TYPE:Page');
        expect(p).toMatchObject({ from: ['bob'], on: '2026-02-03', has: ['image'], is: ['thread'], type: ['page'], terms: [] });
    });

    it('keeps unknown keys and invalid values as plain words', () => {
        const p = parseSearchQuery('foo:bar has:video before:2026-02-30 type:song https://x.io 10:30');
        expect(p.terms).toEqual(['foo:bar', 'has:video', 'before:2026-02-30', 'type:song', 'https://x.io', '10:30']);
        expect(hasOperators(p)).toBe(false);
    });

    it('supports quoted operator values and unclosed quotes', () => {
        expect(parseSearchQuery('in:"#design team" from:"@mary ann"')).toMatchObject({ in: ['#design team'], from: ['mary ann'] });
        expect(parseSearchQuery('"open phrase').phrases).toEqual(['open phrase']);
    });

    it('dedupes repeated list values and lets the last date win', () => {
        const p = parseSearchQuery('from:@a from:@A after:2026-01-01 after:2026-02-01');
        expect(p.from).toEqual(['a']);
        expect(p.after).toBe('2026-02-01');
    });

    it('handles empty input', () => {
        expect(parseSearchQuery('')).toMatchObject({ terms: [], phrases: [], text: '' });
        expect(parseSearchQuery(null).text).toBe('');
    });
});

describe('building and editing queries', () => {
    it('round-trips through buildSearchQuery', () => {
        const q = 'from:@alice in:#general type:task has:link is:thread after:2026-01-01 before:2026-02-01 budget "q1 plan"';
        expect(buildSearchQuery(parseSearchQuery(q))).toBe(q);
        expect(parseSearchQuery(buildSearchQuery(parseSearchQuery('from:"@mary ann" hi')))).toMatchObject({ from: ['mary ann'], terms: ['hi'] });
    });

    it('lists chips for the operators', () => {
        expect(queryChips('hi from:@bob in:#dev on:2026-01-02')).toEqual([
            { key: 'from', value: 'bob', label: 'from: @bob' },
            { key: 'in', value: '#dev', label: 'in: #dev' },
            { key: 'on', value: '2026-01-02', label: 'on: 2026-01-02' },
        ]);
    });

    it('sets, replaces and removes operators', () => {
        expect(setQueryOperator('budget', 'from', '@alice')).toBe('from:@alice budget');
        expect(setQueryOperator('from:@alice budget', 'from', 'bob')).toBe('from:@alice from:@bob budget');
        expect(setQueryOperator('type:task budget', 'type', 'note', { replace: true })).toBe('type:note budget');
        expect(setQueryOperator('after:2026-01-01 x', 'on', '2026-01-05')).toBe('on:2026-01-05 x');
        expect(setQueryOperator('on:2026-01-05 x', 'before', '2026-02-01')).toBe('before:2026-02-01 x');
        expect(setQueryOperator('type:task x', 'type', '')).toBe('x');
        expect(removeQueryOperator('from:@a from:@b x', 'from', 'a')).toBe('from:@b x');
        expect(removeQueryOperator('from:@a from:@b x', 'from')).toBe('x');
        expect(removeQueryOperator('on:2026-01-05 "a b"', 'on')).toBe('"a b"');
    });

    it('validates calendar days', () => {
        expect(isValidDay('2026-02-28')).toBe(true);
        expect(isValidDay('2026-02-29')).toBe(false);
        expect(isValidDay('2026-1-1')).toBe(false);
        expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
        expect(dayKey('nope')).toBeNull();
    });
});

describe('matchesMessage', () => {
    const msg = {
        text: 'Budget draft at https://docs.example.com',
        sender: { username: 'Alice' },
        createdAt: new Date(2026, 1, 10, 12).toISOString(),
        attachments: [{ name: 'chart.png', mimeType: 'image/png' }],
        isPinned: true,
    };
    const channel = { type: 'channel', name: 'general' };
    const m = (q, message = msg, conv = channel) => matchesMessage(parseSearchQuery(q), message, conv);

    it('matches words, phrases and attachment names', () => {
        expect(m('budget docs')).toBe(true);
        expect(m('"budget draft"')).toBe(true);
        expect(m('"draft budget"')).toBe(false);
        expect(m('chart')).toBe(true);
    });

    it('filters by person, place and date', () => {
        expect(m('from:@alice')).toBe(true);
        expect(m('from:@bob')).toBe(false);
        expect(m('in:#general')).toBe(true);
        expect(m('in:#random')).toBe(false);
        expect(m('in:@general')).toBe(false);
        expect(m('in:@alice', msg, { type: 'dm', name: 'alice' })).toBe(true);
        expect(m('on:2026-02-10')).toBe(true);
        expect(m('after:2026-02-09 before:2026-02-11')).toBe(true);
        expect(m('after:2026-02-10')).toBe(false);
        expect(m('before:2026-02-10')).toBe(false);
    });

    it('filters by has:, is: and type:', () => {
        expect(m('has:link has:image has:file is:pinned')).toBe(true);
        expect(m('is:thread')).toBe(false);
        expect(m('is:thread', { ...msg, threadParentId: 'p1' })).toBe(true);
        expect(m('has:file', { ...msg, attachments: [] })).toBe(false);
        expect(m('has:image', { ...msg, attachments: [{ name: 'a.pdf', mimeType: 'application/pdf' }] })).toBe(false);
        expect(m('has:link', { ...msg, text: 'no links here' })).toBe(false);
        expect(m('type:task')).toBe(false);
        expect(m('type:message budget')).toBe(true);
    });
});
