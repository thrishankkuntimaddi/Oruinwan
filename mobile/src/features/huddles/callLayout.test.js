// The call screen's layout maths: grid shapes, pages, the filmstrip and the self-view window.
import { describe, expect, it } from 'vitest';
import {
  FALLBACK_SIZE,
  GAP,
  clampPage,
  cornerPosition,
  gridLayout,
  gridShape,
  nearestCorner,
  orderForGrid,
  pageCapacity,
  pageCount,
  pageOf,
  pickSpeaker,
  resolveView,
  selfViewSize,
  stageLayout,
  stripVisibleRange,
} from './callLayout.js';

const PORTRAIT = { width: 390, height: 640 }; // a phone's stage between the top bar and the controls
const LANDSCAPE = { width: 780, height: 300 };
const TABLET = { width: 800, height: 1000 };

const shape = (n, stage) => {
  const { cols, rows } = gridShape(n, stage);
  return `${cols}x${rows}`;
};

/** Every person appears on exactly one page, in order. */
function allPages(count, stage) {
  const seen = [];
  const pages = pageCount(count, stage);
  for (let p = 0; p < pages; p += 1) {
    const g = gridLayout({ ...stage, count, page: p });
    expect(g.rects).toHaveLength(g.end - g.start);
    for (let i = g.start; i < g.end; i += 1) seen.push(i);
  }
  return seen;
}

describe('grid shapes', () => {
  it('portrait phone: full, stacked, 2×2, 2×3', () => {
    expect([1, 2, 3, 4, 5, 6].map((n) => shape(n, PORTRAIT))).toEqual(['1x1', '1x2', '2x2', '2x2', '2x3', '2x3']);
  });

  it('landscape phone: full, side by side, a row of three, 2×2, 3×2', () => {
    expect([1, 2, 3, 4, 5, 6].map((n) => shape(n, LANDSCAPE))).toEqual(['1x1', '2x1', '3x1', '2x2', '3x2', '3x2']);
  });

  it('tablets fit up to 12 a page', () => {
    expect(pageCapacity(TABLET)).toBe(12);
    expect(shape(9, TABLET)).toBe('3x3');
    expect(shape(12, TABLET)).toBe('3x4');
    expect(shape(12, { width: 1000, height: 700 })).toBe('4x3');
  });

  it('an unmeasured stage falls back to a phone in portrait', () => {
    expect(pageCapacity({ width: 0, height: 0 })).toBe(6);
    expect(shape(2, {})).toBe('1x2');
    expect(gridLayout({ count: 1 }).rects[0]).toEqual({ x: 0, y: 0, w: FALLBACK_SIZE.width, h: FALLBACK_SIZE.height });
  });
});

describe('grid pages for 1…25 people', () => {
  for (const [name, stage] of [
    ['portrait', PORTRAIT],
    ['landscape', LANDSCAPE],
    ['tablet', TABLET],
  ]) {
    it(`${name}: nobody is dropped, nothing overlaps, tiles stay on the stage`, () => {
      for (let n = 1; n <= 25; n += 1) {
        const cap = pageCapacity(stage);
        expect(pageCount(n, stage)).toBe(Math.ceil(n / cap));
        expect(allPages(n, stage)).toEqual(Array.from({ length: n }, (_, i) => i));
        for (let p = 0; p < pageCount(n, stage); p += 1) {
          const { rects, tileWidth, tileHeight } = gridLayout({ ...stage, count: n, page: p });
          expect(tileWidth).toBeGreaterThan(0);
          expect(tileHeight).toBeGreaterThan(0);
          for (const r of rects) {
            expect(r.x).toBeGreaterThanOrEqual(-0.001);
            expect(r.y).toBeGreaterThanOrEqual(-0.001);
            expect(r.x + r.w).toBeLessThanOrEqual(stage.width + 0.001);
            expect(r.y + r.h).toBeLessThanOrEqual(stage.height + 0.001);
          }
          for (let a = 0; a < rects.length; a += 1) {
            for (let b = a + 1; b < rects.length; b += 1) {
              const A = rects[a];
              const B = rects[b];
              const apart = A.x + A.w <= B.x + 0.001 || B.x + B.w <= A.x + 0.001 || A.y + A.h <= B.y + 0.001 || B.y + B.h <= A.y + 0.001;
              expect(apart).toBe(true);
            }
          }
        }
      }
    });
  }

  it('portrait: 7 people make two pages (6 + 1), 25 make five', () => {
    expect(gridLayout({ ...PORTRAIT, count: 7, page: 0 })).toMatchObject({ cols: 2, rows: 3, pageCount: 2, start: 0, end: 6 });
    expect(gridLayout({ ...PORTRAIT, count: 7, page: 1 })).toMatchObject({ cols: 1, rows: 1, start: 6, end: 7 });
    expect(gridLayout({ ...PORTRAIT, count: 25, page: 4 })).toMatchObject({ pageCount: 5, start: 24, end: 25 });
  });

  it('a page past the end (someone left, the phone turned) comes back to the last page', () => {
    expect(clampPage(3, 7, PORTRAIT)).toBe(1);
    expect(clampPage(-2, 7, PORTRAIT)).toBe(0);
    expect(gridLayout({ ...PORTRAIT, count: 4, page: 2 }).page).toBe(0);
    expect(gridLayout({ ...LANDSCAPE, count: 20, page: 9 })).toMatchObject({ page: 3, start: 18, end: 20 });
  });

  it('three people in portrait: two on top, the third centred below', () => {
    const { rects, tileWidth } = gridLayout({ ...PORTRAIT, count: 3 });
    expect(rects[0].y).toBe(rects[1].y);
    expect(rects[2].x).toBeCloseTo((PORTRAIT.width - tileWidth) / 2);
  });

  it('two people in portrait are stacked, full width', () => {
    const { rects } = gridLayout({ ...PORTRAIT, count: 2 });
    expect(rects[0]).toMatchObject({ x: 0, y: 0, w: 390 });
    expect(rects[1].y).toBeCloseTo((640 - GAP) / 2 + GAP);
  });

  it('knows which page someone is on', () => {
    expect(pageOf(0, PORTRAIT)).toBe(0);
    expect(pageOf(6, PORTRAIT)).toBe(1);
    expect(pageOf(13, TABLET)).toBe(1);
    expect(pageOf(-1, PORTRAIT)).toBe(-1);
  });
});

describe('stage and filmstrip', () => {
  it('portrait: filmstrip along the bottom', () => {
    const l = stageLayout({ ...PORTRAIT, stripCount: 4 });
    expect(l.direction).toBe('row');
    expect(l.strip.y + l.strip.h).toBe(640);
    expect(l.stage.h + GAP + l.strip.h).toBe(640);
    expect(l.item.h).toBe(l.strip.h);
  });

  it('landscape: filmstrip down the side', () => {
    const l = stageLayout({ ...LANDSCAPE, stripCount: 4 });
    expect(l.direction).toBe('column');
    expect(l.stage.w + GAP + l.strip.w).toBe(780);
    expect(l.item.w).toBe(l.strip.w);
  });

  it('no filmstrip when nobody else is there', () => {
    expect(stageLayout({ ...PORTRAIT, stripCount: 0 })).toMatchObject({ stage: { w: 390, h: 640 }, strip: null });
  });

  it('only filmstrip items on screen (and one either side) get video', () => {
    expect(stripVisibleRange({ offset: 0, viewport: 390, itemSize: 100, count: 20 })).toEqual([0, 5]);
    expect(stripVisibleRange({ offset: 540, viewport: 390, itemSize: 100, count: 20 })).toEqual([4, 10]);
    expect(stripVisibleRange({ offset: 5000, viewport: 390, itemSize: 100, count: 20 })).toEqual([19, 20]);
    expect(stripVisibleRange({ offset: 0, viewport: 390, itemSize: 100, count: 0 })).toEqual([0, 0]);
    expect(stripVisibleRange({ offset: 0, viewport: 0, itemSize: 100, count: 9 })).toEqual([0, 2]);
  });
});

describe('which view', () => {
  it('picks the view from the people, the mode, a pin and a shared screen', () => {
    expect(resolveView({ count: 1 }).kind).toBe('solo');
    expect(resolveView({ count: 2 }).kind).toBe('duo');
    expect(resolveView({ count: 2, mode: 'grid' }).kind).toBe('grid');
    expect(resolveView({ count: 2, mode: 'speaker' }).kind).toBe('duo');
    expect(resolveView({ count: 3 }).kind).toBe('grid');
    expect(resolveView({ count: 3, mode: 'speaker' }).kind).toBe('speaker');
    expect(resolveView({ count: 5, pinnedId: 'a' })).toEqual({ kind: 'stage', focusId: 'a' });
    expect(resolveView({ count: 5, sharingId: 's', mode: 'grid' })).toEqual({ kind: 'stage', focusId: 's' });
    expect(resolveView({ count: 5, sharingId: 's', pinnedId: 'a' })).toEqual({ kind: 'stage', focusId: 'a' });
  });
});

describe('grid order', () => {
  const people = [
    { userId: 'me', isLocal: true },
    { userId: 'a' },
    { userId: 'b', videoEnabled: true },
    { userId: 'c' },
    { userId: 'd', sharing: true },
  ];
  it('sharing, then cameras, then the rest; me on the first page', () => {
    expect(orderForGrid(people).map((p) => p.userId)).toEqual(['d', 'b', 'a', 'c', 'me']);
    const many = [{ userId: 'me', isLocal: true }, ...Array.from({ length: 9 }, (_, i) => ({ userId: `u${i}` }))];
    const order = orderForGrid(many, { capacity: 6 });
    expect(order.findIndex((p) => p.isLocal)).toBe(5);
    expect(order).toHaveLength(10);
  });
});

describe('the active speaker', () => {
  const people = [{ userId: 'me', isLocal: true }, { userId: 'a' }, { userId: 'b', videoEnabled: true }, { userId: 'c' }];
  it('follows whoever talks, holds on while they talk, and never picks me with others there', () => {
    expect(pickSpeaker(people, {})).toBe('b');
    expect(pickSpeaker(people, { c: true })).toBe('c');
    expect(pickSpeaker(people, { a: true, c: true }, 'c')).toBe('c');
    expect(pickSpeaker(people, {}, 'c')).toBe('c');
    expect(pickSpeaker(people, { me: true }, null)).toBe('b');
    expect(pickSpeaker(people, {}, 'gone')).toBe('b');
    expect(pickSpeaker([{ userId: 'me', isLocal: true }], {})).toBe('me');
  });
});

describe('the self-view window', () => {
  it('snaps to the nearest corner', () => {
    const box = selfViewSize(PORTRAIT);
    expect(box.h).toBeGreaterThan(box.w);
    expect(nearestCorner({ x: 10, y: 10 }, box, PORTRAIT)).toBe('tl');
    expect(nearestCorner({ x: 300, y: 500 }, box, PORTRAIT)).toBe('br');
    expect(nearestCorner({ x: 280, y: 30 }, box, PORTRAIT)).toBe('tr');
    expect(cornerPosition('br', box, PORTRAIT)).toEqual({ x: 390 - box.w - 12, y: 640 - box.h - 12 });
    expect(cornerPosition('tl', box, PORTRAIT)).toEqual({ x: 12, y: 12 });
    const wide = selfViewSize(LANDSCAPE);
    expect(wide.w).toBeGreaterThan(wide.h);
  });
});
