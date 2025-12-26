import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import api from "../services/api";
import { useToast } from "./ToastContext";

const NotesContext = createContext();

export const useNotes = () => useContext(NotesContext);

export const NotesProvider = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { workspaceId } = useParams();
    const { showToast } = useToast();

    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Debounce timer for auto-save
    const saveTimerRef = useRef({});

    // Helper to extract workspaceId from current location
    const getWorkspaceId = useCallback(() => {
        if (workspaceId) return workspaceId;
        const match = location.pathname.match(/\/workspace\/([^/]+)/);
        return match ? match[1] : null;
    }, [location.pathname, workspaceId]);

    // Load notes from backend
    const loadNotes = useCallback(async () => {
        try {
            const wsId = getWorkspaceId();
            if (!wsId) {
                setNotes([]);
                setLoading(false);
                return;
            }

            setLoading(true);
            const response = await api.get(`/api/notes?workspaceId=${wsId}`);

            // Map backend notes to frontend format
            const mappedNotes = response.data.notes.map(note => ({
                id: note._id,
                title: note.title || "",
                content: note.content || "",
                createdAt: note.createdAt,
                updatedAt: note.updatedAt,
                owner: note.owner,
                sharedWith: note.sharedWith || [],
                isPublic: note.isPublic || false,
                isPinned: note.isPinned || false,
                tags: note.tags || [],
                type: note.type || "note"
            }));

            setNotes(mappedNotes);
        } catch (error) {
            console.error("Failed to load notes:", error);
            showToast("Failed to load notes", "error");
            setNotes([]);
        } finally {
            setLoading(false);
        }
    }, [getWorkspaceId, showToast]);

    // Load notes when workspace changes
    useEffect(() => {
        loadNotes();
    }, [loadNotes]);

    // Create new note
    const addNote = useCallback(async () => {
        try {
            const wsId = getWorkspaceId();
            if (!wsId) {
                showToast("Please select a workspace first", "error");
                return null;
            }

            const response = await api.post("/api/notes", {
                title: "Untitled Note",
                content: "",
                workspaceId: wsId,
                type: "note"
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
                tags: response.data.note.tags || [],
                type: response.data.note.type || "note"
            };

            setNotes(prev => [newNote, ...prev]);

            // Navigate to new note
            navigate(`/workspace/${wsId}/notes/${newNote.id}`);
            showToast("Note created", "success");

            return newNote;
        } catch (error) {
            console.error("Failed to create note:", error);
            showToast("Failed to create note", "error");
            return null;
        }
    }, [getWorkspaceId, navigate, showToast]);

    // Update note with debounce
    const updateNote = useCallback(async (id, updates) => {
        // Optimistically update UI
        setNotes(prev => prev.map(note =>
            note.id === id ? { ...note, ...updates, updatedAt: new Date().toISOString() } : note
        ));

        // Clear existing timer for this note
        if (saveTimerRef.current[id]) {
            clearTimeout(saveTimerRef.current[id]);
        }

        // Set new timer for auto-save (1 second debounce)
        saveTimerRef.current[id] = setTimeout(async () => {
            try {
                await api.put(`/api/notes/${id}`, updates);
                // Silently succeed - no toast needed for auto-save
            } catch (error) {
                console.error("Failed to update note:", error);
                showToast("Failed to save changes", "error");

                // Reload note from backend on error
                loadNotes();
            } finally {
                delete saveTimerRef.current[id];
            }
        }, 1000);
    }, [showToast, loadNotes]);

    // Delete note
    const deleteNote = useCallback(async (id) => {
        try {
            await api.delete(`/api/notes/${id}`);

            setNotes(prev => prev.filter(n => n.id !== id));

            const wsId = getWorkspaceId();
            if (wsId) {
                navigate(`/workspace/${wsId}/notes`);
            }

            showToast("Note deleted", "success");
        } catch (error) {
            console.error("Failed to delete note:", error);
            showToast("Failed to delete note", "error");
        }
    }, [getWorkspaceId, navigate, showToast]);

    // Share note with users
    const shareNote = useCallback(async (id, userIds) => {
        try {
            await api.post(`/api/notes/${id}/share`, { userIds });

            // Reload notes to get updated sharedWith
            await loadNotes();

            showToast("Note shared successfully", "success");
        } catch (error) {
            console.error("Failed to share note:", error);
            showToast("Failed to share note", "error");
        }
    }, [loadNotes, showToast]);

    // Filter notes by search query
    const filteredNotes = notes.filter(note =>
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <NotesContext.Provider value={{
            notes: filteredNotes,
            allNotes: notes,
            loading,
            addNote,
            updateNote,
            deleteNote,
            shareNote,
            searchQuery,
            setSearchQuery,
            refreshNotes: loadNotes
        }}>
            {children}
        </NotesContext.Provider>
    );
};
