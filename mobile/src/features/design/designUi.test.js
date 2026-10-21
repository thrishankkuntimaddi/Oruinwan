import { describe, expect, it } from 'vitest';
import {
  applyAnnotationEvent, applyPresence, canDeleteAnnotation, canResolve, countsLabel, formatTime, numberAnnotations, pagesWithPins, pinFromPoint, pinPosition, visibleAnnotations,
} from './designUi.js';
import { mapAnnotation, mapReview, reviewKindOf } from '../../data/live/adapter.design.js';

describe('pins', () => {
  const rect = { left: 100, top: 50, width: 200, height: 100 };
  it('maps a tap to normalised coordinates', () => {
    expect(pinFromPoint(rect, 150, 75)).toEqual({ x: 0.25, y: 0.25 });
    expect(pinFromPoint(rect, 300, 150)).toEqual({ x: 1, y: 1 });
    expect(pinFromPoint(rect, 99, 75)).toBe(null);
    expect(pinFromPoint({ ...rect, width: 0 }, 150, 75)).toBe(null);
    expect(pinFromPoint(rect, 100 + 200 / 3, 50)).toEqual({ x: 0.3333, y: 0 });
  });
  it('draws pins as percentages, boxes at their centre', () => {
    expect(pinPosition({ x: 0.42, y: 0.18 })).toEqual({ left: '42%', top: '18%' });
    expect(pinPosition({ x: 0.2, y: 0.2, w: 0.2, h: 0.4 })).toEqual({ left: '30%', top: '40%' });
    expect(pinPosition({ x: 2, y: -1 })).toEqual({ left: '100%', top: '0%' });
  });
  it('numbers pins by creation time', () => {
    const n = numberAnnotations([{ id: 'b', at: '2026-01-02' }, { id: 'a', at: '2026-01-01' }]);
    expect(n.get('a')).toBe(1);
    expect(n.get('b')).toBe(2);
  });
});

describe('visibleAnnotations', () => {
  const list = [
    { id: '1', versionNumber: 2, page: 1, resolved: false, timeMs: 1000 },
    { id: '2', versionNumber: 2, page: 2, resolved: true, timeMs: 9000 },
    { id: '3', versionNumber: 1, page: 1, resolved: false },
  ];
  it('filters by version, page (PDF), playhead (video) and resolved', () => {
    expect(visibleAnnotations(list, { versionNumber: 2, kind: 'image' }).map((a) => a.id)).toEqual(['1', '2']);
    expect(visibleAnnotations(list, { versionNumber: 2, kind: 'pdf', page: 2 }).map((a) => a.id)).toEqual(['2']);
    expect(visibleAnnotations(list, { versionNumber: 2, kind: 'video', timeMs: 1200 }).map((a) => a.id)).toEqual(['1']);
    expect(visibleAnnotations(list, { versionNumber: 2, showResolved: false }).map((a) => a.id)).toEqual(['1']);
  });
  it('counts pins per page', () => {
    expect(pagesWithPins(list)).toEqual([{ page: 1, total: 2, open: 2 }, { page: 2, total: 1, open: 0 }]);
  });
});

describe('live events', () => {
  const list = [mapAnnotation({ _id: 'a1', body: 'one', x: 0.1, y: 0.1 })];
  it('upserts and deletes annotations', () => {
    const created = applyAnnotationEvent(list, { action: 'created', annotation: { _id: 'a2', body: 'two', x: 0.5, y: 0.5 } }, mapAnnotation);
    expect(created.map((a) => a.id)).toEqual(['a1', 'a2']);
    const resolved = applyAnnotationEvent(created, { action: 'resolved', annotation: { _id: 'a1', body: 'one', resolved: true } }, mapAnnotation);
    expect(resolved[0].resolved).toBe(true);
    expect(resolved).toHaveLength(2);
    expect(applyAnnotationEvent(resolved, { action: 'deleted', annotation: { _id: 'a2' } }, mapAnnotation).map((a) => a.id)).toEqual(['a1']);
    expect(applyAnnotationEvent(list, { action: 'created' }, mapAnnotation)).toBe(list);
  });
  it('tracks viewers, never me', () => {
    let v = applyPresence([], { userId: 'u1', action: 'joined' }, 'me');
    v = applyPresence(v, { userId: 'me', action: 'joined' }, 'me');
    expect(v).toEqual(['u1']);
    expect(applyPresence(v, { userId: 'u1', action: 'left' }, 'me')).toEqual([]);
  });
});

describe('permissions and labels', () => {
  const review = { creator: { id: 'c' }, reviewers: [{ user: { id: 'r' }, decision: 'pending' }], permissions: { canManage: false } };
  const a = { author: { id: 'au' } };
  it('resolve: author, creator, reviewer', () => {
    expect(canResolve(a, review, 'au')).toBe(true);
    expect(canResolve(a, review, 'c')).toBe(true);
    expect(canResolve(a, review, 'r')).toBe(true);
    expect(canResolve(a, review, 'x')).toBe(false);
  });
  it('delete: author or managers', () => {
    expect(canDeleteAnnotation(a, review, 'au')).toBe(true);
    expect(canDeleteAnnotation(a, review, 'r')).toBe(false);
    expect(canDeleteAnnotation(a, { ...review, permissions: { canManage: true } }, 'c')).toBe(true);
  });
  it('labels', () => {
    expect(countsLabel({ total: 3, open: 1 })).toBe('1 open · 3 comments');
    expect(countsLabel({ total: 0, open: 0 })).toBe('No comments yet');
    expect(formatTime(75_400)).toBe('1:15');
  });
});

describe('design adapter mapping', () => {
  it('maps a review with its file, version and permissions', () => {
    const r = mapReview({
      _id: 'd1', workspaceId: 'w1', fileId: 'f1', versionNumber: 2, title: 'Home', status: 'changes_requested',
      createdBy: { _id: 'u1', username: 'ana' }, reviewers: [{ user: { _id: 'u2', username: 'bo' }, decision: 'changes_requested', note: 'Fix' }],
      rounds: [{ versionNumber: 1 }, { versionNumber: 2 }], annotationCounts: { total: 3, open: 1 },
      file: { _id: 'f1', name: 'home.png', mimeType: 'image/png', currentVersion: 3 },
      version: { versionNumber: 2, url: '/api/v2/uploads/file?path=a', mimeType: 'image/png' },
      permissions: { canManage: true, canDecide: false },
    });
    expect(r).toMatchObject({ id: 'd1', fileId: 'f1', versionNumber: 2, status: 'changes_requested', counts: { total: 3, open: 1 }, permissions: { canManage: true, canDecide: false } });
    expect(r.file).toMatchObject({ kind: 'image', currentVersion: 3 });
    expect(r.reviewers[0]).toMatchObject({ user: { id: 'u2', name: 'bo' }, decision: 'changes_requested', note: 'Fix' });
    expect(r.version.url).toContain('/api/v2/uploads/file');
  });
  it('maps annotations and kinds', () => {
    const a = mapAnnotation({ _id: 'a', x: '0.5', y: 0.25, page: 3, authorId: { _id: 'u', username: 'u' }, replies: [{ _id: 'r', body: 'ok', authorId: 'u' }] });
    expect(a).toMatchObject({ id: 'a', x: 0.5, y: 0.25, page: 3, timeMs: null, resolved: false });
    expect(a.replies[0]).toMatchObject({ id: 'r', body: 'ok', author: { id: 'u' } });
    expect(reviewKindOf('application/pdf')).toBe('pdf');
    expect(reviewKindOf('video/mp4')).toBe('video');
    expect(reviewKindOf('text/plain')).toBe(null);
  });
});
