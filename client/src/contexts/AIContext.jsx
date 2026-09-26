import React, { createContext, useContext, useMemo, useRef, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * What the user is looking at, so Oruinwan AI can act on it from anywhere:
 * the open conversation (decrypted transcript), the open note, the open task.
 * Screens register themselves; the assistant panel reads `snapshot()`.
 *
 * Transcripts are provided as getter functions so we never copy message
 * lists on every render — they are read only when an AI call is made.
 */
const AIContext = createContext(null);

export function useAIContext() {
    return useContext(AIContext);
}

const MAX_TRANSCRIPT = 40;

export function AIProvider({ children }) {
    const location = useLocation();
    const [conversation, setConversationState] = useState(null); // { id, type, name, getMessages }
    const [note, setNote] = useState(null);                       // { id, title, getText }
    const [task, setTask] = useState(null);                       // { id, title, description, status, priority, dueDate }
    const composerRef = useRef(null);                             // { insert(text) }

    const setConversation = useCallback((conv) => {
        setConversationState(conv ? { ...conv } : null);
    }, []);

    const registerComposer = useCallback((api) => {
        composerRef.current = api;
        return () => { if (composerRef.current === api) composerRef.current = null; };
    }, []);

    /** Plain-data snapshot for /api/ai/chat. */
    const snapshot = useCallback(() => {
        const out = { screen: { route: location.pathname, title: document.title } };
        if (conversation) {
            const msgs = (conversation.getMessages?.() || []).slice(-MAX_TRANSCRIPT);
            out.conversation = { id: conversation.id, type: conversation.type, name: conversation.name, messages: msgs };
        }
        if (note) out.note = { id: note.id, title: note.title, text: note.getText?.() || '' };
        if (task) out.task = { id: task.id, title: task.title, description: task.description, status: task.status, priority: task.priority, dueDate: task.dueDate };
        const sel = typeof window !== 'undefined' ? String(window.getSelection?.() || '').trim() : '';
        if (sel && sel.length > 20) out.selection = sel.slice(0, 8000);
        return out;
    }, [conversation, note, task, location.pathname]);

    const value = useMemo(() => ({
        conversation, setConversation,
        note, setNote,
        task, setTask,
        registerComposer,
        hasComposer: () => !!composerRef.current,
        insertIntoComposer: (text) => { composerRef.current?.insert(text); return !!composerRef.current; },
        snapshot,
    }), [conversation, note, task, setConversation, registerComposer, snapshot]);

    return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
}
