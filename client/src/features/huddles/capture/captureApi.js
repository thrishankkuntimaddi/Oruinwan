import api, { API_BASE } from '../../../services/api';

/** Same rule as HuddleContext.meetingIdFromHuddleId (kept here so this module stays light). */
const meetingIdFromHuddleId = (huddleId) =>
    (typeof huddleId === 'string' && huddleId.startsWith('meeting-') ? huddleId.slice('meeting-'.length) : null);

/**
 * Recording, transcript and summary endpoints (docs/api/meetings.md).
 * A call that holds a scheduled meeting (huddle id "meeting-<id>") stores its
 * recording and transcript on the meeting, so they show on the meeting page and
 * feed its summary and action items; any other huddle stores them on its run.
 */
export function captureTarget(huddleId, sessionId = null) {
    const meetingId = meetingIdFromHuddleId(huddleId);
    if (meetingId) return { kind: 'meeting', id: meetingId, base: `/api/v2/meetings/${encodeURIComponent(meetingId)}`, query: '' };
    return {
        kind: 'huddle',
        id: huddleId,
        base: `/api/v2/huddles/${encodeURIComponent(huddleId)}`,
        query: sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '',
    };
}

export const meetingTarget = (meetingId) => ({ kind: 'meeting', id: meetingId, base: `/api/v2/meetings/${encodeURIComponent(meetingId)}`, query: '' });

/** Absolute URL for a signed stream path from GET …/recording. */
export const streamUrl = (url) => (!url ? null : /^https?:/i.test(url) ? url : `${API_BASE}${url}`);

export const captureApi = {
    postSegments: (t, segments) => api.post(`${t.base}/transcript/segments`, { segments }).then((r) => r.data),
    transcript: (t) => api.get(`${t.base}/transcript${t.query}`).then((r) => r.data),

    uploadRecording: (t, blob, { fileName, durationSec, onProgress } = {}) => {
        const form = new FormData();
        form.append('file', blob, fileName);
        if (Number.isFinite(durationSec)) form.append('durationSec', String(Math.max(0, Math.min(86400, Math.round(durationSec)))));
        return api.post(`${t.base}/recording${t.query}`, form, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 0,
            onUploadProgress: (e) => { if (onProgress && e.total) onProgress(e.loaded / e.total); },
        }).then((r) => r.data);
    },
    /** { recording, url } or null when there is none. */
    recording: (t) => api.get(`${t.base}/recording${t.query}`)
        .then((r) => ({ ...r.data, url: streamUrl(r.data?.url) }))
        .catch((err) => { if (err?.response?.status === 404) return null; throw err; }),
    deleteRecording: (t) => api.delete(`${t.base}/recording${t.query}`).then((r) => r.data),

    /** { summary, actionItems?, source?, aiFallback? } */
    summarize: (t) => api.post(`${t.base}/summarize${t.query}`).then((r) => r.data),
    /** Meetings only: rule-based action items from the transcript. */
    extractActionItems: (t, apply = false) => api.post(`${t.base}/action-items/extract`, { apply }).then((r) => r.data),
};

export const errorText = (err, fallback) => err?.response?.data?.message || err?.message || fallback;
