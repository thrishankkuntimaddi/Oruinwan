/**
 * platform/sdk/socket/socketClient.js
 *
 * Chttrix Platform SDK — Socket Client
 *
 * Minimal, framework-agnostic Socket.IO client factory.
 * Returns a configured socket instance without connecting automatically.
 * The caller decides when to call socket.connect() — typically after
 * authentication and encryption initialization are confirmed complete.
 *
 * Phase: A2 — Foundation only. Event handlers, reconnection logic, and
 * room-joining strategies are added in a later integration phase.
 *
 * Peer dependency: socket.io-client (must be installed by the consuming app)
 */

// NOTE: `io` is imported from socket.io-client.
// Each platform (web, desktop, mobile) provides this dependency in its own package.json.
import { io } from 'socket.io-client';

// ─── Default Socket Configuration ────────────────────────────────────────────

const DEFAULT_OPTIONS = {
  // Do not connect automatically — the caller calls socket.connect()
  // after completing identity key initialization (E2EE Phase 1).
  autoConnect: false,

  // Prefer WebSocket transport; fall back to HTTP long-polling
  transports: ['websocket', 'polling'],

  // Include credentials for cross-origin cookie support
  withCredentials: true,

  // Reconnection defaults (can be overridden by caller)
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000,
};

// ─── Factory Function ─────────────────────────────────────────────────────────

/**
 * Create a configured Socket.IO client instance.
 *
 * @param {string} serverUrl  - Base URL of the Socket.IO server
 * @param {string} token      - JWT access token for socket authentication
 * @param {Object} [options]  - Optional overrides for socket.io-client options
 * @returns {import('socket.io-client').Socket}
 */
export function createSocket(serverUrl, token, options = {}) {
  if (!serverUrl) {
    throw new Error('[ChttrixSDK] createSocket: serverUrl is required');
  }
  if (!token) {
    throw new Error('[ChttrixSDK] createSocket: token is required');
  }

  const socket = io(serverUrl, {
    // Auth payload — server reads via socket.handshake.auth.token
    auth: { token },

    // Merge defaults with any caller overrides
    ...DEFAULT_OPTIONS,
    ...options,
  });

  return socket;
}

// ─── Default export ───────────────────────────────────────────────────────────

const socketClient = {
  createSocket,
};

export default socketClient;
