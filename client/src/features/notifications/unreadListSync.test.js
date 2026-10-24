import { describe, it, expect } from 'vitest';
import { missingUnreadIds, idsToReloadFor } from './unreadListSync';

describe('missingUnreadIds', () => {
    const unread = { 'dm:d1': 2, 'dm:d2': 0, 'dm:d3': 1, 'channel:c1': 4, 'channel:c2': 1 };

    it('finds unread conversations the section does not list', () => {
        expect(missingUnreadIds(unread, 'dm', ['d1'])).toEqual(['d3']);
        expect(missingUnreadIds(unread, 'channel', ['c1'])).toEqual(['c2']);
    });

    it('ignores read conversations and other types', () => {
        expect(missingUnreadIds(unread, 'dm', ['d1', 'd3'])).toEqual([]);
        expect(missingUnreadIds({ 'channel:c9': 1 }, 'dm', [])).toEqual([]);
        expect(missingUnreadIds(null, 'dm', [])).toEqual([]);
    });

    it('compares ids as strings', () => {
        expect(missingUnreadIds({ 'dm:42': 1 }, 'dm', [42])).toEqual([]);
    });
});

describe('idsToReloadFor', () => {
    it('reloads for each missing conversation once', () => {
        const tried = new Set();
        expect(idsToReloadFor(['a', 'b'], tried)).toEqual(['a', 'b']);
        expect(idsToReloadFor(['a', 'b'], tried)).toEqual([]);
        expect(idsToReloadFor(['b', 'c'], tried)).toEqual(['c']);
    });
});
