'use strict';

/**
 * ICE (STUN/TURN) configuration handed to huddle clients.
 *
 * STUN alone fails for users behind symmetric NATs and most corporate
 * firewalls; a TURN relay is required for calls to connect reliably.
 * Configure exactly one TURN source (checked in this order):
 *
 *   Cloudflare Realtime TURN (managed):  CLOUDFLARE_TURN_KEY_ID + CLOUDFLARE_TURN_API_TOKEN
 *   coturn with a shared secret:         TURN_URLS + TURN_SECRET   (use-auth-secret / static-auth-secret)
 *   static credentials (Metered, etc.):  TURN_URLS + TURN_USERNAME + TURN_CREDENTIAL
 *
 * Optional: STUN_URLS (comma list, defaults to Google STUN), TURN_TTL_SECONDS
 * (default 86400), ICE_TRANSPORT_POLICY=relay to force TURN when testing it.
 */

const crypto = require('crypto');
const axios = require('axios');
const logger = require('../../../utils/logger');

const DEFAULT_STUN = ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'];

function list(value) {
  return String(value || '').split(',').map((s) => s.trim()).filter(Boolean);
}

function ttlSeconds(env) {
  const n = Number(env.TURN_TTL_SECONDS);
  return Number.isInteger(n) && n > 0 ? n : 86400;
}

/** coturn "TURN REST API" credentials: username "<expiry>:<user>", password HMAC-SHA1(secret, username). */
function coturnCredentials(secret, userId, ttl, nowMs) {
  const username = `${Math.floor(nowMs / 1000) + ttl}:${userId}`;
  const credential = crypto.createHmac('sha1', secret).update(username).digest('base64');
  return { username, credential };
}

async function cloudflareIceServers(env, ttl) {
  const url = `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(env.CLOUDFLARE_TURN_KEY_ID)}/credentials/generate`;
  const { data } = await axios.post(url, { ttl }, {
    headers: { Authorization: `Bearer ${env.CLOUDFLARE_TURN_API_TOKEN}`, 'Content-Type': 'application/json' },
    timeout: 5000,
  });
  const servers = Array.isArray(data?.iceServers) ? data.iceServers : [data?.iceServers].filter(Boolean);
  if (!servers.length) throw new Error('Cloudflare TURN response had no iceServers');
  return servers;
}

function turnMode(env = process.env) {
  if (env.CLOUDFLARE_TURN_KEY_ID && env.CLOUDFLARE_TURN_API_TOKEN) return 'cloudflare';
  if (list(env.TURN_URLS).length && env.TURN_SECRET) return 'coturn-secret';
  if (list(env.TURN_URLS).length && env.TURN_USERNAME && env.TURN_CREDENTIAL) return 'static';
  return 'none';
}

/**
 * Build the RTCPeerConnection config for one user.
 * Returns { iceServers, iceTransportPolicy, ttlSeconds, turn } where turn says
 * whether a relay is included, so clients and ops can tell STUN-only setups apart.
 */
async function buildIceConfig(userId, env = process.env, nowMs = Date.now()) {
  const ttl = ttlSeconds(env);
  const stunUrls = list(env.STUN_URLS);
  const iceServers = [{ urls: stunUrls.length ? stunUrls : DEFAULT_STUN }];
  const mode = turnMode(env);

  try {
    if (mode === 'cloudflare') {
      iceServers.push(...(await cloudflareIceServers(env, ttl)));
    } else if (mode === 'coturn-secret') {
      iceServers.push({ urls: list(env.TURN_URLS), ...coturnCredentials(env.TURN_SECRET, userId, ttl, nowMs) });
    } else if (mode === 'static') {
      iceServers.push({ urls: list(env.TURN_URLS), username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL });
    }
  } catch (err) {
    logger.error(`[huddles] TURN credentials unavailable (${mode}): ${err.message}. Falling back to STUN only.`);
  }

  const turn = iceServers.some((s) => [].concat(s.urls).some((u) => /^turns?:/i.test(u)));
  return {
    iceServers,
    iceTransportPolicy: env.ICE_TRANSPORT_POLICY === 'relay' && turn ? 'relay' : 'all',
    ttlSeconds: ttl,
    turn,
  };
}

module.exports = { buildIceConfig, coturnCredentials, turnMode, DEFAULT_STUN };
