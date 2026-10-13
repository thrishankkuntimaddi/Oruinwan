// Encryption in the demo. The demo has no server to hold identity keys, so every demo
// conversation shares one AES-256-GCM key made on this device. Messages still go through the
// client's normal end-to-end code path (services/messageEncryptionService.js): sample messages
// are encrypted with this key and decrypted like any other.

let keyPromise = null;

/** The demo conversation key (one per app session; demo data is rebuilt with it). */
export function demoConversationKey() {
  if (!keyPromise) {
    keyPromise = crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  }
  return keyPromise;
}

/** Encrypts sample text exactly as the composer would. */
export async function encryptForDemo(text, conversationId, conversationType, parentId = null) {
  const { encryptMessageForSending } = await import('../../services/messageEncryptionService');
  return encryptMessageForSending(text, conversationId, conversationType, parentId);
}
