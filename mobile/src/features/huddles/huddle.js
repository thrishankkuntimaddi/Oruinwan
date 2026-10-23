// Huddles on the phone: voice and video calls in a channel, a DM or a scheduled meeting.
//
// The same protocol as the web app (server/src/modules/huddles/huddles.socket.js): a WebRTC
// mesh where everyone already in the call sends the newcomer an offer. Video works like the web
// client's useHuddle.js: a camera (or screen) turned on mid-call is swapped into the video sender
// or added with a fresh offer, so phone and web see each other. Signalling goes over the app's
// socket (the adapter's `huddles` helpers); huddle events arrive on the bus as { event, payload }.
//
// One call at a time: starting or joining another asks first (state.prompt). The same call on
// another of my devices can be moved here (transfer); the server hangs up the other device.
// On Android a foreground service keeps the call alive in the background (native/callSession.js).
import { create } from 'zustand';
import { Capacitor } from '@capacitor/core';
import { api, useSession } from '../../data/session.js';
import { emit as busEmit, on, toast } from '../../lib/bus.js';
import { callFullText, timeLimitEndedText } from '../plan/planText.js';
import { cancelIncomingNotification, keepScreenOn, nativeDeviceName, onCallAction, setSpeaker, startCallSession, stopCallSession, stopRinging, updateCallSession } from '../../native/callSession.js';
import { cameraConstraints, deviceLabel, elsewhereCall, endedMessage, promptForError, scopeOf, switchPrompt } from './callLogic.js';
import { ensureAllowed } from './callPermissions.js';
import { prefs } from '../../native/storage.js';

const FALLBACK_ICE = { iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }] };

const uuid = () =>
  globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** The conversation key a live huddle belongs to: a channel or DM id, or 'workspace'. */
export const scopeKey = (s) => (s?.channelId ? String(s.channelId) : s?.dmId ? String(s.dmId) : 'workspace');

const helpers = () => api()?.huddles || null;
const myId = () => String(useSession.getState().user?.id || '');
const mySocketId = () => helpers()?.socketId?.() || null;

const isTabletScreen = () =>
  typeof screen !== 'undefined' && Math.min(screen.width || 0, screen.height || 0) >= 600;

/** How the server and my other devices name this one: { label, platform }. */
const device = { label: deviceLabel({ userAgent: globalThis.navigator?.userAgent, tablet: isTabletScreen() }), platform: Capacitor.getPlatform() };
let deviceNamed = false;
// The stable install id lets the server tell "another device" from "this device reconnecting".
// Same id the API client sends as X-Device-Id (data/live/http.js deviceId).
const callDevice = () => { let id = null; try { id = prefs.get('device.id'); } catch { /* storage not ready */ } return typeof id === 'string' && id ? { ...device, id } : { ...device }; };
function nameDevice() {
  if (deviceNamed) return;
  deviceNamed = true;
  nativeDeviceName().then((name) => {
    if (name) device.label = deviceLabel({ nativeName: name });
  });
}

export const useHuddle = create(() => ({
  /** The call I'm in: { huddleId, scope, title, startedAt, meetingId } or null (meetingId: its meeting record). */
  call: null,
  connecting: false,
  participants: [], // [{ userId, username, audioEnabled, videoEnabled, handRaised, isLocal }]
  muted: false,
  cameraOn: false,
  /** 'user' (front) or 'environment' (back) camera. */
  facing: 'user',
  sharing: false,
  handRaised: false,
  speakerOn: true,
  /** The call screen: 'full' or minimised to the floating bubble. */
  view: 'full',
  /** Bumps when a video or screen track arrives or ends, so tiles re-render. */
  mediaTick: 0,
  peerStates: {}, // userId -> RTCPeerConnection.connectionState
  /** Live huddles I can see, by conversation: { [channelId|dmId]: { huddleId, startedBy, video, participants } }. */
  live: {},
  /** A DM or group-DM call ringing for me (ringLogic.normalizeRing; incomingCall.js), or null. */
  ring: null,
  /** "Ben started a huddle in #design · Join" (a channel huddle; no ringing), or null. */
  notice: null,
  /** "You're in another call · Switch?" or "Move the call here?" (callLogic.switchPrompt), or null. */
  prompt: null,
  /** My call on another of my devices (the server's huddle:self_active), for "Move here". */
  elsewhere: null,
  /** The free plan's cap on this call (huddle:roster): { maxMinutes, startedAt, endsAt } or null. */
  timeLimit: null,
  /** The last huddle:time_warning for my call: { minutesLeft, endsAt, maxMinutes, message } or null. */
  timeWarning: null,
  /** Why my last call ended, when worth a message (the free plan's time limit): { message, meetingId } or null. */
  endedNotice: null,
}));

const set = (patch) => useHuddle.setState(typeof patch === 'function' ? patch(useHuddle.getState()) : patch);

/** Screen sharing needs getDisplayMedia, which Android's WebView doesn't have (tablets in a browser do). */
export const screenShareSupported = () => typeof globalThis.navigator?.mediaDevices?.getDisplayMedia === 'function';

let localStream = null; // microphone, plus the camera track while it is on
let screenStream = null;
let iceConfig = FALLBACK_ICE;
const peers = {}; // userId -> { pc, pending: [], polite }
const early = {}; // userId -> ICE candidates that came before the offer
const audioEls = {};
const remoteStreams = {}; // userId -> MediaStream (their voice and video)
const streamWatchers = new Set();
const notifyStreams = () => streamWatchers.forEach((fn) => fn());
const bumpMedia = () => set((s) => ({ mediaTick: s.mediaTick + 1 }));

/** The call's audio right now: my microphone and everyone else's voice ({ local, remote: [MediaStream] }). */
export function callAudio() {
  return { local: localStream, remote: Object.values(remoteStreams) };
}

/** Calls fn whenever someone's voice joins or leaves the call (to add them to a recording). Returns an unsubscribe. */
export function onCallAudio(fn) {
  streamWatchers.add(fn);
  return () => streamWatchers.delete(fn);
}

/** What my own tile shows: the screen while sharing, else my camera (or nothing). */
export function localMedia() {
  return screenStream || localStream;
}

/** Someone's stream (voice and video), for their tile. */
export function remoteMedia(userId) {
  return remoteStreams[String(userId)] || null;
}

function emit(event, payload) {
  helpers()?.emit(event, payload);
}

function scopePayload(scope) {
  if (scope?.channelId) return { channelId: scope.channelId };
  if (scope?.dmId) return { dmId: scope.dmId };
  return { workspaceId: scope?.workspaceId || useSession.getState().workspaceId };
}

function setLive(key, value) {
  set((s) => {
    const live = { ...s.live };
    if (value) live[key] = value;
    else delete live[key];
    return { live };
  });
}

function closePeer(userId) {
  const p = peers[userId];
  if (p) {
    p.pc.onicecandidate = null;
    p.pc.ontrack = null;
    p.pc.onconnectionstatechange = null;
    p.pc.close();
    delete peers[userId];
  }
  delete early[userId];
  if (remoteStreams[userId]) {
    delete remoteStreams[userId];
    notifyStreams();
    bumpMedia();
  }
  const el = audioEls[userId];
  if (el) {
    el.srcObject = null;
    el.remove();
    delete audioEls[userId];
  }
  set((s) => {
    const peerStates = { ...s.peerStates };
    delete peerStates[userId];
    return { peerStates };
  });
}

function teardown() {
  if (pendingStart) clearTimeout(pendingStart.timer);
  pendingStart = null;
  Object.keys(peers).forEach(closePeer);
  localStream?.getTracks().forEach((t) => t.stop());
  localStream = null;
  screenStream?.getTracks().forEach((t) => {
    t.onended = null;
    t.stop();
  });
  screenStream = null;
  const hadCall = Boolean(useHuddle.getState().call);
  set({ call: null, participants: [], muted: false, cameraOn: false, sharing: false, handRaised: false, speakerOn: true, view: 'full', peerStates: {}, connecting: false, timeLimit: null, timeWarning: null });
  if (hadCall) {
    stopCallSession();
    keepScreenOn(false);
  }
}

/** The background notification follows the call: title, mute and video. */
function syncSession() {
  const { call, muted, cameraOn } = useHuddle.getState();
  if (call) updateCallSession({ title: call.title, muted, video: cameraOn, startedAt: call.startedAt });
}

function peerFor(userId, polite) {
  if (peers[userId]) return peers[userId];
  const pc = new RTCPeerConnection(iceConfig);
  const entry = { pc, pending: early[userId] || [], polite, makingOffer: false };
  delete early[userId];
  peers[userId] = entry;
  localStream?.getAudioTracks().forEach((t) => pc.addTrack(t, localStream));
  // Someone joining gets my screen while I share, else my camera while it is on.
  const video = screenStream?.getVideoTracks()[0] || localStream?.getVideoTracks()[0];
  if (video) pc.addTrack(video, localStream);
  pc.onicecandidate = ({ candidate }) => {
    const call = useHuddle.getState().call;
    if (candidate && call) emit('huddle:ice-candidate', { huddleId: call.huddleId, targetUserId: userId, candidate: candidate.toJSON ? candidate.toJSON() : candidate });
  };
  pc.ontrack = ({ track, streams }) => {
    const stream = streams[0] || remoteStreams[userId] || new MediaStream();
    if (!streams[0] && !stream.getTracks().includes(track)) stream.addTrack(track);
    remoteStreams[userId] = stream;
    if (track.kind === 'audio') {
      let el = audioEls[userId];
      if (!el) {
        el = document.createElement('audio');
        el.autoplay = true;
        el.setAttribute('playsinline', '');
        document.body.appendChild(el);
        audioEls[userId] = el;
      }
      el.srcObject = stream;
      el.play?.().catch(() => {});
      notifyStreams();
    }
    // A camera or screen turned on mid-call arrives as a new track: re-render the tiles.
    track.onunmute = bumpMedia;
    track.onended = bumpMedia;
    bumpMedia();
  };
  pc.onconnectionstatechange = () => {
    set((s) => ({ peerStates: { ...s.peerStates, [userId]: pc.connectionState } }));
    if (pc.connectionState === 'failed' && !entry.polite) offer(userId, { iceRestart: true }).catch(() => {});
  };
  return entry;
}

async function offer(userId, { iceRestart = false } = {}) {
  const entry = peers[userId];
  const call = useHuddle.getState().call;
  if (!entry || !call) return;
  entry.makingOffer = true;
  try {
    await entry.pc.setLocalDescription(await entry.pc.createOffer(iceRestart ? { iceRestart: true } : undefined));
  } finally {
    entry.makingOffer = false;
  }
  emit('huddle:offer', { huddleId: call.huddleId, targetUserId: userId, offer: entry.pc.localDescription });
}

/** The sender that carries (or carried) my video to this peer, if there is one. */
function videoSender(pc) {
  return (
    pc.getSenders().find((s) => s.track?.kind === 'video') ||
    pc.getTransceivers?.().find((t) => t.receiver?.track?.kind === 'video' && t.sender && !t.sender.track && t.direction !== 'recvonly' && t.direction !== 'inactive')?.sender ||
    null
  );
}

/**
 * Send a video track (camera or screen) to everyone, or stop sending with null: swap it into
 * the existing video sender, or add it and renegotiate (a voice call turning video on).
 */
async function sendVideoTrack(track) {
  await Promise.all(
    Object.entries(peers).map(async ([userId, entry]) => {
      const sender = videoSender(entry.pc);
      if (sender) {
        await sender.replaceTrack(track).catch(() => {});
        return;
      }
      if (!track) return;
      entry.pc.addTrack(track, localStream || new MediaStream([track]));
      await offer(userId).catch(() => {});
    }),
  );
}

async function flush(entry) {
  for (const c of entry.pending.splice(0)) {
    try {
      await entry.pc.addIceCandidate(c);
    } catch {
      /* a stale candidate */
    }
  }
}

const isMine = (hid) => Boolean(hid) && useHuddle.getState().call?.huddleId === hid;

function upsert(p) {
  set((s) => ({
    participants: s.participants.some((x) => x.userId === p.userId)
      ? s.participants.map((x) => (x.userId === p.userId ? { ...x, ...p } : x))
      : [...s.participants, p],
  }));
}

const patchParticipant = (userId, patch) =>
  set((s) => ({ participants: s.participants.map((x) => (x.userId === String(userId) ? { ...x, ...patch } : x)) }));

const patchLocal = (patch) => set((s) => ({ participants: s.participants.map((p) => (p.isLocal ? { ...p, ...patch } : p)) }));

// A start waiting for the server: join once our own huddle:started (or huddle:existing) is back.
let pendingStart = null;
function joinPendingStart(huddleId) {
  const pending = pendingStart;
  if (!pending) return;
  pendingStart = null;
  clearTimeout(pending.timer);
  const { call, muted, cameraOn } = useHuddle.getState();
  if (call && call.huddleId === huddleId) emit('huddle:join', { ...pending.where, huddleId, audioEnabled: !muted, videoEnabled: cameraOn, ...pending.extra });
}

// The last start or join I asked for, so a "you're already in a call" answer can offer to switch.
let lastRequest = null;

/** Huddle payloads carry the call's meeting record id: remember it for the meeting page. */
function noteMeetingId(p) {
  const call = useHuddle.getState().call;
  if (!call || !p?.meetingId || call.huddleId !== p.huddleId || call.meetingId === String(p.meetingId)) return;
  set({ call: { ...call, meetingId: String(p.meetingId) } });
}

function setElsewhere(active) {
  set({ elsewhere: elsewhereCall(active, { socketId: mySocketId(), callHuddleId: useHuddle.getState().call?.huddleId }) });
}

const handlers = {
  'huddle:started'(p) {
    if (pendingStart?.huddleId === p.huddleId) joinPendingStart(p.huddleId);
    const key = scopeKey(p);
    if (key !== 'workspace') setLive(key, { huddleId: p.huddleId, startedBy: p.startedBy, video: Boolean(p.video), participants: [] });
    // Ringing for DM calls: incomingCall.js (huddle:ring, or this event from older servers).
  },
  'huddle:ended'(p) {
    const key = scopeKey(p);
    set((s) => {
      const live = { ...s.live };
      if (live[key]?.huddleId === p.huddleId) delete live[key];
      return { live, ring: s.ring?.huddleId === p.huddleId ? null : s.ring };
    });
    if (isMine(p.huddleId)) {
      const message = endedMessage(p.reason, p.to);
      if (message) toast(message);
      const meetingId = useHuddle.getState().call?.meetingId || (p.meetingId ? String(p.meetingId) : null);
      const maxMinutes = useHuddle.getState().timeLimit?.maxMinutes;
      teardown();
      if (p.reason === 'time_limit') set({ endedNotice: { message: p.message || timeLimitEndedText(maxMinutes), meetingId } });
      // Moved to another device: show "In a call on … · Move here" again.
      if (p.reason === 'moved' || p.reason === 'joined_elsewhere') refreshMine();
    }
  },
  'huddle:existing'(p) {
    // Starting where a huddle already runs joins that one.
    const call = useHuddle.getState().call;
    if (!call || call.huddleId !== p.requestedId) return;
    set({ call: { ...call, huddleId: p.huddleId, ...(p.meetingId ? { meetingId: String(p.meetingId) } : {}) } });
    if (pendingStart?.huddleId === p.requestedId) joinPendingStart(p.huddleId);
  },
  'huddle:roster'(p) {
    if (!isMine(p.huddleId)) return;
    set({ connecting: false, ...(p.timeLimit !== undefined ? { timeLimit: p.timeLimit || null } : {}) });
    (p.participants || [])
      .filter((x) => String(x.userId) !== myId())
      .forEach((x) => upsert({ userId: String(x.userId), username: x.username, audioEnabled: x.audioEnabled !== false, videoEnabled: Boolean(x.videoEnabled), sharing: Boolean(x.videoEnabled && x.sharing), handRaised: Boolean(x.handRaised) }));
  },
  async 'huddle:joined'(p) {
    if (!isMine(p.huddleId) || String(p.userId) === myId()) return;
    const uid = String(p.userId);
    upsert({ userId: uid, username: p.username, audioEnabled: p.audioEnabled !== false, videoEnabled: Boolean(p.videoEnabled), sharing: Boolean(p.videoEnabled && p.sharing), handRaised: false });
    closePeer(uid);
    peerFor(uid, false);
    await offer(uid).catch(() => {});
  },
  async 'huddle:offer'(p) {
    if (!isMine(p.huddleId)) return;
    const uid = String(p.fromUserId);
    const entry = peerFor(uid, true);
    const collision = entry.makingOffer || entry.pc.signalingState !== 'stable';
    if (collision && !entry.polite) return;
    try {
      if (collision) await entry.pc.setLocalDescription({ type: 'rollback' });
      await entry.pc.setRemoteDescription(p.offer);
      await flush(entry);
      await entry.pc.setLocalDescription(await entry.pc.createAnswer());
      emit('huddle:answer', { huddleId: p.huddleId, targetUserId: uid, answer: entry.pc.localDescription });
    } catch {
      /* the next offer recovers */
    }
  },
  async 'huddle:answer'(p) {
    if (!isMine(p.huddleId)) return;
    const entry = peers[String(p.fromUserId)];
    if (!entry) return;
    try {
      await entry.pc.setRemoteDescription(p.answer);
      await flush(entry);
    } catch {
      /* stale answer */
    }
  },
  async 'huddle:ice-candidate'(p) {
    if (!isMine(p.huddleId) || !p.candidate) return;
    const uid = String(p.fromUserId);
    const entry = peers[uid];
    if (!entry) return void (early[uid] ||= []).push(p.candidate);
    if (!entry.pc.remoteDescription) return void entry.pending.push(p.candidate);
    try {
      await entry.pc.addIceCandidate(p.candidate);
    } catch {
      /* stale candidate */
    }
  },
  'huddle:left'(p) {
    if (!isMine(p.huddleId) || String(p.userId) === myId()) return;
    closePeer(String(p.userId));
    set((s) => ({ participants: s.participants.filter((x) => x.userId !== String(p.userId)) }));
  },
  'huddle:audio_changed'(p) {
    if (!isMine(p.huddleId) || String(p.userId) === myId()) return;
    patchParticipant(p.userId, { audioEnabled: p.audioEnabled !== false });
  },
  'huddle:video_changed'(p) {
    if (!isMine(p.huddleId) || String(p.userId) === myId()) return;
    // `sharing` (2.3.4+ senders): the video is a screen share, so the layout gives it the stage.
    patchParticipant(p.userId, { videoEnabled: Boolean(p.videoEnabled), sharing: Boolean(p.videoEnabled && p.sharing) });
    bumpMedia();
  },
  'huddle:hand_changed'(p) {
    if (!isMine(p.huddleId) || String(p.userId) === myId()) return;
    patchParticipant(p.userId, { handRaised: Boolean(p.raised) });
  },
  'huddle:participant_joined'(p) {
    refreshLive(p.huddleId);
  },
  'huddle:participant_left'(p) {
    refreshLive(p.huddleId);
  },
  'huddle:self_active'(p) {
    setElsewhere(p && p.huddleId ? p : null);
  },
  'huddle:time_warning'(p) {
    if (!isMine(p.huddleId)) return;
    const fromRoster = useHuddle.getState().timeLimit?.maxMinutes;
    set({ timeWarning: { minutesLeft: Number(p.minutesLeft) || 0, endsAt: p.endsAt || null, maxMinutes: Number(p.maxMinutes) || Number(fromRoster) || null, message: p.message || '' } });
  },
  'huddle:error'(p) {
    if (!isMine(p.huddleId)) return;
    // Already in a call (on another device, or this same call there): ask instead of failing.
    const prompt = promptForError(p, lastRequest);
    if (prompt) {
      teardown();
      set({ prompt });
      return;
    }
    // The free plan's 10 people per call: the upgrade sheet explains it (features/plan/UpgradeSheet.jsx).
    if (p.code === 'PLAN_LIMIT') {
      busEmit('plan:limit', { ...p, message: p.message || callFullText(p.max) });
      emit('huddle:leave', { huddleId: p.huddleId });
      teardown();
      return;
    }
    toast(p.message || 'Huddle error', 'danger');
    if (['HUDDLE_FULL', 'FORBIDDEN', 'HUDDLE_SCOPE_MISMATCH', 'ALREADY_IN_CALL'].includes(p.code)) {
      emit('huddle:leave', { huddleId: p.huddleId });
      teardown();
    }
  },
};

let refreshTimer = null;
function refreshLive() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(loadLive, 200);
}

/** Every live huddle I can see in this workspace (channels and DMs I'm in). */
export async function loadLive() {
  const h = helpers();
  const ws = useSession.getState().workspaceId;
  if (!h || !ws) return;
  const res = await h.request('huddle:list', { workspaceId: ws });
  if (!res) return;
  const live = {};
  for (const x of res.huddles || []) {
    const key = scopeKey(x);
    if (key !== 'workspace') live[key] = { huddleId: x.huddleId, startedBy: x.startedBy, video: Boolean(x.video), participants: x.participants || [] };
  }
  set({ live });
}

/** Am I in a call on another device? (huddle:mine, on start, reconnect and coming back to the app.) */
export async function refreshMine() {
  const h = helpers();
  if (!h?.connected?.()) return;
  const res = await h.request('huddle:mine', {}).catch(() => null);
  if (res) setElsewhere(res.active || null);
}

let bound = false;
/** Start listening for huddle events (once, app-wide). Returns a cleanup. */
export function bindHuddles() {
  if (bound) return () => {};
  bound = true;
  nameDevice();
  const offHuddle = on('huddle', ({ event, payload }) => {
    const p = payload || {};
    // Run the handler first: huddle:existing may switch the call to the running huddle's id.
    const out = handlers[event]?.(p);
    if (event !== 'huddle:ended') noteMeetingId(p);
    return out;
  });
  // After a reconnect the server has dropped me from the call: rejoin with fresh connections
  // (as a move from my old connection, which the server may not have noticed yet).
  const offRealtime = on('realtime', ({ connected }) => {
    if (!connected) return;
    loadLive();
    refreshMine();
    const { call, muted, cameraOn } = useHuddle.getState();
    if (call) {
      Object.keys(peers).forEach(closePeer);
      emit('huddle:join', { ...scopePayload(call.scope), huddleId: call.huddleId, audioEnabled: !muted, videoEnabled: cameraOn, device: callDevice(), transfer: true, rejoin: true });
    }
  });
  // The notification's Mute and Leave buttons.
  const offAction = onCallAction((action) => {
    if (action === 'mute') toggleMute();
    else if (action === 'leave') leave();
  });
  loadLive();
  refreshMine();
  return () => {
    bound = false;
    offHuddle();
    offRealtime();
    offAction();
  };
}

const getUserMedia = (c) => navigator.mediaDevices.getUserMedia(c);

/** A summary of my current call, for the "you're in another call" prompt. */
function currentCallInfo() {
  const { call } = useHuddle.getState();
  if (!call) return null;
  return { huddleId: call.huddleId, ...call.scope, channelName: call.title?.startsWith('#') ? call.title.slice(1).trim() : null, meetingId: call.meetingId, device: callDevice() };
}

/**
 * Start or join a call. intent: 'switch' leaves my other call first; 'transfer' moves this same
 * call here from another of my devices. Without one, a second call asks first (state.prompt).
 */
async function enter({ huddleId, scope, title, start, meetingId = null, video = false, intent = null, audioEnabled = true, videoEnabled = null }) {
  const h = helpers();
  if (!h) throw new Error('Huddles need a connection to your server.');
  const request = { huddleId, scope, title, start, meetingId, video, tablet: isTabletScreen() };
  const state = useHuddle.getState();
  // Still opening the microphone for another call: one tap at a time.
  if (state.connecting && !state.call) return;
  if (state.call) {
    if (state.call.huddleId === huddleId) {
      set({ view: 'full' });
      return;
    }
    if (intent !== 'switch') {
      set({ prompt: switchPrompt({ kind: 'local', current: currentCallInfo(), request }) });
      return;
    }
    leave();
  }
  if (!h.connected()) throw new Error("Can't reach your server right now.");
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('This device does not support calls.');
  if (!(await ensureAllowed('microphone'))) throw new Error('Allow the microphone to join the huddle.');
  const wantCamera = videoEnabled ?? video;
  const cameraAllowed = wantCamera ? await ensureAllowed('camera') : false;
  // Joining any call stops a ring that's still sounding.
  const ringing = useHuddle.getState().ring;
  if (ringing) {
    stopRinging();
    cancelIncomingNotification(ringing.huddleId);
  }
  set({ connecting: true, ring: null, prompt: null });
  let withCamera = false;
  try {
    const icePromise = h.iceServers().catch(() => null);
    let stream = null;
    if (cameraAllowed) {
      try {
        stream = await getUserMedia({ audio: true, video: cameraConstraints(useHuddle.getState().facing) });
        withCamera = true;
      } catch {
        toast('Camera unavailable: joining with audio only.');
      }
    }
    if (!stream) stream = await getUserMedia({ audio: true, video: false });
    localStream = stream;
    const ice = await icePromise;
    if (ice?.iceServers?.length) iceConfig = { iceServers: ice.iceServers, iceTransportPolicy: ice.iceTransportPolicy || 'all' };
  } catch (err) {
    set({ connecting: false });
    throw new Error(err?.name === 'NotAllowedError' ? 'Allow the microphone to join the huddle.' : err?.message || 'Could not open the microphone.');
  }
  const muted = audioEnabled === false;
  localStream.getAudioTracks().forEach((t) => {
    t.enabled = !muted;
  });
  const me = useSession.getState().user;
  const startedAt = Date.now();
  set({
    call: { huddleId, scope, title: title || 'Huddle', startedAt, meetingId: meetingId ? String(meetingId) : null },
    participants: [{ userId: myId(), username: me?.name || 'You', audioEnabled: !muted, videoEnabled: withCamera, handRaised: false, isLocal: true }],
    muted,
    cameraOn: withCamera,
    view: 'full',
    elsewhere: intent === 'transfer' ? null : state.elsewhere,
  });
  lastRequest = request;
  const where = scopePayload(scope);
  const extra = { device: callDevice(), ...(intent === 'switch' ? { switch: true } : {}), ...(intent === 'transfer' ? { transfer: true } : {}) };
  if (start) {
    // Join once the server has created the huddle (or pointed us at the one already running).
    pendingStart = { huddleId, where, extra, timer: setTimeout(() => joinPendingStart(useHuddle.getState().call?.huddleId), 1500) };
    emit('huddle:start', { ...where, huddleId, video: Boolean(video), ...extra });
  } else {
    emit('huddle:join', { ...where, huddleId, audioEnabled: !muted, videoEnabled: withCamera, ...extra });
  }
  startCallSession({ title: title || 'Huddle', muted, video: withCamera, startedAt });
  setTimeout(() => set((s) => (s.connecting ? { connecting: false } : {})), 8000);
}

/** Start a huddle in a channel or DM (joins the one already live there). opts.video: with the camera on. */
export function startHuddle(scope, title, { video = false } = {}) {
  const live = useHuddle.getState().live[scopeKey(scope)];
  if (live) return enter({ huddleId: live.huddleId, scope, title, start: false, video: video || live.video });
  return enter({ huddleId: uuid(), scope, title, start: true, video });
}

/** Join a live huddle; a video huddle opens the camera too (like the web app). */
export function joinHuddle(huddleId, scope, title, meetingId = null, { video } = {}) {
  const live = useHuddle.getState().live[scopeKey(scope)];
  const withVideo = video ?? Boolean(live?.huddleId === huddleId && live.video);
  return enter({ huddleId, scope, title, start: false, meetingId, video: withVideo });
}

/** A huddle for the whole workspace (no channel or DM): everyone in the workspace may join. */
export function startWorkspaceHuddle(title = 'Workspace huddle') {
  return enter({ huddleId: uuid(), scope: { workspaceId: useSession.getState().workspaceId }, title, start: true });
}

/** The scope a meeting's call runs in, from a mapped meeting ({ conversation }) or a raw one. */
export function meetingScope(m) {
  const idOf = (v) => (v && typeof v === 'object' ? v._id || v.id : v) || null;
  const c = m?.conversation;
  if (c?.kind === 'channel' && c.id) return { channelId: String(c.id) };
  if (c?.kind === 'dm' && c.id) return { dmId: String(c.id) };
  if (idOf(m?.channelId)) return { channelId: String(idOf(m.channelId)) };
  if (idOf(m?.dmSessionId)) return { dmId: String(idOf(m.dmSessionId)) };
  return { workspaceId: String(idOf(m?.workspaceId) || useSession.getState().workspaceId) };
}

/**
 * Join (or start) the call of any meeting record: a scheduled meeting runs as `meeting-<id>`,
 * an ad-hoc huddle under its own huddle id (joinable while it is live).
 */
export function joinMeetingCall(meeting) {
  if (meeting?.kind === 'huddle') {
    if (!meeting.huddleId) throw new Error('This huddle has no call to join.');
    return joinHuddle(meeting.huddleId, meetingScope(meeting), meeting.title, meeting.id);
  }
  return joinMeeting(meeting.raw || meeting);
}

/** "End for everyone": ends the meeting record and its live call (everyone gets huddle:ended). */
export async function endForEveryone(meetingId) {
  const id = meetingId || useHuddle.getState().call?.meetingId;
  if (!id) throw new Error("This call has no meeting page, so it can't be ended for everyone.");
  const ended = await api().endMeeting(id);
  // The server removes everyone; don't wait for the event to hang up here.
  if (useHuddle.getState().call?.meetingId === String(id)) teardown();
  return ended;
}

/** A scheduled meeting's call: its own huddle, in its conversation when it has one. */
export async function joinMeeting(meeting) {
  const h = helpers();
  const id = String(meeting.id || meeting._id);
  const m = (await h.joinMeeting(id)) || meeting;
  return enter({ huddleId: `meeting-${id}`, scope: meetingScope(m), title: m.title || 'Meeting', start: true, meetingId: id });
}

export function leave() {
  const call = useHuddle.getState().call;
  if (call) emit('huddle:leave', { huddleId: call.huddleId });
  teardown();
}

export function toggleMute() {
  const { call, muted } = useHuddle.getState();
  if (!call || !localStream) return;
  const next = !muted;
  localStream.getAudioTracks().forEach((t) => {
    t.enabled = !next;
  });
  set({ muted: next });
  patchLocal({ audioEnabled: !next });
  emit('huddle:audio_toggle', { huddleId: call.huddleId, audioEnabled: !next });
  syncSession();
}

function announceVideo() {
  const { call, cameraOn, sharing } = useHuddle.getState();
  if (!call) return;
  patchLocal({ videoEnabled: cameraOn || sharing });
  emit('huddle:video_toggle', { huddleId: call.huddleId, videoEnabled: cameraOn || sharing, sharing: !!sharing });
  bumpMedia();
  syncSession();
}

/** Camera on or off. Off stops the camera completely (the light goes out, the battery rests). */
export async function toggleCamera() {
  const { call, cameraOn, facing } = useHuddle.getState();
  if (!call || !localStream) return;
  if (cameraOn) {
    const tracks = localStream.getVideoTracks();
    if (!screenStream) await sendVideoTrack(null);
    tracks.forEach((t) => {
      localStream.removeTrack(t);
      t.stop();
    });
    set({ cameraOn: false });
    announceVideo();
    return;
  }
  if (!(await ensureAllowed('camera'))) return;
  let cam;
  try {
    cam = await getUserMedia({ video: cameraConstraints(facing) });
  } catch (err) {
    toast(err?.name === 'NotAllowedError' ? 'Allow the camera to turn on video.' : 'No camera is available.', 'danger');
    return;
  }
  const track = cam.getVideoTracks()[0];
  if (!track || useHuddle.getState().call?.huddleId !== call.huddleId || !localStream) {
    cam.getTracks().forEach((t) => t.stop());
    return;
  }
  localStream.addTrack(track);
  // While sharing the screen, others keep seeing the screen; the camera waits.
  if (!screenStream) await sendVideoTrack(track);
  set({ cameraOn: true });
  announceVideo();
}

/** Front ↔ back camera, without a renegotiation (the new track replaces the old one). */
export async function switchCamera() {
  const { cameraOn, facing } = useHuddle.getState();
  const next = facing === 'user' ? 'environment' : 'user';
  if (!cameraOn || !localStream) {
    set({ facing: next });
    return;
  }
  let cam;
  try {
    cam = await getUserMedia({ video: cameraConstraints(next) });
  } catch {
    toast('Could not switch the camera.', 'danger');
    return;
  }
  const track = cam.getVideoTracks()[0];
  if (!track || !localStream) {
    cam.getTracks().forEach((t) => t.stop());
    return;
  }
  const old = localStream.getVideoTracks();
  localStream.addTrack(track);
  if (!screenStream) await sendVideoTrack(track);
  old.forEach((t) => {
    localStream.removeTrack(t);
    t.stop();
  });
  set({ facing: next });
  bumpMedia();
}

/** Share the screen where the device can (tablets in a browser); Android's WebView can't. */
export async function startScreenShare() {
  const { call } = useHuddle.getState();
  if (!call || screenStream) return false;
  if (!screenShareSupported()) {
    toast('Screen sharing from the phone isn’t available yet. You can see other people’s shared screens.');
    return false;
  }
  let display;
  try {
    display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  } catch {
    return false;
  }
  const track = display.getVideoTracks()[0];
  if (!track || useHuddle.getState().call?.huddleId !== call.huddleId) {
    display.getTracks().forEach((t) => t.stop());
    return false;
  }
  screenStream = display;
  track.onended = () => stopScreenShare();
  await sendVideoTrack(track);
  set({ sharing: true });
  announceVideo();
  return true;
}

export async function stopScreenShare() {
  if (!screenStream) return;
  const screenTracks = screenStream.getTracks();
  screenStream = null;
  screenTracks.forEach((t) => {
    t.onended = null;
    t.stop();
  });
  await sendVideoTrack(localStream?.getVideoTracks()[0] || null);
  set({ sharing: false });
  announceVideo();
}

export function toggleHand() {
  const { call, handRaised } = useHuddle.getState();
  if (!call) return;
  const next = !handRaised;
  set({ handRaised: next });
  patchLocal({ handRaised: next });
  emit('huddle:hand', { huddleId: call.huddleId, raised: next });
}

/** Loudspeaker or earpiece (Android only). */
export async function toggleSpeaker() {
  const next = !useHuddle.getState().speakerOn;
  if (await setSpeaker(next)) set({ speakerOn: next });
}

/** 'full' call screen or the floating bubble. */
export const setCallView = (view) => set({ view });

/** "Switch" / "Move here" on the prompt. */
export async function confirmPrompt() {
  const prompt = useHuddle.getState().prompt;
  if (!prompt) return;
  set({ prompt: null });
  const r = prompt.request;
  if (prompt.kind === 'move') {
    return enter({ ...r, start: false, intent: 'transfer', audioEnabled: prompt.current?.audioEnabled !== false, videoEnabled: Boolean(prompt.current?.videoEnabled) });
  }
  return enter({ ...r, intent: 'switch' });
}

export const dismissPrompt = () => set({ prompt: null });

/** "In a call on Pixel 8 · Move here": take my call over from the other device. */
export function moveCallHere() {
  const active = useHuddle.getState().elsewhere;
  if (!active) return undefined;
  const name = active.channelName ? `# ${String(active.channelName).replace(/^#\s*/, '')}` : 'Huddle';
  return enter({
    huddleId: active.huddleId,
    scope: scopeOf(active),
    title: name,
    start: false,
    meetingId: active.meetingId || null,
    video: Boolean(active.video),
    intent: 'transfer',
    audioEnabled: active.audioEnabled !== false,
    videoEnabled: Boolean(active.videoEnabled),
  });
}

/** Ask whether a huddle is live in this conversation (one opened after it started). */
export async function checkConversation(scope) {
  const h = helpers();
  if (!h) return;
  const res = await h.request('huddle:active', scopePayload(scope));
  const key = scopeKey(scope);
  if (!res) return;
  if (res.huddle) setLive(key, { huddleId: res.huddle.huddleId, startedBy: res.huddle.startedBy, video: Boolean(res.huddle.video), participants: res.huddle.participants || [] });
  else setLive(key, null);
}

/** Tells the server (and so the caller and my other devices) that I declined this call. */
export function declineCall(huddleId) {
  if (huddleId) emit('huddle:decline', { huddleId: String(huddleId) });
}
export const dismissTimeWarning = () => set({ timeWarning: null });
export const dismissEndedNotice = () => set({ endedNotice: null });

/** For tests. */
export function __resetHuddles() {
  teardown();
  lastRequest = null;
  set({ live: {}, ring: null, notice: null, endedNotice: null, prompt: null, elsewhere: null, facing: 'user' });
}
