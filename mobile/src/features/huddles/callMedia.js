// Pure helpers for call recording, live captions and the transcript (no React, no network),
// so the rules are tested on their own. Used by callExtras.js and the meeting screen.

/** Where a call's recording and transcript live: a scheduled meeting held as `meeting-<id>`, or the huddle itself. */
export function callTarget(huddleId) {
  const id = String(huddleId || '');
  if (!id) return null;
  if (id.startsWith('meeting-') && id.length > 8) return { kind: 'meeting', id: id.slice(8) };
  return { kind: 'huddle', id };
}

export const MAX_RECORDING_BYTES = 500 * 1024 * 1024;

/**
 * The audio format to record in: iPhones and iPads (WKWebView) record AAC in MP4, Android's
 * WebView records Opus in WebM. Returns '' when nothing is known to work (MediaRecorder then
 * picks its default, and the uploaded file is named after what it actually produced).
 */
export function pickRecordingMime(isTypeSupported, { ios = false } = {}) {
  const webm = ['audio/webm;codecs=opus', 'audio/webm'];
  const mp4 = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/aac'];
  const order = ios ? [...mp4, ...webm] : [...webm, ...mp4];
  if (typeof isTypeSupported !== 'function') return '';
  for (const type of order) {
    try {
      if (isTypeSupported(type)) return type;
    } catch {
      /* a WebView that throws on unknown types */
    }
  }
  return '';
}

/** The upload's content type and file name for a recorder's mime type ("audio/webm;codecs=opus" → audio/webm, .webm). */
export function recordingFile(mime, at = new Date()) {
  const base = String(mime || '').split(';')[0].trim().toLowerCase();
  const stamp = new Date(at).toISOString().slice(0, 16).replace(/[:T]/g, '-');
  if (base.includes('mp4') || base.includes('aac') || base.includes('m4a')) return { type: 'audio/mp4', name: `call-${stamp}.m4a` };
  if (base === 'video/webm') return { type: 'video/webm', name: `call-${stamp}.webm` };
  return { type: 'audio/webm', name: `call-${stamp}.webm` };
}

/** A readable reason a recording can't be uploaded, or null. */
export function recordingProblem(size) {
  if (!size) return 'Nothing was recorded.';
  if (size > MAX_RECORDING_BYTES) return 'The recording is larger than 500 MB, so it can’t be uploaded.';
  return null;
}

// ---------------------------------------------------------------- recording consent notices
// The server has no recording-state event, so the recorder announces start and stop as
// transcript segments: every client in the call gets them live (…:transcript_segments) and
// they stay in the transcript as the record of when the call was recorded.

export const RECORDING_STARTED = '[Recording started]';
export const RECORDING_STOPPED = '[Recording stopped]';

export function recordingNotice(started, name) {
  return started
    ? `${RECORDING_STARTED} ${name || 'Someone'} is recording this call.`
    : `${RECORDING_STOPPED} ${name || 'Someone'} stopped recording.`;
}

/** 'started' | 'stopped' | null for a segment's text. */
export function noticeKind(text) {
  const t = String(text || '');
  if (t.startsWith(RECORDING_STARTED)) return 'started';
  if (t.startsWith(RECORDING_STOPPED)) return 'stopped';
  return null;
}

/** Who is recording, from the transcript so far: { by, byName, since } or null. The latest notice wins. */
export function recordingStateFrom(segments) {
  let state = null;
  for (const s of segments || []) {
    const kind = noticeKind(s.text);
    if (kind === 'started') state = { by: s.speakerId || null, byName: s.speakerName || 'Someone', since: s.startedAt || null };
    else if (kind === 'stopped' && (!state || !state.by || !s.speakerId || state.by === s.speakerId)) state = null;
  }
  return state;
}

// ---------------------------------------------------------------- transcript lines

const segKey = (s) => `${s.speakerId || ''}|${s.startedAt || ''}|${String(s.text || '').trim()}`;

/** Adds segments to a transcript: no duplicates (my own lines come back over the socket), sorted by time. */
export function mergeSegments(list, incoming) {
  const seen = new Set((list || []).map(segKey));
  const out = [...(list || [])];
  for (const s of incoming || []) {
    if (!s || !String(s.text || '').trim()) continue;
    const k = segKey(s);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out.sort((a, b) => new Date(a.startedAt || 0) - new Date(b.startedAt || 0));
}

/** "mm:ss" (or "h:mm:ss") from the start of the call. */
export function offsetLabel(at, origin) {
  if (!at || !origin) return '';
  const s = Math.max(0, Math.floor((new Date(at) - new Date(origin)) / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Transcript text for the AI: "[mm:ss] name: text" per line (recording notices left out). */
export function transcriptText(segments) {
  const list = (segments || []).filter((s) => !noticeKind(s.text));
  const origin = list[0]?.startedAt;
  return list.map((s) => `[${offsetLabel(s.startedAt, origin) || '0:00'}] ${s.speakerName || 'Someone'}: ${s.text}`).join('\n');
}

// ---------------------------------------------------------------- outgoing caption lines

/**
 * Queues my finished caption lines and sends them in batches. A failed send keeps the lines
 * for the next try (bounded); a 409 (the transcript is full) stops sending for this call.
 * send(segments) → Promise. Returns { push(segment), flush(), pending(), stop() }.
 */
export function createSegmentQueue(send, { max = 200, batch = 50 } = {}) {
  let queue = [];
  let sending = null;
  let full = false;
  const sent = new Set();

  async function flush() {
    if (sending) return sending;
    if (full || !queue.length) return undefined;
    const chunk = queue.slice(0, batch);
    sending = (async () => {
      try {
        await send(chunk);
        chunk.forEach((s) => sent.add(segKey(s)));
        queue = queue.slice(chunk.length);
      } catch (err) {
        if (err?.status === 409) {
          full = true;
          queue = [];
        } else if (err?.status >= 400 && err?.status < 500 && err?.status !== 429) {
          queue = queue.slice(chunk.length); // a permanent rejection: drop these lines
        }
        throw err;
      } finally {
        sending = null;
      }
    })();
    return sending;
  }

  return {
    push(segment) {
      const text = String(segment?.text || '').trim();
      if (!text || full) return false;
      const s = { ...segment, text: text.slice(0, 4000) };
      const k = segKey(s);
      if (sent.has(k) || queue.some((q) => segKey(q) === k)) return false;
      queue.push(s);
      if (queue.length > max) queue = queue.slice(-max);
      return true;
    },
    flush,
    pending: () => queue.length,
    isFull: () => full,
    stop() {
      queue = [];
    },
  };
}

// ---------------------------------------------------------------- captions shown in the call

/** Keeps the last few caption lines on screen: final lines from everyone plus my line in progress. */
export function captionLines(segments, partial, { max = 3, me = null } = {}) {
  const finals = (segments || []).filter((s) => !noticeKind(s.text)).slice(-max).map((s) => ({ key: segKey(s), name: s.speakerId && s.speakerId === me ? 'You' : s.speakerName || 'Someone', text: s.text, live: false }));
  if (partial && partial.trim()) finals.push({ key: 'partial', name: 'You', text: partial.trim(), live: true });
  return finals.slice(-max);
}
