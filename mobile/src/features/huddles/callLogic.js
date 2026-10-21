// Pure rules for calls on the phone (no React, no network), tested on their own:
// one call at a time, moving a call between your own devices, device names and permissions.

/** "Pixel 8" from an Android user agent, or null when the agent hides it (newer Chrome sends "K"). */
export function modelFromUserAgent(ua) {
  const m = /Android [\d.]+; ([^;)]+?)(?: Build\/[^;)]*)?[;)]/.exec(String(ua || ''));
  const model = m?.[1]?.trim();
  if (!model || model.length < 2 || /^(k|wv|mobile)$/i.test(model)) return null;
  return model;
}

/** What other devices call this one: the native name, else the model, else "Android phone/tablet". */
export function deviceLabel({ nativeName = null, userAgent = '', tablet = false } = {}) {
  return (nativeName && String(nativeName).trim()) || modelFromUserAgent(userAgent) || (tablet ? 'Android tablet' : 'Android phone');
}

/** "another device" when the server didn't say which. */
export const deviceName = (device) => (device && (device.label || device.name)) || 'another device';

/** "# design", "a direct message" or "a huddle", for prompts. */
export function callPlace(current) {
  if (current?.channelName) return `#${String(current.channelName).replace(/^#\s*/, '')}`;
  if (current?.dmId) return 'a direct message';
  return 'a huddle';
}

/**
 * What to ask when a start or join collides with a call I'm already in.
 *   local:  I'm in another call on this device.
 *   remote: I'm in another call on another device (the server's ALREADY_IN_CALL).
 *   move:   I'm in this same call on another device: offer to move it here.
 * Returns { kind, title, body, confirmLabel, request } or null.
 */
export function switchPrompt({ kind, current, request }) {
  if (!request) return null;
  const where = callPlace(current);
  if (kind === 'move') {
    return {
      kind,
      current,
      request,
      title: 'Move the call here?',
      body: `You're in this call on ${deviceName(current?.device)}. Moving it here hangs up there, with a second or two of silence while this ${request.tablet ? 'tablet' : 'phone'} connects.`,
      confirmLabel: 'Move here',
    };
  }
  if (kind === 'remote') {
    return {
      kind,
      current,
      request,
      title: 'You’re in another call',
      body: `You're in a call in ${where} on ${deviceName(current?.device)}. Leave it and join this one here?`,
      confirmLabel: 'Switch',
    };
  }
  return {
    kind: 'local',
    current,
    request,
    title: 'You’re in another call',
    body: `You're in a call in ${where}. Leave it and join this one?`,
    confirmLabel: 'Switch',
  };
}

/** The server's ALREADY_IN_CALL error as a prompt for the request that caused it, or null. */
export function promptForError(err, request) {
  if (err?.code !== 'ALREADY_IN_CALL' || !request) return null;
  return switchPrompt({ kind: err.sameCall ? 'move' : 'remote', current: err.current || null, request });
}

/**
 * My call running on another of my devices, for the "In a call on Pixel 8 · Move here" pill.
 * active: the server's huddle:self_active / huddle:mine payload. null when the call is here
 * (same socket) or there is none.
 */
export function elsewhereCall(active, { socketId = null, callHuddleId = null } = {}) {
  if (!active || !active.huddleId) return null;
  if (socketId && active.socketId && String(active.socketId) === String(socketId)) return null;
  if (callHuddleId && String(callHuddleId) === String(active.huddleId) && !active.socketId) return null;
  return active;
}

/** The scope of a call from a server payload: { channelId } | { dmId } | { workspaceId }. */
export function scopeOf(p) {
  if (p?.channelId) return { channelId: String(p.channelId) };
  if (p?.dmId) return { dmId: String(p.dmId) };
  return { workspaceId: p?.workspaceId ? String(p.workspaceId) : null };
}

/** Why my call ended, as a toast, or null when no message is needed. */
export function endedMessage(reason, to) {
  if (reason === 'moved') return `Call moved to ${deviceName(to)}.`;
  if (reason === 'switched') return 'You joined another call, so you left this one.';
  if (reason === 'joined_elsewhere') return 'You joined this huddle on another device.';
  return null;
}

/**
 * What to do before opening the microphone or camera, from the permission's state:
 *   go: ask the system now (or it's already allowed); explain: say why first; settings: it was
 *   turned down for good, so only system settings can allow it.
 */
export function permissionStep(state) {
  if (state === 'granted') return 'go';
  if (state === 'denied') return 'settings';
  return 'explain';
}

export const PERMISSION_COPY = {
  microphone: {
    title: 'Allow the microphone',
    body: 'Oruinwan needs your microphone so others in the huddle can hear you. It is only used while you are in a call.',
    denied: 'The microphone is turned off for Oruinwan. Turn it on in Settings → Permissions to join calls.',
  },
  camera: {
    title: 'Allow the camera',
    body: 'Oruinwan needs your camera to show your video in the call. You can turn it off any time.',
    denied: 'The camera is turned off for Oruinwan. Turn it on in Settings → Permissions to use video in calls.',
  },
};

/** Camera constraints that keep calls light on battery and data. */
export function cameraConstraints(facing = 'user') {
  return { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 24 } };
}

/** Tiles to show: the person sharing (or a pinned one) first, then whoever has video, then the rest. */
export function orderTiles(participants, { pinned = null, speaking = {} } = {}) {
  const list = [...(participants || [])];
  const rank = (p) => (p.userId === pinned ? 0 : p.isLocal ? 3 : p.videoEnabled ? 1 : speaking[p.userId] ? 1.5 : 2);
  return list.sort((a, b) => rank(a) - rank(b));
}

/** Grid columns for n tiles on a phone (portrait) or a tablet/landscape screen. */
export function gridColumns(n, wide = false) {
  if (n <= 1) return 1;
  if (wide) return n <= 4 ? 2 : 3;
  return n <= 2 ? 1 : 2;
}
