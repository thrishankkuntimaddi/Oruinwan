'use strict';

/**
 * Test-only Google sign-in for the E2E server (preloaded with --require by start-stack.js;
 * never part of the app). Google can't issue tokens in a test, so a token that reads
 * "e2e-google:<email>" stands for a verified Google account with that email. The browser
 * side is a fake of Google's sign-in script (tests/helpers.js loginWithGoogle).
 */

const path = require('path');

const serverDir = path.join(__dirname, '..', '..', 'server');
const fromServer = (mod) => require(require.resolve(mod, { paths: [serverDir] }));
const PREFIX = 'e2e-google:';

const emailOf = (token) => (typeof token === 'string' && token.startsWith(PREFIX) ? token.slice(PREFIX.length) : null);
const profileOf = (email) => ({ email, email_verified: true, name: email.split('@')[0], sub: `e2e-${email}` });

const { OAuth2Client } = fromServer('google-auth-library');
OAuth2Client.prototype.verifyIdToken = async function verifyIdToken({ idToken }) {
  const email = emailOf(idToken);
  if (!email) throw new Error('Not an E2E Google token');
  return { getPayload: () => profileOf(email) };
};
OAuth2Client.prototype.getTokenInfo = async function getTokenInfo(accessToken) {
  const email = emailOf(accessToken);
  if (!email) throw new Error('Not an E2E Google token');
  return { aud: process.env.GOOGLE_CLIENT_ID, sub: `e2e-${email}` };
};

const axios = fromServer('axios');
const realGet = axios.get.bind(axios);
axios.get = async (url, config = {}) => {
  if (String(url).startsWith('https://www.googleapis.com/oauth2/v3/userinfo')) {
    const email = emailOf(String(config.headers?.Authorization || '').replace(/^Bearer /, ''));
    if (email) return { data: profileOf(email) };
  }
  return realGet(url, config);
};
