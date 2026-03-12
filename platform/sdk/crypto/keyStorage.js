/**
 * platform/sdk/crypto/keyStorage.js
 *
 * Chttrix Platform SDK — Key Storage Façade
 *
 * SDK abstraction for encryption key lifecycle management.
 * Delegates entirely to the existing implementation in:
 *   client/src/services/keyManagement.js
 *
 * No logic lives here — this is a pure pass-through façade.
 * Mobile clients will replace the underlying sessionStorage
 * implementation with AsyncStorage or SecureStore while keeping
 * the same exported function signatures.
 *
 * Phase A5: Façade only — no behavioral change.
 *
 * ⚠️  DO NOT change key storage formats or session handling.
 *     clearAllKeys() MUST be called on logout for security — do not remove.
 */

export {
    // ── Key lifecycle ───────────────────────────────────────────────────────

    /**
     * Decrypt server-provided encrypted keys and store in sessionStorage.
     * Called on login or when joining a new workspace.
     * @param {string} password - User's plaintext password
     * @param {Array}  encryptedKeys - Encrypted workspace key blobs from server
     * @returns {Promise<{success: boolean, workspaceIds: string[]}>}
     */
    enrollUserKeys,

    /**
     * Check whether the user has a decrypted workspace key in storage.
     * @param {string} workspaceId
     * @returns {boolean}
     */
    hasWorkspaceKey,

    /**
     * Return all workspace IDs currently enrolled in sessionStorage.
     * @returns {string[]}
     */
    getEnrolledWorkspaces,

    /**
     * Clear all workspace encryption keys from sessionStorage.
     * MUST be called on logout.
     */
    clearAllKeys,

    /**
     * Re-fetch encrypted keys from the server and re-enroll.
     * Used when user joins or leaves workspaces.
     * @param {string} password
     * @param {string|null} workspaceId - Specific workspace or null for all
     * @returns {Promise<{success: boolean}>}
     */
    refreshWorkspaceKeys,

    // ── Default export ──────────────────────────────────────────────────────
    default as keyManagement,
} from '../../../client/src/services/keyManagement.js';
