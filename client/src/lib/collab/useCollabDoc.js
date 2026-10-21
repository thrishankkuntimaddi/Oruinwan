import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';
import { CollabProvider } from './collab-provider';
import { useOptionalSocket } from '../../contexts/SocketContext';
import { AuthContext } from '../../contexts/AuthContext';
import { getAvatarUrl } from '../../utils/avatarUtils';

const PROVIDER_ORIGIN = 'collab-provider';

const CLOSED_TEXT = {
    deleted: 'This was deleted by someone else.',
    revoked: 'You no longer have access to this.',
};

/** Other people in the document, one entry per user (a person with two tabs shows once). */
export function peersFromAwareness(awareness, selfClientId) {
    if (!awareness) return [];
    const byUser = new Map();
    awareness.getStates().forEach((state, clientId) => {
        if (clientId === selfClientId || !state || !state.user) return;
        const key = String(state.user.id || `client-${clientId}`);
        const prev = byUser.get(key);
        const entry = {
            key,
            clientId,
            id: state.user.id || null,
            name: state.user.name || 'Someone',
            avatar: state.user.avatar || null,
            blockId: state.blockId || null,
            cursor: state.cursor || null,
            pointer: state.pointer || null,
        };
        // Prefer the tab that says where the person is.
        if (!prev || (!prev.blockId && entry.blockId) || (!prev.cursor && entry.cursor) || (!prev.pointer && entry.pointer)) {
            byUser.set(key, entry);
        }
    });
    return Array.from(byUser.values());
}

/** What the presence pill says: 'connecting' | 'live' | 'saving' | 'saved' | 'offline' | 'readonly' | 'off'. */
export function collabLabel({ live, failed, status, saveState, readOnly }) {
    if (failed || status === 'closed' || status === 'unavailable') return 'off';
    if (!live) return 'connecting';
    if (status === 'offline' || status === 'connecting') return 'offline';
    if (readOnly) return 'readonly';
    if (saveState === 'saving') return 'saving';
    if (saveState === 'saved') return 'saved';
    return 'live';
}

const INITIAL = {
    key: null,
    status: 'idle',
    synced: false,      // synced at least once with the current document
    readOnly: false,
    failed: false,      // could not go live: callers keep their REST behaviour
    error: null,
    closedReason: null,
    saveState: null,    // 'saving' while local edits are unsaved on the server, then 'saved'
    savedAt: null,
};

/**
 * Open a collaborative document (docs/api/collab.md) on the app socket.
 *
 *   const live = useCollabDoc('knowledge', pageId, { enabled: !!pageId });
 *   if (live.synced) bind(live.doc.getText('content'));
 *
 * - `synced` turns true after the first sync; the editor binds then and stays bound
 *   while offline (edits merge on reconnect).
 * - `failed` is true when there is no socket or the join was refused, so the
 *   caller keeps saving over REST.
 * - `peers` are the other editors (from awareness); `setPresence(fields)` shares
 *   where you are (blockId, cursor, pointer…).
 */
export function useCollabDoc(docType, docId, { enabled = true } = {}) {
    const socketCtx = useOptionalSocket();
    const socket = socketCtx?.socket || null;
    const auth = useContext(AuthContext);
    const user = auth?.user || null;

    const key = enabled && docId ? `${docType}:${docId}` : null;
    const [state, setState] = useState(INITIAL);
    const [peers, setPeers] = useState([]);
    const [handle, setHandle] = useState(null); // { key, doc, provider }

    const userInfo = useMemo(() => {
        if (!user) return null;
        return {
            id: user._id || user.id || null,
            name: user.username || user.name || user.email || 'Someone',
            avatar: getAvatarUrl(user),
            color: '#b8956a', // the theme accent (other clients may not have our CSS tokens)
        };
    }, [user]);
    const userRef = useRef(userInfo);
    userRef.current = userInfo;

    useEffect(() => {
        if (!key) { setState(INITIAL); setHandle(null); setPeers([]); return undefined; }
        if (!socket) {
            setState({ ...INITIAL, key, status: 'unavailable', failed: true });
            setHandle(null);
            return undefined;
        }
        const doc = new Y.Doc();
        const provider = new CollabProvider(socket, docType, docId, { doc, user: userRef.current || undefined });
        setHandle({ key, doc, provider });
        setPeers([]);

        const patch = (p) => setState((s) => (s.key === key ? { ...s, ...p } : s));
        const offs = [
            provider.on('status', (status) => patch({ status })),
            provider.on('synced', ({ readOnly }) => patch({ synced: true, readOnly: !!readOnly, failed: false, error: null })),
            provider.on('saved', ({ savedAt }) => setState((s) => (s.key === key
                ? { ...s, saveState: s.saveState === 'saving' || s.saveState === 'saved' ? 'saved' : s.saveState, savedAt: savedAt || new Date().toISOString() }
                : s))),
            provider.on('error', (err) => setState((s) => {
                if (s.key !== key) return s;
                // A refused join before the first sync means "not live": fall back to REST.
                return { ...s, error: err || null, failed: s.synced ? s.failed : true };
            })),
            provider.on('closed', ({ reason } = {}) => patch({ closedReason: reason || 'closed', failed: true })),
        ];

        const onUpdate = (_update, origin) => {
            if (origin === PROVIDER_ORIGIN || provider.readOnly) return;
            setState((s) => (s.key === key && s.saveState !== 'saving' ? { ...s, saveState: 'saving' } : s));
        };
        doc.on('update', onUpdate);

        const onAwareness = () => setPeers(peersFromAwareness(provider.awareness, doc.clientID));
        provider.awareness.on('change', onAwareness);

        // The provider may already have joined (or failed) while being constructed:
        // start from what it knows, not from the events we were too late for.
        setState({
            ...INITIAL,
            key,
            status: provider.status,
            synced: provider.synced,
            readOnly: provider.readOnly,
            failed: provider.status === 'error',
        });
        onAwareness();

        return () => {
            offs.forEach((off) => off());
            doc.off('update', onUpdate);
            provider.awareness.off('change', onAwareness);
            provider.destroy();
            doc.destroy();
        };
    }, [socket, docType, docId, key]);

    // Keep the shared name/avatar current (e.g. after a profile change).
    useEffect(() => {
        if (handle?.provider && userInfo && !handle.provider.destroyed) {
            handle.provider.awareness.setLocalStateField('user', userInfo);
        }
    }, [handle, userInfo]);

    const current = handle && handle.key === key ? handle : null;
    const s = state.key === key ? state : { ...INITIAL, key };

    const setPresence = useCallback((fields) => {
        const p = current?.provider;
        if (!p || p.destroyed) return;
        const local = p.awareness.getLocalState() || {};
        p.awareness.setLocalState({ ...local, ...fields });
    }, [current]);

    return {
        doc: current?.doc || null,
        provider: current?.provider || null,
        status: s.status,
        synced: !!current && s.synced,
        live: !!current && s.synced && !s.closedReason,
        readOnly: s.readOnly,
        failed: s.failed,
        error: s.error,
        closedReason: s.closedReason,
        closedText: s.closedReason ? (CLOSED_TEXT[s.closedReason] || 'Live editing ended.') : null,
        saveState: s.saveState,
        savedAt: s.savedAt,
        peers: current ? peers : [],
        setPresence,
    };
}

export default useCollabDoc;
