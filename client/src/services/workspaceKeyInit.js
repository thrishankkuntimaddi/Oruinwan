import { generateWorkspaceKey, arrayBufferToBase64, generateSalt } from '../utils/crypto';

export async function initializeWorkspaceKeys() {
    try {
        
        const workspaceKey = await generateWorkspaceKey();

        
        const keyBytes = await crypto.subtle.exportKey('raw', workspaceKey);
        const keyBase64 = arrayBufferToBase64(keyBytes);

        
        
        const iv = generateSalt(); 
        const salt = generateSalt(); 

        
        const result = {
            encryptedKey: keyBase64, 
            keyIv: arrayBufferToBase64(iv),
            pbkdf2Salt: arrayBufferToBase64(salt)
        };

        return result;

    } catch (error) {
        console.error('❌ [initializeWorkspaceKeys] Failed to initialize workspace keys:', error);
        throw new Error(`Workspace key initialization failed: ${error.message}`);
    }
}

export async function getUserPasswordForKeyInit() {
    
    return null;
}

export async function enrollCreatorInWorkspace(workspaceId, keyData) {
    try {
        const { encryptedKey } = keyData;

        
        
        sessionStorage.setItem(`e2ee_workspace_key_${workspaceId}`, encryptedKey);

        return true;

    } catch (error) {
        console.error(`❌ [enrollCreatorInWorkspace] Failed to enroll in workspace:`, error);
        return false;
    }
}
