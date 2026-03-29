// client/src/hooks/useTranslation.js
// Centralized translation state + cache for the entire message list.
// A single instance of this hook lives in MessagesContainer and props are
// passed down — no global context, no unnecessary re-renders.

import { useReducer, useRef, useCallback } from 'react';
import api from '@services/api';

// ── State shape ────────────────────────────────────────────────────────────
// translationMap: Map<string, TranslationEntry>
// TranslationEntry: { status: 'loading'|'done'|'error', translatedText, language, detectedLang }

const INITIAL_STATE = { translationMap: new Map() };

function reducer(state, action) {
    const next = new Map(state.translationMap);
    switch (action.type) {
        case 'SET_LOADING':
            next.set(action.msgId, { status: 'loading', language: action.language, translatedText: null, detectedLang: null });
            break;
        case 'SET_DONE':
            next.set(action.msgId, {
                status: 'done',
                language: action.language,
                translatedText: action.translatedText,
                detectedLang: action.detectedLang ?? null,
            });
            break;
        case 'SET_ERROR':
            next.set(action.msgId, { status: 'error', language: action.language, translatedText: null, detectedLang: null });
            break;
        case 'CLEAR':
            next.delete(action.msgId);
            break;
        default:
            return state;
    }
    return { translationMap: next };
}

// ── Hook ──────────────────────────────────────────────────────────────────
export function useTranslation() {
    const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

    // Cache: msgId:langCode → { translatedText, detectedLang }
    const cacheRef = useRef(new Map());
    // Pending guards — prevents duplicate in-flight requests
    const pendingRef = useRef(new Set());

    /** Returns the current translation entry for a message, or null. */
    const getTranslation = useCallback((msgId) => {
        return state.translationMap.get(msgId) ?? null;
    }, [state.translationMap]);

    /**
     * Request a translation for `text` into `langCode`.
     * Uses the cache (msgId:langCode) to skip duplicate API calls.
     */
    const requestTranslation = useCallback(async (msgId, text, langCode) => {
        if (!msgId || !text || !langCode) return;

        const cacheKey = `${msgId}:${langCode}`;
        const pendingKey = `${msgId}:${langCode}`;

        // Cache hit → apply immediately
        if (cacheRef.current.has(cacheKey)) {
            const cached = cacheRef.current.get(cacheKey);
            dispatch({ type: 'SET_DONE', msgId, language: langCode, ...cached });
            return;
        }

        // Already in-flight → skip
        if (pendingRef.current.has(pendingKey)) return;

        pendingRef.current.add(pendingKey);
        dispatch({ type: 'SET_LOADING', msgId, language: langCode });

        try {
            const res = await api.post('/api/v2/messages/ai/translate', {
                text,
                targetLang: langCode,
                messageId: msgId,
            });

            const translatedText = res.data?.translated ?? text;
            const detectedLang = res.data?.detectedLang ?? null;

            // Store in cache
            cacheRef.current.set(cacheKey, { translatedText, detectedLang });

            dispatch({ type: 'SET_DONE', msgId, language: langCode, translatedText, detectedLang });
        } catch {
            dispatch({ type: 'SET_ERROR', msgId, language: langCode });
        } finally {
            pendingRef.current.delete(pendingKey);
        }
    }, []);

    /** Reset a message back to its original text. */
    const clearTranslation = useCallback((msgId) => {
        dispatch({ type: 'CLEAR', msgId });
    }, []);

    return { getTranslation, requestTranslation, clearTranslation };
}
