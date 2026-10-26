// Conversation key versions on the web (see server conversations/keyEpochs.js): which version
// encrypted each recent ciphertext, so any request carrying one can say so (`keyVersion`), and a
// way to tell the key cache that a conversation's key changed (a 409 KEY_ROTATED, or the
// `conversation:key_rotated` event). Its own module so services/api.js can use it without
// importing the key service (which imports api.js).

const recent = new Map();
const listeners = new Set();

export function rememberKeyVersion(ciphertext, version) {
    if (typeof ciphertext !== 'string' || version == null) return;
    recent.set(ciphertext, version);
    if (recent.size > 300) recent.delete(recent.keys().next().value);
}

/** The key version that produced `ciphertext` on this device, or null. */
export function keyVersionOf(ciphertext) {
    return typeof ciphertext === 'string' ? recent.get(ciphertext) ?? null : null;
}

/** Adds `keyVersion` to a request body (or its nested `body`) that carries a known ciphertext. */
export function withKeyVersion(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
    let out = data;
    if (typeof data.ciphertext === 'string' && data.keyVersion == null) {
        const v = keyVersionOf(data.ciphertext);
        if (v != null) out = { ...out, keyVersion: v };
    }
    if (data.body && typeof data.body === 'object' && typeof data.body.ciphertext === 'string' && data.body.keyVersion == null) {
        const v = keyVersionOf(data.body.ciphertext);
        if (v != null) out = { ...out, body: { ...data.body, keyVersion: v } };
    }
    return out;
}

export function onKeyRotated(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function notifyKeyRotated(conversationId, conversationType) {
    if (!conversationId) return;
    for (const fn of listeners) {
        try { fn(String(conversationId), conversationType); } catch { /* a listener failing never blocks the others */ }
    }
}

/**
 * Runs `send(attempt)`; if the server answers 409 KEY_ROTATED (the conversation got a new key
 * meanwhile, and the old one was just dropped), runs it once more so it encrypts with the new key.
 * `attempt` is 0, then 1: on 1 the caller encrypts again.
 */
export async function retryOnKeyRotated(send) {
    try {
        return await send(0);
    } catch (err) {
        if (err?.response?.data?.code !== 'KEY_ROTATED') throw err;
        return send(1);
    }
}
