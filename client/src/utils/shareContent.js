/**
 * Sharing a message or a whole thread outside Oruinwan (copy, system share sheet).
 *
 * Messages are end-to-end encrypted: everything here works on text already decrypted on this
 * device and never sends it to the server. Links point at the web app and open the message
 * (?message=<id>, plus &thread=<parent> for a reply) or the thread (?thread=<parent>), the
 * format ChatWindowV2 and Files → "Go to message" already use. Pure helpers; the
 * clipboard/share-sheet parts are at the bottom.
 */
import { IS_APP, BUILT_IN_SERVER, normalizeServer } from '../appMode/env';

const idOf = (v) => (v && typeof v === 'object' ? String(v._id || v.id || '') : v ? String(v) : '');

/**
 * The web app's address for links: this page's origin in a browser; in the desktop app
 * (app://oruinwan) VITE_WEB_APP_URL, else the built-in server (it serves the web app too).
 */
export function webBase({ location = typeof window !== 'undefined' ? window.location : null, appMode = IS_APP } = {}) {
    if (!appMode && location && /^https?:$/.test(location.protocol)) return location.origin;
    const configured = normalizeServer(import.meta.env?.VITE_WEB_APP_URL);
    if (configured) return configured;
    const server = BUILT_IN_SERVER || '';
    try {
        const u = new URL(server);
        if (u.hostname.startsWith('api.')) u.hostname = u.hostname.slice(4);
        return `${u.protocol}//${u.host}`;
    } catch {
        return location?.origin || '';
    }
}

/**
 * /workspace/<ws>/<channel|dm>/<id>[?message=<id>][&thread=<parent>] (absolute when `base` is
 * given). Returns null without a workspace or conversation.
 */
export function conversationLink({ base = '', workspaceId, kind, conversationId, messageId = null, threadId = null }) {
    if (!workspaceId || !conversationId) return null;
    const type = kind === 'channel' ? 'channel' : 'dm';
    const params = new URLSearchParams();
    if (messageId) params.set('message', String(messageId));
    if (threadId) params.set('thread', String(threadId));
    const q = params.toString();
    return `${String(base || '').replace(/\/+$/, '')}/workspace/${workspaceId}/${type}/${conversationId}${q ? `?${q}` : ''}`;
}

/** Link to one message (a thread reply opens its thread too). */
export function messageLink({ base, workspaceId, kind, conversationId, message }) {
    const id = idOf(message?._id || message?.id);
    const parent = idOf(message?.parentId);
    return conversationLink({ base, workspaceId, kind, conversationId, messageId: id || null, threadId: parent && parent !== id ? parent : null });
}

/** Link that opens a thread (its parent message's id). */
export function threadLink({ base, workspaceId, kind, conversationId, parentId }) {
    return conversationLink({ base, workspaceId, kind, conversationId, threadId: parentId });
}

function attachmentsOf(msg) {
    const list = msg?.attachments?.length ? msg.attachments : msg?.payload?.attachments || [];
    return (Array.isArray(list) ? list : []).filter(Boolean);
}

/** A message's readable text: decrypted text, plus attachment names ("📎 report.pdf"). */
export function shareableBody(msg) {
    const text = String(msg?.decryptedContent || msg?.text || msg?.payload?.text || '').trim();
    const files = attachmentsOf(msg).map((a) => `📎 ${a.name || a.fileName || a.originalName || 'Attachment'}`);
    return [text, ...files].filter(Boolean).join('\n');
}

export function senderOf(msg) {
    return msg?.senderName || msg?.sender?.username || msg?.sender?.name || msg?.author?.name || 'Someone';
}

/** "Ana: hello\n\nhttps://…" — what Copy text / Share send for one message. */
export function messageShareText({ sender, body, link }) {
    const head = body ? `${sender || 'Someone'}: ${body}` : '';
    return [head, link].filter(Boolean).join('\n\n');
}

/** "Oct 24, 3:05 PM" in this device's locale. */
export function defaultStamp(at) {
    const d = new Date(at);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * Plain-text transcript of a thread:
 *   Thread in #general
 *   [Oct 24, 3:05 PM] Ana: Parent text
 *   [Oct 24, 3:07 PM] Ben: A reply
 *
 *   https://…/workspace/…?thread=…
 * `messages` are { sender, text, at }; empty ones (unreadable, deleted) are skipped.
 */
export function threadTranscript({ title, messages, link, stamp = defaultStamp }) {
    const lines = (messages || [])
        .filter((m) => m && String(m.text || '').trim())
        .map((m) => {
            const when = m.at ? stamp(m.at) : '';
            const text = String(m.text).trim().replace(/\n/g, '\n    ');
            return `${when ? `[${when}] ` : ''}${m.sender || 'Someone'}: ${text}`;
        });
    return [[title, ...lines].filter(Boolean).join('\n'), link].filter(Boolean).join('\n\n');
}

/** "Thread in #general" / "Thread with Ana". */
export function threadTitle(kind, name) {
    if (!name) return 'Thread';
    return kind === 'channel' ? `Thread in #${String(name).replace(/^#/, '')}` : `Thread with ${name}`;
}

/* ── Clipboard and share sheet ───────────────────────────────────────── */

/** Copies text. Returns true when it worked (falls back to execCommand for older WebViews). */
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return ok;
        } catch {
            return false;
        }
    }
}

/**
 * The system share sheet when the browser has one (navigator.share), else the clipboard.
 * Returns 'shared' | 'copied' | 'cancelled' | 'failed'.
 */
export async function shareOrCopy({ title, text, url }) {
    const full = [text, url && !String(text || '').includes(url) ? url : null].filter(Boolean).join('\n\n');
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
            await navigator.share({ title, text: full });
            return 'shared';
        } catch (err) {
            if (err?.name === 'AbortError') return 'cancelled';
            // NotAllowedError (no user gesture) etc.: copy instead.
        }
    }
    return (await copyToClipboard(full)) ? 'copied' : 'failed';
}
