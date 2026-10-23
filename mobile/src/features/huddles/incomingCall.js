// Incoming calls on the phone: rings for DM and group-DM calls, tells about channel huddles.
//
//  - App open: the incoming-call screen (IncomingCall.jsx) with the phone's ringtone.
//  - App in the background: the system's ringing call notification (Answer / Decline), which also
//    rings when the app is closed (CallMessagingService.java handles the push natively).
// The rules live in ringLogic.js. State is useHuddle's `ring` (ringing) and `notice` (channel).
import { on } from '../../lib/bus.js';
import { useSession } from '../../data/session.js';
import { onAppState } from '../../native/index.js';
import {
  cancelIncomingNotification,
  leaveLockScreen,
  onIncomingCallAction,
  showIncomingNotification,
  startRinging,
  stopRinging,
} from '../../native/callSession.js';
import { fromStarted, normalizeRing, ringAction, ringScope } from './ringLogic.js';
import { declineCall, joinHuddle, useHuddle } from './huddle.js';
import { openConversation } from '../chats/chatsUi.js';
import { Haptics, NotificationType } from '@capacitor/haptics';

const set = (patch) => useHuddle.setState(typeof patch === 'function' ? patch(useHuddle.getState()) : patch);
const myId = () => String(useSession.getState().user?.id || '');

let foreground = true;
let expiryTimer = null;
let noticeTimer = null;
const startedTimers = new Map(); // huddleId -> timer (old servers: ring from huddle:started)

function clearRing(huddleId) {
  const ring = useHuddle.getState().ring;
  if (!ring || (huddleId && ring.huddleId !== huddleId)) return;
  clearTimeout(expiryTimer);
  expiryTimer = null;
  set({ ring: null });
  stopRinging();
  cancelIncomingNotification(ring.huddleId);
  leaveLockScreen();
}

/** Starts ringing for a call (in-app screen when open, system notification otherwise). */
export function receiveRing(payload) {
  const ring = normalizeRing(payload);
  const state = useHuddle.getState();
  const action = ringAction(ring, { myId: myId(), inCall: Boolean(state.call || state.connecting), current: state.ring });
  if (action === 'ignore') return action;
  if (action === 'notice') {
    clearTimeout(noticeTimer);
    set({ notice: ring });
    // A short buzz instead of ringing (channel huddles don't ring).
    Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    noticeTimer = setTimeout(() => set((s) => (s.notice?.huddleId === ring.huddleId ? { notice: null } : {})), 15000);
    return action;
  }
  const timer = startedTimers.get(ring.huddleId);
  if (timer) clearTimeout(timer);
  startedTimers.delete(ring.huddleId);
  set({ ring });
  if (foreground) startRinging();
  else showIncomingNotification(ring);
  clearTimeout(expiryTimer);
  expiryTimer = setTimeout(() => clearRing(ring.huddleId), Math.max(1000, ring.expiresAt - Date.now()));
  return action;
}

/** Answer: open the conversation and join the call. */
export async function answerRing(ring = useHuddle.getState().ring) {
  if (!ring) return;
  clearRing(ring.huddleId);
  if (ring.dmId) openConversation('dm', ring.dmId);
  else if (ring.channelId) openConversation('channel', ring.channelId);
  await joinHuddle(ring.huddleId, ringScope(ring), ring.title || (ring.from?.name ? `Call with ${ring.from.name}` : 'Huddle'), ring.meetingId, { video: ring.video });
}

/** Decline: stop ringing here and on my other devices, and tell the caller. */
export function declineRing(ring = useHuddle.getState().ring) {
  if (!ring) return;
  clearRing(ring.huddleId);
  declineCall(ring.huddleId);
}

export const dismissNotice = () => set({ notice: null });

/** Join a channel huddle from its notice. */
export async function joinFromNotice(notice = useHuddle.getState().notice) {
  if (!notice) return;
  set({ notice: null });
  if (notice.channelId) openConversation('channel', notice.channelId);
  await joinHuddle(notice.huddleId, ringScope(notice), notice.title ? `# ${notice.title.replace(/^#\s*/, '')}` : 'Huddle', notice.meetingId, { video: notice.video });
}

let bound = false;
/** Listen for rings, cancels, notification taps and the app going to the background. Once, app-wide. */
export function bindIncomingCalls() {
  if (bound) return () => {};
  bound = true;
  const offBus = on('huddle', ({ event, payload }) => {
    const p = payload || {};
    if (event === 'huddle:ring') receiveRing(p);
    else if (event === 'huddle:ring_cancel') clearRing(p.huddleId ? String(p.huddleId) : null);
    else if (event === 'huddle:ended' && p.huddleId) {
      clearRing(String(p.huddleId));
      set((s) => (s.notice?.huddleId === String(p.huddleId) ? { notice: null } : {}));
    } else if (event === 'huddle:started') {
      // Servers before 2.3 don't send huddle:ring: ring from huddle:started, unless a ring follows.
      const ring = fromStarted(p, myId());
      if (!ring || startedTimers.has(ring.huddleId)) return;
      startedTimers.set(ring.huddleId, setTimeout(() => {
        startedTimers.delete(ring.huddleId);
        receiveRing(ring);
      }, 1500));
    }
  });
  // Taps on the system call notification (also the one that started the app).
  const offNative = onIncomingCallAction((action, call) => {
    if (action === 'answer') answerRing(normalizeRing(call)).catch(() => {});
    else if (action === 'open') receiveRing(call);
    else if (action === 'decline') {
      // The notification already told the server; tell it over the socket too, in case.
      clearRing(String(call?.huddleId || ''));
      if (call?.huddleId) declineCall(String(call.huddleId));
    } else if (action === 'cancel') clearRing(String(call?.huddleId || ''));
  });
  // Going to the background while ringing hands the ring to the system notification, and back.
  let offApp = () => {};
  onAppState((active) => {
    foreground = active;
    const ring = useHuddle.getState().ring;
    if (!ring) return;
    if (active) {
      cancelIncomingNotification(ring.huddleId);
      startRinging();
    } else {
      stopRinging();
      showIncomingNotification(ring);
    }
  }).then((off) => {
    offApp = off;
  });
  return () => {
    bound = false;
    offBus();
    offNative();
    offApp();
  };
}
