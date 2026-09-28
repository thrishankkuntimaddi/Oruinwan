'use strict';

const { assertNotSSRF, isPrivateIP, fetchPageHtml } = require('../linkPreview.service');

describe('link preview SSRF guard', () => {
  test.each([
    'http://127.0.0.1:8080/api/health',
    'http://127.1/',
    'http://0x7f000001/',
    'http://[::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://10.0.0.5/',
    'http://192.168.1.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://0.0.0.0/',
    'http://localhost/',
    'http://metadata.google.internal/',
    'http://user:pw@example.com/',
    'ftp://example.com/',
  ])('%s is refused', async (url) => {
    await expect(assertNotSSRF(url)).rejects.toThrow();
  });

  test('public IP literals are allowed', async () => {
    await expect(assertNotSSRF('https://93.184.216.34/')).resolves.toBeTruthy();
  });

  test('private address ranges', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.0.1', '169.254.1.1', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1', '::ffff:7f00:1']) {
      expect(isPrivateIP(ip)).toBe(true);
    }
    for (const ip of ['8.8.8.8', '93.184.216.34', '2606:4700:4700::1111']) {
      expect(isPrivateIP(ip)).toBe(false);
    }
  });

  test('a redirect to an internal address is not followed', async () => {
    const fetchImpl = jest.fn(async () => ({
      status: 302,
      ok: false,
      headers: { get: (h) => (h.toLowerCase() === 'location' ? 'http://127.0.0.1/admin' : null) },
    }));
    await expect(fetchPageHtml('https://93.184.216.34/r', fetchImpl)).rejects.toThrow(/private/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
