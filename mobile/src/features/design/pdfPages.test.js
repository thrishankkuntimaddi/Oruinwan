import { describe, expect, it, vi } from 'vitest';
import { clampPage, drawPage, fitScale, openPdf } from './pdfPages.js';

describe('pdf pages', () => {
  it('fits a page into the box without upscaling past 2x', () => {
    expect(fitScale(600, 300)).toBe(0.5);
    expect(fitScale(100, 1000)).toBe(2);
    expect(fitScale(0, 300)).toBe(1);
  });

  it('clamps page numbers', () => {
    expect(clampPage(5, 3)).toBe(3);
    expect(clampPage(0, 3)).toBe(1);
    expect(clampPage('2', 0)).toBe(2);
  });

  it('reports a failed download', async () => {
    await expect(openPdf('x', { fetchImpl: async () => ({ ok: false, status: 403 }) })).rejects.toThrow(/403/);
  });

  it('draws a page sized to the box and can be cancelled', async () => {
    const render = vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() }));
    const page = { getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale }), render };
    const doc = { getPage: vi.fn(async () => page) };
    const canvas = { style: {}, getContext: () => ({}) };
    const job = drawPage(doc, 1, canvas, 300, 2);
    await job.done;
    expect(canvas.width).toBe(600);
    expect(canvas.style.width).toBe('300px');
    expect(render).toHaveBeenCalledTimes(1);
    const later = drawPage(doc, 2, { style: {}, getContext: () => ({}) }, 300, 1);
    later.cancel();
    await later.done;
    expect(render).toHaveBeenCalledTimes(1);
  });
});
