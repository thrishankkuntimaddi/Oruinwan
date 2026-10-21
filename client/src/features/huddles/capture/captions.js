/**
 * Transcript segments for live captions: building, de-duplicating, the
 * recording/caption "consent markers", and a send queue that batches segments
 * to the transcript API (docs/api/meetings.md, Transcript segments).
 *
 * Segment: { speakerId, speakerName, text, startedAt (ISO), endedAt (ISO) }.
 */

export const MAX_SEGMENT_TEXT = 4000;
export const MAX_SEGMENTS_PER_REQUEST = 200;

/** One caption segment from a final speech result. Returns null for empty text. */
export function makeSegment({ speakerId, speakerName, text, startedAt, endedAt }) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_SEGMENT_TEXT);
    if (!clean) return null;
    const start = new Date(startedAt || Date.now());
    let end = new Date(endedAt || start);
    if (end < start) end = start;
    return {
        speakerId: speakerId || undefined,
        speakerName: speakerName || undefined,
        text: clean,
        startedAt: start.toISOString(),
        endedAt: end.toISOString(),
    };
}

export const segmentKey = (s) => `${s?.speakerId || s?.speakerName || ''}|${new Date(s?.startedAt || 0).getTime()}|${String(s?.text || '').trim()}`;

/** Merge segments (local echo + server copies) without duplicates, sorted by start time. */
export function mergeSegments(existing = [], incoming = []) {
    const seen = new Map();
    for (const s of [...existing, ...incoming]) {
        if (!s || !s.text) continue;
        const k = segmentKey(s);
        if (!seen.has(k)) seen.set(k, s);
        else if (!seen.get(k).speakerName && s.speakerName) seen.set(k, s);
    }
    return [...seen.values()].sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
}

/* ── Consent markers ─────────────────────────────────────────────────────── */

/**
 * Turning recording or captions on/off is announced to everyone in the call as
 * a transcript line, so every participant (including late joiners) can see who
 * is recording or transcribing, and the transcript itself records it.
 */
export const CAPTURE_MARKERS = {
    'recording:on': '(started recording the call)',
    'recording:off': '(stopped recording the call)',
    'captions:on': '(turned on live captions)',
    'captions:off': '(turned off live captions)',
};
const MARKER_LOOKUP = Object.fromEntries(Object.entries(CAPTURE_MARKERS).map(([k, v]) => [v, k]));

/** { kind: 'recording'|'captions', on: boolean } for a marker text, else null. */
export function parseCaptureMarker(text) {
    const key = MARKER_LOOKUP[String(text || '').trim()];
    if (!key) return null;
    const [kind, state] = key.split(':');
    return { kind, on: state === 'on' };
}

export const isMarker = (s) => !!parseCaptureMarker(s?.text);

/**
 * Who is recording / transcribing right now, from the markers in a transcript.
 * Returns Map<userId, { userId, name, recording, transcribing }>, only for people
 * with something on. `presentIds` (optional) drops people who have left the call.
 */
export function captureStateFromSegments(segments = [], presentIds = null) {
    const state = new Map();
    const sorted = [...segments].sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
    for (const s of sorted) {
        const m = parseCaptureMarker(s.text);
        if (!m) continue;
        const id = String(s.speakerId || s.speakerName || '');
        if (!id) continue;
        const cur = state.get(id) || { userId: id, name: s.speakerName || 'Someone', recording: false, transcribing: false };
        if (s.speakerName) cur.name = s.speakerName;
        if (m.kind === 'recording') cur.recording = m.on;
        else cur.transcribing = m.on;
        state.set(id, cur);
    }
    for (const [id, v] of state) {
        if (!v.recording && !v.transcribing) state.delete(id);
        else if (presentIds && !presentIds.has(id)) state.delete(id);
    }
    return state;
}

/**
 * The consent notices someone still has to acknowledge: one per (person, kind)
 * that another participant has turned on. `acknowledged` is a Set of "userId:kind".
 */
export function pendingConsent(captureState, myId, acknowledged = new Set()) {
    const out = [];
    for (const v of captureState.values()) {
        if (String(v.userId) === String(myId)) continue;
        if (v.recording && !acknowledged.has(`${v.userId}:recording`)) out.push({ userId: v.userId, name: v.name, kind: 'recording' });
        if (v.transcribing && !acknowledged.has(`${v.userId}:captions`)) out.push({ userId: v.userId, name: v.name, kind: 'captions' });
    }
    return out;
}

/** "Ada and Bo" / "Ada, Bo and 2 others" */
export function listNames(names = []) {
    const n = names.filter(Boolean);
    if (n.length === 0) return '';
    if (n.length === 1) return n[0];
    if (n.length === 2) return `${n[0]} and ${n[1]}`;
    if (n.length === 3) return `${n[0]}, ${n[1]} and ${n[2]}`;
    return `${n[0]}, ${n[1]} and ${n.length - 2} others`;
}

/** Banner text for what is being captured, e.g. "Ada is recording · Live captions: Ada and you". */
export function captureBannerText(captureState, { myId, recordingLocal = false, captionsLocal = false } = {}) {
    const recorders = [];
    const captioners = [];
    for (const v of captureState.values()) {
        if (String(v.userId) === String(myId)) continue;
        if (v.recording) recorders.push(v.name);
        if (v.transcribing) captioners.push(v.name);
    }
    if (recordingLocal) recorders.unshift('You');
    if (captionsLocal) captioners.unshift('you');
    const parts = [];
    if (recorders.length) parts.push(`${listNames(recorders)} ${recorders.length === 1 && recorders[0] !== 'You' ? 'is' : 'are'} recording this call`);
    if (captioners.length) parts.push(`Live captions on for ${listNames(captioners)}`);
    return parts.join(' · ');
}

/* ── Send queue ──────────────────────────────────────────────────────────── */

/**
 * Batches final caption segments and sends them with `send(segments)` (a
 * promise). Flushes when `maxBatch` segments wait, every `intervalMs`, or on
 * flush(). Failed batches are retried on the next flush (bounded by `maxQueue`).
 */
export class SegmentQueue {
    constructor(send, { intervalMs = 3000, maxBatch = 20, maxQueue = 1000, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
        this.send = send;
        this.intervalMs = intervalMs;
        this.maxBatch = Math.min(maxBatch, MAX_SEGMENTS_PER_REQUEST);
        this.maxQueue = maxQueue;
        this.queue = [];
        this.inFlight = null;
        this.timer = null;
        this.setTimer = setTimer;
        this.clearTimer = clearTimer;
        this.lastError = null;
    }

    push(segment) {
        if (!segment) return;
        this.queue.push(segment);
        if (this.queue.length > this.maxQueue) this.queue.splice(0, this.queue.length - this.maxQueue);
        if (this.queue.length >= this.maxBatch) this.flush();
        else this._schedule();
    }

    _schedule() {
        if (this.timer) return;
        this.timer = this.setTimer(() => { this.timer = null; this.flush(); }, this.intervalMs);
    }

    async flush() {
        if (this.timer) { this.clearTimer(this.timer); this.timer = null; }
        if (this.inFlight) { await this.inFlight; if (!this.queue.length) return; }
        if (!this.queue.length) return;
        const batch = this.queue.splice(0, MAX_SEGMENTS_PER_REQUEST);
        this.inFlight = (async () => {
            try {
                await this.send(batch);
                this.lastError = null;
            } catch (err) {
                this.lastError = err;
                const status = err?.response?.status;
                // 400/403/409 will not succeed on retry (bad input, no access, transcript full).
                if (![400, 403, 404, 409, 413].includes(status)) this.queue.unshift(...batch);
            } finally {
                this.inFlight = null;
            }
        })();
        await this.inFlight;
        if (this.queue.length && !this.lastError) await this.flush();
    }

    get pending() { return this.queue.length; }

    dispose() {
        if (this.timer) this.clearTimer(this.timer);
        this.timer = null;
    }
}

/* ── Formatting ──────────────────────────────────────────────────────────── */

/** "[03:12]" offset of a segment from the start of the call. */
export function offsetLabel(at, startedAt) {
    const base = new Date(startedAt || at).getTime();
    const secs = Math.max(0, Math.round((new Date(at).getTime() - base) / 1000));
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Plain-text transcript, one line per segment, markers included as they read. */
export function transcriptText(segments = [], startedAt) {
    const start = startedAt || segments[0]?.startedAt;
    return segments.map((s) => `[${offsetLabel(s.startedAt, start)}] ${s.speakerName || 'Speaker'}: ${s.text}`).join('\n');
}

/** The last few caption lines for the live strip (markers left out). */
export function recentCaptions(segments = [], { limit = 3, withinMs = 20000, now = Date.now() } = {}) {
    return segments
        .filter((s) => !isMarker(s) && now - new Date(s.endedAt || s.startedAt).getTime() <= withinMs)
        .slice(-limit);
}
