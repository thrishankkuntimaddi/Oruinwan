'use strict';

const zlib = require('zlib');
const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');
const { SignedXml } = require('xml-crypto');

process.env.BACKEND_URL = 'https://api.test.local';
process.env.ACCESS_TOKEN_SECRET = 'test-secret';

const mockDb = {
  company: { _id: 'c0000000000000000000000a', name: 'Acme', domain: 'acme.com', domainVerified: true, sso: {} },
  users: { u1: { _id: 'u1', username: 'ada', email: 'ada@acme.com', companyId: 'c0000000000000000000000a', accountStatus: 'active', roles: ['user'] } },
};

jest.mock('../../../shared/redis', () => ({ getRedis: () => null }));
jest.mock('../../../shared/middleware/auth', () => (req, res, next) => { req.user = { sub: req.headers['x-user'] }; next(); });
jest.mock('../../../shared/middleware/requireCompanyAdmin', () => (req, res, next) => {
  if (req.headers['x-user'] !== 'admin') return res.status(403).json({ message: 'Access denied' });
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
    findByEmail: jest.fn(async (email) => Object.values(mockDb.users).find((u) => u.email === email) || null),
    update: jest.fn(async (id, patch) => Object.assign(mockDb.users[id], patch)),
    create: jest.fn(),
  },
}));
jest.mock('../../../identity/queries/security', () => ({
  findBySso: jest.fn(async (provider, id) => Object.values(mockDb.users).find((u) => u.sso?.provider === provider && u.sso?.id === id) || null),
}));

const router = require('../sso.routes');

const KEY = require('./fixtures/samlTestIdp').TEST_IDP_KEY;
const CERT = require('./fixtures/samlTestIdp').TEST_IDP_CERT;
const ISSUER = 'https://idp.example.com/entity';
const CID = mockDb.company._id;
const BASE = `/api/auth/sso/saml`;

function call(method, url, { user, body, form } = {}) {
  const app = express();
  app.use(express.json());
  app.use('/api/auth/sso', router);
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const data = form ? new URLSearchParams(form).toString() : body ? JSON.stringify(body) : null;
      const req = http.request({
        port: server.address().port, path: url, method,
        headers: {
          ...(user ? { 'x-user': user } : {}),
          'content-type': form ? 'application/x-www-form-urlencoded' : 'application/json',
          ...(data ? { 'content-length': Buffer.byteLength(data) } : {}),
        },
      }, (res) => {
        let text = '';
        res.on('data', (c) => { text += c; });
        res.on('end', () => {
          server.close();
          let parsed = text;
          try { parsed = JSON.parse(text); } catch { /* xml or empty */ }
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

describe('SAML routes', () => {
  test('only company admins configure SAML; the cert is never echoed', async () => {
    expect((await call('PUT', `${BASE}/config`, { user: 'member', body: {} })).status).toBe(403);
    expect((await call('PUT', `${BASE}/config`, { user: 'admin', body: { entryPoint: 'https://idp.example.com/sso', cert: 'bad', issuer: ISSUER } })).status).toBe(400);

    const res = await call('PUT', `${BASE}/config`, { user: 'admin', body: { entryPoint: 'https://idp.example.com/sso', cert: CERT, issuer: ISSUER } });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ configured: true, enabled: true, issuer: ISSUER, acsUrl: `https://api.test.local${BASE}/${CID}/acs` });
    expect(res.body.cert).toBeUndefined();
    expect(res.body.certFingerprint).toMatch(/:/);
    expect(mockDb.company.sso.saml.cert).not.toMatch(/BEGIN/);
  });

  test('metadata and discovery', async () => {
    const meta = await call('GET', `${BASE}/${CID}/metadata`);
    expect(meta.status).toBe(200);
    expect(meta.headers['content-type']).toMatch(/samlmetadata\+xml/);
    expect(meta.body).toContain('AssertionConsumerService');
    expect((await call('GET', '/api/auth/sso/discover?email=ada@acme.com')).body)
      .toEqual({ enabled: true, protocol: 'saml', startUrl: `https://api.test.local${BASE}/${CID}/login` });
    expect((await call('GET', '/api/auth/sso/discover?email=x@other.com')).body).toEqual({ enabled: false });
    expect((await call('GET', '/api/auth/sso/discover?email=garbage')).body).toEqual({ enabled: false });
    expect((await call('GET', `${BASE}/nope/metadata`)).status).toBe(404);
  });

  test('login → IdP → ACS signs the user in and links the identity', async () => {
    const login = await call('GET', `${BASE}/${CID}/login?deviceId=device-abc-123`);
    expect(login.status).toBe(302);
    const redirect = new URL(login.headers.location);
    expect(redirect.origin).toBe('https://idp.example.com');
    const requestXml = zlib.inflateRawSync(Buffer.from(redirect.searchParams.get('SAMLRequest'), 'base64')).toString('utf8');
    const requestId = requestXml.match(/ID="([^"]+)"/)[1];

    expect(redirect.searchParams.get('RelayState')).toBe('device-abc-123');
    const acs = await call('POST', `${BASE}/${CID}/acs`, { form: { SAMLResponse: signedResponse(requestId, 'ada@acme.com'), RelayState: 'device-abc-123' } });
    expect(acs.status).toBe(302);
    // A full session: refresh cookie set and the device id carried through.
    expect(String(acs.headers['set-cookie'])).toMatch(/jwt=refresh-for-u1/);
    expect(require('../../auth/auth.controller').startSsoSession)
      .toHaveBeenCalledWith(expect.anything(), expect.anything(), 'u1', { method: 'sso_saml', deviceId: 'device-abc-123' });
    expect(acs.headers.location).toMatch(/^https:\/\/app\.test\.local\/oauth-success#access=/);
    const token = acs.headers.location.split('access=')[1];
    expect(jwt.verify(token, 'test-secret').sub).toBe('u1');
    expect(mockDb.users.u1.sso).toEqual({ provider: `saml:${CID}`, id: 'ada@acme.com' });
  });

  test('a forged or replayed response is refused', async () => {
    const acs = await call('POST', `${BASE}/${CID}/acs`, { form: { SAMLResponse: signedResponse('_never_requested', 'ada@acme.com') } });
    expect(acs.status).toBe(302);
    expect(acs.headers.location).toMatch(/\/login\?error=sso_saml_/);
  });

  test('disabled config refuses login', async () => {
    mockDb.company.sso.saml.enabled = false;
    const login = await call('GET', `${BASE}/${CID}/login`);
    expect(login.headers.location).toMatch(/error=sso_saml_not_configured/);
  });

  test('discover: OIDC providers need a verified domain and a configured client', async () => {
    const { ssoForCompany } = require('../sso.routes');
    process.env.OKTA_CLIENT_ID = 'okta-client';
    expect(ssoForCompany({ _id: 'c', domainVerified: true, settings: { sso: { enabled: true, provider: 'okta' } } }))
      .toEqual({ protocol: 'oidc', startUrl: 'https://api.test.local/api/auth/sso/okta' });
    expect(ssoForCompany({ _id: 'c', domainVerified: false, sso: { enabled: true, provider: 'okta' } })).toBeNull();
    delete process.env.MICROSOFT_CLIENT_ID;
    expect(ssoForCompany({ _id: 'c', domainVerified: true, sso: { enabled: true, provider: 'microsoft' } })).toBeNull();
    expect(ssoForCompany({ _id: 'c', domainVerified: true, sso: { enabled: false, provider: 'okta' } })).toBeNull();
    expect(ssoForCompany(null)).toBeNull();
  });
});
