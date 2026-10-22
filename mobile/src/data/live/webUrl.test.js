import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../native/storage.js', () => {
  const store = new Map();
  return { prefs: { get: (k) => store.get(k), set: (k, v) => store.set(k, v) } };
});

import { guessWebUrl, loadWebUrl, resetWebUrlCache, webUrlFor } from './webUrl.js';

describe('web app address', () => {
  beforeEach(() => resetWebUrlCache());

  test('guesses by dropping the api. prefix', () => {
    expect(guessWebUrl('https://api.oruinwan.poelys.com')).toBe('https://oruinwan.poelys.com');
    expect(guessWebUrl('https://chat.example.com')).toBe('https://chat.example.com');
    expect(guessWebUrl('http://100.70.1.2:8080')).toBe('http://100.70.1.2:8080');
    expect(guessWebUrl('')).toBe('');
  });

  test('uses the address the server reports', async () => {
    const probe = vi.fn().mockResolvedValue({ state: 'ok', info: { webUrl: 'https://app.example.com/' } });
    await loadWebUrl('https://api.example.com', probe);
    expect(webUrlFor('https://api.example.com')).toBe('https://app.example.com');
    expect(probe).toHaveBeenCalledTimes(1);
  });

  test('keeps the guess when the server is older or offline', async () => {
    await loadWebUrl('https://api.example.org', vi.fn().mockResolvedValue({ state: 'ok', info: { status: 'healthy' } }));
    expect(webUrlFor('https://api.example.org')).toBe('https://example.org');
    await loadWebUrl('https://api.other.org', vi.fn().mockRejectedValue(new Error('offline')));
    expect(webUrlFor('https://api.other.org')).toBe('https://other.org');
  });
});
