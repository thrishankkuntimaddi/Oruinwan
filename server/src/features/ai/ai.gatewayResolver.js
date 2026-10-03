'use strict';

/**
 * Which AI gateway this process talks to:
 *   AI_SERVICE_URL set   -> the standalone AI process over HTTP (ai.remote.js)
 *   otherwise            -> the in-process gateway (ai/api/ai.gateway.js), today's behaviour
 *
 * `gateway()` returns the chosen backend. The module itself also delegates
 * every method (gateway.chat(...), gateway.configure(...)) so call sites only
 * change their require line.
 */

const local = require('../../../../ai/api/ai.gateway');
const { createRemoteGateway } = require('./ai.remote');

let remote = null;
let remoteUrl = null;

function gateway(env = process.env) {
  const url = env.AI_SERVICE_URL;
  if (!url) return local;
  if (!remote || remoteUrl !== url) {
    remote = createRemoteGateway({ baseUrl: url, token: env.AI_SERVICE_TOKEN });
    remoteUrl = url;
  }
  return remote;
}

/** Test hook: forget the cached remote client. */
function _reset() { remote = null; remoteUrl = null; }

module.exports = new Proxy({ gateway, _reset }, {
  get(target, key) {
    if (key in target) return target[key];
    const backend = gateway();
    const value = backend[key];
    return typeof value === 'function' ? value.bind(backend) : value;
  },
});
