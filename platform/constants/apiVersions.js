/**
 * platform/constants/apiVersions.js
 *
 * Chttrix Platform — API Version Constants
 *
 * Defines the canonical API version identifiers used across the platform.
 * All clients (web, desktop, mobile) and server routing should reference
 * these constants when constructing endpoint paths.
 *
 * Current state of the server:
 *   /api/         — V1 legacy routes (being migrated)
 *   /api/v2/      — V2 modular routes (canonical, preferred)
 *   v1-to-v2-proxy.js — backward-compat shim (temporary)
 *
 * Phase A4: Definition only — no integration yet.
 * Integration phase will replace inline version strings in:
 *   • client/src/services/*.js
 *   • server/server.js route mounts
 */

export const API_VERSIONS = Object.freeze({
    V1: 'v1',
    V2: 'v2',
});

/**
 * The canonical version all new client code should target.
 * Older V1 paths remain alive via the server compatibility proxy
 * until full migration is complete.
 */
export const DEFAULT_API_VERSION = API_VERSIONS.V2;

/**
 * Convenience helpers for constructing versioned API path prefixes.
 *
 * Usage:
 *   `${API_PREFIX.V2}/messages`  →  "/api/v2/messages"
 *   `${API_PREFIX.V1}/chat`      →  "/api/v1/chat"
 */
export const API_PREFIX = Object.freeze({
    V1: `/api/${API_VERSIONS.V1}`,
    V2: `/api/${API_VERSIONS.V2}`,
    /** Root prefix for V1 legacy routes mounted directly at /api/ */
    LEGACY: '/api',
});
