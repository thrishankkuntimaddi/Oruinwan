import { describe, expect, it } from 'vitest';
import { dedupeFiles, placesLabel } from './filesUi.js';

const f = (id, url, conv, extra = {}) => ({ id, name: 'a.webp', size: 10, url, source: 'message', conv: { kind: 'dm', name: conv }, ...extra });

describe('files shared in several places', () => {
  it('fold into the newest row and remember where else they are', () => {
    const rows = dedupeFiles([f('1', '/api/v2/uploads/file?path=s%2Fa.webp', 'Muzamil'), f('2', '/api/v2/uploads/file?path=s%2Fa.webp', 'Varshitha'), f('3', '/api/v2/uploads/file?path=s%2Fb.webp', 'Muzamil', { name: 'b.webp' })]);
    expect(rows.map((r) => r.id)).toEqual(['1', '3']);
    expect(rows[0].places).toEqual(['Muzamil', 'Varshitha']);
    expect(placesLabel(rows[0])).toBe('Shared in 2 places');
    expect(placesLabel(rows[1])).toBe('Muzamil');
  });

  it('folds the same picture sent again (a new copy each time) by the same person', () => {
    const rows = dedupeFiles([
      f('1', '/api/v2/uploads/file?path=dms%2F1.jpg', 'Muzamil', { name: 'IMG_1.jpg', size: 5000, byId: 'me' }),
      f('2', '/api/v2/uploads/file?path=dms%2F2.jpg', 'Reddy', { name: 'IMG_1.jpg', size: 5000, byId: 'me' }),
      f('3', '/api/v2/uploads/file?path=dms%2F3.jpg', 'Reddy', { name: 'IMG_1.jpg', size: 5000, byId: 'other' }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(['1', '3']);
  });

  it('keeps different library uploads apart even with the same name', () => {
    const rows = dedupeFiles([
      { id: 'x', name: 'r.pdf', size: 1, source: 'library', fileId: 'f1' },
      { id: 'y', name: 'r.pdf', size: 1, source: 'library', fileId: 'f2' },
    ]);
    expect(rows).toHaveLength(2);
  });
});
