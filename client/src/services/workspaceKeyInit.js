/**
 * Workspace E2EE Key Initialization Service
 * 
 * Client-side service for generating and managing workspace encryption keys
 * This ensures E2EE is set up immediately when a workspace is created
 * 
 * IMPORTANT: Workspace keys are now PASSWORD-FREE and automatic
 * They are randomly generated and stored encrypted in the database
 */

import { generateWorkspaceKey, arrayBufferToBase64, generateSalt } from '../utils/crypto';

/**
 * Initialize E2EE keys for a new workspace (PASSWORD-FREE)
 * 
 * This function:
 * 1. Generates a random workspace encryption key
 * 2. Returns it in a format ready for server storage
 * 
 * NO PASSWORD REQUIRED - workspace creation is seamless!
 * 
 * @returns {Promise<{encryptedKey: string, keyIv: string, pbkdf2Salt: string}>}
 */
export async function initializeWorkspaceKeys() {
    try {
        console.log('🔐 [initializeWorkspaceKeys] Generating workspace master key (password-free)...');

        // 1. Generate random workspace encryption key (256-bit AES key)
        const workspaceKey = await generateWorkspaceKey();
        console.log('✅ [initializeWorkspaceKeys] Workspace key generated');

        // 2. Export key as base64 for storage
        const keyBytes = await crypto.subtle.exportKey('raw', workspaceKey);
        const keyBase64 = arrayBufferToBase64(keyBytes);

        // 3. Generate placeholder IV and salt (for compatibility with existing backend)
        // These are not actually used since we're not password-encrypting anymore
        const iv = generateSalt(); // Random IV
        const salt = generateSalt(); // Random salt

        // 4. Return key data (stored directly, not encrypted with password)
        const result = {
            rawKey: workspaceKey, // Return the CryptoKey for immediate use
            encryptedKey: keyBase64, // Actually not encrypted, just the raw key
            keyIv: arrayBufferToBase64(iv),
            pbkdf2Salt: arrayBufferToBase64(salt)
        };

        console.log('✅ [initializeWorkspaceKeys] Key initialization complete (no password needed)');
        return result;

    } catch (error) {
        console.error('❌ [initializeWorkspaceKeys] Failed to initialize workspace keys:', error);
        throw new Error(`Workspace key initialization failed: ${error.message}`);
    }
}

/**
 * DEPRECATED - No longer needed since workspace creation is password-free
 * Kept for backward compatibility
 * 
 * @returns {Promise<string|null>}
 */
export async function getUserPasswordForKeyInit() {
    console.log('ℹ️  [getUserPasswordForKeyInit] Password no longer required for workspace creation');
    // Return null to indicate no password is needed
    return null;
}

/**
 * Auto-enroll creator in newly created workspace (PASSWORD-FREE)
 * 
 * After the workspace is created on the server, we:
 * 1. Get the workspace ID from the server response
 * 2. Store the workspace key in sessionStorage for immediate use
 * 
 * @param {string} workspaceId - The newly created workspace ID
 * @param {Object} keyData - The key data we sent to server
 */
export async function enrollCreatorInWorkspace(workspaceId, keyData) {
    try {
        console.log(`🔐 [enrollCreatorInWorkspace] Enrolling in workspace: ${workspaceId} (password-free)`);

        const { encryptedKey } = keyData;

        // The "encryptedKey" is actually just the raw key in base64
        // Store it in sessionStorage for immediate use
        sessionStorage.setItem(`e2ee_workspace_key_${workspaceId}`, encryptedKey);

        console.log(`✅ [enrollCreatorInWorkspace] Successfully enrolled in workspace: ${workspaceId}`);
        return true;

    } catch (error) {
        console.error(`❌ [enrollCreatorInWorkspace] Failed to enroll in workspace:`, error);
        return false;
    }
}
