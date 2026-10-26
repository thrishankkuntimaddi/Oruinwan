// Test cases for the shared motion logic, run by both the web and the phone test suites.
import { createArrivals, rose } from './arrivals.js';

const at = (s) => new Date(Date.UTC(2026, 9, 26, 10, 0, s)).toISOString();

export function defineMotionTests({ describe, it, expect }) {
    describe('new messages (arrivals)', () => {
        it('the history a conversation opens with is not new', () => {
            const a = createArrivals();
            expect([...a.update([])]).toEqual([]);
            expect([...a.update([{ id: 'm1', at: at(1) }, { id: 'm2', at: at(2) }])]).toEqual([]);
        });
        it('a message that arrives afterwards is new', () => {
            const a = createArrivals();
            a.update([{ id: 'm1', at: at(1) }]);
            expect([...a.update([{ id: 'm1', at: at(1) }, { id: 'm2', at: at(5) }])]).toEqual(['m2']);
        });
        it('older messages loaded by scrolling up are not new', () => {
            const a = createArrivals();
            a.update([{ id: 'm5', at: at(50) }]);
            expect([...a.update([{ id: 'm1', at: at(1) }, { id: 'm5', at: at(50) }])]).toEqual([]);
        });
        it('a sent message animates once: its saved copy replacing it does not animate again', () => {
            const a = createArrivals();
            a.update([{ id: 'm1', at: at(1) }]);
            expect(a.update([{ id: 'm1', at: at(1) }, { id: 'tmp-1', at: at(9) }]).has('tmp-1')).toBe(true);
            const after = a.update([{ id: 'm1', at: at(1) }, { id: 'm9', tempId: 'tmp-1', at: at(9) }]);
            expect(after.has('m9')).toBe(false);
        });
        it('knows when a count went up', () => {
            expect(rose(1, 2)).toBe(true);
            expect(rose(2, 2)).toBe(false);
            expect(rose(3, 0)).toBe(false);
            expect(rose(undefined, 1)).toBe(true);
        });
    });
}
