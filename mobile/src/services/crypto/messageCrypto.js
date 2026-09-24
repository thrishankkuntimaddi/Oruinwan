/**
 * Message encryption — mirrors client/src/services/messageEncryptionService.js.
 * Payload: { ciphertext: b64(AES-GCM(ct||tag)), messageIv: b64(12 bytes), isEncrypted: true }.
 */
import { aesGcmDecrypt, aesGcmEncrypt, deriveThreadKey } from './aes';
import { base64ToBytes, bytesToBase64, utf8Decode } from './encoding';
import { getConversationKey, KeyError } from './conversationKeys';

const NON_ENCRYPTED_TYPES = {
  poll: '📊 Poll', image: '📷 Photo', video: '🎬 Video', file: '📎 File',
  voice: '🎤 Voice message', contact: '👤 Contact', meeting: '📅 Meeting',
  screen_recording: '🎥 Screen recording', checklist: '☑️ Checklist',
};

export async function encryptForSend(plaintext, conversationId, type) {
  const key = await getConversationKey(conversationId, type);
  const { ciphertext, iv } = aesGcmEncrypt(key, plaintext);
  return { ciphertext: bytesToBase64(ciphertext), messageIv: bytesToBase64(iv), isEncrypted: true };
}

/**
 * Adds `_text` (display text) and `_state` to a message:
 *  ok | system | deleted | attachment | failed | locked | nokey | plain
 */
export function decryptWithKey(message, key, keyError) {
  if (!message || message._state === 'ok') return message;
  if (message.isDeletedUniversally || message.isDeleted) {
    return { ...message, _state: 'deleted', _text: message.deletedByName ? `Deleted by ${message.deletedByName}` : 'This message was deleted' };
  }
  if (message.type === 'system') {
    return { ...message, _state: 'system', _text: message.systemData?.text || message.text || 'System event' };
  }
  if (NON_ENCRYPTED_TYPES[message.type]) {
    const name = message.attachments?.[0]?.name;
    return { ...message, _state: 'attachment', _text: name ? `${NON_ENCRYPTED_TYPES[message.type]} · ${name}` : NON_ENCRYPTED_TYPES[message.type] };
  }
  const p = message.payload?.payload || message.payload || message;
  if (!p?.ciphertext || !p?.messageIv) {
    return { ...message, _state: 'plain', _text: message.payload?.text || message.text || '' };
  }
  if (!key) {
    const locked = keyError?.code === 'LOCKED';
    return { ...message, _state: locked ? 'locked' : 'nokey', _text: locked ? '🔒 Encrypted — unlock to read' : '🔒 Encrypted message (key unavailable)' };
  }
  try {
    const k = message.parentId && message.isThreadEncrypted === true ? deriveThreadKey(key, String(message.parentId)) : key;
    const plain = aesGcmDecrypt(k, base64ToBytes(p.messageIv), base64ToBytes(p.ciphertext));
    return { ...message, _state: 'ok', _text: utf8Decode(plain) };
  } catch (_) {
    return { ...message, _state: 'failed', _text: '🔒 Unable to decrypt message' };
  }
}

/** Resolve the key once, then decrypt a batch. Returns { messages, keyError }. */
export async function decryptMessages(messages, conversationId, type) {
  let key = null;
  let keyError = null;
  try {
    key = await getConversationKey(conversationId, type);
  } catch (err) {
    keyError = err instanceof KeyError ? err : new KeyError('ERROR', err?.message);
  }
  return { messages: messages.map((m) => decryptWithKey(m, key, keyError)), keyError };
}
