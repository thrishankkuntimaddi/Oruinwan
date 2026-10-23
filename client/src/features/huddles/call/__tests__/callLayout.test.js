import { describe, it, expect } from 'vitest';
import {
    GAP, PAGE_CAPS, bestGrid, deviceClassFor, filmstripWindow, findSharer, gridLayout, gridWidth,
    nearestCorner, perPageFor, pickFeatured, pipLayout, resolveView, stageLayout, swipeDirection,
} from '../callLayout';

const STAGES = [
    { width: 1920, height: 940, device: 'desktop' },
    { width: 1280, height: 620, device: 'desktop' },
    { width: 1000, height: 700, device: 'desktop' },
    { width: 1024, height: 640, device: 'tablet' },
    { width: 768, height: 900, device: 'tablet' },   // tablet, portrait
    { width: 1180, height: 700, device: 'tablet' },  // tablet, landscape
    { width: 375, height: 600, device: 'narrow' },
    { width: 600, height: 300, device: 'narrow' },   // phone-size, landscape
    { width: 320, height: 180, device: 'desktop' },  // a very small window
];
const ALLOWED = [16 / 9, 4 / 3, 1];

describe('grid layout, 1…25 people on every stage', () => {
    for (const stage of STAGES) {
        it(`${stage.width}×${stage.height} (${stage.device})`, () => {
            for (let count = 1; count <= 25; count += 1) {
                const first = gridLayout({ ...stage, count });
                const seen = [];
                for (let page = 0; page < first.pages; page += 1) {
                    const l = gridLayout({ ...stage, count, page });
                    const onPage = l.end - l.start;
                    expect(l.page).toBe(page);
                    expect(onPage).toBeGreaterThan(0);
                    expect(onPage).toBeLessThanOrEqual(l.perPage);
                    expect(l.perPage).toBeLessThanOrEqual(PAGE_CAPS[stage.device]);
                    // Enough cells, and no row left completely empty.
                    expect(l.cols * l.rows).toBeGreaterThanOrEqual(onPage);
                    expect((l.rows - 1) * l.cols).toBeLessThan(onPage);
                    // Tiles fit the stage: nothing overflows or is clipped.
                    expect(l.cols * l.tileW + (l.cols - 1) * GAP).toBeLessThanOrEqual(stage.width);
                    expect(l.rows * l.tileH + (l.rows - 1) * GAP).toBeLessThanOrEqual(stage.height);
                    expect(l.width).toBe(gridWidth(l));
                    expect(l.tileW).toBeGreaterThan(0);
                    expect(l.tileH).toBeGreaterThan(0);
                    // A sane tile shape (rounded to whole pixels).
                    expect(ALLOWED.some(a => Math.abs(l.tileW / l.tileH - a) < 0.05)).toBe(true);
                    for (let i = l.start; i < l.end; i += 1) seen.push(i);
                }
                // Everyone is on exactly one page: nobody is dropped.
                expect(seen).toEqual(Array.from({ length: count }, (_, i) => i));
            }
        });
    }

    it('3 and 4 people get a 2×2 grid on a wide stage; 2 people sit side by side', () => {
        expect(bestGrid(1280, 720, 2)).toMatchObject({ cols: 2, rows: 1 });
        expect(bestGrid(1280, 720, 3)).toMatchObject({ cols: 2, rows: 2 });
        expect(bestGrid(1280, 720, 4)).toMatchObject({ cols: 2, rows: 2 });
        expect(bestGrid(1280, 720, 9)).toMatchObject({ cols: 3, rows: 3 });
        expect(bestGrid(1280, 720, 16)).toMatchObject({ cols: 4, rows: 4 });
    });

    it('a portrait stage stacks people and may use squarer tiles', () => {
        const g = bestGrid(375, 600, 2);
        expect(g.cols).toBe(1);
        expect(g.rows).toBe(2);
        const four = bestGrid(375, 600, 4);
        expect(four.cols * four.rows).toBeGreaterThanOrEqual(4);
    });

    it('caps a page by device and pages the rest', () => {
        expect(gridLayout({ width: 1920, height: 940, count: 20, device: 'desktop' })).toMatchObject({ perPage: 16, pages: 2 });
        expect(gridLayout({ width: 1180, height: 700, count: 20, device: 'tablet' })).toMatchObject({ perPage: 9, pages: 3 });
        expect(gridLayout({ width: 375, height: 600, count: 20, device: 'narrow' })).toMatchObject({ perPage: 6, pages: 4 });
        expect(gridLayout({ width: 600, height: 300, count: 20, device: 'narrow' }).perPage).toBeLessThanOrEqual(4);
        expect(gridLayout({ width: 1920, height: 940, count: 25, device: 'desktop', page: 1 })).toMatchObject({ start: 16, end: 25 });
    });

    it('a small stage holds fewer tiles rather than unrecognisable ones', () => {
        expect(perPageFor(320, 180, 'desktop')).toBeLessThan(4);
        const g = gridLayout({ width: 320, height: 180, count: 10, device: 'desktop' });
        expect(g.tileW).toBeGreaterThanOrEqual(150);
    });

    it('clamps the page when people leave', () => {
        expect(gridLayout({ width: 1920, height: 940, count: 20, device: 'desktop', page: 1 }).page).toBe(1);
        const after = gridLayout({ width: 1920, height: 940, count: 10, device: 'desktop', page: 1 });
        expect(after).toMatchObject({ page: 0, pages: 1, start: 0, end: 10 });
        expect(gridLayout({ width: 1920, height: 940, count: 0, device: 'desktop', page: 3 })).toMatchObject({ page: 0, pages: 1, start: 0, end: 0 });
    });

    it('reflows on resize: shrinking the window pages people, growing it brings them back', () => {
        const big = gridLayout({ width: 1600, height: 900, count: 12, device: 'desktop' });
        const small = gridLayout({ width: 560, height: 320, count: 12, device: 'desktop' });
        expect(big.pages).toBe(1);
        expect(small.pages).toBeGreaterThan(1);
        // Rotating a tablet keeps everyone and keeps the tiles inside the stage.
        for (const [w, h] of [[1180, 760], [760, 1180]]) {
            const l = gridLayout({ width: w, height: h, count: 7, device: 'tablet' });
            expect(l.cols * l.tileW + (l.cols - 1) * GAP).toBeLessThanOrEqual(w);
            expect(l.rows * l.tileH + (l.rows - 1) * GAP).toBeLessThanOrEqual(h);
        }
    });
});

describe('stage, filmstrip and self-view', () => {
    it('puts the filmstrip on the right of wide stages and below others', () => {
        const wide = stageLayout({ width: 1600, height: 800, stripCount: 5 });
        expect(wide.strip).toBe('right');
        expect(wide.mainW + wide.thumbW + GAP).toBe(1600);
        const tall = stageLayout({ width: 800, height: 900, stripCount: 5 });
        expect(tall.strip).toBe('bottom');
        expect(tall.mainH + tall.thumbH + GAP).toBe(900);
        expect(stageLayout({ width: 800, height: 600, stripCount: 0 })).toMatchObject({ strip: null, mainW: 800, mainH: 600 });
    });

    it('knows which filmstrip tiles are on screen', () => {
        expect(filmstripWindow({ count: 20, size: 100, gap: 10, scroll: 0, viewport: 330, overscan: 0 })).toEqual({ first: 0, last: 2 });
        expect(filmstripWindow({ count: 20, size: 100, gap: 10, scroll: 550, viewport: 330, overscan: 1 })).toEqual({ first: 4, last: 8 });
        expect(filmstripWindow({ count: 3, size: 100, gap: 10, scroll: 0, viewport: 2000 })).toEqual({ first: 0, last: 2 });
        expect(filmstripWindow({ count: 0, size: 100, viewport: 300 })).toEqual({ first: 0, last: -1 });
        // Scrolled past the end (the strip shrank): still the last tile, never an empty window.
        expect(filmstripWindow({ count: 5, size: 100, gap: 10, scroll: 5000, viewport: 300 })).toEqual({ first: 4, last: 4 });
    });

    it('sizes and snaps my self-view', () => {
        expect(pipLayout({ width: 1280, height: 720 })).toEqual({ pipW: 240, pipH: 135 });
        const portrait = pipLayout({ width: 400, height: 800 });
        expect(portrait.pipH).toBeGreaterThan(portrait.pipW);
        expect(nearestCorner(10, 10, 1000, 600)).toBe('tl');
        expect(nearestCorner(900, 500, 1000, 600)).toBe('br');
        expect(nearestCorner(900, 50, 1000, 600)).toBe('tr');
    });

    it('reads swipes', () => {
        expect(swipeDirection(-80, 10)).toBe(-1);
        expect(swipeDirection(80, 5)).toBe(1);
        expect(swipeDirection(30, 0)).toBe(0);
        expect(swipeDirection(-80, 120)).toBe(0); // mostly vertical: a scroll
    });

    it('classifies the device', () => {
        expect(deviceClassFor({ width: 1440 })).toBe('desktop');
        expect(deviceClassFor({ width: 1440, coarse: true })).toBe('tablet');
        expect(deviceClassFor({ width: 900 })).toBe('tablet');
        expect(deviceClassFor({ width: 500 })).toBe('narrow');
    });
});

describe('what the stage shows', () => {
    const me = { userId: 'me', isLocal: true };
    const bob = { userId: 'b', videoEnabled: true };
    const cat = { userId: 'c' };
    const dan = { userId: 'd', videoEnabled: true, screenSharing: true };

    it('1:1 calls show the other person large; groups get the grid', () => {
        expect(resolveView({ participants: [me, bob] })).toEqual({ kind: 'duo', mainId: 'b', reason: 'duo' });
        expect(resolveView({ participants: [me, bob], view: 'grid' }).kind).toBe('grid');
        expect(resolveView({ participants: [me, bob, cat] }).kind).toBe('grid');
        expect(resolveView({ participants: [me] }).kind).toBe('grid');
    });

    it('speaker view features whoever talks', () => {
        expect(resolveView({ participants: [me, bob, cat], view: 'speaker', speakerId: 'c' })).toMatchObject({ kind: 'stage', mainId: 'c', reason: 'speaker' });
        expect(resolveView({ participants: [me, bob, cat], view: 'speaker' })).toMatchObject({ mainId: 'b' });
    });

    it('a pin wins; a screen share takes the stage unless Grid was chosen', () => {
        const all = [me, bob, cat, dan];
        expect(resolveView({ participants: all, sharerId: 'd' })).toMatchObject({ kind: 'stage', mainId: 'd', reason: 'screen' });
        expect(resolveView({ participants: all, sharerId: 'd', view: 'grid' }).kind).toBe('grid');
        expect(resolveView({ participants: all, sharerId: 'd', pinnedId: 'c' })).toMatchObject({ mainId: 'c', reason: 'pinned' });
        // A pin on someone who left is ignored.
        expect(resolveView({ participants: [me, bob, cat], pinnedId: 'gone' }).kind).toBe('grid');
    });

    it('finds who shares a screen, and features the speaker', () => {
        expect(findSharer([me, bob, dan])?.userId).toBe('d');
        expect(findSharer([me, bob])).toBeNull();
        expect(findSharer([me, bob], { localSharing: true })?.userId).toBe('me');
        expect(pickFeatured([me, bob, cat], new Set(['c']), null).userId).toBe('c');
        expect(pickFeatured([me, bob, cat], new Set(), 'c').userId).toBe('c');
        expect(pickFeatured([me, cat, bob], new Set(), null).userId).toBe('b');
    });
});
