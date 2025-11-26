import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const NotesContext = createContext();

export const useNotes = () => useContext(NotesContext);

export const NotesProvider = ({ children }) => {
    const navigate = useNavigate();
    const [notes, setNotes] = useState(() => {
        const saved = localStorage.getItem("chttrix_notes");
        return saved ? JSON.parse(saved) : [
            {
                id: "1",
                title: "Project Ideas",
                content: "1. AI Integration\n2. Real-time collaboration\n3. Dark mode support",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: "2",
                title: "Meeting Minutes",
                content: "Attendees: John, Sarah, Mike\n\nAction items:\n- Fix login bug\n- Update designs",
                createdAt: new Date(Date.now() - 86400000).toISOString(),
                updatedAt: new Date(Date.now() - 86400000).toISOString()
            }
        ];
    });

    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        localStorage.setItem("chttrix_notes", JSON.stringify(notes));
    }, [notes]);

    const addNote = () => {
        const newNote = {
            id: Date.now().toString(),
            title: "",
            content: "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        setNotes([newNote, ...notes]);
        navigate(`/notes/${newNote.id}`);
        return newNote;
    };

    const updateNote = (id, updates) => {
        setNotes(prev => prev.map(note =>
            note.id === id ? { ...note, ...updates, updatedAt: new Date().toISOString() } : note
        ));
    };

    const deleteNote = (id) => {
        setNotes(prev => prev.filter(n => n.id !== id));
        navigate("/notes");
    };

    const filteredNotes = notes.filter(note =>
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <NotesContext.Provider value={{
            notes: filteredNotes,
            allNotes: notes,
            addNote,
            updateNote,
            deleteNote,
            searchQuery,
            setSearchQuery
        }}>
            {children}
        </NotesContext.Provider>
    );
};
