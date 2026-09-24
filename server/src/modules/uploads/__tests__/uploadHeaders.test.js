'use strict';

const { isInlineSafe, buildSafeHeaders } = require('../upload.service');

describe('upload response headers', () => {
  test.each(['image/png', 'video/mp4', 'audio/webm', 'application/pdf'])('%s is inline', (mt) => {
    expect(isInlineSafe(mt)).toBe(true);
    expect(buildSafeHeaders(mt, 'a.bin')['Content-Disposition']).toMatch(/^inline;/);
  });

  test.each(['text/html', 'image/svg+xml', 'application/xhtml+xml', 'text/plain', 'application/zip'])(
    '%s is forced to download with nosniff', (mt) => {
      const h = buildSafeHeaders(mt, 'evil.html');
      expect(isInlineSafe(mt)).toBe(false);
      expect(h['Content-Disposition']).toMatch(/^attachment;/);
      expect(h['X-Content-Type-Options']).toBe('nosniff');
    });

  test('script-capable types are never served with their real content type', () => {
    expect(buildSafeHeaders('text/html', 'x.html')['Content-Type']).toBe('application/octet-stream');
    expect(buildSafeHeaders('image/svg+xml', 'x.svg')['Content-Type']).toBe('application/octet-stream');
  });

  test('filename is encoded (no header injection)', () => {
    const h = buildSafeHeaders('image/png', 'a"\r\nX-Evil: 1.png');
    expect(h['Content-Disposition']).not.toMatch(/[\r\n"]/);
  });
});
