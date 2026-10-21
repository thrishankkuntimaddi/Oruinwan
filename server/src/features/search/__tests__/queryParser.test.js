'use strict';

const {
    parseQuery, parseDay, textRegex, applicableKinds, dateRangeToMongo, MAX_QUERY_LENGTH,
} = require('../queryParser');

const d = (s) => new Date(`${s}T00:00:00.000Z`);

describe('parseQuery — plain text', () => {
    test('empty / non-string input', () => {
        for (const v of ['', '   ', null, undefined, 42, {}]) {
            const p = parseQuery(v);
            expect(p.text).toBe('');
            expect(p.hasFilters).toBe(false);
            expect(p.warnings).toEqual([]);
        }
    });

    test('words become terms', () => {
        const p = parseQuery('  release   notes ');
        expect(p.terms).toEqual(['release', 'notes']);
        expect(p.phrases).toEqual([]);
        expect(p.text).toBe('release notes');
        expect(p.hasFilters).toBe(false);
    });

    test('quoted phrases', () => {
        const p = parseQuery('deploy "on call rota" now');
        expect(p.terms).toEqual(['deploy', 'now']);
        expect(p.phrases).toEqual(['on call rota']);
        expect(p.text).toBe('deploy now on call rota');
    });

    test('unterminated quote runs to end', () => {
        expect(parseQuery('a "b c').phrases).toEqual(['b c']);
    });

    test('empty quotes are ignored', () => {
        const p = parseQuery('"" x');
        expect(p.phrases).toEqual([]);
        expect(p.terms).toEqual(['x']);
    });

    test('quote glued to a word splits it', () => {
        const p = parseQuery('abc"def"');
        expect(p.terms).toEqual(['abc']);
        expect(p.phrases).toEqual(['def']);
    });

    test('unknown keys and URLs stay literal text', () => {
        const p = parseQuery('ratio:3 https://x.io/a');
        expect(p.terms).toEqual(['ratio:3', 'https://x.io/a']);
        expect(p.hasFilters).toBe(false);
        expect(p.warnings).toEqual([]);
    });

    test('long input is truncated', () => {
        const p = parseQuery('a'.repeat(MAX_QUERY_LENGTH + 100));
        expect(p.text.length).toBe(MAX_QUERY_LENGTH);
    });
});

describe('parseQuery — operators', () => {
    test('from: with and without @, lower-cased, deduped', () => {
        const p = parseQuery('from:@Alice from:alice from:bob');
        expect(p.filters.from).toEqual(['alice', 'bob']);
        expect(p.text).toBe('');
        expect(p.hasFilters).toBe(true);
    });

    test('from:me', () => {
        expect(parseQuery('from:me').filters.from).toEqual(['me']);
    });

    test('in: with and without #', () => {
        expect(parseQuery('in:#Engineering in:general').filters.in).toEqual(['engineering', 'general']);
    });

    test('quoted operator values', () => {
        const p = parseQuery('in:"#Release Train" hello');
        expect(p.filters.in).toEqual(['release train']);
        expect(p.terms).toEqual(['hello']);
    });

    test('keys are case-insensitive', () => {
        const p = parseQuery('FROM:@x IS:Pinned Type:Task');
        expect(p.filters.from).toEqual(['x']);
        expect(p.filters.is).toEqual(['pinned']);
        expect(p.filters.types).toEqual(['task']);
    });

    test('has: values', () => {
        expect(parseQuery('has:file has:LINK has:image has:file').filters.has).toEqual(['file', 'link', 'image']);
    });

    test('invalid has:/is: values stay text with a warning', () => {
        const p = parseQuery('has:video is:starred');
        expect(p.filters.has).toEqual([]);
        expect(p.filters.is).toEqual([]);
        expect(p.terms).toEqual(['has:video', 'is:starred']);
        expect(p.warnings).toHaveLength(2);
    });

    test('is: values', () => {
        expect(parseQuery('is:pinned is:thread').filters.is).toEqual(['pinned', 'thread']);
    });

    test('type: aliases', () => {
        expect(parseQuery('type:page').filters.types).toEqual(['knowledge']);
        expect(parseQuery('type:people type:msg type:files type:notes').filters.types).toEqual(['user', 'message', 'file', 'note']);
        const bad = parseQuery('type:spaceship');
        expect(bad.filters.types).toEqual([]);
        expect(bad.terms).toEqual(['type:spaceship']);
    });

    test('empty operator values are text with a warning', () => {
        const p = parseQuery('from: x');
        expect(p.filters.from).toEqual([]);
        expect(p.terms).toEqual(['from:', 'x']);
        expect(p.warnings.length).toBe(1);
        expect(parseQuery('from:@').filters.from).toEqual([]);
        expect(parseQuery('in:#').filters.in).toEqual([]);
    });

    test('mixed query', () => {
        const p = parseQuery('from:@sam in:#eng "launch plan" after:2026-01-01 has:file budget');
        expect(p.filters).toMatchObject({ from: ['sam'], in: ['eng'], after: '2026-01-01', has: ['file'] });
        expect(p.terms).toEqual(['budget']);
        expect(p.phrases).toEqual(['launch plan']);
    });
});

describe('dates', () => {
    test('parseDay validates real calendar dates', () => {
        expect(parseDay('2026-02-28')).toEqual(d('2026-02-28'));
        expect(parseDay('2026-02-30')).toBeNull();
        expect(parseDay('2026-13-01')).toBeNull();
        expect(parseDay('26-1-1')).toBeNull();
        expect(parseDay('yesterday')).toBeNull();
    });

    test('before: is exclusive of the day', () => {
        expect(parseQuery('before:2026-03-10').dateRange).toEqual({ lt: d('2026-03-10') });
    });

    test('after: starts the next day', () => {
        expect(parseQuery('after:2026-03-10').dateRange).toEqual({ gte: d('2026-03-11') });
    });

    test('on: covers the whole UTC day', () => {
        expect(parseQuery('on:2026-03-10').dateRange).toEqual({ gte: d('2026-03-10'), lt: d('2026-03-11') });
    });

    test('combined filters intersect', () => {
        const p = parseQuery('after:2026-01-01 before:2026-02-01');
        expect(p.dateRange).toEqual({ gte: d('2026-01-02'), lt: d('2026-02-01') });
        expect(p.warnings).toEqual([]);
    });

    test('non-overlapping range warns', () => {
        const p = parseQuery('after:2026-02-01 before:2026-01-01');
        expect(p.warnings.join(' ')).toMatch(/overlap/);
    });

    test('invalid date is text with a warning', () => {
        const p = parseQuery('on:2026-02-31');
        expect(p.dateRange).toBeNull();
        expect(p.terms).toEqual(['on:2026-02-31']);
        expect(p.hasFilters).toBe(false);
    });

    test('later operator of the same key wins', () => {
        expect(parseQuery('before:2026-01-01 before:2026-05-01').filters.before).toBe('2026-05-01');
    });

    test('dateRangeToMongo', () => {
        expect(dateRangeToMongo(null)).toBeNull();
        expect(dateRangeToMongo({ gte: d('2026-01-01'), lt: d('2026-01-02') })).toEqual({ $gte: d('2026-01-01'), $lt: d('2026-01-02') });
    });
});

describe('textRegex', () => {
    test('null without text', () => {
        expect(textRegex(parseQuery('from:me'))).toBeNull();
    });
    test('single term is escaped and case-insensitive', () => {
        const re = textRegex(parseQuery('a.b('));
        expect(re.test('xx A.B( yy')).toBe(true);
        expect(re.test('aXb(')).toBe(false);
    });
    test('multiple terms must all appear, any order', () => {
        const re = textRegex(parseQuery('beta "release plan"'));
        expect(re.test('The release plan for Beta')).toBe(true);
        expect(re.test('release for beta')).toBe(false);
        expect(re.test('multi\nline release plan\nbeta')).toBe(true);
    });
});

describe('applicableKinds', () => {
    const kinds = (q) => applicableKinds(parseQuery(q));
    test('no operators → everything', () => {
        expect(kinds('hello')).toEqual(['message', 'task', 'note', 'file', 'knowledge', 'channel', 'user']);
    });
    test('type: restricts', () => {
        expect(kinds('type:task type:page')).toEqual(['task', 'knowledge']);
    });
    test('from: drops people', () => {
        expect(kinds('from:@a')).not.toContain('user');
    });
    test('in: keeps messages, tasks, notes', () => {
        expect(kinds('in:#eng')).toEqual(['message', 'task', 'note']);
    });
    test('has:link only messages', () => {
        expect(kinds('has:link')).toEqual(['message']);
    });
    test('has:image → messages, notes, files', () => {
        expect(kinds('has:image')).toEqual(['message', 'note', 'file']);
    });
    test('is:pinned → messages, notes; is:thread → messages', () => {
        expect(kinds('is:pinned')).toEqual(['message', 'note']);
        expect(kinds('is:thread')).toEqual(['message']);
    });
    test('dates drop people', () => {
        expect(kinds('on:2026-01-01')).not.toContain('user');
    });
    test('incompatible type + operator → nothing', () => {
        expect(kinds('type:file is:thread')).toEqual([]);
    });
});
