import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import api from '@services/api';
import { useToast } from "./ToastContext";
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext";
import { htmlToText } from "../utils/sanitizeHtml";
import logger from '../utils/logger';

const NotesContext = createContext();

export const useNotes = () => useContext(NotesContext);

const SAVE_DEBOUNCE_MS = 600;
// Fields only the note owner may change (the server answers 403 otherwise).
const OWNER_FIELDS = ['sharedWith', 'isPublic', 'isPinned', 'isArchived', 'allowEditing', 'tags', 'type'];

const idOf = (v) => String(v?._id || v?.id || v || '');

/** Plain text of a note's stored content (JSON blocks or legacy HTML), for search/previews. */
export function noteContentToText(content) {
    if (!content) return '';
    const str = String(content);
    if (str.trim().startsWith('[')) {
        try {
            const blocks = JSON.parse(str);
            if (Array.isArray(blocks)) {
                return blocks.map((b) => {
                    if (!b || typeof b.content !== 'string') return '';
                    if (b.type === 'text') return htmlToText(b.content);
                    if (['image', 'video', 'audio', 'file'].includes(b.type)) return b.meta?.name || '';
                    if (b.type === 'checklist') {
                        try { return JSON.parse(b.content).map(i => i.text).join(' '); } catch { return ''; }
                    }
                    if (b.type === 'table') {
                        try { const t = JSON.parse(b.content); return [...(t.headers || []), ...(t.rows || []).flat()].join(' '); } catch { return ''; }
                    }
                    return `${b.meta?.title || ''} ${b.content}`;
                }).join(' ').replace(/\s+/g, ' ').trim();
            }
        } catch { /* legacy content */ }
    }
    return htmlToText(str).replace(/\s+/g, ' ').trim();
}

const mapNote = (note) => ({
    id: String(note._id),
    title: note.title || "",
    content: note.content || "",
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    owner: note.owner,
    workspace: idOf(note.workspace),
    sharedWith: note.sharedWith || [],
    isPublic: note.isPublic || false,
    allowEditing: note.allowEditing || false,
    isPinned: note.isPinned || false,
    isArchived: note.isArchived || false,
    attachments: note.attachments || [],
    tags: note.tags || [],
    type: note.type || "note"
});

function errorMessage(error, fallback) {
    return error?.response?.data?.message || fallback;
}

export const NotesProvider = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { workspaceId: paramWorkspaceId } = useParams();
    const { showToast } = useToast();
    const { socket } = useSocket();
    const { user } = useAuth() || {};
    const currentUserId = idOf(user?._id || user?.id);

    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTagFilter, setActiveTagFilter] = useState(null);
    const [selectedSection, setSelectedSection] = useState("all");
    // noteId -> 'saving' | 'saved' | 'error'
    const [saveStatus, setSaveStatus] = useState({});
    const notesRef = useRef(notes);
    notesRef.current = notes;

    // Unsaved changes per note, merged until the debounced PUT is sent.
    const pendingRef = useRef({});
    const saveTimerRef = useRef({});
    const inflightRef = useRef({});
    const waitersRef = useRef({}); // resolvers of debounced updateNote() promises
    const deletedIdsRef = useRef(new Set()); // permanently deleted here: never refetch

    const [noteVersions, setNoteVersions] = useState({});
    const versionSaveTimer = useRef({});

    // Only the workspace id matters: route changes inside a workspace must not refetch.
    const workspaceId = useMemo(() => {
        if (paramWorkspaceId) return paramWorkspaceId;
        const match = location.pathname.match(/\/workspace\/([^/]+)/);
        return match ? match[1] : null;
    }, [paramWorkspaceId, location.pathname]);
    const workspaceIdRef = useRef(workspaceId);
    workspaceIdRef.current = workspaceId;
    const getWorkspaceId = useCallback(() => workspaceIdRef.current, []);

    const loadVersions = useCallback(async (noteId) => {
        if (!noteId) return;
        try {
            const res = await api.get(`/api/v2/notes/${noteId}/versions`);
            const versions = res.data.versions || [];
            setNoteVersions(prev => ({ ...prev, [noteId]: versions }));
        } catch (e) {
            logger.warn('Failed to load versions for', noteId, e?.message);
        }
    }, []);

    const addVersion = useCallback((noteId, snapshot) => {
        setNoteVersions(prev => {
            const existing = prev[noteId] || [];
            const last = existing[existing.length - 1];
            if (last && last.content === snapshot.content) return prev;
            return { ...prev, [noteId]: [...existing, { ...snapshot, savedAt: new Date().toISOString() }].slice(-50) };
        });

        if (versionSaveTimer.current[noteId]) clearTimeout(versionSaveTimer.current[noteId]);
        versionSaveTimer.current[noteId] = setTimeout(async () => {
            try {
                await api.post(`/api/v2/notes/${noteId}/versions`, {
                    title: snapshot.title || '',
                    content: snapshot.content || '',
                });
            } catch (e) {
                logger.warn('Failed to persist version for', noteId, e?.message);
            } finally {
                delete versionSaveTimer.current[noteId];
            }
        }, 10000);
    }, []);

    /** Apply a server note, keeping any local edits that have not been sent yet. */
    const mergeServerNote = useCallback((serverNote, prevNote) => {
        const mapped = mapNote(serverNote);
        const pending = pendingRef.current[mapped.id];
        const inflight = inflightRef.current[mapped.id];
        if (!pending && !inflight) return mapped;
        return { ...mapped, ...(inflight || {}), ...(pending || {}), updatedAt: prevNote?.updatedAt || mapped.updatedAt };
    }, []);

    const loadNotes = useCallback(async () => {
        const wsId = workspaceIdRef.current;
        if (!wsId) {
            setNotes([]);
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const response = await api.get(`/api/v2/notes`, { params: { workspaceId: wsId } });
            if (workspaceIdRef.current !== wsId) return; // workspace changed meanwhile
            setNotes(prev => {
                const prevById = new Map(prev.map(n => [n.id, n]));
                return (response.data.notes || []).map(n => mergeServerNote(n, prevById.get(String(n._id))));
            });
        } catch (error) {
            logger.error("Failed to load notes:", error);
            showToast(errorMessage(error, "Failed to load notes"), "error");
            setNotes([]);
        } finally {
            setLoading(false);
        }
    }, [showToast, mergeServerNote]);

    useEffect(() => {
        loadNotes();
    }, [workspaceId, loadNotes]);

    /** Fetch one note by id (deep links to notes that are not in the list). */
    const fetchNote = useCallback(async (noteId) => {
        if (deletedIdsRef.current.has(noteId)) return { error: 404 };
        try {
            const res = await api.get(`/api/v2/notes/${noteId}`);
            const note = res.data?.note;
            if (!note) return { error: 404 };
            if (workspaceIdRef.current && idOf(note.workspace) !== workspaceIdRef.current) return { error: 404 };
            setNotes(prev => (prev.some(n => n.id === String(note._id))
                ? prev.map(n => (n.id === String(note._id) ? mergeServerNote(note, n) : n))
                : [mapNote(note), ...prev]));
            return { note: mapNote(note) };
        } catch (error) {
            return { error: error?.response?.status || 500, message: errorMessage(error, 'Could not load this note') };
        }
    }, [mergeServerNote]);

    useEffect(() => {
        if (!socket) return undefined;

        const inWorkspace = (note) => {
            const ws = workspaceIdRef.current;
            return !ws || !note.workspace || idOf(note.workspace) === ws;
        };

        const upsert = (note) => {
            if (!note?._id || !inWorkspace(note)) return;
            setNotes(prev => {
                const nid = String(note._id);
                const existing = prev.find(n => n.id === nid);
                if (existing) return prev.map(n => (n.id === nid ? mergeServerNote(note, n) : n));
                return [mapNote(note), ...prev];
            });
        };

        const handleNoteCreated = (note) => upsert(note);
        const handleNoteUpdated = (note) => {
            if (!note?._id) return;
            setNotes(prev => prev.map(n => (n.id === String(note._id) ? mergeServerNote(note, n) : n)));
            // A note that just became visible (e.g. made public) arrives as an update too.
            setNotes(prev => (prev.some(n => n.id === String(note._id)) || !inWorkspace(note) ? prev : [mapNote(note), ...prev]));
        };
        const handleNoteDeleted = (data) => {
            const nid = String(data?.noteId || '');
            if (!nid) return;
            if (data.archived) {
                setNotes(prev => prev.map(n => (n.id === nid ? { ...n, isArchived: true } : n)));
            } else {
                setNotes(prev => prev.filter(n => n.id !== nid));
            }
        };
        const handleNoteShared = (note) => {
            if (!note?._id) return;
            const isOwner = idOf(note.owner) === currentUserId;
            if (!isOwner && inWorkspace(note)) {
                if (!notesRef.current.some(n => n.id === String(note._id))) {
                    showToast(`Note shared with you: ${note.title || 'Untitled'}`, "info");
                }
            }
            upsert(note);
        };

        socket.on("note-created", handleNoteCreated);
        socket.on("note-updated", handleNoteUpdated);
        socket.on("note-deleted", handleNoteDeleted);
        socket.on("note-shared", handleNoteShared);

        return () => {
            socket.off("note-created", handleNoteCreated);
            socket.off("note-updated", handleNoteUpdated);
            socket.off("note-deleted", handleNoteDeleted);
            socket.off("note-shared", handleNoteShared);
        };
    }, [socket, showToast, mergeServerNote, currentUserId]);

    /** Access of the current user to a note. */
    const getNoteAccess = useCallback((note) => {
        if (!note) return { isOwner: false, canEdit: false };
        const isOwner = !!currentUserId && idOf(note.owner) === currentUserId;
        const isShared = (note.sharedWith || []).some(u => idOf(u) === currentUserId);
        return { isOwner, canEdit: isOwner || (!!note.allowEditing && isShared) };
    }, [currentUserId]);

    const sendPending = useCallback(async (id) => {
        const updates = pendingRef.current[id];
        if (!updates) return true;
        // Wait for a previous save of this note so requests land in order.
        if (inflightRef.current[id]?.promise) {
            try { await inflightRef.current[id].promise; } catch { /* reported there */ }
        }
        const toSend = pendingRef.current[id];
        if (!toSend) return true;
        delete pendingRef.current[id];
        setSaveStatus(prev => ({ ...prev, [id]: 'saving' }));
        const promise = api.put(`/api/v2/notes/${id}`, toSend);
        inflightRef.current[id] = { ...toSend, promise };
        try {
            const res = await promise;
            const saved = res.data?.note;
            if (saved) {
                // Server-normalised values (e.g. an empty title stored as "Untitled")
                // must not overwrite what the user is typing, so only metadata is taken.
                setNotes(prev => prev.map(n => (n.id === id ? { ...n, updatedAt: saved.updatedAt || n.updatedAt } : n)));
            }
            setSaveStatus(prev => ({ ...prev, [id]: pendingRef.current[id] ? 'saving' : 'saved' }));
            return true;
        } catch (error) {
            logger.error("Failed to update note:", error);
            setSaveStatus(prev => ({ ...prev, [id]: 'error' }));
            showToast(errorMessage(error, "Failed to save changes"), "error");
            if (error?.response?.status === 403 || error?.response?.status === 404) {
                // Our view of the note is stale (access changed): reload it from the server.
                delete pendingRef.current[id];
                fetchNote(id);
            } else {
                // Keep the failed changes so the next edit (or flush) retries them.
                pendingRef.current[id] = { ...toSend, ...(pendingRef.current[id] || {}) };
            }
            return false;
        } finally {
            if (inflightRef.current[id]?.promise === promise) delete inflightRef.current[id];
        }
    }, [showToast, fetchNote]);

    /** Send the merged pending changes of a note now. */
    const flushNote = useCallback(async (id) => {
        if (saveTimerRef.current[id]) {
            clearTimeout(saveTimerRef.current[id]);
            delete saveTimerRef.current[id];
        }
        const waiters = waitersRef.current[id] || [];
        delete waitersRef.current[id];
        const result = await sendPending(id);
        waiters.forEach(w => w(result));
        return result;
    }, [sendPending]);

    const flushAll = useCallback(() => {
        Object.keys(pendingRef.current).forEach(id => { flushNote(id); });
    }, [flushNote]);

    /**
     * Optimistically update a note and save it. Content/title edits are merged per note
     * and sent after SAVE_DEBOUNCE_MS of inactivity; owner-only fields are sent at once.
     */
    const updateNote = useCallback((id, updates, { immediate = false } = {}) => {
        if (!id || !updates) return Promise.resolve(false);
        setNotes(prev => prev.map(note =>
            note.id === id ? { ...note, ...updates, updatedAt: new Date().toISOString() } : note
        ));
        pendingRef.current[id] = { ...(pendingRef.current[id] || {}), ...updates };
        setSaveStatus(prev => (prev[id] === 'saving' ? prev : { ...prev, [id]: 'saving' }));

        if (saveTimerRef.current[id]) clearTimeout(saveTimerRef.current[id]);
        if (immediate || OWNER_FIELDS.some(f => updates[f] !== undefined)) {
            return flushNote(id);
        }
        return new Promise((resolve) => {
            (waitersRef.current[id] = waitersRef.current[id] || []).push(resolve);
            saveTimerRef.current[id] = setTimeout(() => {
                delete saveTimerRef.current[id];
                const waiters = waitersRef.current[id] || [];
                delete waitersRef.current[id];
                flushNote(id).then(ok => waiters.forEach(w => w(ok)));
            }, SAVE_DEBOUNCE_MS);
        });
    }, [flushNote]);

    // Flush unsaved edits when the workspace changes, the tab is hidden/closed, or on unmount.
    useEffect(() => () => flushAll(), [workspaceId, flushAll]);
    useEffect(() => {
        const onHide = () => { if (document.visibilityState === 'hidden') flushAll(); };
        window.addEventListener('beforeunload', flushAll);
        document.addEventListener('visibilitychange', onHide);
        return () => {
            window.removeEventListener('beforeunload', flushAll);
            document.removeEventListener('visibilitychange', onHide);
        };
    }, [flushAll]);

    const addNote = useCallback(async (noteTitle = "Untitled Note", noteType = "note", extra = {}) => {
        try {
            const wsId = getWorkspaceId();
            if (!wsId) { showToast("Please select a workspace first", "error"); return null; }

            const response = await api.post("/api/v2/notes", {
                title: noteTitle,
                content: extra.content || "",
                tags: extra.tags,
                workspaceId: wsId,
                type: noteType
            });

            const newNote = mapNote(response.data.note);
            // The note-created socket event may have added it already.
            setNotes(prev => (prev.some(n => n.id === newNote.id) ? prev : [newNote, ...prev]));
            navigate(`/workspace/${wsId}/notes/${newNote.id}`);
            if (!extra.silent) showToast("Note created", "success");
            return newNote;
        } catch (error) {
            logger.error("Failed to create note:", error);
            showToast(errorMessage(error, "Failed to create note"), "error");
            return null;
        }
    }, [getWorkspaceId, navigate, showToast]);

    /** Permanently delete a note (owner only). */
    const deleteNote = useCallback(async (id) => {
        try {
            if (saveTimerRef.current[id]) clearTimeout(saveTimerRef.current[id]);
            delete saveTimerRef.current[id];
            delete pendingRef.current[id];
            await api.delete(`/api/v2/notes/${id}`, { params: { permanent: true } });
            deletedIdsRef.current.add(id);
            setNotes(prev => prev.filter(n => n.id !== id));
            if (location.pathname.includes(`/notes/${id}`)) {
                const wsId = getWorkspaceId();
                if (wsId) navigate(`/workspace/${wsId}/notes`);
            }
            showToast("Note deleted", "success");
            return true;
        } catch (error) {
            logger.error("Failed to delete note:", error);
            showToast(errorMessage(error, "Failed to delete note"), "error");
            return false;
        }
    }, [getWorkspaceId, navigate, showToast, location.pathname]);

    const togglePin = useCallback(async (id) => {
        const note = notesRef.current.find(n => n.id === id);
        if (!note) return;
        const newVal = !note.isPinned;
        const ok = await updateNote(id, { isPinned: newVal });
        if (ok) showToast(newVal ? "Added to Favorites" : "Removed from Favorites", "success");
    }, [updateNote, showToast]);

    const toggleArchive = useCallback(async (id) => {
        const note = notesRef.current.find(n => n.id === id);
        if (!note) return;
        const newVal = !note.isArchived;
        const ok = await updateNote(id, { isArchived: newVal });
        if (!ok) return;
        showToast(newVal ? "Note archived" : "Note restored", "success");
        if (newVal && location.pathname.includes(id)) {
            const wsId = getWorkspaceId();
            if (wsId) navigate(`/workspace/${wsId}/notes`);
        }
    }, [updateNote, showToast, location.pathname, getWorkspaceId, navigate]);

    /**
     * Save the sharing settings of a note (owner only).
     *   userIds       everyone the note should be shared with
     *   allowEditing  whether shared users may edit
     *   isPublic      visible to the whole workspace
     * Newly added people go through POST /share (they get a notification); removals and
     * visibility are a PUT. Shows exactly one toast.
     */
    const shareNote = useCallback(async (id, { userIds = [], allowEditing, isPublic } = {}) => {
        const note = notesRef.current.find(n => n.id === id);
        if (!note) return false;
        const current = new Set((note.sharedWith || []).map(idOf));
        const next = [...new Set(userIds.map(idOf))].filter(Boolean);
        const added = next.filter(uid => !current.has(uid));
        const removed = [...current].filter(uid => !next.includes(uid));
        try {
            let latest = null;
            if (added.length || (allowEditing !== undefined && allowEditing !== note.allowEditing)) {
                const res = await api.post(`/api/v2/notes/${id}/share`, {
                    userIds: added,
                    ...(allowEditing !== undefined ? { allowEditing } : {}),
                });
                latest = res.data?.note || latest;
            }
            if (removed.length || (isPublic !== undefined && isPublic !== note.isPublic)) {
                const res = await api.put(`/api/v2/notes/${id}`, {
                    ...(removed.length ? { sharedWith: next } : {}),
                    ...(isPublic !== undefined ? { isPublic } : {}),
                });
                latest = res.data?.note || latest;
            }
            if (latest) setNotes(prev => prev.map(n => (n.id === id ? mergeServerNote(latest, n) : n)));
            const people = next.length;
            showToast(
                isPublic
                    ? 'Note visible to the entire workspace'
                    : people ? `Shared with ${people} member${people !== 1 ? 's' : ''}` : 'Sharing updated',
                "success"
            );
            return true;
        } catch (error) {
            logger.error("Failed to share note:", error);
            showToast(errorMessage(error, "Failed to share note"), "error");
            return false;
        }
    }, [showToast, mergeServerNote]);

    const activeNotes = useMemo(() => notes.filter(n => !n.isArchived), [notes]);
    const archivedNotes = useMemo(() => notes.filter(n => n.isArchived), [notes]);

    // Plain text of each note for searching (not raw HTML/JSON).
    const textCache = useRef(new Map());
    const noteText = useCallback((note) => {
        const hit = textCache.current.get(note.id);
        if (hit && hit.content === note.content) return hit.text;
        const text = noteContentToText(note.content).toLowerCase();
        textCache.current.set(note.id, { content: note.content, text });
        return text;
    }, []);

    const matchesSearch = useCallback((note, query) => {
        const q = (query || '').trim().toLowerCase();
        if (!q) return true;
        return (note.title || '').toLowerCase().includes(q) || noteText(note).includes(q);
    }, [noteText]);

    const filteredNotes = useMemo(() => {
        const sectionFiltered = (() => {
            if (selectedSection === "favorites") return activeNotes.filter(n => n.isPinned);
            if (selectedSection === "recents") return [...activeNotes].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 10);
            if (selectedSection === "archive") return archivedNotes;
            if (selectedSection !== "all") return activeNotes.filter(n => n.type === selectedSection);
            return activeNotes;
        })();
        return sectionFiltered.filter(note =>
            matchesSearch(note, searchQuery) &&
            (!activeTagFilter || (note.tags && note.tags.includes(activeTagFilter)))
        );
    }, [selectedSection, activeNotes, archivedNotes, searchQuery, activeTagFilter, matchesSearch]);

    return (
        <NotesContext.Provider value={{
            notes: filteredNotes,
            allNotes: notes,
            activeNotes,
            archivedNotes,
            loading,
            currentUserId,
            addNote,
            updateNote,
            flushNote,
            saveStatus,
            deleteNote,
            togglePin,
            toggleArchive,
            shareNote,
            fetchNote,
            getNoteAccess,
            matchesSearch,
            searchQuery,
            setSearchQuery,
            refreshNotes: loadNotes,
            activeTagFilter,
            setActiveTagFilter,
            selectedSection,
            setSelectedSection,
            noteVersions,
            addVersion,
            loadVersions,
        }}>
            {children}
        </NotesContext.Provider>
    );
};
