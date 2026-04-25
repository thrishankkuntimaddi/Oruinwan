import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import api from '@services/api';
import { useToast } from "./ToastContext";
import { useSocket } from "./SocketContext";

const NotesContext = createContext();

export const useNotes = () => useContext(NotesContext);

export const NotesProvider = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { workspaceId } = useParams();
    const { showToast } = useToast();
    const { socket } = useSocket();

    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTagFilter, setActiveTagFilter] = useState(null);

    
    const [selectedSection, setSelectedSection] = useState("all");

    
    const saveTimerRef = useRef({});

    
    const [noteVersions, setNoteVersions] = useState({});
    const versionSaveTimer = useRef({});

    const loadVersions = useCallback(async (noteId) => {
        if (!noteId) return;
        try {
            const res = await api.get(`/api/v2/notes/${noteId}/versions`);
            const versions = res.data.versions || [];
            setNoteVersions(prev => ({ ...prev, [noteId]: versions }));
        } catch (e) {
            console.warn('Failed to load versions for', noteId, e?.message);
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
                console.warn('Failed to persist version for', noteId, e?.message);
            } finally {
                delete versionSaveTimer.current[noteId];
            }
        }, 10000);
    }, []);

    const getWorkspaceId = useCallback(() => {
        if (workspaceId) return workspaceId;
        const match = location.pathname.match(/\/workspace\/([^/]+)/);
        return match ? match[1] : null;
    }, [location.pathname, workspaceId]);

    const loadNotes = useCallback(async () => {
        try {
            const wsId = getWorkspaceId();
            if (!wsId) {
                setNotes([]);
                setLoading(false);
                return;
            }
            setLoading(true);
            const response = await api.get(`/api/v2/notes?workspaceId=${wsId}`);

            const mapNote = (note) => ({
                id: note._id,
                title: note.title || "",
                content: note.content || "",
                createdAt: note.createdAt,
                updatedAt: note.updatedAt,
                owner: note.owner,
                sharedWith: note.sharedWith || [],
                isPublic: note.isPublic || false,
                isPinned: note.isPinned || false,
                isArchived: note.isArchived || false,
                tags: note.tags || [],
                type: note.type || "note"
            });

            setNotes(response.data.notes.map(mapNote));
        } catch (error) {
            console.error("Failed to load notes:", error);
            showToast("Failed to load notes", "error");
            setNotes([]);
        } finally {
            setLoading(false);
        }
    }, [getWorkspaceId, showToast]);

    useEffect(() => {
        loadNotes();
    }, [loadNotes]);

    
    useEffect(() => {
        if (!socket) return;

        const mapNote = (note) => ({
            id: note._id,
            title: note.title || "",
            content: note.content || "",
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
            owner: note.owner,
            sharedWith: note.sharedWith || [],
            isPublic: note.isPublic || false,
            isPinned: note.isPinned || false,
            isArchived: note.isArchived || false,
            tags: note.tags || [],
            type: note.type || "note"
        });

        const handleNoteCreated = (note) => {
            setNotes(prev => {
                if (prev.some(n => n.id === note._id)) return prev;
                const currentWsId = getWorkspaceId();
                if (currentWsId && note.workspace && note.workspace !== currentWsId) return prev;
                return [mapNote(note), ...prev];
            });
        };

        const handleNoteUpdated = (note) => {
            setNotes(prev => prev.map(n => n.id === note._id ? mapNote(note) : n));
        };

        const handleNoteDeleted = (data) => {
            setNotes(prev => prev.filter(n => n.id !== data.noteId));
        };

        const handleNoteShared = (note) => {
            showToast(`Note shared with you: ${note.title}`, "info");
            setNotes(prev => {
                if (prev.some(n => n.id === note._id)) {
                    return prev.map(n => n.id === note._id ? mapNote(note) : n);
                }
                return [mapNote(note), ...prev];
            });
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
    }, [socket, getWorkspaceId, showToast]);

    
    const addNote = useCallback(async (noteTitle = "Untitled Note", noteType = "note") => {
        try {
            const wsId = getWorkspaceId();
            if (!wsId) { showToast("Please select a workspace first", "error"); return null; }

            const response = await api.post("/api/v2/notes", {
                title: noteTitle,
                content: "",
                workspaceId: wsId,
                type: noteType
            });

            const newNote = {
                id: response.data.note._id,
                title: response.data.note.title,
                content: response.data.note.content,
                createdAt: response.data.note.createdAt,
                updatedAt: response.data.note.updatedAt,
                owner: response.data.note.owner,
                sharedWith: response.data.note.sharedWith || [],
                isPublic: response.data.note.isPublic || false,
                isPinned: response.data.note.isPinned || false,
                isArchived: response.data.note.isArchived || false,
                tags: response.data.note.tags || [],
                type: response.data.note.type || "note"
            };

            setNotes(prev => [newNote, ...prev]);
            navigate(`/workspace/${wsId}/notes/${newNote.id}`);
            showToast("Note created", "success");
            return newNote;
        } catch (error) {
            console.error("Failed to create note:", error);
            showToast("Failed to create note", "error");
            return null;
        }
    }, [getWorkspaceId, navigate, showToast]);

    
    const updateNote = useCallback(async (id, updates) => {
        setNotes(prev => prev.map(note =>
            note.id === id ? { ...note, ...updates, updatedAt: new Date().toISOString() } : note
        ));

        if (saveTimerRef.current[id]) clearTimeout(saveTimerRef.current[id]);
        saveTimerRef.current[id] = setTimeout(async () => {
            try {
                await api.put(`/api/v2/notes/${id}`, updates);
            } catch (error) {
                console.error("Failed to update note:", error);
                showToast("Failed to save changes", "error");
                loadNotes();
            } finally {
                delete saveTimerRef.current[id];
            }
        }, 1000);
    }, [showToast, loadNotes]);

    
    const deleteNote = useCallback(async (id) => {
        try {
            await api.delete(`/api/v2/notes/${id}`);
            setNotes(prev => prev.filter(n => n.id !== id));
            const wsId = getWorkspaceId();
            if (wsId) navigate(`/workspace/${wsId}/notes`);
            
        } catch (error) {
            console.error("Failed to delete note:", error);
            showToast("Failed to delete note", "error");
        }
    }, [getWorkspaceId, navigate, showToast]);

    
    const togglePin = useCallback(async (id) => {
        const note = notes.find(n => n.id === id);
        if (!note) return;
        const newVal = !note.isPinned;
        await updateNote(id, { isPinned: newVal });
        showToast(newVal ? "Added to Favorites" : "Removed from Favorites", "success");
    }, [notes, updateNote, showToast]);

    
    const toggleArchive = useCallback(async (id) => {
        const note = notes.find(n => n.id === id);
        if (!note) return;
        const newVal = !note.isArchived;
        await updateNote(id, { isArchived: newVal });
        showToast(newVal ? "Note archived" : "Note restored", "success");
        
        if (newVal && location.pathname.includes(id)) {
            const wsId = getWorkspaceId();
            if (wsId) navigate(`/workspace/${wsId}/notes`);
        }
    }, [notes, updateNote, showToast, location.pathname, getWorkspaceId, navigate]);

    
    const shareNote = useCallback(async (id, userIds) => {
        try {
            await api.post(`/api/v2/notes/${id}/share`, { userIds });
            await loadNotes();
            showToast("Note shared successfully", "success");
        } catch (error) {
            console.error("Failed to share note:", error);
            showToast("Failed to share note", "error");
        }
    }, [loadNotes, showToast]);

    
    const activeNotes = notes.filter(n => !n.isArchived);
    const archivedNotes = notes.filter(n => n.isArchived);

    
    const sectionFiltered = (() => {
        if (selectedSection === "favorites") return activeNotes.filter(n => n.isPinned);
        if (selectedSection === "recents") return [...activeNotes].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 10);
        if (selectedSection === "archive") return archivedNotes;
        if (selectedSection !== "all") return activeNotes.filter(n => n.type === selectedSection);
        return activeNotes;
    })();

    
    const filteredNotes = sectionFiltered.filter(note => {
        const matchesSearch = !searchQuery ||
            note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            note.content.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTag = !activeTagFilter || (note.tags && note.tags.includes(activeTagFilter));
        return matchesSearch && matchesTag;
    });

    return (
        <NotesContext.Provider value={{
            notes: filteredNotes,
            allNotes: notes,
            activeNotes,
            archivedNotes,
            loading,
            addNote,
            updateNote,
            deleteNote,
            togglePin,
            toggleArchive,
            shareNote,
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
