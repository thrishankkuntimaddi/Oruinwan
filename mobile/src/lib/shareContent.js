// Sharing a message or a whole thread outside Oruinwan (copy, system share sheet), and opening
// the links it makes. Messages are end-to-end encrypted: this works on text already decrypted on
// this device and never sends it to the server. Links are the web app's
//   https://<web>/workspace/<ws>/<channel|dm>/<id>?message=<id>[&thread=<parent>]
//   https://<web>/workspace/<ws>/<channel|dm>/<id>?thread=<parent>
// (the format the web client opens; see client/src/utils/shareContent.js).

/** /workspace/<ws>/<channel|dm>/<id>[?message=…][&thread=…] on `base`; null without ids. */
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
  const parent = message?.parentId && message.parentId !== message.id ? message.parentId : null;
  return conversationLink({ base, workspaceId, kind, conversationId, messageId: message?.id || null, threadId: parent });
}

export function threadLink({ base, workspaceId, kind, conversationId, parentId }) {
  return conversationLink({ base, workspaceId, kind, conversationId, threadId: parentId });
}

/** A message's readable text plus attachment names ("📎 report.pdf"); '' when it can't be read. */
export function shareableBody(m) {
  if (!m || (m.state && m.state !== 'ok')) return '';
  const files = (m.attachments || []).filter(Boolean).map((a) => `📎 ${a.name || 'Attachment'}`);
  return [String(m.text || '').trim(), ...files].filter(Boolean).join('\n');
}

/** "Ana: hello\n\nhttps://…" */
export function messageShareText({ sender, body, link }) {
  const head = body ? `${sender || 'Someone'}: ${body}` : '';
  return [head, link].filter(Boolean).join('\n\n');
}

export function defaultStamp(at) {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** "Thread in #general" / "Thread with Ana". */
export function threadTitle(kind, name) {
  const clean = String(name || '').replace(/^#/, '');
  if (!clean) return 'Thread';
  return kind === 'channel' ? `Thread in #${clean}` : `Thread with ${clean}`;
}

/**
 * Plain-text transcript: a title line, then "[time] sender: text" for the parent and each reply,
 * then the link. `messages` are { sender, text, at }; empty ones are skipped.
 */
export function threadTranscript({ title, messages, link, stamp = defaultStamp }) {
  const lines = (messages || [])
    .filter((m) => m && String(m.text || '').trim())
    .map((m) => {
      const when = m.at ? stamp(m.at) : '';
      return `${when ? `[${when}] ` : ''}${m.sender || 'Someone'}: ${String(m.text).trim().replace(/\n/g, '\n    ')}`;
    });
  return [[title, ...lines].filter(Boolean).join('\n'), link].filter(Boolean).join('\n\n');
}

/**
 * A message or thread link (https://<any host>/workspace/… or oruinwan://workspace/…) →
 * { workspaceId, kind, id, messageId, threadId }, or null when it isn't one.
 */
export function parseConversationLink(input) {
  let url;
  try {
    url = new URL(String(input || '').trim());
  } catch {
    return null;
  }
  const path = `${url.protocol === 'oruinwan:' ? `/${url.host}` : ''}${url.pathname}`;
  const m = path.match(/\/workspace\/([^/]+)\/(?:home\/|messages\/)?(channel|dm)\/([^/?#]+)\/?$/i);
  if (!m) return null;
  return {
    workspaceId: decodeURIComponent(m[1]),
    kind: m[2].toLowerCase(),
    id: decodeURIComponent(m[3]),
    messageId: url.searchParams.get('message') || null,
    threadId: url.searchParams.get('thread') || null,
  };
}
