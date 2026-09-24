import { diffWords, hasChanges } from '../utils/textDiff';

const render = (segs) => segs.map(s => (s.type === 'same' ? s.text : s.type === 'added' ? `[+${s.text}]` : `[-${s.text}]`)).join('');

describe('diffWords', () => {
    it('returns a single same segment for identical text', () => {
        const segs = diffWords('hello world', 'hello world');
        expect(segs).toEqual([{ type: 'same', text: 'hello world' }]);
        expect(hasChanges(segs)).toBe(false);
    });

    it('detects a replaced word', () => {
        expect(render(diffWords('the quick fox', 'the slow fox'))).toBe('the [-quick][+slow] fox');
    });

    it('detects appended and removed words', () => {
        expect(render(diffWords('a b', 'a b c'))).toBe('a b[+ c]');
        expect(render(diffWords('a b c', 'a c'))).toBe('a [-b ]c');
    });

    it('handles empty sides', () => {
        expect(diffWords('', 'new text')).toEqual([{ type: 'added', text: 'new text' }]);
        expect(diffWords('old', '')).toEqual([{ type: 'removed', text: 'old' }]);
        expect(diffWords('', '')).toEqual([]);
    });

    it('reconstructs both texts from the segments', () => {
        const a = 'Meet at 5pm in room 12 tomorrow';
        const b = 'Meet at 6pm in room 14, tomorrow please';
        const segs = diffWords(a, b);
        expect(segs.filter(s => s.type !== 'added').map(s => s.text).join('')).toBe(a);
        expect(segs.filter(s => s.type !== 'removed').map(s => s.text).join('')).toBe(b);
        expect(hasChanges(segs)).toBe(true);
    });
});
