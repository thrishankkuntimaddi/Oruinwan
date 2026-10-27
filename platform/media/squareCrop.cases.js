// Shared cases for platform/media/squareCrop.js (web and phone test suites run them).
import { clampCrop, initialCrop, sourceSquare, zoomCrop } from './squareCrop.js';

export function defineSquareCropTests({ describe, it, expect }) {
  describe('square crop', () => {
    const wide = { width: 2000, height: 1000 };
    it('starts centred, covering the frame', () => {
      expect(initialCrop(wide, 200)).toEqual({ zoom: 1, x: -100, y: 0 });
      expect(sourceSquare(wide, 200, initialCrop(wide, 200))).toEqual({ sx: 500, sy: 0, size: 1000 });
    });
    it('never shows an empty edge', () => {
      expect(clampCrop(wide, 200, { zoom: 1, x: 50, y: 30 })).toEqual({ zoom: 1, x: 0, y: 0 });
      expect(clampCrop(wide, 200, { zoom: 1, x: -999, y: -5 })).toEqual({ zoom: 1, x: -200, y: 0 });
      expect(clampCrop(wide, 200, { zoom: 9, x: 0, y: 0 }).zoom).toBe(4);
    });
    it('zooms about the centre', () => {
      const z = zoomCrop(wide, 200, initialCrop(wide, 200), 2);
      expect(sourceSquare(wide, 200, z)).toEqual({ sx: 750, sy: 250, size: 500 });
    });
  });
}
