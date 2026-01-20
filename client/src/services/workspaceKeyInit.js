/**
 * Workspace E2EE Key Initialization Service
 * 
 * Client-side service for generating and managing workspace encryption keys
 * This ensures E2EE is set up immediately when a workspace is created
 */

import { generateWorkspaceKey, deriveKeyFromPassword, encryptMessage, generateSalt, arrayBufferToBase64 } from '../utils/crypto';

/**
 * Initialize E2EE keys for a new workspace
 * 
 * This function:
 * 1. Generates a random workspace encryption key
 * 2. Derives a KEK from the user's password
 * 3. Encrypts the workspace key with the KEK
 * 4. Returns the encrypted key data to send to the server
 * 
 * @param {string} password - User's password (retrieved from session or prompted)
 * @returns {Promise<{encryptedKey: string, keyIv: string, pbkdf2Salt: string}>}
 */
export async function initializeWorkspaceKeys(password) {
    try {
        console.log('🔐 [initializeWorkspaceKeys] Generating workspace master key...');

        // 1. Generate random workspace encryption key (256-bit AES key)
        const workspaceKey = await generateWorkspaceKey();
        console.log('✅ [initializeWorkspaceKeys] Workspace key generated');

        // 2. Generate salt for PBKDF2
        const salt = generateSalt();
        console.log('✅ [initializeWorkspaceKeys] Salt generated');

        // 3. Derive KEK from user's password
        console.log('🔓 [initializeWorkspaceKeys] Deriving KEK from password...');
        const kek = await deriveKeyFromPassword(password, salt);
        console.log('✅ [initializeWorkspaceKeys] KEK derived');

        // 4. Encrypt workspace key with KEK
        console.log('🔒 [initializeWorkspaceKeys] Encrypting workspace key...');
        const { ciphertext, iv } = await encryptMessage(
            arrayBufferToBase64(await crypto.subtle.exportKey('raw', workspaceKey)),
            kek
        );
        console.log('✅ [initializeWorkspaceKeys] Workspace key encrypted');

        // 5. Return encrypted key data
        const result = {
            encryptedKey: ciphertext,
            keyIv: iv,
            pbkdf2Salt: arrayBufferToBase64(salt)
        };

        console.log('✅ [initializeWorkspaceKeys] Key initialization complete');
        return result;

    } catch (error) {
        console.error('❌ [initializeWorkspaceKeys] Failed to initialize workspace keys:', error);
        throw new Error(`Workspace key initialization failed: ${error.message}`);
    }
}

/**
 * Get user password from session or prompt user
 * 
 * The password was stored in sessionStorage during login for E2EE purposes
 * If not available, we need to prompt the user
 * 
 * @returns {Promise<string|null>} Password or null if unavailable
 */
export async function getUserPasswordForKeyInit() {
    // Check if password is available from login session
    const sessionPassword = sessionStorage.getItem('e2ee_unlock_password');

    if (sessionPassword) {
        console.log('✅ [getUserPasswordForKeyInit] Retrieved password from session');
        return sessionPassword;
    }

    console.warn('⚠️ [getUserPasswordForKeyInit] Password not found in session');
    console.warn('⚠️ [getUserPasswordForKeyInit] User may need to re-enter password');

    // If password is not in session, we need to prompt the user
    // This would require a modal/prompt in the UI
    return null;
}

/**
 * Auto-enroll creator in newly created workspace
 * 
 * After the workspace is created on the server, we need to:
 * 1. Get the workspace ID from the server response
 * 2. Decrypt the workspace key
 * 3. Store it in sessionStorage for immediate use
 * 
 * @param {string} workspaceId - The newly created workspace ID
 * @param {string} password - User's password
 * @param {Object} keyData - The encrypted key data we sent to server
 */
export async function enrollCreatorInWorkspace(workspaceId, password, keyData) {
    try {
        console.log(`🔐 [enrollCreatorInWorkspace] Enrolling in workspace: ${workspaceId}`);

        const { encryptedKey, keyIv, pbkdf2Salt } = keyData;

        // Import the crypto module functions
        const { base64ToArrayBuffer, decryptMessage, importKey } = await import('../utils/crypto');

        // 1. Derive KEK from password (same as during creation)
        const saltBytes = base64ToArrayBuffer(pbkdf2Salt);
        const kek = await deriveKeyFromPassword(password, new Uint8Array(saltBytes));

        // 2. Decrypt the workspace key
        const workspaceKeyBase64 = await decryptMessage(encryptedKey, keyIv, kek);

        // 3. Import as CryptoKey
        const workspaceKeyBytes = base64ToArrayBuffer(workspaceKeyBase64);
        const workspaceKey = await importKey(workspaceKeyBytes);

        // 4. Store in sessionStorage
        const keyBytes = await crypto.subtle.exportKey('raw', workspaceKey);
        const keyBase64 = btoa(String.fromCharCode(...new Uint8Array(keyBytes)));
        sessionStorage.setItem(`e2ee_workspace_key_${workspaceId}`, keyBase64);

        console.log(`✅ [enrollCreatorInWorkspace] Successfully enrolled in workspace: ${workspaceId}`);
        return true;

    } catch (error) {
        console.error(`❌ [enrollCreatorInWorkspace] Failed to enroll in workspace:`, error);
        return false;
    }
}
