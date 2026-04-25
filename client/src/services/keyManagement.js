import {
    deriveKeyFromPassword,
    decryptWorkspaceKey,
    importKey,
    base64ToArrayBuffer,
    validateCryptoSetup
} from '../utils/crypto';

const STORAGE_KEY_PREFIX = 'e2ee_workspace_key_';

async function storeWorkspaceKey(workspaceId, key) {
    try {
        
        const keyBytes = await crypto.subtle.exportKey('raw', key);
        const keyBase64 = btoa(String.fromCharCode(...new Uint8Array(keyBytes)));

        
        sessionStorage.setItem(STORAGE_KEY_PREFIX + workspaceId, keyBase64);
    } catch (error) {
        console.error('Failed to store workspace key:', error);
        throw new Error('Key storage failed');
    }
}

async function getWorkspaceKey(workspaceId) {
    try {
        const keyBase64 = sessionStorage.getItem(STORAGE_KEY_PREFIX + workspaceId);

        if (!keyBase64) {
            return null;
        }

        
        const keyBytes = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));

        
        const key = await importKey(keyBytes.buffer);

        return key;
    } catch (error) {
        console.error('Failed to retrieve workspace key:', error);
        return null;
    }
}

function removeWorkspaceKey(workspaceId) {
    sessionStorage.removeItem(STORAGE_KEY_PREFIX + workspaceId);
}

function clearAllWorkspaceKeys() {
    
    const keys = Object.keys(sessionStorage);

    
    keys.forEach(key => {
        if (key.startsWith(STORAGE_KEY_PREFIX)) {
            sessionStorage.removeItem(key);
        }
    });
}

export async function enrollUserKeys(password, encryptedKeys) {
    try {
        validateCryptoSetup();

        const enrolledWorkspaces = [];

        
        for (let i = 0; i < encryptedKeys.length; i++) {
            const item = encryptedKeys[i];
            const { workspaceId, encryptedKey, iv, salt } = item;

            try {
                
                const saltBytes = base64ToArrayBuffer(salt);

                
                const kek = await deriveKeyFromPassword(password, new Uint8Array(saltBytes));

                
                const workspaceKey = await decryptWorkspaceKey(encryptedKey, iv, kek);

                
                await storeWorkspaceKey(workspaceId, workspaceKey);

                enrolledWorkspaces.push(workspaceId);
            } catch (keyError) {
                console.error(`❌ [enrollUserKeys] Failed to process workspace ${workspaceId}:`, keyError);
                
            }
        }

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

export function hasWorkspaceKey(workspaceId) {
    return sessionStorage.getItem(STORAGE_KEY_PREFIX + workspaceId) !== null;
}

export function getEnrolledWorkspaces() {
    const keys = Object.keys(sessionStorage);
    return keys
        .filter(key => key.startsWith(STORAGE_KEY_PREFIX))
        .map(key => key.replace(STORAGE_KEY_PREFIX, ''));
}

export function clearAllKeys() {
    clearAllWorkspaceKeys();
}

export async function refreshWorkspaceKeys(password, workspaceId = null) {
    try {
        
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

        
        return await enrollUserKeys(password, encryptedKeys);
    } catch (error) {
        console.error('Key refresh failed:', error);
        return { success: false, error: error.message };
    }
}

const keyManagementService = {
    enrollUserKeys,
    getWorkspaceKey,
    hasWorkspaceKey,
    getEnrolledWorkspaces,
    clearAllKeys,
    refreshWorkspaceKeys
};

export default keyManagementService;
