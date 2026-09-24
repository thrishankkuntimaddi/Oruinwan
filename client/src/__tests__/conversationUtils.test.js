import { mergeUniqueEvents, newestPersistedEvent, normalizeMessage, sameId, ATTACHMENT_TYPES } from '../hooks/conversationUtils';

describe('mergeUniqueEvents', () => {
    const ev = (id) => ({ id });
    it('appends only unseen events', () => {
        const out = mergeUniqueEvents([ev('a'), ev('b')], [ev('b'), ev('c'), ev('c')], 'append');
        expect(out.map(e => e.id)).toEqual(['a', 'b', 'c']);
    });
    it('prepends only unseen events', () => {
        const out = mergeUniqueEvents([ev('c')], [ev('a'), ev('b'), ev('c')], 'prepend');
        expect(out.map(e => e.id)).toEqual(['a', 'b', 'c']);
    });
    it('returns the same array when nothing is new', () => {
        const existing = [ev('a')];
        expect(mergeUniqueEvents(existing, [ev('a')])).toBe(existing);
    });
});

describe('newestPersistedEvent', () => {
    it('skips optimistic temp ids', () => {
        const events = [{ id: '507f1f77bcf86cd799439011' }, { id: 'temp_123' }];
        expect(newestPersistedEvent(events).id).toBe('507f1f77bcf86cd799439011');
        expect(newestPersistedEvent([{ id: 'temp' }])).toBeNull();
    });
});

describe('normalizeMessage', () => {
    it('handles attachment types at module scope', () => {
        expect(ATTACHMENT_TYPES).toContain('image');
        const n = normalizeMessage({ _id: 'x', type: 'image', attachments: [{ url: 'u' }] });
        expect(n.type).toBe('image');
        expect(n.payload.attachment).toEqual({ url: 'u' });
    });
});

describe('sameId', () => {
    it('compares strings, objects with _id, and rejects nullish', () => {
        expect(sameId('a', 'a')).toBe(true);
        expect(sameId({ _id: 'a' }, 'a')).toBe(true);
        expect(sameId(null, null)).toBe(false);
        expect(sameId('a', 'b')).toBe(false);
    });
});
