import {
    getMessageText, isBookmarkedBy, toggleBookmarkedBy, hasEditHistory,
    taskTitleFromText, resolveReminderPreset,
} from '../utils/messageActionUtils';

describe('getMessageText', () => {
    it('prefers decrypted content over empty E2EE text', () => {
        expect(getMessageText({ text: '', decryptedContent: 'secret' })).toBe('secret');
        expect(getMessageText({ payload: { text: 'p' } })).toBe('p');
        expect(getMessageText(null)).toBe('');
    });
});

describe('bookmark optimistic toggle', () => {
    it('adds the user when not bookmarked', () => {
        const res = toggleBookmarkedBy(['u2'], 'u1');
        expect(res).toEqual({ bookmarked: true, bookmarkedBy: ['u2', 'u1'] });
        expect(isBookmarkedBy(res.bookmarkedBy, 'u1')).toBe(true);
    });

    it('removes the user (object or string ids) when bookmarked', () => {
        const res = toggleBookmarkedBy([{ _id: 'u1' }, 'u2'], 'u1');
        expect(res.bookmarked).toBe(false);
        expect(res.bookmarkedBy).toEqual(['u2']);
    });

    it('handles missing lists', () => {
        expect(toggleBookmarkedBy(undefined, 'u1')).toEqual({ bookmarked: true, bookmarkedBy: ['u1'] });
        expect(isBookmarkedBy(undefined, 'u1')).toBe(false);
    });

    it('toggling twice restores the original list (revert path)', () => {
        const original = ['u2'];
        const once = toggleBookmarkedBy(original, 'u1');
        const twice = toggleBookmarkedBy(once.bookmarkedBy, 'u1');
        expect(twice.bookmarkedBy).toEqual(original);
    });
});

describe('hasEditHistory', () => {
    it('detects edits from any signal', () => {
        expect(hasEditHistory({})).toBe(false);
        expect(hasEditHistory({ editHistory: [{}] })).toBe(true);
        expect(hasEditHistory({ version: 2 })).toBe(true);
        expect(hasEditHistory({ editedAt: '2026-01-01' })).toBe(true);
    });
});

describe('taskTitleFromText', () => {
    it('uses the first non-empty line capped at 120 chars', () => {
        expect(taskTitleFromText('\n  Fix login  \nmore details')).toBe('Fix login');
        const long = 'x'.repeat(200);
        expect(taskTitleFromText(long)).toHaveLength(120);
    });
});

describe('resolveReminderPreset', () => {
    const now = new Date(2026, 8, 24, 15, 30); // Thu 24 Sep 2026 15:30 local
    it('resolves relative presets', () => {
        expect(resolveReminderPreset('20m', now).getTime() - now.getTime()).toBe(20 * 60000);
        expect(resolveReminderPreset('3h', now).getTime() - now.getTime()).toBe(3 * 3600000);
    });
    it('resolves tomorrow 9:00 and next Monday 9:00', () => {
        const t = resolveReminderPreset('tomorrow', now);
        expect([t.getDate(), t.getHours(), t.getMinutes()]).toEqual([25, 9, 0]);
        const w = resolveReminderPreset('nextweek', now);
        expect(w.getDay()).toBe(1);
        expect([w.getDate(), w.getHours()]).toEqual([28, 9]);
        const monday = new Date(2026, 8, 28, 8, 0);
        expect(resolveReminderPreset('nextweek', monday).getDate()).toBe(5); // Oct 5
    });
});
