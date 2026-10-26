/**
 * Desktop notification quick reply.
 *
 * On macOS and Windows the desktop app's native notifications have an inline Reply field
 * (desktop/electron/main.js). The main process validates the reply and hands it to this page
 * as { workspaceId, channelId | dmSessionId, text } via window.electronAPI.onQuickReply.
 *
 * Messages are end-to-end encrypted, so the reply goes through the same path as the composer
 * (src/hooks/useMessageActions.js → sendMessage): the conversation key from
 * conversationKeyService, encryptMessageForSending (AES-GCM), then POST to
 * /api/v2/messages/{channel|direct} with only ciphertext + IV. Plaintext never leaves the page.
 * Both services are module singletons, so no React context is needed; while the keys are
 * still locked encryption fails and the conversation is opened instead, to retry there.
 */

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_TEXT = 4000;

/** A reply as received over IPC → a validated reply, or null. Mirrors desktop/electron/trayState.js. */
export function normalizeReply(reply) {
    if (!reply || typeof reply !== 'object') return null;
    const { workspaceId, channelId, dmSessionId, text } = reply;
    if (typeof workspaceId !== 'string' || !SAFE_ID.test(workspaceId)) return null;
    if (typeof text !== 'string') return null;
    const body = text.trim().slice(0, MAX_TEXT);
    if (!body) return null;
    if (typeof channelId === 'string' && SAFE_ID.test(channelId)) return { workspaceId, channelId, text: body };
    if (typeof dmSessionId === 'string' && SAFE_ID.test(dmSessionId)) return { workspaceId, dmSessionId, text: body };
    return null;
}

async function defaultDeps() {
    const [{ encryptMessageForSending }, { default: api }] = await Promise.all([
        import('../services/messageEncryptionService'),
        import('../services/api'),
    ]);
    return {
        encrypt: encryptMessageForSending,
        post: (url, body) => api.post(url, body),
    };
}

const tempId = () => `temp_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

/**
 * Encrypts and sends one reply. Resolves true when the server accepted it.
 * `deps` ({ encrypt, post }) is for tests; the app uses the real services.
 */
export async function sendQuickReply(reply, deps) {
    const r = normalizeReply(reply);
    if (!r) return false;
    const { encrypt, post } = deps || await defaultDeps();
    const isChannel = Boolean(r.channelId);
    const conversationId = isChannel ? r.channelId : r.dmSessionId;
    const clientTempId = tempId();
    const sendOnce = async () => {
        const { ciphertext, messageIv, keyVersion } = await encrypt(r.text, conversationId, isChannel ? 'channel' : 'dm', null);
        if (!ciphertext || !messageIv) throw new Error('Encryption produced no ciphertext');
        const common = { ciphertext, messageIv, isEncrypted: true, attachments: [], clientTempId, ...(keyVersion ? { keyVersion } : {}) };
        if (isChannel) await post('/api/v2/messages/channel', { channelId: r.channelId, ...common });
        else await post('/api/v2/messages/direct', { dmSessionId: r.dmSessionId, workspaceId: r.workspaceId, ...common });
    };
    try {
        await sendOnce();
    } catch (err) {
        // The conversation got a new key meanwhile (the old one was dropped): encrypt again, once.
        if (err?.response?.data?.code !== 'KEY_ROTATED') throw err;
        await sendOnce();
    }
    return true;
}

/**
 * Subscribes to quick replies from the desktop app. Replies are sent one at a time, in order.
 * Returns an unsubscribe function (or null when this is not the desktop app).
 */
export function installQuickReply(electronAPI, deps) {
    if (!electronAPI || typeof electronAPI.onQuickReply !== 'function') return null;
    let queue = Promise.resolve();
    return electronAPI.onQuickReply((reply) => {
        queue = queue.then(async () => {
            let sent = false;
            try {
                sent = await sendQuickReply(reply, deps);
            } catch {
                sent = false;
            }
            if (!sent && reply && typeof electronAPI.quickReplyFailed === 'function') {
                try { electronAPI.quickReplyFailed(reply); } catch { /* ignore */ }
            }
        });
    });
}
