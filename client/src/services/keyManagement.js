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
const STORAGE_KEK = 'e2ee_kek';
const STORAGE_SALT = 'e2ee_salt';

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
 * 
 * @param {string} workspaceId - Workspace ID
 */
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

    // Also clear KEK and salt
    sessionStorage.removeItem(STORAGE_KEK);
    sessionStorage.removeItem(STORAGE_SALT);
}

// ==================== KEK MANAGEMENT ====================

/**
 * Store Key Encryption Key (KEK) in sessionStorage
 * Used to decrypt workspace keys
 * 
 * @param {CryptoKey} kek - Key Encryption Key
 */
async function storeKEK(kek) {
    try {
        const kekBytes = await crypto.subtle.exportKey('raw', kek);
        const kekBase64 = btoa(String.fromCharCode(...new Uint8Array(kekBytes)));
        sessionStorage.setItem(STORAGE_KEK, kekBase64);
    } catch (error) {
        console.error('Failed to store KEK:', error);
    }
}

/**
 * Retrieve KEK from sessionStorage
 * 
 * @returns {Promise<CryptoKey|null>} KEK or null
 */
async function getKEK() {
    try {
        const kekBase64 = sessionStorage.getItem(STORAGE_KEK);
        if (!kekBase64) return null;

        const kekBytes = Uint8Array.from(atob(kekBase64), c => c.charCodeAt(0));
        return await importKey(kekBytes.buffer);
    } catch (error) {
        console.error('Failed to retrieve KEK:', error);
        return null;
    }
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
        validateCryptoSetup();

        const enrolledWorkspaces = [];

        // Process each workspace key
        for (const item of encryptedKeys) {
            const { workspaceId, encryptedKey, iv, salt } = item;

            // Convert salt from Base64
            const saltBytes = base64ToArrayBuffer(salt);

            // Derive KEK from password
            const kek = await deriveKeyFromPassword(password, new Uint8Array(saltBytes));

            // Decrypt workspace key
            const workspaceKey = await decryptWorkspaceKey(encryptedKey, iv, kek);

            // Store workspace key
            await storeWorkspaceKey(workspaceId, workspaceKey);

            // Store KEK (first one only, same for all workspaces per user)
            if (enrolledWorkspaces.length === 0) {
                await storeKEK(kek);
                sessionStorage.setItem(STORAGE_SALT, salt);
            }

            enrolledWorkspaces.push(workspaceId);
        }

        console.log(`✅ Enrolled in ${enrolledWorkspaces.length} workspaces`);

        return {
            success: true,
            workspaceIds: enrolledWorkspaces
        };
    } catch (error) {
        console.error('Key enrollment failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get workspace key for encryption/decryption
 * Returns cached key from memory
 * 
 * @param {string} workspaceId - Workspace ID
 * @returns {Promise<CryptoKey|null>} Workspace key or null
 */
export async function getWorkspaceKeyForEncryption(workspaceId) {
    return await getWorkspaceKey(workspaceId);
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
    getWorkspaceKeyForEncryption,
    hasWorkspaceKey,
    getEnrolledWorkspaces,
    clearAllKeys,
    refreshWorkspaceKeys
};

export default keyManagementService;
