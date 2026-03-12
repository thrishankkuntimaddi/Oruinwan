// client/src/utils/tokenUtils.js
//
// Compatibility wrapper — delegates to the Platform SDK token manager.
// All existing imports throughout the web client continue to work unchanged.
//
// Migration path:
//   client code → tokenUtils.js (this file) → platform/sdk/auth/tokenManager.js

import sdkTokenManager from '../../../../platform/sdk/auth/tokenManager.js';

// ─── Re-exports: SDK names ────────────────────────────────────────────────────
// Expose the full SDK surface so any new code can use canonical names directly.

export const { getAccessToken, getRefreshToken, setTokens, clearTokens, hasAccessToken } = sdkTokenManager;

// ─── Legacy aliases ───────────────────────────────────────────────────────────
// These names are used by existing imports across the web client.
// They are kept as-is so that no other file needs to be modified.

/** @deprecated Use setTokens({ accessToken }) from the SDK instead */
export const saveAccessToken = (token) => sdkTokenManager.setTokens({ accessToken: token });

/** @deprecated Use clearTokens() from the SDK instead */
export const clearAccessToken = () => sdkTokenManager.clearTokens();

