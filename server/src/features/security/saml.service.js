'use strict';

/**
 * SAML 2.0 single sign-on, one Identity Provider per company.
 *
 * The IdP settings live in companies.sso.saml (jsonb):
 *   { enabled, entryPoint, cert, issuer, jitProvisioning, updatedBy, updatedAt }
 *   - entryPoint  IdP SSO URL (HTTP-Redirect binding) the browser is sent to
 *   - cert        IdP signing certificate (PEM, or its base64 body)
 *   - issuer      IdP entity id; responses from any other issuer are refused
 *
 * Oruinwan is the Service Provider. Its entity id is the metadata URL and its
 * Assertion Consumer Service (ACS) is /api/auth/sso/saml/:companyId/acs.
 * Only SP-initiated sign-in is accepted (InResponseTo must match a request we
 * issued), which also stops replayed or unsolicited responses. Request ids are
 * kept in Redis when configured so any instance can take the ACS POST.
 */

const crypto = require('crypto');
const logger = require('../../../utils/logger');

const SSO_PROVIDER_PREFIX = 'saml:';
const REQUEST_ID_TTL_MS = 10 * 60 * 1000;
const MAX_CERT_LENGTH = 16 * 1024;

const BACKEND_URL = () => (process.env.BACKEND_URL || 'http://localhost:8080').replace(/\/+$/, '');

function spUrls(companyId) {
  const base = `${BACKEND_URL()}/api/auth/sso/saml/${encodeURIComponent(String(companyId))}`;
  return { entityId: `${base}/metadata`, metadataUrl: `${base}/metadata`, acsUrl: `${base}/acs`, loginUrl: `${base}/login` };
}

class SamlError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** PEM or bare base64 → the base64 body node-saml expects (no header, no whitespace). */
function normalizeCert(raw) {
  if (typeof raw !== 'string') return null;
  const body = raw
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s+/g, '');
  if (!body || !/^[A-Za-z0-9+/]+={0,2}$/.test(body)) return null;
  return body;
}

function certFingerprint(cert) {
  if (!cert) return null;
  try {
    const der = Buffer.from(cert, 'base64');
    const hex = crypto.createHash('sha256').update(der).digest('hex').toUpperCase();
    return hex.match(/.{2}/g).join(':');
  } catch {
    return null;
  }
}

/** Validate an admin's IdP settings. Returns the normalized config or throws SamlError. */
function validateConfig(input = {}, { production = process.env.NODE_ENV === 'production' } = {}) {
  const { entryPoint, cert, issuer, enabled = true, jitProvisioning = false } = input;
  if (typeof entryPoint !== 'string' || entryPoint.length > 2048) throw new SamlError('invalid_entry_point', 'entryPoint must be the IdP SSO URL');
  let url;
  try { url = new URL(entryPoint); } catch { throw new SamlError('invalid_entry_point', 'entryPoint must be a valid URL'); }
  if (url.protocol !== 'https:' && (production || url.protocol !== 'http:')) {
    throw new SamlError('invalid_entry_point', 'entryPoint must use https');
  }
  if (typeof cert !== 'string' || cert.length > MAX_CERT_LENGTH) throw new SamlError('invalid_cert', 'cert must be the IdP signing certificate (PEM)');
  const normalized = normalizeCert(cert);
  if (!normalized) throw new SamlError('invalid_cert', 'cert must be a PEM or base64 X.509 certificate');
  try {
    new crypto.X509Certificate(Buffer.from(normalized, 'base64'));
  } catch {
    throw new SamlError('invalid_cert', 'cert could not be parsed as an X.509 certificate');
  }
  if (typeof issuer !== 'string' || !issuer.trim() || issuer.length > 512) throw new SamlError('invalid_issuer', 'issuer must be the IdP entity id');
  return {
    enabled: enabled !== false,
    entryPoint: url.toString(),
    cert: normalized,
    issuer: issuer.trim(),
    jitProvisioning: jitProvisioning === true,
  };
}

/** Public view of a stored config (the certificate itself is shown only as a fingerprint). */
function describeConfig(companyId, saml) {
  const urls = spUrls(companyId);
  if (!saml) return { configured: false, ...urls };
  return {
    configured: true,
    enabled: !!saml.enabled,
    entryPoint: saml.entryPoint,
    issuer: saml.issuer,
    certFingerprint: certFingerprint(saml.cert),
    jitProvisioning: !!saml.jitProvisioning,
    updatedAt: saml.updatedAt || null,
    ...urls,
  };
}

// ── Request-id cache (InResponseTo) ───────────────────────────────────────

const memoryCache = new Map();

function cacheProvider() {
  const redis = (() => {
    try { return require('../../shared/redis').getRedis(); } catch { return null; }
  })();
  const key = (k) => `saml:req:${k}`;
  if (redis) {
    return {
      async saveAsync(k, value) {
        const ok = await redis.set(key(k), value, 'PX', REQUEST_ID_TTL_MS, 'NX');
        return ok ? { value, createdAt: Date.now() } : null;
      },
      async getAsync(k) { return redis.get(key(k)); },
      async removeAsync(k) { const v = await redis.get(key(k)); await redis.del(key(k)); return v; },
    };
  }
  return {
    async saveAsync(k, value) {
      if (memoryCache.has(k)) return null;
      memoryCache.set(k, { value, at: Date.now() });
      for (const [id, e] of memoryCache) if (Date.now() - e.at > REQUEST_ID_TTL_MS) memoryCache.delete(id);
      return { value, createdAt: Date.now() };
    },
    async getAsync(k) {
      const e = memoryCache.get(k);
      if (!e || Date.now() - e.at > REQUEST_ID_TTL_MS) return null;
      return e.value;
    },
    async removeAsync(k) { const e = memoryCache.get(k); memoryCache.delete(k); return e ? e.value : null; },
  };
}

function loadSamlLibrary() {
  try {
    return require('@node-saml/node-saml');
  } catch (err) {
    logger.error('[SAML] @node-saml/node-saml is not installed:', err.message);
    throw new SamlError('saml_unavailable', 'SAML is not available on this server', 501);
  }
}

/** A node-saml instance for one company's IdP. */
function buildSaml(companyId, saml) {
  const { SAML, ValidateInResponseTo } = loadSamlLibrary();
  const urls = spUrls(companyId);
  return new SAML({
    entryPoint: saml.entryPoint,
    idpCert: saml.cert,
    idpIssuer: saml.issuer,
    issuer: urls.entityId,
    audience: urls.entityId,
    callbackUrl: urls.acsUrl,
    identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: false,
    acceptedClockSkewMs: 5000,
    maxAssertionAgeMs: 5 * 60 * 1000,
    validateInResponseTo: ValidateInResponseTo.always,
    requestIdExpirationPeriodMs: REQUEST_ID_TTL_MS,
    cacheProvider: cacheProvider(),
    disableRequestedAuthnContext: true,
  });
}

/** SP metadata XML for the IdP administrator. */
function metadataXml(companyId, saml) {
  const urls = spUrls(companyId);
  if (saml) return buildSaml(companyId, saml).generateServiceProviderMetadata(null, null);
  const { generateServiceProviderMetadata } = loadSamlLibrary();
  return generateServiceProviderMetadata({
    issuer: urls.entityId,
    callbackUrl: urls.acsUrl,
    identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    wantAssertionsSigned: true,
  });
}

const EMAIL_ATTRS = [
  'email', 'mail', 'Email', 'emailAddress',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
  'urn:oid:0.9.2342.19200300.100.1.3',
];
const NAME_ATTRS = ['displayName', 'name', 'http://schemas.microsoft.com/identity/claims/displayname', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'];
const GIVEN_ATTRS = ['givenName', 'firstName', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'];
const SUR_ATTRS = ['sn', 'surname', 'lastName', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'];

function firstAttr(profile, names) {
  for (const n of names) {
    const v = profile?.[n] ?? profile?.attributes?.[n];
    const s = Array.isArray(v) ? v[0] : v;
    if (typeof s === 'string' && s.trim()) return s.trim();
  }
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Email, display name and stable id from a validated SAML profile. */
function identityFromProfile(profile, expectedIssuer = null) {
  if (!profile || !profile.nameID) throw new SamlError('no_name_id', 'The IdP response had no NameID');
  // node-saml checks idpIssuer only on logout messages, so the assertion issuer is checked here.
  if (expectedIssuer && profile.issuer !== expectedIssuer) throw new SamlError('wrong_issuer', 'The response came from an unexpected IdP');
  let email = firstAttr(profile, EMAIL_ATTRS);
  if (!email && EMAIL_RE.test(profile.nameID)) email = profile.nameID;
  if (!email || !EMAIL_RE.test(email)) throw new SamlError('no_email', 'The IdP response had no email address');
  const given = firstAttr(profile, GIVEN_ATTRS);
  const sur = firstAttr(profile, SUR_ATTRS);
  const name = firstAttr(profile, NAME_ATTRS) || [given, sur].filter(Boolean).join(' ') || email.split('@')[0];
  return { externalId: String(profile.nameID), email: email.toLowerCase(), name };
}

const domainOf = (email) => String(email).split('@')[1]?.toLowerCase() || '';

/**
 * Find, link or (with jitProvisioning) create the Oruinwan user for a SAML identity.
 * Rules: a user already linked to this IdP signs in; a user of this company is linked
 * on first SAML login; a user with no company is linked only when their email is on
 * the company's verified domain; anyone in another company is refused.
 */
async function resolveUser({ company, saml, identity: who }, deps = {}) {
  const identityRepo = deps.identity || require('../../identity');
  const { findBySso } = deps.securityQueries || require('../../identity/queries/security');
  const provider = `${SSO_PROVIDER_PREFIX}${company._id || company.id}`;
  const companyId = String(company._id || company.id);
  const onVerifiedDomain = !!company.domain && !!company.domainVerified && domainOf(who.email) === String(company.domain).toLowerCase();

  let user = await findBySso(provider, who.externalId);
  if (user && user.companyId && String(user.companyId) !== companyId) {
    throw new SamlError('wrong_company', 'This account belongs to a different company', 403);
  }
  if (!user) {
    const existing = await identityRepo.users.findByEmail(who.email);
    if (existing) {
      const sameCompany = existing.companyId && String(existing.companyId) === companyId;
      if (!sameCompany && (existing.companyId || !onVerifiedDomain)) {
        throw new SamlError('wrong_company', 'This email is not part of this company', 403);
      }
      user = await identityRepo.users.update(existing._id, { sso: { provider, id: who.externalId } });
    }
  }
  if (!user) {
    if (!saml.jitProvisioning || !onVerifiedDomain) {
      throw new SamlError('no_account', 'No Oruinwan account for this email; ask your admin to invite you', 403);
    }
    user = await identityRepo.users.create({
      username: who.name || who.email.split('@')[0],
      email: who.email,
      authProvider: 'local',
      sso: { provider, id: who.externalId },
      passwordHash: null,
      verified: true,
      accountStatus: 'active',
      companyId,
      companyRole: 'member',
      userType: 'company',
    });
  }
  if (['suspended', 'removed', 'deleted'].includes(user.accountStatus) || user.isActive === false) {
    throw new SamlError('account_disabled', 'This account is disabled', 403);
  }
  return user;
}

module.exports = {
  SSO_PROVIDER_PREFIX,
  SamlError,
  spUrls,
  normalizeCert,
  certFingerprint,
  validateConfig,
  describeConfig,
  buildSaml,
  metadataXml,
  identityFromProfile,
  resolveUser,
  cacheProvider,
};
