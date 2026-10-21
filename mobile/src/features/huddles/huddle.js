// Huddles on the phone: voice calls in a channel, a DM or a scheduled meeting.
//
// The same protocol as the web app (server/src/modules/huddles/huddles.socket.js): a WebRTC
// mesh where everyone already in the call sends the newcomer an offer. The phone sends audio
// only; it still plays everyone's audio. Signalling goes over the app's socket (the adapter's
// `huddles` helpers), and huddle events arrive on the bus as { event, payload }.
import { create } from 'zustand';
import { api, useSession } from '../../data/session.js';
import { emit as busEmit, on, toast } from '../../lib/bus.js';
import { callFullText, timeLimitEndedText } from '../plan/planText.js';

const FALLBACK_ICE = { iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }] };

const uuid = () =>
  globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** The conversation key a live huddle belongs to: a channel or DM id, or 'workspace'. */
export const scopeKey = (s) => (s?.channelId ? String(s.channelId) : s?.dmId ? String(s.dmId) : 'workspace');

const helpers = () => api()?.huddles || null;
const myId = () => String(useSession.getState().user?.id || '');

export const useHuddle = create(() => ({
  /** The call I'm in: { huddleId, scope, title, startedAt, meetingId } or null (meetingId: its meeting record). */
  call: null,
  connecting: false,
  participants: [], // [{ userId, username, audioEnabled, isLocal }]
  muted: false,
  peerStates: {}, // userId -> RTCPeerConnection.connectionState
  /** Live huddles I can see, by conversation: { [channelId|dmId]: { huddleId, startedBy, video, participants } }. */
  live: {},
  /** A DM call ringing for me. */
  ring: null,
  /** The free plan's cap on this call (huddle:roster): { maxMinutes, startedAt, endsAt } or null. */
  timeLimit: null,
  /** The last huddle:time_warning for my call: { minutesLeft, endsAt, maxMinutes, message } or null. */
  timeWarning: null,
  /** Why my last call ended, when worth a message (the free plan's time limit): { message, meetingId } or null. */
  endedNotice: null,
}));

const set = (patch) => useHuddle.setState(typeof patch === 'function' ? patch(useHuddle.getState()) : patch);

let localStream = null;
let iceConfig = FALLBACK_ICE;
const peers = {}; // userId -> { pc, pending: [], polite }
const early = {}; // userId -> ICE candidates that came before the offer
const audioEls = {};
const remoteStreams = {}; // userId -> MediaStream (their voice), for recording the call
const streamWatchers = new Set();
const notifyStreams = () => streamWatchers.forEach((fn) => fn());

/** The call's audio right now: my microphone and everyone else's voice ({ local, remote: [MediaStream] }). */
export function callAudio() {
  return { local: localStream, remote: Object.values(remoteStreams) };
}

/** Calls fn whenever someone's voice joins or leaves the call (to add them to a recording). Returns an unsubscribe. */
export function onCallAudio(fn) {
  streamWatchers.add(fn);
  return () => streamWatchers.delete(fn);
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
  set({ call: null, participants: [], muted: false, peerStates: {}, connecting: false, timeLimit: null, timeWarning: null });
}

function peerFor(userId, polite) {
  if (peers[userId]) return peers[userId];
  const pc = new RTCPeerConnection(iceConfig);
  const entry = { pc, pending: early[userId] || [], polite, makingOffer: false };
  delete early[userId];
  peers[userId] = entry;
  localStream?.getTracks().forEach((t) => pc.addTrack(t, localStream));
  pc.onicecandidate = ({ candidate }) => {
    const call = useHuddle.getState().call;
    if (candidate && call) emit('huddle:ice-candidate', { huddleId: call.huddleId, targetUserId: userId, candidate: candidate.toJSON ? candidate.toJSON() : candidate });
  };
  pc.ontrack = ({ track, streams }) => {
    if (track.kind !== 'audio') return; // the phone plays voices; video stays on bigger screens
    let el = audioEls[userId];
    if (!el) {
      el = document.createElement('audio');
      el.autoplay = true;
      el.setAttribute('playsinline', '');
      document.body.appendChild(el);
      audioEls[userId] = el;
    }
    el.srcObject = streams[0] || new MediaStream([track]);
    el.play?.().catch(() => {});
    remoteStreams[userId] = el.srcObject;
    notifyStreams();
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

// A start waiting for the server: join once our own huddle:started (or huddle:existing) is back.
let pendingStart = null;
function joinPendingStart(huddleId) {
  const pending = pendingStart;
  if (!pending) return;
  pendingStart = null;
  clearTimeout(pending.timer);
  const call = useHuddle.getState().call;
  if (call && call.huddleId === huddleId) emit('huddle:join', { ...pending.where, huddleId, audioEnabled: !useHuddle.getState().muted, videoEnabled: false });
}

/** Huddle payloads carry the call's meeting record id: remember it for the meeting page. */
function noteMeetingId(p) {
  const call = useHuddle.getState().call;
  if (!call || !p?.meetingId || call.huddleId !== p.huddleId || call.meetingId === String(p.meetingId)) return;
  set({ call: { ...call, meetingId: String(p.meetingId) } });
}

const handlers = {
  'huddle:started'(p) {
    if (pendingStart?.huddleId === p.huddleId) joinPendingStart(p.huddleId);
    const key = scopeKey(p);
    if (key !== 'workspace') setLive(key, { huddleId: p.huddleId, startedBy: p.startedBy, video: Boolean(p.video), participants: [] });
    // A DM call for me, while I'm in no call: ring.
    if (p.dmId && String(p.startedBy?._id || '') !== myId() && !useHuddle.getState().call) {
      set({ ring: { huddleId: p.huddleId, dmId: String(p.dmId), startedBy: p.startedBy || null, video: Boolean(p.video) } });
      setTimeout(() => set((s) => (s.ring?.huddleId === p.huddleId ? { ring: null } : {})), 45000);
    }
  },
  'huddle:ended'(p) {
    const key = scopeKey(p);
    set((s) => {
      const live = { ...s.live };
      if (live[key]?.huddleId === p.huddleId) delete live[key];
      return { live, ring: s.ring?.huddleId === p.huddleId ? null : s.ring };
    });
    if (isMine(p.huddleId)) {
      if (p.reason === 'joined_elsewhere') toast('You joined this huddle on another device.');
      const meetingId = useHuddle.getState().call?.meetingId || (p.meetingId ? String(p.meetingId) : null);
      const maxMinutes = useHuddle.getState().timeLimit?.maxMinutes;
      teardown();
      if (p.reason === 'time_limit') set({ endedNotice: { message: p.message || timeLimitEndedText(maxMinutes), meetingId } });
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
    (p.participants || []).filter((x) => String(x.userId) !== myId()).forEach((x) => upsert({ userId: String(x.userId), username: x.username, audioEnabled: x.audioEnabled !== false }));
  },
  async 'huddle:joined'(p) {
    if (!isMine(p.huddleId) || String(p.userId) === myId()) return;
    const uid = String(p.userId);
    upsert({ userId: uid, username: p.username, audioEnabled: p.audioEnabled !== false });
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
    if (!isMine(p.huddleId)) return;
    set((s) => ({ participants: s.participants.map((x) => (x.userId === String(p.userId) ? { ...x, audioEnabled: p.audioEnabled !== false } : x)) }));
  },
  'huddle:participant_joined'(p) {
    refreshLive(p.huddleId);
  },
  'huddle:participant_left'(p) {
    refreshLive(p.huddleId);
  },
  'huddle:time_warning'(p) {
    if (!isMine(p.huddleId)) return;
    const fromRoster = useHuddle.getState().timeLimit?.maxMinutes;
    set({ timeWarning: { minutesLeft: Number(p.minutesLeft) || 0, endsAt: p.endsAt || null, maxMinutes: Number(p.maxMinutes) || Number(fromRoster) || null, message: p.message || '' } });
  },
  'huddle:error'(p) {
    if (!isMine(p.huddleId)) return;
    // The free plan's 10 people per call: the upgrade sheet explains it (features/plan/UpgradeSheet.jsx).
    if (p.code === 'PLAN_LIMIT') {
      busEmit('plan:limit', { ...p, message: p.message || callFullText(p.max) });
      emit('huddle:leave', { huddleId: p.huddleId });
      teardown();
      return;
    }
    toast(p.message || 'Huddle error', 'danger');
    if (['HUDDLE_FULL', 'FORBIDDEN', 'HUDDLE_SCOPE_MISMATCH'].includes(p.code)) {
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

let bound = false;
/** Start listening for huddle events (once, app-wide). Returns a cleanup. */
export function bindHuddles() {
  if (bound) return () => {};
  bound = true;
  const offHuddle = on('huddle', ({ event, payload }) => {
    const p = payload || {};
    // Run the handler first: huddle:existing may switch the call to the running huddle's id.
    const out = handlers[event]?.(p);
    if (event !== 'huddle:ended') noteMeetingId(p);
    return out;
  });
  // After a reconnect the server has dropped me from the call: rejoin with fresh connections.
  const offRealtime = on('realtime', ({ connected }) => {
    if (!connected) return;
    loadLive();
    const { call, muted } = useHuddle.getState();
    if (call) {
      Object.keys(peers).forEach(closePeer);
      emit('huddle:join', { ...scopePayload(call.scope), huddleId: call.huddleId, audioEnabled: !muted, videoEnabled: false });
    }
  });
  loadLive();
  return () => {
    bound = false;
    offHuddle();
    offRealtime();
  };
}

async function enter({ huddleId, scope, title, start, meetingId = null }) {
  const h = helpers();
  if (!h) throw new Error('Huddles need a connection to your server.');
  if (useHuddle.getState().call || useHuddle.getState().connecting) {
    if (useHuddle.getState().call?.huddleId === huddleId) return;
    leave();
  }
  if (!h.connected()) throw new Error("Can't reach your server right now.");
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('This device does not support calls.');
  set({ connecting: true, ring: null });
  try {
    const [stream, ice] = await Promise.all([
      navigator.mediaDevices.getUserMedia({ audio: true, video: false }),
      h.iceServers().catch(() => null),
    ]);
    localStream = stream;
    if (ice?.iceServers?.length) iceConfig = { iceServers: ice.iceServers, iceTransportPolicy: ice.iceTransportPolicy || 'all' };
  } catch (err) {
    set({ connecting: false });
    throw new Error(err?.name === 'NotAllowedError' ? 'Allow the microphone to join the huddle.' : err?.message || 'Could not open the microphone.');
  }
  const me = useSession.getState().user;
  set({
    call: { huddleId, scope, title: title || 'Huddle', startedAt: Date.now(), meetingId: meetingId ? String(meetingId) : null },
    participants: [{ userId: myId(), username: me?.name || 'You', audioEnabled: true, isLocal: true }],
    muted: false,
  });
  const where = scopePayload(scope);
  if (start) {
    // Join once the server has created the huddle (or pointed us at the one already running).
    pendingStart = { huddleId, where, timer: setTimeout(() => joinPendingStart(useHuddle.getState().call?.huddleId), 1500) };
    emit('huddle:start', { ...where, huddleId, video: false });
  } else {
    emit('huddle:join', { ...where, huddleId, audioEnabled: true, videoEnabled: false });
  }
  setTimeout(() => set((s) => (s.connecting ? { connecting: false } : {})), 8000);
}

/** Start a huddle in a channel or DM (joins the one already live there). */
export function startHuddle(scope, title) {
  const live = useHuddle.getState().live[scopeKey(scope)];
  if (live) return enter({ huddleId: live.huddleId, scope, title, start: false });
  return enter({ huddleId: uuid(), scope, title, start: true });
}

export function joinHuddle(huddleId, scope, title, meetingId = null) {
  return enter({ huddleId, scope, title, start: false, meetingId });
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
  set((s) => ({ muted: next, participants: s.participants.map((p) => (p.isLocal ? { ...p, audioEnabled: !next } : p)) }));
  emit('huddle:audio_toggle', { huddleId: call.huddleId, audioEnabled: !next });
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

export const dismissRing = () => set({ ring: null });
export const dismissTimeWarning = () => set({ timeWarning: null });
export const dismissEndedNotice = () => set({ endedNotice: null });

/** For tests. */
export function __resetHuddles() {
  teardown();
  set({ live: {}, ring: null, endedNotice: null });
}
