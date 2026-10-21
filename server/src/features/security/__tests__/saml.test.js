'use strict';

const zlib = require('zlib');
const crypto = require('crypto');
const { SignedXml } = require('xml-crypto');

jest.mock('../../../shared/redis', () => ({ getRedis: () => null }));

const saml = require('../saml.service');

// Throwaway key pair generated for these tests only (never used anywhere else).
const IDP_KEY = require('./fixtures/samlTestIdp').TEST_IDP_KEY;
const IDP_CERT = require('./fixtures/samlTestIdp').TEST_IDP_CERT;
const IDP_ISSUER = 'https://idp.example.com/entity';
const COMPANY_ID = 'a1b2c3d4e5f6a1b2c3d4e5f6';

process.env.BACKEND_URL = 'https://api.test.local';

const config = () => saml.validateConfig({ entryPoint: 'https://idp.example.com/sso', cert: IDP_CERT, issuer: IDP_ISSUER });

function signedResponse({ inResponseTo, nameId = 'ada@acme.com', audience, issuer = IDP_ISSUER, extraAttrs = '' }) {
  const urls = saml.spUrls(COMPANY_ID);
  const now = new Date();
  const later = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
  const id = `_${crypto.randomBytes(8).toString('hex')}`;
  const aid = `_${crypto.randomBytes(8).toString('hex')}`;
  const irt = inResponseTo ? ` InResponseTo="${inResponseTo}"` : '';
  const xml = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${id}" Version="2.0" IssueInstant="${now.toISOString()}" Destination="${urls.acsUrl}"${irt}>`
    + `<saml:Issuer>${issuer}</saml:Issuer>`
    + '<samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>'
    + `<saml:Assertion ID="${aid}" Version="2.0" IssueInstant="${now.toISOString()}">`
    + `<saml:Issuer>${issuer}</saml:Issuer>`
    + `<saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${nameId}</saml:NameID>`
    + `<saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="${later}" Recipient="${urls.acsUrl}"${irt}/></saml:SubjectConfirmation></saml:Subject>`
    + `<saml:Conditions NotBefore="${now.toISOString()}" NotOnOrAfter="${later}"><saml:AudienceRestriction><saml:Audience>${audience || urls.entityId}</saml:Audience></saml:AudienceRestriction></saml:Conditions>`
    + `<saml:AuthnStatement AuthnInstant="${now.toISOString()}" SessionIndex="${aid}"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement>`
    + `<saml:AttributeStatement><saml:Attribute Name="displayName"><saml:AttributeValue>Ada Lovelace</saml:AttributeValue></saml:Attribute>${extraAttrs}</saml:AttributeStatement>`
    + '</saml:Assertion></samlp:Response>';
  const sig = new SignedXml({
    privateKey: IDP_KEY,
    publicCert: IDP_CERT,
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#',
  });
  sig.addReference({
    xpath: "//*[local-name(.)='Assertion']",
    transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/2001/10/xml-exc-c14n#'],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
  });
  sig.computeSignature(xml, { location: { reference: "//*[local-name(.)='Assertion']/*[local-name(.)='Issuer']", action: 'after' } });
  return Buffer.from(sig.getSignedXml()).toString('base64');
}

async function startLogin(instance) {
  const url = new URL(await instance.getAuthorizeUrlAsync('', 'api.test.local', {}));
  const xml = zlib.inflateRawSync(Buffer.from(url.searchParams.get('SAMLRequest'), 'base64')).toString('utf8');
  return { url, requestId: xml.match(/ID="([^"]+)"/)[1] };
}

describe('validateConfig', () => {
  test('accepts a PEM cert and normalizes it', () => {
    const c = config();
    expect(c.cert).not.toMatch(/BEGIN/);
    expect(c.issuer).toBe(IDP_ISSUER);
    expect(c.enabled).toBe(true);
    expect(c.jitProvisioning).toBe(false);
    expect(saml.certFingerprint(c.cert)).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
  });

  test.each([
    [{ entryPoint: 'not a url', cert: IDP_CERT, issuer: 'x' }, 'invalid_entry_point'],
    [{ entryPoint: 'ftp://idp', cert: IDP_CERT, issuer: 'x' }, 'invalid_entry_point'],
    [{ entryPoint: 'https://idp', cert: 'garbage!!', issuer: 'x' }, 'invalid_cert'],
    [{ entryPoint: 'https://idp', cert: 'QUJD', issuer: 'x' }, 'invalid_cert'],
    [{ entryPoint: 'https://idp', cert: IDP_CERT, issuer: '' }, 'invalid_issuer'],
  ])('rejects %#', (input, code) => {
    expect(() => saml.validateConfig(input)).toThrow(expect.objectContaining({ code }));
  });

  test('http entry points are refused in production', () => {
    expect(() => saml.validateConfig({ entryPoint: 'http://idp.local/sso', cert: IDP_CERT, issuer: 'x' }, { production: true }))
      .toThrow(expect.objectContaining({ code: 'invalid_entry_point' }));
  });
});

describe('SAML sign-in flow (node-saml)', () => {
  test('metadata names the ACS and entity id', () => {
    const xml = saml.metadataXml(COMPANY_ID, config());
    const urls = saml.spUrls(COMPANY_ID);
    expect(xml).toContain(`entityID="${urls.entityId}"`);
    expect(xml).toContain(`Location="${urls.acsUrl}"`);
  });

  test('a signed response to our own request is accepted once', async () => {
    const instance = saml.buildSaml(COMPANY_ID, config());
    const { url, requestId } = await startLogin(instance);
    expect(url.origin + url.pathname).toBe('https://idp.example.com/sso');

    const SAMLResponse = signedResponse({ inResponseTo: requestId });
    const { profile } = await instance.validatePostResponseAsync({ SAMLResponse });
    expect(saml.identityFromProfile(profile, IDP_ISSUER)).toEqual({ externalId: 'ada@acme.com', email: 'ada@acme.com', name: 'Ada Lovelace' });

    // Replaying the same response fails: the request id was consumed.
    await expect(saml.buildSaml(COMPANY_ID, config()).validatePostResponseAsync({ SAMLResponse })).rejects.toThrow();
  });

  test('unsolicited (IdP-initiated) responses are refused', async () => {
    const instance = saml.buildSaml(COMPANY_ID, config());
    await expect(instance.validatePostResponseAsync({ SAMLResponse: signedResponse({}) })).rejects.toThrow();
  });

  test('a tampered assertion is refused', async () => {
    const instance = saml.buildSaml(COMPANY_ID, config());
    const { requestId } = await startLogin(instance);
    const xml = Buffer.from(signedResponse({ inResponseTo: requestId }), 'base64').toString('utf8').replace(/ada@acme\.com/g, 'eve@acme.com');
    await expect(instance.validatePostResponseAsync({ SAMLResponse: Buffer.from(xml).toString('base64') })).rejects.toThrow();
  });

  test('a response from another issuer is refused', async () => {
    const instance = saml.buildSaml(COMPANY_ID, config());
    const { requestId } = await startLogin(instance);
    // Signed with the right key but naming another issuer: refused by our issuer check.
    const { profile } = await instance.validatePostResponseAsync({ SAMLResponse: signedResponse({ inResponseTo: requestId, issuer: 'https://evil.example' }) });
    expect(() => saml.identityFromProfile(profile, IDP_ISSUER)).toThrow(expect.objectContaining({ code: 'wrong_issuer' }));
  });

  test('a response for another audience is refused', async () => {
    const instance = saml.buildSaml(COMPANY_ID, config());
    const { requestId } = await startLogin(instance);
    await expect(instance.validatePostResponseAsync({ SAMLResponse: signedResponse({ inResponseTo: requestId, audience: 'https://other-sp' }) }))
      .rejects.toThrow();
  });
});

describe('identityFromProfile', () => {
  test('prefers an email attribute over the NameID', () => {
    expect(saml.identityFromProfile({ nameID: 'u-123', email: 'Bob@Acme.com', givenName: 'Bob', sn: 'Smith' }))
      .toEqual({ externalId: 'u-123', email: 'bob@acme.com', name: 'Bob Smith' });
  });
  test('throws without an email', () => {
    expect(() => saml.identityFromProfile({ nameID: 'u-123' })).toThrow(expect.objectContaining({ code: 'no_email' }));
  });
});

describe('resolveUser', () => {
  const company = { _id: COMPANY_ID, domain: 'acme.com', domainVerified: true };
  const who = { externalId: 'ada@acme.com', email: 'ada@acme.com', name: 'Ada' };
  function deps({ linked = null, byEmail = null } = {}) {
    const users = {
      findByEmail: jest.fn(async () => byEmail),
      update: jest.fn(async (id, patch) => ({ ...byEmail, ...patch })),
      create: jest.fn(async (data) => ({ _id: 'new', accountStatus: 'active', ...data })),
    };
    return { users, deps: { identity: { users }, securityQueries: { findBySso: jest.fn(async () => linked) } } };
  }

  test('an already linked user signs in', async () => {
    const { deps: d } = deps({ linked: { _id: 'u1', companyId: COMPANY_ID, accountStatus: 'active' } });
    await expect(saml.resolveUser({ company, saml: {}, identity: who }, d)).resolves.toMatchObject({ _id: 'u1' });
  });

  test('a company member is linked on first SAML login', async () => {
    const { users, deps: d } = deps({ byEmail: { _id: 'u2', companyId: COMPANY_ID, accountStatus: 'active' } });
    const user = await saml.resolveUser({ company, saml: {}, identity: who }, d);
    expect(users.update).toHaveBeenCalledWith('u2', { sso: { provider: `saml:${COMPANY_ID}`, id: 'ada@acme.com' } });
    expect(user._id).toBe('u2');
  });

  test('a user of another company is refused', async () => {
    const { deps: d } = deps({ byEmail: { _id: 'u3', companyId: 'other', accountStatus: 'active' } });
    await expect(saml.resolveUser({ company, saml: {}, identity: who }, d)).rejects.toMatchObject({ code: 'wrong_company' });
  });

  test('a personal account is linked only on the verified domain', async () => {
    const personal = { _id: 'u4', companyId: null, accountStatus: 'active' };
    const { deps: d } = deps({ byEmail: personal });
    await expect(saml.resolveUser({ company: { ...company, domainVerified: false }, saml: {}, identity: who }, d))
      .rejects.toMatchObject({ code: 'wrong_company' });
    await expect(saml.resolveUser({ company, saml: {}, identity: who }, d)).resolves.toMatchObject({ _id: 'u4' });
  });

  test('unknown users need jitProvisioning on the verified domain', async () => {
    const { users, deps: d } = deps();
    await expect(saml.resolveUser({ company, saml: { jitProvisioning: false }, identity: who }, d)).rejects.toMatchObject({ code: 'no_account' });
    const created = await saml.resolveUser({ company, saml: { jitProvisioning: true }, identity: who }, d);
    expect(users.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'ada@acme.com', companyId: COMPANY_ID, companyRole: 'member', verified: true }));
    expect(created._id).toBe('new');
  });

  test('suspended accounts are refused', async () => {
    const { deps: d } = deps({ linked: { _id: 'u5', companyId: COMPANY_ID, accountStatus: 'suspended' } });
    await expect(saml.resolveUser({ company, saml: {}, identity: who }, d)).rejects.toMatchObject({ code: 'account_disabled' });
  });
});
