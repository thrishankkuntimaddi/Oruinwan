import { describe, it, expect } from 'vitest';
import {
    quarterOf, quarterKey, parseQuarterKey, addQuarters, quarterStart, quarterEnd,
    itemSpan, buildRange, dateToPct, pctToDate, barGeometry, pxToDays, applyDrag,
    groupItems, progressOf, progressLabel, colorVar, isoDay,
} from '../pages/roadmap/roadmapTimeline';

describe('roadmap quarter math', () => {
    it('finds the quarter of a date', () => {
        expect(quarterOf('2026-01-01T00:00:00Z')).toEqual({ year: 2026, q: 1 });
        expect(quarterOf('2026-11-15T00:00:00Z')).toEqual({ year: 2026, q: 4 });
        expect(quarterOf('nope')).toBeNull();
    });
    it('round-trips quarter keys and wraps years', () => {
        expect(quarterKey({ year: 2026, q: 3 })).toBe('2026-Q3');
        expect(parseQuarterKey('2026-Q3')).toEqual({ year: 2026, q: 3 });
        expect(parseQuarterKey('2026-Q5')).toBeNull();
        expect(addQuarters({ year: 2026, q: 4 }, 1)).toEqual({ year: 2027, q: 1 });
        expect(addQuarters({ year: 2026, q: 1 }, -1)).toEqual({ year: 2025, q: 4 });
        expect(quarterStart({ year: 2026, q: 2 }).toISOString()).toBe('2026-04-01T00:00:00.000Z');
        expect(quarterEnd({ year: 2026, q: 4 }).toISOString()).toBe('2027-01-01T00:00:00.000Z');
    });
});

describe('itemSpan', () => {
    it('uses dates, falls back to the quarter, or is unscheduled', () => {
        expect(isoDay(itemSpan({ startDate: '2026-02-01', endDate: '2026-03-01' }).start)).toBe('2026-02-01');
        const q = itemSpan({ quarter: '2026-Q2' });
        expect(isoDay(q.start)).toBe('2026-04-01');
        expect(isoDay(q.end)).toBe('2026-06-30');
        expect(q.fromQuarter).toBe(true);
        expect(itemSpan({})).toBeNull();
    });
    it('gives a single date a two week bar', () => {
        const s = itemSpan({ startDate: '2026-02-01' });
        expect(isoDay(s.end)).toBe('2026-02-14');
    });
});

describe('buildRange and positions', () => {
    const now = new Date('2026-05-10T00:00:00Z');
    it('covers today and at least four quarters', () => {
        const r = buildRange([], now);
        expect(r.quarters.map((q) => q.key)).toEqual(['2026-Q2', '2026-Q3', '2026-Q4', '2027-Q1']);
    });
    it('extends to the items', () => {
        const r = buildRange([{ startDate: '2025-11-01', endDate: '2026-01-10' }, { quarter: '2027-Q3' }], now);
        expect(r.quarters[0].key).toBe('2025-Q4');
        expect(r.quarters[r.quarters.length - 1].key).toBe('2027-Q3');
    });
    it('maps dates to percentages and back', () => {
        const r = buildRange([], new Date('2026-01-15T00:00:00Z'), { minQuarters: 4 });
        expect(dateToPct(r.start, r)).toBe(0);
        expect(dateToPct(r.end, r)).toBe(100);
        expect(dateToPct('2030-01-01', r)).toBe(100);
        expect(isoDay(pctToDate(dateToPct('2026-07-01', r), r))).toBe('2026-07-01');
    });
    it('computes bar geometry', () => {
        const r = buildRange([], new Date('2026-01-15T00:00:00Z'));
        const g = barGeometry({ quarter: '2026-Q1' }, r);
        expect(g.left).toBe(0);
        expect(g.width).toBeCloseTo(25, 0);
        expect(barGeometry({}, r)).toBeNull();
    });
});

describe('dragging', () => {
    const r = buildRange([], new Date('2026-01-15T00:00:00Z'));
    it('converts pixels to days', () => {
        expect(pxToDays(0, 1000, r)).toBe(0);
        expect(pxToDays(1000, 1000, r)).toBe(365);
        expect(pxToDays(10, 0, r)).toBe(0);
    });
    const item = { startDate: '2026-02-01', endDate: '2026-02-10' };
    it('moves both dates', () => {
        expect(applyDrag(item, 'move', 5)).toEqual({ startDate: '2026-02-06', endDate: '2026-02-15' });
    });
    it('resizes an edge but never past the other', () => {
        expect(applyDrag(item, 'end', 3)).toEqual({ startDate: '2026-02-01', endDate: '2026-02-13' });
        expect(applyDrag(item, 'start', 20)).toEqual({ startDate: '2026-02-10', endDate: '2026-02-10' });
        expect(applyDrag(item, 'end', -30)).toEqual({ startDate: '2026-02-01', endDate: '2026-02-01' });
    });
    it('returns null for unscheduled items', () => {
        expect(applyDrag({}, 'move', 1)).toBeNull();
    });
});

describe('lanes and progress', () => {
    const items = [
        { _id: 'a', status: 'done', order: 2, ownerId: { _id: 'u2', username: 'zed' } },
        { _id: 'b', status: 'planned', order: 1, ownerId: { _id: 'u1', username: 'ada' } },
        { _id: 'c', order: 0, ownerId: null },
    ];
    it('groups by status keeping every lane', () => {
        const lanes = groupItems(items, 'status');
        expect(lanes.map((l) => l.key)).toEqual(['planned', 'in_progress', 'at_risk', 'done']);
        expect(lanes[0].items.map((i) => i._id)).toEqual(['c', 'b']);
        expect(lanes[3].items.map((i) => i._id)).toEqual(['a']);
    });
    it('groups by owner, alphabetical, no owner last', () => {
        const lanes = groupItems(items, 'owner');
        expect(lanes.map((l) => l.label)).toEqual(['ada', 'zed', 'No owner']);
    });
    it('reads progress', () => {
        expect(progressOf({ progress: { percent: 67.4 } })).toBe(67);
        expect(progressOf({ status: 'done' })).toBe(100);
        expect(progressOf({})).toBe(0);
        expect(progressLabel({ progress: { tasks: { total: 3, done: 2 } } })).toBe('2/3 tasks done');
        expect(progressLabel({ progress: { tasks: { total: 0 }, milestones: { total: 2, completed: 1 } } })).toBe('1/2 milestones complete');
        expect(progressLabel({})).toBe('Nothing linked yet');
    });
    it('maps colours to theme tokens only', () => {
        expect(colorVar('color-success')).toBe('var(--color-success)');
        expect(colorVar('#ff00ff')).toBe('var(--accent)');
    });
});
