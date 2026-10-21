'use strict';

/**
 * Passkeys (WebAuthn): /api/auth/passkeys
 *
 *   POST   /register/options  (signed in)  → creation options for navigator.credentials.create
 *   POST   /register/verify   (signed in)  { response, name? } → stores the credential
 *   GET    /                  (signed in)  → [{ id, name, createdAt, lastUsedAt, backedUp, transports }]
 *   PATCH  /:id               (signed in)  { name } → rename
 *   DELETE /:id               (signed in)  → remove
 *   POST   /login/options     (public)     { email? } → request options (discoverable when no email)
 *   POST   /login/verify      (public)     { response } → same answer as any other sign-in
 *
 * Challenges live in otpStore for 5 minutes and are deleted before they are checked, so
 * each one works once. Sign-in challenges are keyed by the challenge itself (it comes back
 * inside the signed clientDataJSON), so the public endpoints need no other handle.
 *
 * Two-factor: a passkey sign-in requires user verification (fingerprint, face, PIN or
 * screen lock) on top of possession of the device, which is already two factors and is
 * phishing-resistant. So it does not ask for the authenticator-app code (signInGates
 * skipTotp). Lockout, suspension and deactivation are still enforced.
 *
 * Encryption keys: like Google sign-in, a passkey sign-in has no password, so it only
 * issues the session; the app asks for the password when encrypted messages need unlocking.
 */

const express = require('express');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const requireAuth = require('../../shared/middleware/auth');
const otpStore = require('../../shared/services/otpStore');
const { allowedOrigins } = require('../../shared/allowedOrigins');
const { userDocs } = require('../../identity/queries/auth');
const logger = require('../../shared/utils/logger');
const repo = require('./passkeys.repo');

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_NAME = 64;
const MAX_PASSKEYS = 20;

/** The relying-party id: WEBAUTHN_RP_ID, else the host of FRONTEND_URL, else localhost. */
function rpId(env = process.env) {
  if (env.WEBAUTHN_RP_ID) return env.WEBAUTHN_RP_ID.trim();
  try {
    if (env.FRONTEND_URL) return new URL(env.FRONTEND_URL).hostname;
  } catch { /* fall through */ }
  return 'localhost';
}
const rpName = () => process.env.WEBAUTHN_RP_NAME || 'Oruinwan';
const regKey = (userId) => `passkey-reg:${userId}`;
const authKey = (challenge) => `passkey-auth:${challenge}`;

function cleanName(name) {
  const n = String(name || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
  return n || null;
}

function publicView(p) {
  return {
    id: p.id,
    name: p.name,
    createdAt: p.createdAt,
    lastUsedAt: p.lastUsedAt || null,
    backedUp: !!p.backedUp,
    transports: p.transports || [],
  };
}

/** The challenge a browser signed, read from clientDataJSON (base64url JSON). */
function challengeOf(response) {
  try {
    const json = Buffer.from(String(response.response.clientDataJSON), 'base64url').toString('utf8');
    const c = JSON.parse(json).challenge;
    return typeof c === 'string' && c ? c : null;
  } catch {
    return null;
  }
}

/** Reads and deletes a challenge: a second use (or one after 5 minutes) finds nothing. */
async function takeChallenge(key) {
  const value = await otpStore.get(key);
  if (value) await otpStore.delete(key);
  return value;
}

// ── Registration (signed in) ─────────────────────────────────────────────────

async function registerOptions(req, res) {
  try {
    const user = await userDocs.findById(req.user.sub);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const existing = await repo.listForUser(user._id);
    if (existing.length >= MAX_PASSKEYS) {
      return res.status(400).json({ message: `You can have up to ${MAX_PASSKEYS} passkeys. Remove one to add another.` });
    }

    const options = await generateRegistrationOptions({
      rpName: rpName(),
      rpID: rpId(),
      userName: user.email,
      userDisplayName: user.username || user.email,
      userID: Buffer.from(String(user._id), 'utf8'),
      attestationType: 'none',
      excludeCredentials: existing.map((p) => ({ id: p.credentialId, transports: p.transports })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    });
    await otpStore.set(regKey(user._id), { challenge: options.challenge }, CHALLENGE_TTL_MS);
    return res.json(options);
  } catch (err) {
    logger.error({ err }, 'PASSKEY REGISTER OPTIONS ERROR');
    return res.status(500).json({ message: 'Could not start adding a passkey' });
  }
}

async function registerVerify(req, res) {
  try {
    const response = req.body?.response;
    if (!response || typeof response !== 'object') return res.status(400).json({ message: 'Missing passkey response' });

    const userId = String(req.user.sub);
    const stored = await takeChallenge(regKey(userId));
    if (!stored?.challenge) {
      return res.status(400).json({ message: 'This request expired. Try adding the passkey again.' });
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: stored.challenge,
        expectedOrigin: allowedOrigins(),
        expectedRPID: rpId(),
        requireUserVerification: true,
      });
    } catch (err) {
      logger.warn({ err: err.message }, 'Passkey registration did not verify');
      return res.status(400).json({ message: "That passkey couldn't be verified. Try again." });
    }
    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ message: "That passkey couldn't be verified. Try again." });
    }

    const { credential, credentialBackedUp } = verification.registrationInfo;
    const passkey = await repo.create({
      userId,
      credentialId: credential.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports || response.response?.transports || [],
      name: cleanName(req.body.name) || 'Passkey',
      backedUp: credentialBackedUp,
    });
    if (!passkey) return res.status(409).json({ message: 'This passkey is already registered.' });

    return res.status(201).json({ message: 'Passkey added', passkey: publicView(passkey) });
  } catch (err) {
    logger.error({ err }, 'PASSKEY REGISTER VERIFY ERROR');
    return res.status(500).json({ message: 'Could not add the passkey' });
  }
}

// ── Management (signed in) ───────────────────────────────────────────────────

async function list(req, res) {
  try {
    const passkeys = await repo.listForUser(req.user.sub);
    return res.json({ passkeys: passkeys.map(publicView) });
  } catch (err) {
    logger.error({ err }, 'PASSKEY LIST ERROR');
    return res.status(500).json({ message: 'Could not load passkeys' });
  }
}

async function rename(req, res) {
  try {
    const name = cleanName(req.body?.name);
    if (!name) return res.status(400).json({ message: 'Give the passkey a name' });
    const passkey = await repo.rename(req.user.sub, req.params.id, name);
    if (!passkey) return res.status(404).json({ message: 'Passkey not found' });
    return res.json({ passkey: publicView(passkey) });
  } catch (err) {
    logger.error({ err }, 'PASSKEY RENAME ERROR');
    return res.status(500).json({ message: 'Could not rename the passkey' });
  }
}

async function remove(req, res) {
  try {
    const removed = await repo.remove(req.user.sub, req.params.id);
    if (!removed) return res.status(404).json({ message: 'Passkey not found' });
    return res.json({ message: 'Passkey removed' });
  } catch (err) {
    logger.error({ err }, 'PASSKEY REMOVE ERROR');
    return res.status(500).json({ message: 'Could not remove the passkey' });
  }
}

// ── Sign-in (public) ─────────────────────────────────────────────────────────

async function loginOptions(req, res) {
  try {
    // With an email, name that account's passkeys; an unknown email gets the same answer as
    // no email (any discoverable passkey), so this does not reveal who has an account.
    let allowCredentials;
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (email) {
      const user = await userDocs.findByEmail(email);
      const passkeys = user ? await repo.listForUser(user._id) : [];
      if (passkeys.length) allowCredentials = passkeys.map((p) => ({ id: p.credentialId, transports: p.transports }));
    }

    const options = await generateAuthenticationOptions({
      rpID: rpId(),
      userVerification: 'required',
      ...(allowCredentials ? { allowCredentials } : {}),
    });
    await otpStore.set(authKey(options.challenge), { issuedAt: Date.now() }, CHALLENGE_TTL_MS);
    return res.json(options);
  } catch (err) {
    logger.error({ err }, 'PASSKEY LOGIN OPTIONS ERROR');
    return res.status(500).json({ message: 'Could not start passkey sign-in' });
  }
}

async function loginVerify(req, res) {
  try {
    const response = req.body?.response;
    if (!response || typeof response !== 'object' || !response.id) {
      return res.status(400).json({ message: 'Missing passkey response' });
    }

    const challenge = challengeOf(response);
    if (!challenge || !(await takeChallenge(authKey(challenge)))) {
      return res.status(400).json({ message: 'This sign-in request expired. Try again.' });
    }

    const passkey = await repo.findByCredentialId(response.id);
    if (!passkey) {
      return res.status(401).json({ message: "This passkey isn't registered with Oruinwan. Sign in another way and add it under Settings → Security." });
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: allowedOrigins(),
        expectedRPID: rpId(),
        credential: {
          id: passkey.credentialId,
          publicKey: new Uint8Array(passkey.publicKey),
          counter: passkey.counter,
          transports: passkey.transports,
        },
        requireUserVerification: true,
      });
    } catch (err) {
      logger.warn({ err: err.message }, 'Passkey sign-in did not verify');
      return res.status(401).json({ message: "That passkey couldn't be verified." });
    }
    if (!verification.verified) return res.status(401).json({ message: "That passkey couldn't be verified." });

    await repo.markUsed(passkey.id, verification.authenticationInfo.newCounter);

    const user = await userDocs.findById(passkey.userId);
    if (!user) return res.status(401).json({ message: "This passkey isn't registered with Oruinwan." });

    // Required lazily: auth.controller pulls in Google and email clients this module doesn't need at load.
    const { signInGates, issueSignInSession } = require('./auth.controller');
    // A verified passkey is two factors already, so no authenticator-app code (see top of file).
    const stop = await signInGates(user, req.body.otp, { skipTotp: true });
    if (stop) return res.status(stop.status).json(stop.body);

    const needsPasswordSetup = Boolean(user.googleAccount && !user.passwordHash);
    const extras = { message: 'Signed in with a passkey', isNewUser: false, needsPasswordSetup };
    // The device limit applies to passkeys too; the passkey itself is the second factor.
    const blocked = await require('./signInFlow').gate(req, user, { kind: 'oauth', method: 'passkey', mfaSatisfiedBy: 'passkey', extras });
    if (blocked) return res.status(blocked.status).json(blocked.body);
    return issueSignInSession(req, res, user, { ...extras, method: 'passkey' });
  } catch (err) {
    logger.error({ err }, 'PASSKEY LOGIN ERROR');
    return res.status(500).json({ message: 'Passkey sign-in failed' });
  }
}

const router = express.Router();
router.post('/register/options', requireAuth, registerOptions);
router.post('/register/verify', requireAuth, registerVerify);
router.post('/login/options', loginOptions);
router.post('/login/verify', loginVerify);
router.get('/', requireAuth, list);
router.patch('/:id', requireAuth, rename);
router.delete('/:id', requireAuth, remove);

module.exports = router;
module.exports.handlers = { registerOptions, registerVerify, list, rename, remove, loginOptions, loginVerify };
module.exports.rpId = rpId;
