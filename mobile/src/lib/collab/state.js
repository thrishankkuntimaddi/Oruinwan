// What a live document editor is doing, as a small state machine fed by the provider's events,
// plus who else is in the document (awareness → presence avatars).
//
// Modes:
//   connecting    joining / first sync. The editor shows the saved copy, read-only.
//   offline       no connection and never synced: the copy cached on the phone, read-only.
//   live          synced: edits go to everyone at once (unless readOnly).
//   live-offline  was live, connection dropped: keep writing; Yjs merges the edits on reconnect.
//   rest          the server doesn't do live editing (older server, or it refused for a
//                 non-access reason): the editor saves over REST as before.
//   closed        deleted, access revoked or never allowed: read-only, with the reason.

const ACCESS_CODES = new Set(['FORBIDDEN', 'NOT_FOUND', 'WORKSPACE_ACCESS_DENIED']);
const FALLBACK_CODES = new Set(['NO_COLLAB', 'BAD_REQUEST', 'TOO_MANY_DOCS', 'SERVER_ERROR']);

export function initialCollabState(connected) {
  return { mode: connected ? 'connecting' : 'offline', everSynced: false, readOnly: false, savedAt: null, reason: null, message: null };
}

export function collabReducer(state, ev) {
  if (state.mode === 'closed' || (state.mode === 'rest' && ev.type !== 'reset')) return state;
  switch (ev.type) {
    case 'reset':
      return initialCollabState(ev.connected);
    case 'status':
      if (ev.status === 'offline') return { ...state, mode: state.everSynced ? 'live-offline' : 'offline' };
      if ((ev.status === 'connecting' || ev.status === 'connected') && state.mode === 'offline') return { ...state, mode: 'connecting' };
      return state;
    case 'synced':
      return { ...state, mode: 'live', everSynced: true, readOnly: Boolean(ev.readOnly), message: null };
    case 'saved':
      return { ...state, savedAt: ev.savedAt || new Date().toISOString() };
    case 'closed':
      return { ...state, mode: 'closed', reason: ev.reason || 'revoked' };
    case 'error': {
      const code = ev.code || 'SERVER_ERROR';
      if (ACCESS_CODES.has(code)) return { ...state, mode: 'closed', reason: code === 'FORBIDDEN' || code === 'WORKSPACE_ACCESS_DENIED' ? 'revoked' : 'deleted' };
      if (code === 'READ_ONLY') return { ...state, readOnly: true };
      if (FALLBACK_CODES.has(code)) {
        // Never got going: save over REST instead. Already live: keep the document, retry on reconnect.
        return state.everSynced ? { ...state, message: ev.message || null } : { ...state, mode: 'rest' };
      }
      // TOO_LARGE, DOC_TOO_LARGE, BAD_MESSAGE: the edit was refused; say so.
      return { ...state, message: code === 'TOO_LARGE' || code === 'DOC_TOO_LARGE' ? 'This document is too large to save more changes.' : ev.message || 'An edit was not accepted.' };
    }
    default:
      return state;
  }
}

/** What the editor shows for a state: can the person type, the header subtitle, and a banner. */
export function collabView(state, { kind = 'note' } = {}) {
  const thing = kind === 'page' ? 'page' : 'note';
  switch (state.mode) {
    case 'connecting':
      return { editable: false, subtitle: 'Connecting…', banner: null };
    case 'offline':
      return { editable: false, subtitle: 'Offline', banner: `You're offline, so this is the copy saved on this device. Editing comes back when you reconnect.` };
    case 'live':
      return { editable: !state.readOnly, subtitle: state.readOnly ? 'View only' : state.savedAt ? 'Saved' : 'Live', banner: null };
    case 'live-offline':
      return {
        editable: !state.readOnly,
        subtitle: 'Offline',
        banner: state.readOnly ? null : `You're offline. Keep writing: your changes sync when you reconnect. Keep the app open until then.`,
      };
    case 'closed':
      return {
        editable: false,
        subtitle: 'View only',
        banner: state.reason === 'deleted' ? `This ${thing} was deleted.` : `You no longer have access to edit this ${thing}.`,
      };
    default:
      return { editable: true, subtitle: null, banner: null };
  }
}

/**
 * Other people in the document, one entry per person (someone on the web and the phone at
 * once shows once). `states` is awareness.getStates(): Map<clientId, { user }>.
 */
export function peersFrom(states, ownClientId, meId) {
  const out = new Map();
  for (const [clientId, state] of states || []) {
    if (clientId === ownClientId) continue;
    const user = state?.user;
    if (!user) continue;
    const id = user.id ? String(user.id) : `c${clientId}`;
    if (meId && id === String(meId)) continue;
    if (!out.has(id)) out.set(id, { id, name: user.name || 'Someone', color: user.color || null, avatar: user.avatar || null });
  }
  return [...out.values()];
}
