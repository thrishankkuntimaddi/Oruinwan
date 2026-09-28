import React, { createContext, useContext, useMemo, useRef, useState, useCallback, useEffect } from 'react';
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
    const [thread, setThreadState] = useState(null);              // { parentId, getMessages } while a thread is open
    // Composers register in mount order; the most recent one (e.g. an open
    // thread) receives inserts, and closing it hands back to the previous one.
    const composersRef = useRef([]);                              // [{ insert(text) }]

    const setConversation = useCallback((conv) => {
        setConversationState(conv ? { ...conv } : null);
    }, []);

    const setThread = useCallback((t) => {
        setThreadState(t ? { ...t } : null);
    }, []);

    const registerComposer = useCallback((api) => {
        composersRef.current = [...composersRef.current.filter((c) => c !== api), api];
        return () => { composersRef.current = composersRef.current.filter((c) => c !== api); };
    }, []);
    const topComposer = () => composersRef.current[composersRef.current.length - 1] || null;

    // `chttrix:composer:insert` events (aiService.insertIntoComposer) go to the top composer only.
    useEffect(() => {
        const onInsert = (e) => topComposer()?.insert(e?.detail?.text);
        document.addEventListener('chttrix:composer:insert', onInsert);
        return () => document.removeEventListener('chttrix:composer:insert', onInsert);
    }, []);

    /** Plain-data snapshot for /api/ai/chat. */
    const snapshot = useCallback(() => {
        const out = { screen: { route: location.pathname, title: document.title } };
        if (conversation && thread) {
            // An open thread is what the user is looking at: send its replies.
            const msgs = (thread.getMessages?.() || []).slice(-MAX_TRANSCRIPT);
            out.conversation = { id: conversation.id, type: conversation.type, name: `${conversation.name || 'conversation'} (thread)`, messages: msgs };
        } else if (conversation) {
            const msgs = (conversation.getMessages?.() || []).slice(-MAX_TRANSCRIPT);
            out.conversation = { id: conversation.id, type: conversation.type, name: conversation.name, messages: msgs };
        }
        if (note) out.note = { id: note.id, title: note.title, text: note.getText?.() || '' };
        if (task) out.task = { id: task.id, title: task.title, description: task.description, status: task.status, priority: task.priority, dueDate: task.dueDate };
        const sel = typeof window !== 'undefined' ? String(window.getSelection?.() || '').trim() : '';
        if (sel && sel.length > 20) out.selection = sel.slice(0, 8000);
        return out;
    }, [conversation, thread, note, task, location.pathname]);

    const value = useMemo(() => ({
        conversation, setConversation,
        thread, setThread,
        note, setNote,
        task, setTask,
        registerComposer,
        hasComposer: () => !!topComposer(),
        insertIntoComposer: (text) => { const c = topComposer(); c?.insert(text); return !!c; },
        snapshot,
    }), [conversation, thread, note, task, setConversation, setThread, registerComposer, snapshot]);

    return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
}
