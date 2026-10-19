'use strict';

// Proof that an email address or phone number was verified with a one-time code.
// The verify endpoint records it; company sign-up checks it on the server, so sign-up
// does not depend on the web page having asked for the codes.
const otpStore = require('./otpStore');

const PROOF_TTL_MS = 30 * 60 * 1000;

// Emails are compared case-insensitively. Phones keep only digits and a leading "+", so
// "+91 000-000-0000" and "+910000000000" are the same number.
function proofKey(target) {
  const t = String(target || '').trim();
  const normalized = t.includes('@') ? t.toLowerCase() : t.replace(/[^0-9+]/g, '');
  return `otp-verified:${normalized}`;
}

async function markVerified(target) {
  await otpStore.set(proofKey(target), true, PROOF_TTL_MS);
}

async function isVerified(target) {
  return (await otpStore.get(proofKey(target))) === true;
}

function smsConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}

module.exports = { proofKey, markVerified, isVerified, smsConfigured, PROOF_TTL_MS };
