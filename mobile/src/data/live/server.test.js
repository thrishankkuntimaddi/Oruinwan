import { normalizeServerUrl } from './server.js';

describe('normalizeServerUrl', () => {
  it('adds https for domains and http for LAN/Tailscale addresses', () => {
    expect(normalizeServerUrl('chat.example.com')).toBe('https://chat.example.com');
    expect(normalizeServerUrl('100.70.234.41:8080')).toBe('http://100.70.234.41:8080');
    expect(normalizeServerUrl('localhost:8080')).toBe('http://localhost:8080');
  });

  it('strips trailing slashes and /api', () => {
    expect(normalizeServerUrl('https://x.com/api/')).toBe('https://x.com');
    expect(normalizeServerUrl('https://x.com/oru/')).toBe('https://x.com/oru');
  });

  it('rejects garbage', () => {
    expect(normalizeServerUrl('')).toBe('');
    expect(normalizeServerUrl('http://')).toBe('');
  });
});
