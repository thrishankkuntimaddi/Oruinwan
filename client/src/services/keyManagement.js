/**
 * Key Management Service
 * 
 * Handles encryption key lifecycle:
 * - Fetching workspace keys from server
 * - Decrypting keys with user password
 * - Storing keys in memory (sessionStorage)
 * - Clearing keys on logout
 */

import {
    deriveKeyFromPassword,
    decryptWorkspaceKey,
    importKey,
    base64ToArrayBuffer,
    validateCryptoSetup
} from '../utils/crypto';

// ==================== CONSTANTS ====================

const STORAGE_KEY_PREFIX = 'e2ee_workspace_key_';

// ==================== KEY STORAGE ====================

/**
 * Store workspace key in sessionStorage
 * Keys are stored as Base64-encoded raw bytes
 * 
 * @param {string} workspaceId - Workspace ID
 * @param {CryptoKey} key - Workspace encryption key
 */
async function storeWorkspaceKey(workspaceId, key) {
    try {
        // Export key to raw bytes
        const keyBytes = await crypto.subtle.exportKey('raw', key);
        const keyBase64 = btoa(String.fromCharCode(...new Uint8Array(keyBytes)));

        // Store in sessionStorage
        sessionStorage.setItem(STORAGE_KEY_PREFIX + workspaceId, keyBase64);
    } catch (error) {
        console.error('Failed to store workspace key:', error);
        throw new Error('Key storage failed');
    }
}

/**
 * Retrieve workspace key from sessionStorage
 * 
 * @param {string} workspaceId - Workspace ID
 * @returns {Promise<CryptoKey|null>} Workspace key or null if not found
 */
async function getWorkspaceKey(workspaceId) {
    try {
        const keyBase64 = sessionStorage.getItem(STORAGE_KEY_PREFIX + workspaceId);

        if (!keyBase64) {
            return null;
        }

        // Convert Base64 to ArrayBuffer
        const keyBytes = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));

        // Import as CryptoKey
        const key = await importKey(keyBytes.buffer);

        return key;
    } catch (error) {
        console.error('Failed to retrieve workspace key:', error);
        return null;
    }
}

/**
 * Remove workspace key from storage
 * Called when user leaves a workspace
 * 
 * @param {string} workspaceId - Workspace ID
 */
// eslint-disable-next-line no-unused-vars
function removeWorkspaceKey(workspaceId) {
    sessionStorage.removeItem(STORAGE_KEY_PREFIX + workspaceId);
}

/**
 * Clear all workspace keys from storage
 * Called on logout
 */
function clearAllWorkspaceKeys() {
    // Get all keys from sessionStorage
    const keys = Object.keys(sessionStorage);

    // Remove all workspace keys
    keys.forEach(key => {
        if (key.startsWith(STORAGE_KEY_PREFIX)) {
            sessionStorage.removeItem(key);
        }
    });
}

// ==================== KEY ENROLLMENT ====================

/**
 * Enroll user in workspace (decrypt and store workspace keys)
 * Called on login or when joining new workspace
 * 
 * @param {string} password - User's password
 * @param {Array} encryptedKeys - Encrypted workspace keys from server
 * @returns {Promise<{success: boolean, workspaceIds: string[]}>}
 */
export async function enrollUserKeys(password, encryptedKeys) {
    try {
        console.log('🔐 [enrollUserKeys] Starting enrollment process...');
        console.log('🔐 [enrollUserKeys] Number of keys to process:', encryptedKeys.length);

        validateCryptoSetup();
        console.log('✅ [enrollUserKeys] Crypto setup validated');

        const enrolledWorkspaces = [];

        // Process each workspace key
        for (let i = 0; i < encryptedKeys.length; i++) {
            const item = encryptedKeys[i];
            const { workspaceId, encryptedKey, iv, salt } = item;

            console.log(`🔑 [enrollUserKeys] Processing workspace ${i + 1}/${encryptedKeys.length}: ${workspaceId}`);
            console.log(`🔑 [enrollUserKeys] Key data present:`, {
                hasEncryptedKey: !!encryptedKey,
                hasIv: !!iv,
                hasSalt: !!salt
            });

            try {
                // Convert salt from Base64
                const saltBytes = base64ToArrayBuffer(salt);
                console.log(`🔓 [enrollUserKeys] Deriving KEK from password for ${workspaceId}...`);

                // Derive KEK from password
                const kek = await deriveKeyFromPassword(password, new Uint8Array(saltBytes));
                console.log(`✅ [enrollUserKeys] KEK derived for ${workspaceId}`);

                // Decrypt workspace key
                console.log(`🔓 [enrollUserKeys] Decrypting workspace key for ${workspaceId}...`);
                const workspaceKey = await decryptWorkspaceKey(encryptedKey, iv, kek);
                console.log(`✅ [enrollUserKeys] Workspace key decrypted for ${workspaceId}`);

                // Store workspace key
                console.log(`💾 [enrollUserKeys] Storing key in sessionStorage for ${workspaceId}...`);
                await storeWorkspaceKey(workspaceId, workspaceKey);

                // Verify storage
                const stored = sessionStorage.getItem(STORAGE_KEY_PREFIX + workspaceId);
                console.log(`✅ [enrollUserKeys] Key stored for ${workspaceId}:`, stored ? 'YES' : 'NO');

                enrolledWorkspaces.push(workspaceId);
            } catch (keyError) {
                console.error(`❌ [enrollUserKeys] Failed to process workspace ${workspaceId}:`, keyError);
                // Continue processing other keys even if one fails
            }
        }

        console.log(`✅ [enrollUserKeys] Enrolled in ${enrolledWorkspaces.length}/${encryptedKeys.length} workspaces`);
        console.log(`✅ [enrollUserKeys] Successfully enrolled workspaces:`, enrolledWorkspaces);

        return {
            success: true,
            workspaceIds: enrolledWorkspaces
        };
    } catch (error) {
        console.error('❌ [enrollUserKeys] Enrollment failed:', error);
        console.error('❌ [enrollUserKeys] Error details:', {
            message: error.message,
            stack: error.stack
        });
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Check if user has key for workspace
 * 
 * @param {string} workspaceId - Workspace ID
 * @returns {boolean} True if key exists
 */
export function hasWorkspaceKey(workspaceId) {
    return sessionStorage.getItem(STORAGE_KEY_PREFIX + workspaceId) !== null;
}

/**
 * Get all enrolled workspace IDs
 * 
 * @returns {string[]} Array of workspace IDs
 */
export function getEnrolledWorkspaces() {
    const keys = Object.keys(sessionStorage);
    return keys
        .filter(key => key.startsWith(STORAGE_KEY_PREFIX))
        .map(key => key.replace(STORAGE_KEY_PREFIX, ''));
}

// ==================== LOGOUT ====================

/**
 * Clear all encryption keys from memory
 * MUST be called on logout for security
 */
export function clearAllKeys() {
    clearAllWorkspaceKeys();
    console.log('🔒 All encryption keys cleared');
}

// ==================== KEY REFRESH ====================

/**
 * Refresh workspace keys from server
 * Used when user joins/leaves workspaces
 * 
 * @param {string} password - User's password
 * @param {string} workspaceId - Specific workspace to refresh (optional)
 * @returns {Promise<{success: boolean}>}
 */
export async function refreshWorkspaceKeys(password, workspaceId = null) {
    try {
        // Fetch encrypted keys from server
        const url = workspaceId
            ? `/api/v2/encryption/keys?workspaceId=${workspaceId}`
            : '/api/v2/encryption/keys';

        const response = await fetch(url, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to fetch workspace keys');
        }

        const { encryptedKeys } = await response.json();

        // Enroll (decrypt and store)
        return await enrollUserKeys(password, encryptedKeys);
    } catch (error) {
        console.error('Key refresh failed:', error);
        return { success: false, error: error.message };
    }
}

// ==================== EXPORTS ====================

const keyManagementService = {
    enrollUserKeys,
    hasWorkspaceKey,
    getEnrolledWorkspaces,
    clearAllKeys,
    refreshWorkspaceKeys
};

export default keyManagementService;
