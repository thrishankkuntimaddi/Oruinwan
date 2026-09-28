import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../../services/api';
import { huddleApi, sendNotesOp, errorText } from './huddleApi';
import { htmlToPlain, readNoteBlocks, newId } from './wrapUp';

const SAVE_DELAY_MS = 350;
const TYPING_MS = 3000;

/**
 * The huddle's shared notes.
 *
 * The Note is created (or opened) through the huddles API, so it is a normal
 * note that stays in Notes after the call. Edits are sent as small operations
 * (one paragraph / one action item) over the socket; the server applies them
 * in order and relays them to the others in the call, so people typing in
 * different paragraphs never overwrite each other. The same paragraph edited
 * by two people at once is still last-write-wins (per paragraph).
 */
export default function useHuddleNotes({ huddleId, live, socket, enabled = true }) {
    const [state, setState] = useState({ status: 'idle', noteId: null, title: '', error: null });
    const [paragraphs, setParagraphs] = useState([]);
    const [actions, setActions] = useState([]);
    const [saving, setSaving] = useState(0);
    const [saveError, setSaveError] = useState(null);
    // blockId -> { username, at }: someone else is typing there.
    const [remote, setRemote] = useState({});

    const timers = useRef({});
    const dirty = useRef(new Set());      // paragraphs with local edits not yet acknowledged
    const pendingText = useRef({});
    const noteIdRef = useRef(null);

    const load = useCallback(async (hid) => {
        setState((s) => ({ ...s, status: 'loading', error: null }));
        try {
            const { noteId } = await huddleApi.ensureNotes(hid);
            noteIdRef.current = noteId;
            const { data } = await api.get(`/api/v2/notes/${noteId}`);
            const note = data.note || data;
            const parsed = readNoteBlocks(note.content);
            setParagraphs(parsed.paragraphs.length ? parsed.paragraphs : []);
            setActions(parsed.actions);
            setState({ status: 'ready', noteId, title: note.title || 'Huddle notes', error: null });
        } catch (err) {
            setState({ status: 'error', noteId: null, title: '', error: errorText(err, 'Could not open the huddle notes.') });
        }
    }, []);

    useEffect(() => {
        if (!enabled || !huddleId) return undefined;
        noteIdRef.current = null;
        setParagraphs([]);
        setActions([]);
        setRemote({});
        load(huddleId);
        const pending = timers.current;
        return () => { Object.values(pending).forEach(clearTimeout); };
    }, [enabled, huddleId, load]);

    // Everyone else's edits, live.
    useEffect(() => {
        if (!socket || !huddleId) return undefined;
        const onOp = ({ huddleId: hid, applied, by } = {}) => {
            if (hid !== huddleId || !applied) return;
            const who = by?.username || 'Someone';
            if (applied.kind === 'paragraph') {
                const text = htmlToPlain(applied.content);
                setParagraphs((prev) => {
                    const i = prev.findIndex((p) => p.id === applied.id);
                    if (i >= 0) {
                        if (dirty.current.has(applied.id)) return prev; // keep what I am typing
                        const next = prev.slice();
                        next[i] = { ...next[i], text };
                        return next;
                    }
                    const at = applied.afterId ? prev.findIndex((p) => p.id === applied.afterId) : -1;
                    const block = { id: applied.id, text, author: applied.author || who };
                    if (at < 0) return [...prev, block];
                    return [...prev.slice(0, at + 1), block, ...prev.slice(at + 1)];
                });
                setRemote((r) => ({ ...r, [applied.id]: { username: who, at: Date.now() } }));
            } else if (applied.kind === 'remove') {
                setParagraphs((prev) => prev.filter((p) => p.id !== applied.id));
            } else if (applied.kind === 'action') {
                setActions((prev) => {
                    const i = prev.findIndex((a) => a.id === String(applied.item.id));
                    const item = { ...applied.item, id: String(applied.item.id) };
                    if (i < 0) return [...prev, item];
                    const next = prev.slice();
                    next[i] = item;
                    return next;
                });
            } else if (applied.kind === 'action_remove') {
                setActions((prev) => prev.filter((a) => a.id !== String(applied.id)));
            }
        };
        const onReady = ({ huddleId: hid } = {}) => {
            if (hid === huddleId && !noteIdRef.current && enabled) load(huddleId);
        };
        socket.on('huddle:notes_op', onOp);
        socket.on('huddle:notes_ready', onReady);
        return () => {
            socket.off('huddle:notes_op', onOp);
            socket.off('huddle:notes_ready', onReady);
        };
    }, [socket, huddleId, enabled, load]);

    // "Bob is typing" fades after a few seconds.
    useEffect(() => {
        const keys = Object.keys(remote);
        if (!keys.length) return undefined;
        const t = setTimeout(() => {
            const now = Date.now();
            setRemote((r) => Object.fromEntries(Object.entries(r).filter(([, v]) => now - v.at < TYPING_MS)));
        }, TYPING_MS);
        return () => clearTimeout(t);
    }, [remote]);

    const send = useCallback(async (op) => {
        setSaving((n) => n + 1);
        try {
            const res = await sendNotesOp(socket, huddleId, op);
            setSaveError(null);
            return res;
        } catch (err) {
            setSaveError(err.message);
            throw err;
        } finally {
            setSaving((n) => n - 1);
        }
    }, [socket, huddleId]);

    const flushParagraph = useCallback((id) => {
        clearTimeout(timers.current[id]);
        delete timers.current[id];
        const text = pendingText.current[id];
        if (text === undefined) return Promise.resolve();
        delete pendingText.current[id];
        return send({ kind: 'paragraph', id, text })
            .catch(() => {})
            .finally(() => { if (pendingText.current[id] === undefined) dirty.current.delete(id); });
    }, [send]);

    const editParagraph = useCallback((id, text) => {
        if (!live) return;
        dirty.current.add(id);
        pendingText.current[id] = text;
        setParagraphs((prev) => prev.map((p) => (p.id === id ? { ...p, text } : p)));
        clearTimeout(timers.current[id]);
        timers.current[id] = setTimeout(() => flushParagraph(id), SAVE_DELAY_MS);
    }, [live, flushParagraph]);

    /** Adds an empty paragraph after `afterId` (or at the end); returns its id. */
    const addParagraph = useCallback((afterId = null, text = '') => {
        if (!live) return null;
        const id = newId('p');
        setParagraphs((prev) => {
            const at = afterId ? prev.findIndex((p) => p.id === afterId) : -1;
            const block = { id, text, author: 'you' };
            return at < 0 ? [...prev, block] : [...prev.slice(0, at + 1), block, ...prev.slice(at + 1)];
        });
        send({ kind: 'paragraph', id, text, afterId: afterId || undefined }).catch(() => {});
        return id;
    }, [live, send]);

    const removeParagraph = useCallback((id) => {
        if (!live) return;
        clearTimeout(timers.current[id]);
        delete pendingText.current[id];
        dirty.current.delete(id);
        setParagraphs((prev) => prev.filter((p) => p.id !== id));
        send({ kind: 'remove', id }).catch(() => {});
    }, [live, send]);

    const upsertAction = useCallback(async (item) => {
        const full = { done: false, ...item, id: String(item.id || newId('a')) };
        setActions((prev) => {
            const i = prev.findIndex((a) => a.id === full.id);
            if (i < 0) return [...prev, full];
            const next = prev.slice();
            next[i] = { ...next[i], ...full };
            return next;
        });
        const res = await send({ kind: 'action', item: full });
        if (res?.applied?.item) {
            const saved = { ...res.applied.item, id: String(res.applied.item.id) };
            setActions((prev) => prev.map((a) => (a.id === saved.id ? saved : a)));
            return saved;
        }
        return full;
    }, [send]);

    const removeAction = useCallback((id) => {
        setActions((prev) => prev.filter((a) => a.id !== id));
        send({ kind: 'action_remove', id }).catch(() => {});
    }, [send]);

    return {
        ...state,
        paragraphs,
        actions,
        remote,
        saving: saving > 0,
        saveError,
        reload: () => huddleId && load(huddleId),
        editParagraph,
        flushParagraph,
        addParagraph,
        removeParagraph,
        upsertAction,
        removeAction,
    };
}
