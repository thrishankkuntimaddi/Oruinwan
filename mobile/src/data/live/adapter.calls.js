// Live adapter part: meeting and huddle recordings, live transcript segments (captions) and
// "ask AI about this meeting". Merged into liveAdapter (adapter.js), so screens call these
// through api(). Server contract: docs/api/meetings.md.
//
// A call target is { kind: 'meeting', id } (a scheduled meeting, also while it runs as the
// huddle `meeting-<id>`) or { kind: 'huddle', id: huddleId }.
//   recording   POST/GET/DELETE /v2/meetings/:id/recording, /v2/huddles/:huddleId/recording
//   transcript  POST /v2/{meetings/:id|huddles/:huddleId}/transcript/segments, GET …/transcript
//   AI          POST /ai/chat with the transcript as context.note (transcripts are not E2EE)
// Socket (forwarded on the bus by realtime.js): meeting:transcript_segments, meeting:recording_ready,
// meeting:recording_deleted (room meeting:<id>); huddle:transcript_segments, huddle:recording_ready,
// huddle:recording_deleted (room huddle:<huddleId>).
import { ApiError, NETWORK_MESSAGE, absolute, accessToken, api, refreshSession, serverUrl } from './http.js';
import { clientPlatform } from '../../native/index.js';

const base = (target) => (target.kind === 'meeting' ? `/v2/meetings/${encodeURIComponent(target.id)}` : `/v2/huddles/${encodeURIComponent(target.id)}`);

/** Server segment → { id, speakerId, speakerName, text, startedAt, endedAt }. */
export function mapSegment(s) {
  const speakerId = s?.speakerId && typeof s.speakerId === 'object' ? String(s.speakerId._id || s.speakerId.id || '') : s?.speakerId ? String(s.speakerId) : null;
  return {
    id: String(s?._id || s?.id || `${speakerId || ''}|${s?.startedAt || ''}|${s?.text || ''}`),
    speakerId,
    speakerName: s?.speakerName || 'Someone',
    text: String(s?.text || ''),
    startedAt: s?.startedAt || null,
    endedAt: s?.endedAt || null,
  };
}

function mapRecording(data) {
  const r = data?.recording;
  if (!r) return null;
  return {
    mimeType: r.mimeType || '',
    size: Number(r.size) || 0,
    durationSec: Number(r.durationSec) || 0,
    uploadedBy: r.uploadedBy ? String(r.uploadedBy?._id || r.uploadedBy) : null,
    uploadedAt: r.uploadedAt || null,
    url: data.url ? absolute(data.url) : null,
    expiresAt: data.expiresAt || null,
  };
}

async function postForm(path, form, query) {
  const url = new URL(`${serverUrl()}/api${path}`);
  for (const [k, v] of Object.entries(query || {})) if (v) url.searchParams.set(k, String(v));
  const send = async () => {
    let res;
    try {
      res = await fetch(url.toString(), {
        method: 'POST',
        headers: { Accept: 'application/json', 'x-client-platform': clientPlatform, ...(accessToken() ? { Authorization: `Bearer ${accessToken()}` } : {}) },
        body: form,
      });
    } catch {
      throw new ApiError(NETWORK_MESSAGE, 0, null);
    }
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { res, data };
  };
  let { res, data } = await send();
  if (res.status === 401) {
    await refreshSession();
    ({ res, data } = await send());
  }
  if (!res.ok) {
    const fallback =
      res.status === 413 ? 'The recording is too large to upload.' : res.status === 415 ? "The server doesn't accept this recording format." : "The recording didn't upload. Try again.";
    throw new ApiError((data && typeof data === 'object' && data.message) || fallback, res.status, data);
  }
  return data;
}

export const callsAdapter = {
  mapSegment,

  /** Uploads a call recording (a Blob with a name). Replaces an earlier recording of the same call. */
  async uploadRecording(target, blob, { fileName, durationSec } = {}) {
    const form = new FormData();
    form.append('file', blob, fileName || blob.name || 'recording.webm');
    if (durationSec) form.append('durationSec', String(Math.min(86400, Math.max(0, Math.round(durationSec)))));
    const data = await postForm(`${base(target)}/recording`, form);
    return { recording: data?.recording || null };
  },
  /** The recording with a short-lived playback URL, or null when there is none. */
  async callRecording(target) {
    try {
      return mapRecording(await api.get(`${base(target)}/recording`));
    } catch (err) {
      if (err?.status === 404) return null;
      throw err;
    }
  },
  async deleteRecording(target) {
    await api.del(`${base(target)}/recording`);
  },

  /** Sends finished caption lines: [{ speakerId, speakerName, text, startedAt, endedAt }] (≤ 200). */
  async addTranscriptSegments(target, segments) {
    if (!segments.length) return { added: 0 };
    const data = await api.post(`${base(target)}/transcript/segments`, { segments: segments.slice(0, 200) });
    return { added: Number(data?.added) || 0 };
  },
  /** { segments, text } — segments sorted by time; text is the rendered "[mm:ss] name: text" form. */
  async callTranscript(target) {
    try {
      const data = await api.get(`${base(target)}/transcript`);
      return { segments: (data?.segments || []).map(mapSegment), text: data?.text || '' };
    } catch (err) {
      if (err?.status === 404) return { segments: [], text: '' };
      throw err;
    }
  },

  /**
   * Asks Oruinwan AI a question about a call. The transcript so far goes as the assistant's
   * screen context (`context.note`, up to 20 000 characters: the newest part is kept).
   */
  async askAboutMeeting({ workspaceId, title, transcript, question }) {
    const text = String(transcript || '').trim();
    const clipped = text.length > 19000 ? `…${text.slice(-19000)}` : text;
    const name = title || 'Meeting';
    try {
      const data = await api.post('/ai/chat', {
        workspaceId,
        message: question,
        context: {
          screen: { route: 'meeting', title: name },
          note: {
            title: `Transcript of the meeting “${name}” so far ([mm:ss] speaker: text)`,
            text: clipped || '(No transcript yet: nobody in the call has turned on live captions.)',
          },
        },
      });
      return { text: data?.text || '' };
    } catch (err) {
      if (err?.status === 503 || err?.status === 501) throw new Error("Oruinwan AI isn't set up on this server yet.");
      throw err;
    }
  },
};
