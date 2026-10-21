import { describe, it, expect } from 'vitest';
import {
    normalisePoint, normaliseRect, annotationStyle, isPin, formatTimestamp, visibleOn,
    sortAnnotations, applyAnnotationEvent, reviewKind,
} from '../pages/designReview/reviewGeometry';

const rect = { left: 100, top: 50, width: 400, height: 200 };

describe('normalisePoint', () => {
    it('maps pixels to 0..1 of the frame and clamps', () => {
        expect(normalisePoint(300, 150, rect)).toEqual({ x: 0.5, y: 0.5 });
        expect(normalisePoint(0, 0, rect)).toEqual({ x: 0, y: 0 });
        expect(normalisePoint(9999, 9999, rect)).toEqual({ x: 1, y: 1 });
        expect(normalisePoint(10, 10, { width: 0, height: 0 })).toEqual({ x: 0, y: 0 });
    });
});

describe('normaliseRect', () => {
    it('handles any drag direction', () => {
        expect(normaliseRect({ x: 0.6, y: 0.5 }, { x: 0.2, y: 0.1 })).toEqual({ x: 0.2, y: 0.1, w: 0.4, h: 0.4 });
    });
    it('turns a click into a pin', () => {
        expect(normaliseRect({ x: 0.3, y: 0.3 }, { x: 0.302, y: 0.301 })).toEqual({ x: 0.3, y: 0.3, w: 0, h: 0 });
    });
    it('never exceeds the frame', () => {
        const r = normaliseRect({ x: 0.7, y: 0.9 }, { x: 1.4, y: 1.2 });
        expect(r.x + r.w).toBeLessThanOrEqual(1);
        expect(r.y + r.h).toBeLessThanOrEqual(1);
    });
});

describe('display helpers', () => {
    it('positions boxes and pins in percent', () => {
        expect(annotationStyle({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 })).toEqual({ left: '10%', top: '20%', width: '30%', height: '40%' });
        expect(annotationStyle({ x: 0.5, y: 0.5, w: 0, h: 0 })).toEqual({ left: '50%', top: '50%' });
        expect(isPin({ w: 0, h: 0 })).toBe(true);
        expect(isPin({ w: 0.2, h: 0 })).toBe(false);
    });
    it('formats video timestamps', () => {
        expect(formatTimestamp(0)).toBe('0:00');
        expect(formatTimestamp(65_400)).toBe('1:05');
        expect(formatTimestamp(3_725_000)).toBe('1:02:05');
        expect(formatTimestamp(null)).toBe('');
    });
    it('shows annotations on their page and near their time', () => {
        expect(visibleOn({ page: 2 }, { kind: 'pdf', page: 2 })).toBe(true);
        expect(visibleOn({ page: 2 }, { kind: 'pdf', page: 1 })).toBe(false);
        expect(visibleOn({ timeMs: 5000 }, { kind: 'video', timeMs: 6000 })).toBe(true);
        expect(visibleOn({ timeMs: 5000 }, { kind: 'video', timeMs: 9000 })).toBe(false);
        expect(visibleOn({ timeMs: null }, { kind: 'video', timeMs: 9000 })).toBe(true);
    });
    it('detects reviewable kinds', () => {
        expect(reviewKind('image/png')).toBe('image');
        expect(reviewKind('application/pdf')).toBe('pdf');
        expect(reviewKind('video/mp4')).toBe('video');
        expect(reviewKind('text/plain')).toBeNull();
    });
});

describe('annotation lists', () => {
    it('sorts open first, then by time', () => {
        const out = sortAnnotations([
            { _id: 'r', resolved: true, createdAt: '2026-01-01' },
            { _id: 'b', timeMs: 3000, createdAt: '2026-01-02' },
            { _id: 'a', timeMs: 1000, createdAt: '2026-01-03' },
        ]);
        expect(out.map((a) => a._id)).toEqual(['a', 'b', 'r']);
    });
    it('applies live events', () => {
        let list = [{ _id: '1', body: 'x', resolved: false }];
        list = applyAnnotationEvent(list, { action: 'created', annotation: { _id: '2', body: 'y' } });
        expect(list.map((a) => a._id)).toEqual(['1', '2']);
        list = applyAnnotationEvent(list, { action: 'resolved', annotation: { _id: '1', resolved: true } });
        expect(list[0]).toEqual({ _id: '1', body: 'x', resolved: true });
        list = applyAnnotationEvent(list, { action: 'deleted', annotation: { _id: '2' } });
        expect(list.map((a) => a._id)).toEqual(['1']);
        expect(applyAnnotationEvent(list, {})).toBe(list);
    });
});
