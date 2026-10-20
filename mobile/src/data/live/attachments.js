// Attachments on a self-hosted server: the same upload endpoint, message shape and signed media
// links as the web client (client/src/utils/uploadFile.js, utils/mediaUrl.js,
// hooks/useMessageActions.js).
//
// Files are not end-to-end encrypted, on the web or here: the web uploads the file as-is and
// sends the attachment's metadata in the message's `attachments`, and the server only lets
// people who can read the conversation fetch it (server/src/modules/uploads/upload.access.js).
// Phone and web must agree, or one could not open the other's files, so this does the same.
import { ApiError, NETWORK_MESSAGE, accessToken, api, refreshSession, serverUrl } from './http.js';
import { clientPlatform } from '../../native/index.js';
import { messageTypeFor, validateUpload } from '../../lib/files.js';

const PROXY = '/api/v2/uploads/file';

/** The server's attachment record, as the app models it. */
export function mapAttachment(a) {
  if (!a || typeof a !== 'object') return null;
  return {
    type: a.type || 'file',
    url: a.url || null, // server-relative /api/v2/uploads/file?path=…, signed before use
    gcsPath: a.gcsPath || null,
    name: a.name || a.fileName || a.originalName || 'File',
    size: Number.isFinite(a.size) ? a.size : null,
    mimeType: a.mimeType || a.mimetype || '',
    width: a.width || null,
    height: a.height || null,
    duration: Number.isFinite(a.duration) ? a.duration : null,
  };
}

/** The attachment as the message endpoints accept it (the fields the server keeps). */
export function attachmentDoc(a) {
  const doc = { type: a.type, url: a.url, name: a.name, size: a.size, mimeType: a.mimeType };
  if (Number.isFinite(a.duration)) doc.duration = a.duration;
  if (Number.isFinite(a.width)) doc.width = a.width;
  if (Number.isFinite(a.height)) doc.height = a.height;
  return doc;
}

/** Request body for POST /v2/messages/channel or /v2/messages/direct. */
export function attachmentMessageBody(conv, attachment, { workspaceId, clientTempId } = {}) {
  const base = { type: messageTypeFor(attachment), attachments: [attachmentDoc(attachment)], clientTempId };
  return conv.kind === 'channel' ? { ...base, channelId: conv.id } : { ...base, dmSessionId: conv.id, workspaceId };
}

function uploadError(status, data) {
  const msg = (typeof data === 'object' && (data?.error || data?.message)) || '';
  if (status === 0) return new ApiError(NETWORK_MESSAGE, 0, null);
  if (status === 413) return new ApiError(msg || 'That file is too large (the limit is 100 MB).', status, data);
  if (status === 415) return new ApiError(msg || 'This file type is not allowed.', status, data);
  if (status === 403) return new ApiError(msg || 'File sharing is turned off in this workspace.', status, data);
  return new ApiError(msg || 'The upload failed. Try again.', status, data);
}

function postForm(form, { onProgress, signal }) {
  return new Promise((resolve, reject) => {
    // XMLHttpRequest for upload progress. On Android and iOS, CapacitorHttp performs it natively.
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${serverUrl()}/api/v2/uploads`);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('x-client-platform', clientPlatform);
    if (accessToken()) xhr.setRequestHeader('Authorization', `Bearer ${accessToken()}`);
    xhr.upload?.addEventListener?.('progress', (e) => {
      if (e.lengthComputable && e.total) onProgress?.(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    });
    xhr.onload = () => {
      let data = null;
      try {
        data = typeof xhr.response === 'string' || !xhr.response ? JSON.parse(xhr.responseText || 'null') : xhr.response;
      } catch {
        data = xhr.responseText;
      }
      resolve({ status: xhr.status, data });
    };
    xhr.onerror = () => resolve({ status: 0, data: null });
    xhr.onabort = () => reject(Object.assign(new Error('Cancelled'), { name: 'AbortError' }));
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}

/**
 * Uploads one file for a conversation. Resolves with the app's attachment model.
 * opts: { conversationId, conversationType: 'channel' | 'dm', onProgress(0..100), signal }
 */
export async function uploadFile(file, { conversationId, conversationType = 'channel', onProgress, signal } = {}) {
  const problem = validateUpload(file);
  if (problem) throw Object.assign(new Error(problem), { noRetry: true });
  const send = () => {
    const form = new FormData();
    form.append('file', file, file.name || 'file');
    form.append('conversationType', conversationType === 'dm' ? 'dm' : 'channel');
    if (conversationId) form.append('conversationId', conversationId);
    return postForm(form, { onProgress, signal });
  };
  let { status, data } = await send();
  if (status === 401) {
    // Access tokens last 15 minutes: refresh once and try again.
    await refreshSession();
    ({ status, data } = await send());
  }
  if (status < 200 || status >= 300 || !data?.url) throw uploadError(status, data);
  onProgress?.(100);
  return mapAttachment(data);
}

// Stored files need authorization, which <img>, <video> and <audio> can't send. The server
// signs a short-lived link per file (10 minutes); keep it until shortly before it expires.
const signed = new Map(); // objectPath → { url, refreshAt }
const inflight = new Map();

/** The object path of a stored file, from its proxy URL or gcsPath; null for other URLs. */
export function objectPathOf(a) {
  if (!a) return null;
  if (a.gcsPath) return a.gcsPath;
  const url = String(a.url || '');
  const at = url.indexOf(`${PROXY}?`);
  if (at < 0) return null;
  return new URLSearchParams(url.slice(at + PROXY.length + 1)).get('path');
}

/** A URL the WebView can load directly (signed for stored files). `fresh` skips the cache. */
export async function mediaUrl(a, { fresh = false } = {}) {
  const path = objectPathOf(a);
  if (!path) {
    const url = a?.url || null;
    if (!url) return null;
    return /^(https?:|data:|blob:)/.test(url) ? url : `${serverUrl()}${url.startsWith('/') ? '' : '/'}${url}`;
  }
  if (fresh) signed.delete(path);
  const hit = signed.get(path);
  if (hit && hit.refreshAt > Date.now()) return hit.url;
  if (inflight.has(path)) return inflight.get(path);
  const p = api
    .get('/v2/uploads/sign', { path })
    .then((data) => {
      const url = `${serverUrl()}${data.url}`;
      const expires = new Date(data.expiresAt).getTime();
      signed.set(path, { url, refreshAt: Number.isFinite(expires) ? expires - 60_000 : Date.now() + 5 * 60_000 });
      return url;
    })
    .finally(() => inflight.delete(path));
  inflight.set(path, p);
  return p;
}

export function clearMediaCache() {
  signed.clear();
  inflight.clear();
}
