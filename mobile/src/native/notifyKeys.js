// Android: conversation keys for message notifications while the app is closed. The server can't
// read messages (end-to-end encrypted), so a push carries the message still encrypted and the
// app's Firebase handler (android/.../CallMessagingService.java) decrypts it on the phone with
// the key kept here — sealed by the Android Keystore (NotifyKeys.java). Cleared on sign-out.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { isAndroid } from './index.js';
import { toB64Bytes } from './bytes.js';

const CallSession = registerPlugin('CallSession');
export const keepsNotifyKeys = () => isAndroid && Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('CallSession');

const kept = new Set();

let supported = null;
/**
 * True when this app's Android code can keep keys and decrypt pushes (3.4+). A newer UI can
 * arrive as a quick update on an older app, so ask the native side instead of assuming: an older
 * one answers "not implemented".
 */
export async function notifyKeysSupported() {
  if (!keepsNotifyKeys()) return false;
  if (supported !== null) return supported;
  try {
    await CallSession.storeConversationKey({});
    supported = true;
  } catch (err) {
    supported = !(err?.code === 'UNIMPLEMENTED' || /not implemented/i.test(String(err?.message || '')));
  }
  return supported;
}

/** Hands one conversation key (raw bytes) to Android, once per launch. */
export function keepForNotifications(conversationId, version, raw) {
  if (!keepsNotifyKeys() || !conversationId || !raw || supported === false) return;
  const id = `${conversationId}|${version || 1}`;
  if (kept.has(id)) return;
  kept.add(id);
  CallSession.storeConversationKey({ id: String(conversationId), version: Number(version) || 1, key: toB64Bytes(raw) }).catch(() => kept.delete(id));
}

export function forgetNotificationKeys() {
  kept.clear();
  if (keepsNotifyKeys()) CallSession.clearConversationKeys().catch(() => {});
}
