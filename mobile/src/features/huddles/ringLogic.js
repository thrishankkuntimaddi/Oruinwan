// Incoming calls, the rules only (no sockets or native code), so they can be tested.
//
// The server sends huddle:ring to each person a call is for (docs/api/calls.md):
//   { huddleId, kind: 'dm'|'group_dm'|'channel', dmId|channelId, workspaceId, title,
//     from: { id, name, avatar }, video, meetingId, ring, expiresAt, declineUrl? }
// ring: true rings (DM and group-DM calls); ring: false only tells (a channel huddle started).
// huddle:ring_cancel { huddleId, reason } stops it. Servers from before 2.3 only send
// huddle:started, so a DM call from one of those still rings (fromStarted).

export const RING_MS = 45_000;

const str = (v) => (v === undefined || v === null || v === '' ? null : String(v));

/** A ring payload, tidied: null when it isn't a usable call. */
export function normalizeRing(p, now = Date.now()) {
  if (!p || !str(p.huddleId)) return null;
  const dmId = str(p.dmId || p.dmSessionId);
  const channelId = str(p.channelId);
  const kind = p.kind === 'channel' || p.kind === 'group_dm' || p.kind === 'dm' ? p.kind : channelId ? 'channel' : 'dm';
  const from = p.from || (p.startedBy ? { id: str(p.startedBy._id || p.startedBy.id), name: p.startedBy.username || p.startedBy.name } : null);
  const expiresAt = Number(p.expiresAt) > 0 ? Number(p.expiresAt) : now + RING_MS;
  return {
    huddleId: String(p.huddleId),
    kind,
    dmId,
    channelId,
    workspaceId: str(p.workspaceId),
    title: str(p.title) || str(p.channelName),
    from: from ? { id: str(from.id), name: from.name || 'Someone', avatar: from.avatar || null } : { id: null, name: 'Someone', avatar: null },
    video: p.video === true || p.video === 'true',
    meetingId: str(p.meetingId),
    // FCM data arrives as strings: "false" must not ring.
    ring: !(p.ring === false || p.ring === 'false') && kind !== 'channel',
    expiresAt,
    declineUrl: str(p.declineUrl),
  };
}

/**
 * What to do with an incoming ring: 'ring' (incoming-call screen), 'notice' (a channel
 * huddle started: a banner with Join), or 'ignore'.
 */
export function ringAction(ring, { myId, inCall, current, now = Date.now() } = {}) {
  if (!ring) return 'ignore';
  if (ring.from?.id && myId && ring.from.id === String(myId)) return 'ignore'; // my own call
  if (ring.expiresAt && ring.expiresAt <= now) return 'ignore';
  if (inCall) return 'ignore'; // busy: the server doesn't ring me either
  if (current?.huddleId === ring.huddleId) return 'ignore'; // already ringing
  return ring.ring ? 'ring' : 'notice';
}

/** An old server's huddle:started for a DM: ring if it's someone else's call. */
export function fromStarted(p, myId, now = Date.now()) {
  if (!p?.dmId) return null;
  if (String(p.startedBy?._id || '') === String(myId || '')) return null;
  return normalizeRing({ ...p, kind: 'dm', ring: true }, now);
}

/** The scope a call joins with. */
export const ringScope = (ring) => (ring?.channelId ? { channelId: ring.channelId } : ring?.dmId ? { dmId: ring.dmId } : {});

/** "Incoming video call" / "Incoming voice call" (· group call). */
export function ringSubtitle(ring) {
  if (!ring) return '';
  const what = ring.video ? 'Incoming video call' : 'Incoming voice call';
  return ring.kind === 'group_dm' ? `${what} · group` : what;
}
