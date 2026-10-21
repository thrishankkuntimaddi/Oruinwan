'use strict';

// SSO from the phone app: sign-in started with client=app ends at oruinwan://sso?code=…,
// and the app trades the code + its PKCE verifier for a session (ssoApp.js).

const zlib = require('zlib');
const crypto = require('crypto');
const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');
const { SignedXml } = require('xml-crypto');

process.env.BACKEND_URL = 'https://api.test.local';
process.env.ACCESS_TOKEN_SECRET = 'test-secret';

const KEY = require('./fixtures/samlTestIdp').TEST_IDP_KEY;
const CERT = require('./fixtures/samlTestIdp').TEST_IDP_CERT;
const ISSUER = 'https://idp.example.com/entity';

const mockDb = {
  company: { _id: 'c0000000000000000000000a', name: 'Acme', domain: 'acme.com', domainVerified: true, sso: {} },
  users: { u1: { _id: 'u1', username: 'ada', email: 'ada@acme.com', companyId: 'c0000000000000000000000a', accountStatus: 'active', roles: ['user'] } },
};

jest.mock('../../../shared/redis', () => ({ getRedis: () => null }));
jest.mock('../../../shared/middleware/auth', () => (req, res, next) => { req.user = { sub: req.headers['x-user'] }; next(); });
jest.mock('../../../shared/middleware/requireCompanyAdmin', () => (req, res, next) => {
  req.companyId = 'c0000000000000000000000a';
  return next();
});
jest.mock('../../../shared/utils/webAppUrl', () => ({ webAppUrl: () => 'https://app.test.local' }));
jest.mock('../../../../models/AuditLog', () => ({ create: jest.fn().mockResolvedValue({}) }));
jest.mock('../../auth/auth.controller', () => ({
  startSsoSession: jest.fn(async (req, res, userId) => {
    res.cookie('jwt', 'refresh-for-' + userId);
    return { accessToken: require('jsonwebtoken').sign({ sub: userId }, 'test-secret'), refreshToken: 'r' };
  }),
}));
jest.mock('../../../identity', () => ({
  companies: {
    findById: jest.fn(async (id) => (id === mockDb.company._id ? JSON.parse(JSON.stringify(mockDb.company)) : null)),
    findByDomain: jest.fn(async (d) => (d === mockDb.company.domain ? JSON.parse(JSON.stringify(mockDb.company)) : null)),
    update: jest.fn(async (_id, patch) => { Object.assign(mockDb.company, patch); return mockDb.company; }),
  },
  users: {
    findById: jest.fn(async (id) => mockDb.users[id] || null),
    findByEmail: jest.fn(async (email) => Object.values(mockDb.users).find((u) => u.email === email) || null),
    update: jest.fn(async (id, patch) => Object.assign(mockDb.users[id], patch)),
    create: jest.fn(),
  },
}));
jest.mock('../../../identity/queries/security', () => ({
  findBySso: jest.fn(async (provider, id) => Object.values(mockDb.users).find((u) => u.sso?.provider === provider && u.sso?.id === id) || null),
}));

const router = require('../sso.routes');
const ssoApp = require('../ssoApp');
const { startSsoSession } = require('../../auth/auth.controller');

const CID = mockDb.company._id;
const BASE = '/api/auth/sso/saml';

function call(method, url, { body, form, cookies, headers = {}, user } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.cookies = Object.fromEntries(String(req.headers.cookie || '').split(';').filter(Boolean).map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k, v.join('=')];
    }));
    next();
  });
  app.use('/api/auth/sso', router);
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const data = form ? new URLSearchParams(form).toString() : body ? JSON.stringify(body) : null;
      const req = http.request({
        port: server.address().port, path: url, method,
        headers: {
          ...headers,
          ...(user ? { 'x-user': user } : {}),
          ...(cookies ? { cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
          'content-type': form ? 'application/x-www-form-urlencoded' : 'application/json',
          ...(data ? { 'content-length': Buffer.byteLength(data) } : {}),
        },
      }, (res) => {
        let text = '';
        res.on('data', (c) => { text += c; });
        res.on('end', () => {
          server.close();
          let parsed = text;
          try { parsed = JSON.parse(text); } catch { /* empty */ }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      });
      req.on('error', (e) => { server.close(); reject(e); });
      if (data) req.write(data);
      req.end();
    });
  });
}

function signedResponse(inResponseTo, nameId) {
  const acs = `https://api.test.local${BASE}/${CID}/acs`;
  const aud = `https://api.test.local${BASE}/${CID}/metadata`;
  const now = new Date().toISOString();
  const later = new Date(Date.now() + 300000).toISOString();
  const xml = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_r1" Version="2.0" IssueInstant="${now}" Destination="${acs}" InResponseTo="${inResponseTo}">`
    + `<saml:Issuer>${ISSUER}</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>`
    + `<saml:Assertion ID="_a1" Version="2.0" IssueInstant="${now}"><saml:Issuer>${ISSUER}</saml:Issuer>`
    + `<saml:Subject><saml:NameID>${nameId}</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="${later}" Recipient="${acs}" InResponseTo="${inResponseTo}"/></saml:SubjectConfirmation></saml:Subject>`
    + `<saml:Conditions NotBefore="${now}" NotOnOrAfter="${later}"><saml:AudienceRestriction><saml:Audience>${aud}</saml:Audience></saml:AudienceRestriction></saml:Conditions>`
    + `<saml:AuthnStatement AuthnInstant="${now}"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:Password</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement>`
    + '</saml:Assertion></samlp:Response>';
  const sig = new SignedXml({ privateKey: KEY, publicCert: CERT, signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256', canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#' });
  sig.addReference({ xpath: "//*[local-name(.)='Assertion']", transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/2001/10/xml-exc-c14n#'], digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256' });
  sig.computeSignature(xml, { location: { reference: "//*[local-name(.)='Assertion']/*[local-name(.)='Issuer']", action: 'after' } });
  return Buffer.from(sig.getSignedXml()).toString('base64');
}

const pkce = () => {
  const verifier = crypto.randomBytes(32).toString('base64url');
  return { verifier, challenge: ssoApp.challengeOf(verifier) };
};

/** App starts SAML sign-in, the IdP answers: the ACS response (a redirect). */
async function samlAppSignIn(challenge, deviceId = 'android-phone-1') {
  const login = await call('GET', `${BASE}/${CID}/login?deviceId=${deviceId}&client=app&appChallenge=${challenge}`);
  const redirect = new URL(login.headers.location);
  const requestXml = zlib.inflateRawSync(Buffer.from(redirect.searchParams.get('SAMLRequest'), 'base64')).toString('utf8');
  const requestId = requestXml.match(/ID="([^"]+)"/)[1];
  const relay = redirect.searchParams.get('RelayState');
  const acs = await call('POST', `${BASE}/${CID}/acs`, { form: { SAMLResponse: signedResponse(requestId, 'ada@acme.com'), RelayState: relay } });
  return { relay, acs };
}

beforeAll(async () => {
  const res = await call('PUT', `${BASE}/config`, { user: 'admin', body: { entryPoint: 'https://idp.example.com/sso', cert: CERT, issuer: ISSUER } });
  expect(res.status).toBe(200);
});

beforeEach(() => {
  mockDb.company.sso.saml.enabled = true;
  startSsoSession.mockClear();
});

test('helpers: challenge, relay state and return URL', () => {
  const { challenge } = pkce();
  expect(ssoApp.appChallengeFrom({ client: 'app', appChallenge: challenge })).toBe(challenge);
  expect(ssoApp.appChallengeFrom({ client: 'app', appChallenge: 'short' })).toBeNull();
  expect(ssoApp.appChallengeFrom({ appChallenge: challenge })).toBeNull();
  expect(ssoApp.decodeRelayState(ssoApp.encodeRelayState('dev-1234:x', challenge))).toEqual({ challenge, deviceId: 'dev-1234:x' });
  expect(ssoApp.decodeRelayState(ssoApp.encodeRelayState('', challenge))).toEqual({ challenge, deviceId: null });
  expect(ssoApp.encodeRelayState('device-abc-123', null)).toBe('device-abc-123');
  expect(ssoApp.decodeRelayState('device-abc-123')).toEqual({ challenge: null, deviceId: 'device-abc-123' });
  expect(ssoApp.decodeRelayState('app:garbage')).toEqual({ challenge: null, deviceId: null });
  expect(ssoApp.appReturnUrl({})).toBe('oruinwan://sso');
  expect(ssoApp.appReturnUrl({ APP_SSO_RETURN_URL: 'https://evil.example/sso' })).toBe('oruinwan://sso');
  expect(ssoApp.appReturnUrl({ APP_SSO_RETURN_URL: 'oruinwan-dev://sso' })).toBe('oruinwan-dev://sso');
});

test('SAML: ACS sends the app a code instead of starting a browser session', async () => {
  const { challenge } = pkce();
  const { relay, acs } = await samlAppSignIn(challenge);
  expect(relay).toBe(`app:${challenge}:android-phone-1`);
  expect(acs.status).toBe(302);
  expect(acs.headers.location).toMatch(/^oruinwan:\/\/sso\?code=[a-f0-9]{64}$/);
  expect(acs.headers['set-cookie']).toBeUndefined();
  expect(startSsoSession).not.toHaveBeenCalled();
});

test('exchange: the right verifier gets a mobile session, once', async () => {
  const { verifier, challenge } = pkce();
  const { acs } = await samlAppSignIn(challenge);
  const code = new URL(acs.headers.location).searchParams.get('code');

  const ok = await call('POST', '/api/auth/sso/app/exchange', { body: { code, verifier }, headers: { 'x-client-platform': 'ios' } });
  expect(ok.status).toBe(200);
  expect(ok.body).toMatchObject({ refreshToken: 'r', requiresPasswordSetup: false, user: { id: 'u1', email: 'ada@acme.com' } });
  expect(jwt.verify(ok.body.accessToken, 'test-secret').sub).toBe('u1');
  expect(startSsoSession).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'u1', { method: 'sso_saml', deviceId: 'android-phone-1' });

  const again = await call('POST', '/api/auth/sso/app/exchange', { body: { code, verifier }, headers: { 'x-client-platform': 'ios' } });
  expect(again.status).toBe(400);
  expect(again.body.code).toBe('SSO_CODE_INVALID');
});

test('exchange: over the device limit the app gets DEVICE_LIMIT and no session', async () => {
  const { verifier, challenge } = pkce();
  const { acs } = await samlAppSignIn(challenge);
  const code = new URL(acs.headers.location).searchParams.get('code');
  startSsoSession.mockImplementationOnce(async () => ({ status: 409, pending: { code: 'DEVICE_LIMIT', pendingToken: 'p'.repeat(43), devices: [], limit: 4 } }));
  const res = await call('POST', '/api/auth/sso/app/exchange', { body: { code, verifier }, headers: { 'x-client-platform': 'ios' } });
  expect(res.status).toBe(409);
  expect(res.body.code).toBe('DEVICE_LIMIT');
  expect(res.body.accessToken).toBeUndefined();
  expect(res.body.refreshToken).toBeUndefined();
});

test('exchange: a wrong verifier burns the code; browsers get no refresh token', async () => {
  const { verifier, challenge } = pkce();
  const { acs } = await samlAppSignIn(challenge);
  const code = new URL(acs.headers.location).searchParams.get('code');
  const stolen = await call('POST', '/api/auth/sso/app/exchange', { body: { code, verifier: pkce().verifier }, headers: { 'x-client-platform': 'android' } });
  expect(stolen.status).toBe(400);
  expect((await call('POST', '/api/auth/sso/app/exchange', { body: { code, verifier }, headers: { 'x-client-platform': 'android' } })).status).toBe(400);
  expect((await call('POST', '/api/auth/sso/app/exchange', { body: { code: 'nope', verifier } })).status).toBe(400);

  const second = pkce();
  const next = await samlAppSignIn(second.challenge);
  const code2 = new URL(next.acs.headers.location).searchParams.get('code');
  const web = await call('POST', '/api/auth/sso/app/exchange', { body: { code: code2, verifier: second.verifier } });
  expect(web.status).toBe(200);
  expect(web.body.refreshToken).toBeUndefined();
});

test('SAML: failures go back to the app as an error', async () => {
  const { challenge } = pkce();
  const acs = await call('POST', `${BASE}/${CID}/acs`, {
    form: { SAMLResponse: signedResponse('_never_requested', 'ada@acme.com'), RelayState: `app:${challenge}:` },
  });
  expect(acs.headers.location).toMatch(/^oruinwan:\/\/sso\?error=sso_saml_/);
  mockDb.company.sso.saml.enabled = false;
  const login = await call('GET', `${BASE}/${CID}/login?client=app&appChallenge=${challenge}`);
  expect(login.headers.location).toBe('oruinwan://sso?error=sso_saml_not_configured');
});

test('OIDC: the app flag rides in a cookie; the callback returns a code, or an error', async () => {
  process.env.OKTA_CLIENT_ID = 'okta-client';
  process.env.OKTA_DOMAIN = 'https://acme.okta.test';
  const { verifier, challenge } = pkce();
  const start = await call('GET', `/api/auth/sso/okta?client=app&appChallenge=${challenge}&deviceId=android-phone-2`);
  expect(start.status).toBe(302);
  const cookies = Object.fromEntries(start.headers['set-cookie'].map((c) => c.split(';')[0].split('=')));
  expect(cookies.sso_app_okta).toBe(challenge);

  const bad = await call('GET', '/api/auth/sso/okta/callback?code=x&state=wrong', { cookies });
  expect(bad.headers.location).toBe('oruinwan://sso?error=sso_state_mismatch');

  const axios = require('axios');
  const post = jest.spyOn(axios, 'post').mockResolvedValue({ data: { access_token: 'okta-at' } });
  const get = jest.spyOn(axios, 'get').mockResolvedValue({ data: { sub: 'okta-1', email: 'ada@acme.com', name: 'Ada' } });
  const done = await call('GET', `/api/auth/sso/okta/callback?code=c1&state=${cookies.sso_state_okta}`, { cookies });
  post.mockRestore();
  get.mockRestore();
  expect(done.headers.location).toMatch(/^oruinwan:\/\/sso\?code=[a-f0-9]{64}$/);
  expect(startSsoSession).not.toHaveBeenCalled();
  const code = new URL(done.headers.location).searchParams.get('code');

  const ok = await call('POST', '/api/auth/sso/app/exchange', { body: { code, verifier }, headers: { 'x-client-platform': 'android' } });
  expect(ok.status).toBe(200);
  expect(startSsoSession).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'u1', { method: 'sso_okta', deviceId: 'android-phone-2' });
});

test('the browser flow is unchanged without client=app', async () => {
  process.env.OKTA_CLIENT_ID = 'okta-client';
  const start = await call('GET', '/api/auth/sso/okta');
  const cookies = Object.fromEntries(start.headers['set-cookie'].map((c) => c.split(';')[0].split('=')));
  expect(cookies.sso_app_okta).toBe('');
  const bad = await call('GET', '/api/auth/sso/okta/callback?code=x&state=wrong', { cookies: { sso_state_okta: cookies.sso_state_okta } });
  expect(bad.headers.location).toBe('https://app.test.local/login?error=sso_state_mismatch');
});
