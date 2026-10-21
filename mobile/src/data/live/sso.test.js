import { describe, expect, it, beforeEach } from 'vitest';
import { appStartUrl, challengeFor, makePkce, parseSsoReturn, savePending, ssoErrorMessage, takePending } from './sso.js';

describe('company SSO from the app', () => {
  beforeEach(() => localStorage.clear());

  it('makes an RFC 7636 S256 challenge', () => {
    // RFC 7636 appendix B test vector.
    expect(challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    const { verifier, challenge } = makePkce();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(challenge).toBe(challengeFor(verifier));
    expect(makePkce().verifier).not.toBe(verifier);
  });

  it('adds the app flag, challenge and device id to the start URL', () => {
    const url = new URL(appStartUrl('https://api.x/api/auth/sso/saml/c1/login', { challenge: 'abc', deviceId: 'android-1' }));
    expect(url.pathname).toBe('/api/auth/sso/saml/c1/login');
    expect(Object.fromEntries(url.searchParams)).toEqual({ client: 'app', appChallenge: 'abc', deviceId: 'android-1' });
  });

  it('reads the link the browser comes back with', () => {
    const code = 'a'.repeat(64);
    expect(parseSsoReturn(`oruinwan://sso?code=${code}`)).toEqual({ code });
    expect(parseSsoReturn('oruinwan://sso?error=sso_saml_no_account')).toEqual({ error: 'sso_saml_no_account' });
    expect(parseSsoReturn('oruinwan://sso?code=short')).toEqual({ error: 'sso_failed' });
    expect(parseSsoReturn('oruinwan://join/abc')).toBeNull();
    expect(parseSsoReturn('https://evil.example/sso?code=x')).toBeNull();
    expect(ssoErrorMessage('sso_saml_no_account')).toMatch(/invite/);
    expect(ssoErrorMessage('whatever')).toMatch(/Try again/);
  });

  it('keeps the pending sign-in for ten minutes, once', () => {
    savePending({ server: 'https://x', verifier: 'v'.repeat(43) }, 1000);
    expect(takePending(2000)).toMatchObject({ server: 'https://x', verifier: 'v'.repeat(43) });
    expect(takePending(2000)).toBeNull();
    savePending({ server: 'https://x', verifier: 'v'.repeat(43) }, 0);
    expect(takePending(11 * 60 * 1000)).toBeNull();
  });
});
