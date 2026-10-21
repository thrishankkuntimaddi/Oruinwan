'use strict';

/**
 * Transcript segments shared by scheduled meetings and huddles (pure helpers).
 *
 * A segment is { speakerId, speakerName?, text, startedAt, endedAt }. Transcripts are
 * produced by the clients (speech-to-text in the call) and stored server-side so the
 * summary and action-item extraction can read them.
 */

const mongoose = require('mongoose');

const MAX_SEGMENTS_PER_REQUEST = 200;
const MAX_SEGMENTS_TOTAL = 5000;
const MAX_TEXT_LENGTH = 4000;
const MAX_NAME_LENGTH = 80;

const segmentSchema = new mongoose.Schema({
    speakerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    speakerName: { type: String, default: '', maxlength: MAX_NAME_LENGTH },
    text: { type: String, required: true, maxlength: MAX_TEXT_LENGTH },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { _id: false });

const isObjectId = (v) => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v);

/**
 * Validate a request body ({ segments: [...] } or a single segment).
 * Returns { segments } or { error }.
 */
function validateSegments(body, { addedBy = null } = {}) {
    const raw = Array.isArray(body?.segments) ? body.segments : (body && body.text !== undefined ? [body] : null);
    if (!raw || !raw.length) return { error: 'segments must be a non-empty array' };
    if (raw.length > MAX_SEGMENTS_PER_REQUEST) return { error: `At most ${MAX_SEGMENTS_PER_REQUEST} segments per request` };
    const out = [];
    for (const [i, s] of raw.entries()) {
        if (!s || typeof s !== 'object') return { error: `segments[${i}] must be an object` };
        const text = typeof s.text === 'string' ? s.text.trim() : '';
        if (!text) return { error: `segments[${i}].text is required` };
        if (text.length > MAX_TEXT_LENGTH) return { error: `segments[${i}].text is longer than ${MAX_TEXT_LENGTH} characters` };
        if (s.speakerId != null && s.speakerId !== '' && !isObjectId(String(s.speakerId))) return { error: `segments[${i}].speakerId is invalid` };
        const startedAt = new Date(s.startedAt);
        const endedAt = new Date(s.endedAt ?? s.startedAt);
        if (Number.isNaN(startedAt.getTime())) return { error: `segments[${i}].startedAt is invalid` };
        if (Number.isNaN(endedAt.getTime()) || endedAt < startedAt) return { error: `segments[${i}].endedAt must be on or after startedAt` };
        out.push({
            speakerId: s.speakerId ? String(s.speakerId) : null,
            speakerName: typeof s.speakerName === 'string' ? s.speakerName.trim().slice(0, MAX_NAME_LENGTH) : '',
            text,
            startedAt,
            endedAt,
            addedBy: addedBy ? String(addedBy) : null,
        });
    }
    return { segments: out };
}

const sortSegments = (segments = []) => [...segments].sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));

function clock(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * Plain text for the AI / exports: "[mm:ss] Name: text" per line, offsets from `origin`
 * (the meeting start, else the first segment). `names` maps speakerId -> display name.
 */
function renderTranscript(segments = [], { origin = null, names = new Map() } = {}) {
    const sorted = sortSegments(segments);
    if (!sorted.length) return '';
    const t0 = new Date(origin || sorted[0].startedAt).getTime();
    return sorted.map((s) => {
        const who = names.get(String(s.speakerId)) || s.speakerName || 'Speaker';
        return `[${clock(new Date(s.startedAt).getTime() - t0)}] ${who}: ${s.text}`;
    }).join('\n');
}

// Phrases that usually introduce a commitment or a follow-up in spoken meetings.
const EXPLICIT = /^(?:action(?:\s+item)?|todo|to-do|follow[-\s]?up|next step)s?\s*[:\-–]\s*(.+)$/i;
const SELF = /\b(?:i(?:'ll| will| am going to|'m going to)|let me)\s+(.+)/i;
const OTHER = /\b(?:can you|could you|would you|please)\s+(.+)/i;
const TEAM = /\b(?:we need to|we should|we must|we have to|let's|lets|need to make sure)\s+(.+)/i;
const FILLER = /^(?:think|guess|see|know|be honest|say|mean|agree|just|try)\b/i;

function tidy(text) {
    let t = String(text).replace(/\s+/g, ' ').trim().replace(/[?.!,;:]+$/, '');
    t = t.split(/(?<=[.!?])\s/)[0].replace(/[?.!,;:]+$/, '');
    if (t.length > 200) t = `${t.slice(0, 197)}…`;
    return t ? t[0].toUpperCase() + t.slice(1) : t;
}

/**
 * Rule-based action items from transcript segments. Each result is
 * { text, assigneeId|null, speakerId|null, at } — "I'll …" is assigned to the speaker,
 * "can you …"/"we need to …" stay unassigned. Duplicates (same text) are dropped.
 */
function extractActionItems(segments = [], { max = 25 } = {}) {
    const seen = new Set();
    const items = [];
    for (const s of sortSegments(segments)) {
        const sentences = String(s.text || '').split(/(?<=[.!?])\s+/);
        for (const sentence of sentences) {
            const line = sentence.trim();
            if (!line) continue;
            let text = null;
            let assigneeId = null;
            let m;
            if ((m = EXPLICIT.exec(line))) {
                text = m[1];
            } else if ((m = SELF.exec(line)) && !FILLER.test(m[1])) {
                text = m[1];
                assigneeId = s.speakerId ? String(s.speakerId) : null;
            } else if ((m = OTHER.exec(line)) && !FILLER.test(m[1])) {
                text = m[1];
            } else if ((m = TEAM.exec(line))) {
                text = m[1];
            }
            if (!text) continue;
            const clean = tidy(text);
            if (clean.length < 4) continue;
            const key = clean.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            items.push({ text: clean, assigneeId, speakerId: s.speakerId ? String(s.speakerId) : null, at: s.startedAt });
            if (items.length >= max) return items;
        }
    }
    return items;
}

module.exports = {
    segmentSchema,
    validateSegments,
    sortSegments,
    renderTranscript,
    extractActionItems,
    MAX_SEGMENTS_PER_REQUEST,
    MAX_SEGMENTS_TOTAL,
    MAX_TEXT_LENGTH,
};
