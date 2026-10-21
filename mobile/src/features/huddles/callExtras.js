// In-call extras on the phone: live captions (sent as transcript segments), recording the call's
// audio, the "someone is recording" consent banner, and asking AI about the call.
//
//  - Captions: on-device speech-to-text (native/speech.js). Each device captions its own speaker;
//    final lines go to the transcript API and come back to everyone over the socket, so the
//    caption strip shows the whole call.
//  - Recording: the person who starts it records the mixed call audio (their microphone plus
//    everyone's voice) with MediaRecorder and uploads it when they stop or leave.
//  - Consent: starting and stopping a recording is announced as a transcript line, which every
//    client in the call receives live and which stays in the transcript as the record.
import { create } from 'zustand';
import { api, useSession } from '../../data/session.js';
import { on, toast } from '../../lib/bus.js';
import { isIOS } from '../../native/index.js';
import { startCaptions } from '../../native/speech.js';
import { callAudio, leave, onCallAudio, useHuddle } from './huddle.js';
import {
  callTarget, captionLines, createSegmentQueue, mergeSegments, noticeKind, pickRecordingMime, recordingFile, recordingNotice, recordingProblem,
  recordingStateFrom, transcriptText,
} from './callMedia.js';

export const useCallExtras = create(() => ({
  target: null, // { kind: 'meeting' | 'huddle', id }
  segments: [], // the call's transcript so far (everyone's lines)
  partial: '', // my line in progress
  showCaptions: false, // the caption strip is open (everyone's lines)
  captions: false, // my speech is being captioned
  captionsBusy: false,
  recording: null, // mine: { startedAt, mime }
  uploading: false,
  failedUpload: null, // { blob, fileName, durationSec, target } to retry
  recorder: null, // who records the call, from the transcript notices: { by, byName, since }
  consentSeen: false, // I dismissed the banner for the current recording
}));

const set = (patch) => useCallExtras.setState(typeof patch === 'function' ? patch(useCallExtras.getState()) : patch);
const me = () => useSession.getState().user || {};
const myId = () => String(me().id || '');

const sameTarget = (payload) => {
  const t = useCallExtras.getState().target;
  if (!t) return false;
  return t.kind === 'meeting' ? String(payload?.meetingId) === t.id : String(payload?.huddleId) === t.id;
};

function addSegments(list) {
  const mapped = (list || []).map((s) => (s && 'speakerName' in s && 'id' in s ? s : api().mapSegment?.(s) || s));
  set((s) => {
    const segments = mergeSegments(s.segments, mapped);
    const recorder = recordingStateFrom(segments);
    const startedByOther = mapped.some((x) => noticeKind(x.text) === 'started' && x.speakerId !== myId());
    return { segments, recorder, consentSeen: startedByOther ? false : s.consentSeen };
  });
}

// ---------------------------------------------------------------- captions

let stopListening = null;
let queue = null;
let flushTimer = null;

function scheduleFlush(ms = 2000) {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flushCaptions, ms);
}

async function flushCaptions() {
  if (!queue) return;
  try {
    await queue.flush();
  } catch (err) {
    if (queue?.isFull()) toast('This call’s transcript is full, so new captions aren’t saved.', 'warning');
    else if (!(err?.status >= 400 && err?.status < 500)) scheduleFlush(8000); // offline or server busy: try again
  }
  if (queue?.pending()) scheduleFlush(3000);
}

function ensureQueue(target) {
  if (!queue) queue = createSegmentQueue((segments) => api().addTranscriptSegments(target, segments));
  return queue;
}

export async function startCallCaptions() {
  const { target, captions, captionsBusy } = useCallExtras.getState();
  if (!target || captions || captionsBusy) return;
  set({ captionsBusy: true });
  try {
    ensureQueue(target);
    stopListening = await startCaptions({
      onPartial: (text) => set({ partial: useHuddle.getState().muted ? '' : text }),
      onFinal: ({ text, startedAt, endedAt }) => {
        if (useHuddle.getState().muted) return; // muted: nothing I say is in the call
        const seg = { id: `me|${startedAt}`, speakerId: myId(), speakerName: me().name || me().username || 'Me', text, startedAt, endedAt };
        addSegments([seg]);
        queue?.push(seg);
        scheduleFlush();
      },
      onError: (err) => {
        toast(err.message, 'warning');
        stopCallCaptions();
      },
    });
    set({ captions: true });
  } catch (err) {
    toast(err.message || 'Live captions couldn’t start.', 'warning');
  } finally {
    set({ captionsBusy: false });
  }
}

export async function stopCallCaptions() {
  const stop = stopListening;
  stopListening = null;
  set({ captions: false, partial: '' });
  if (stop) await stop().catch(() => {});
  clearTimeout(flushTimer);
  await flushCaptions();
}

/**
 * Live captions on/off. On shows everyone's lines and captions my speech when the device can;
 * when it can't, the others' captions still show.
 */
export function toggleCallCaptions() {
  if (useCallExtras.getState().showCaptions) {
    set({ showCaptions: false });
    return stopCallCaptions();
  }
  set({ showCaptions: true });
  return startCallCaptions();
}

// ---------------------------------------------------------------- recording

let rec = null; // { recorder, chunks, ctx, dest, sources: Map, off, mime, startedAt }

/** Why this device can't record calls, or null. */
export function recordingUnsupported() {
  if (typeof window === 'undefined' || typeof window.MediaRecorder !== 'function') return 'This device can’t record calls (no MediaRecorder in its web view).';
  if (!(window.AudioContext || window.webkitAudioContext)) return 'This device can’t mix the call’s audio for a recording.';
  return null;
}

async function announce(target, started) {
  const now = new Date().toISOString();
  const seg = { speakerId: myId(), speakerName: me().name || me().username || 'Someone', text: recordingNotice(started, me().name || me().username), startedAt: now, endedAt: now };
  if (useCallExtras.getState().target === target) addSegments([{ ...seg, id: `notice|${now}` }]);
  try {
    await api().addTranscriptSegments(target, [seg]);
  } catch {
    /* the banner still shows locally; the others see the recording when it is saved */
  }
}

function wireSources() {
  if (!rec) return;
  const { local, remote } = callAudio();
  const streams = [local, ...remote].filter((s) => s && s.getAudioTracks?.().length);
  const ids = new Set(streams.map((s) => s.id));
  for (const s of streams) {
    if (rec.sources.has(s.id)) continue;
    try {
      const src = rec.ctx.createMediaStreamSource(s);
      src.connect(rec.dest);
      rec.sources.set(s.id, src);
    } catch {
      /* a stream that ended meanwhile */
    }
  }
  for (const [id, src] of rec.sources) {
    if (ids.has(id)) continue;
    try {
      src.disconnect();
    } catch {
      /* already gone */
    }
    rec.sources.delete(id);
  }
}

export async function startRecording() {
  const { target, recording, recorder } = useCallExtras.getState();
  if (!target || recording) return;
  if (recorder && recorder.by && recorder.by !== myId() && useHuddle.getState().participants.some((p) => p.userId === recorder.by)) {
    toast(`${recorder.byName} is already recording this call.`);
    return;
  }
  const why = recordingUnsupported();
  if (why) {
    toast(why, 'warning');
    return;
  }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    await ctx.resume?.().catch(() => {});
    const dest = ctx.createMediaStreamDestination();
    const mime = pickRecordingMime(window.MediaRecorder.isTypeSupported?.bind(window.MediaRecorder), { ios: isIOS });
    const recorder = new window.MediaRecorder(dest.stream, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    rec = { recorder, chunks, ctx, dest, sources: new Map(), mime: recorder.mimeType || mime, startedAt: Date.now(), target };
    recorder.ondataavailable = (e) => {
      if (e.data?.size) chunks.push(e.data);
    };
    wireSources();
    rec.off = onCallAudio(wireSources);
    recorder.start(1000);
    set({ recording: { startedAt: rec.startedAt, mime: rec.mime }, consentSeen: true });
    await announce(target, true);
  } catch (err) {
    cleanupRecorder();
    toast(err?.message ? `Recording couldn’t start: ${err.message}` : 'Recording couldn’t start.', 'danger');
  }
}

function cleanupRecorder(r = rec) {
  if (!r) return;
  if (r === rec) rec = null;
  r.off?.();
  for (const src of r.sources.values()) {
    try {
      src.disconnect();
    } catch {
      /* already gone */
    }
  }
  r.ctx?.close?.().catch?.(() => {});
}

async function upload({ blob, fileName, durationSec, target }) {
  set({ uploading: true, failedUpload: null });
  try {
    await api().uploadRecording(target, blob, { fileName, durationSec });
    toast(target.kind === 'meeting' ? 'Recording saved to the meeting' : 'Recording saved to the huddle', 'success');
  } catch (err) {
    set({ failedUpload: { blob, fileName, durationSec, target } });
    toast(err.message || 'The recording didn’t upload. Try again from the call menu.', 'danger');
  } finally {
    set({ uploading: false });
  }
}

export async function stopRecording() {
  const r = rec;
  if (!r) return;
  rec = null; // a second stop (leaving right after tapping Stop) finds nothing to do
  r.off?.();
  set({ recording: null });
  const stopped = new Promise((resolve) => {
    r.recorder.onstop = resolve;
    setTimeout(resolve, 3000);
  });
  try {
    if (r.recorder.state !== 'inactive') r.recorder.stop();
  } catch {
    /* already stopped */
  }
  await stopped;
  cleanupRecorder(r);
  announce(r.target, false);
  const { type, name } = recordingFile(r.mime);
  const blob = new Blob(r.chunks, { type });
  const problem = recordingProblem(blob.size);
  if (problem) {
    toast(problem, 'warning');
    return;
  }
  await upload({ blob, fileName: name, durationSec: (Date.now() - r.startedAt) / 1000, target: r.target });
}

export const retryUpload = () => {
  const f = useCallExtras.getState().failedUpload;
  if (f) upload(f);
};

export const dismissConsent = () => set({ consentSeen: true });

/** "Leave" on the consent banner: leave the call (and stop my own captions). */
export function declineRecording() {
  set({ consentSeen: true });
  leave();
}

// ---------------------------------------------------------------- AI

export async function askAboutCall(question) {
  const { segments } = useCallExtras.getState();
  const call = useHuddle.getState().call;
  return api().askAboutMeeting({
    workspaceId: useSession.getState().workspaceId,
    title: call?.title || 'Huddle',
    transcript: transcriptText(segments),
    question,
  });
}

/** The caption strip: the last lines from everyone plus mine in progress. */
export const useCaptionLines = () => {
  const segments = useCallExtras((s) => s.segments);
  const partial = useCallExtras((s) => s.partial);
  return captionLines(segments, partial, { me: myId() });
};

// ---------------------------------------------------------------- lifecycle

async function callStarted(call) {
  const target = callTarget(call.huddleId);
  set({ target, segments: [], partial: '', recorder: null, consentSeen: false, failedUpload: null });
  if (!target) return;
  if (target.kind === 'meeting') api().joinMeetingRoom?.(target.id).catch(() => {});
  try {
    const { segments } = await api().callTranscript(target);
    if (sameTarget(target.kind === 'meeting' ? { meetingId: target.id } : { huddleId: target.id })) addSegments(segments);
  } catch {
    /* no transcript yet, or offline */
  }
}

async function callEnded(prevTarget) {
  if (rec) stopRecording(); // uploads in the background, to the call it recorded
  await stopCallCaptions();
  queue = null;
  if (prevTarget?.kind === 'meeting') api().leaveMeetingRoom?.(prevTarget.id);
  set({ target: null, segments: [], partial: '', recorder: null, showCaptions: false });
}

const onEvent = ({ event, payload }) => {
  if (!sameTarget(payload)) return;
  if (event.endsWith(':transcript_segments')) addSegments(payload.segments);
  else if (event.endsWith(':recording_ready') && String(payload.recording?.uploadedBy || '') !== myId()) toast('A recording of this call was saved.');
};

let bound = false;
/** Follows the current call (once, app-wide). Returns a cleanup. */
export function bindCallExtras() {
  if (bound) return () => {};
  bound = true;
  let current = useHuddle.getState().call?.huddleId || null;
  if (current) callStarted(useHuddle.getState().call);
  const offStore = useHuddle.subscribe((s) => {
    const next = s.call?.huddleId || null;
    if (next === current) return;
    const prev = useCallExtras.getState().target;
    current = next;
    Promise.resolve(prev ? callEnded(prev) : null).then(() => {
      const call = useHuddle.getState().call;
      if (next && call?.huddleId === next) callStarted(call);
    });
  });
  const offHuddle = on('huddle', onEvent);
  const offMeeting = on('meeting', onEvent);
  // After a reconnect: rejoin the meeting room and catch up on lines sent meanwhile.
  const offRealtime = on('realtime', ({ connected }) => {
    const t = useCallExtras.getState().target;
    if (!connected || !t) return;
    if (t.kind === 'meeting') api().joinMeetingRoom?.(t.id).catch(() => {});
    api().callTranscript(t).then(({ segments }) => addSegments(segments), () => {});
    if (queue?.pending()) flushCaptions();
  });
  return () => {
    bound = false;
    offStore();
    offHuddle();
    offMeeting();
    offRealtime();
  };
}

/** For tests. */
export function __resetCallExtras() {
  stopListening = null;
  queue = null;
  clearTimeout(flushTimer);
  cleanupRecorder();
  set({ target: null, segments: [], partial: '', showCaptions: false, captions: false, captionsBusy: false, recording: null, uploading: false, failedUpload: null, recorder: null, consentSeen: false });
}
