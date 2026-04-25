import { useReducer, useRef, useCallback } from 'react';
import api from '@services/api';

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

export function useTranslation() {
    const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

    
    const cacheRef = useRef(new Map());
    
    const pendingRef = useRef(new Set());

    
    const getTranslation = useCallback((msgId) => {
        return state.translationMap.get(msgId) ?? null;
    }, [state.translationMap]);

    
    const requestTranslation = useCallback(async (msgId, text, langCode) => {
        if (!msgId || !text || !langCode) return;

        const cacheKey = `${msgId}:${langCode}`;
        const pendingKey = `${msgId}:${langCode}`;

        
        if (cacheRef.current.has(cacheKey)) {
            const cached = cacheRef.current.get(cacheKey);
            dispatch({ type: 'SET_DONE', msgId, language: langCode, ...cached });
            return;
        }

        
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

            
            cacheRef.current.set(cacheKey, { translatedText, detectedLang });

            dispatch({ type: 'SET_DONE', msgId, language: langCode, translatedText, detectedLang });
        } catch {
            dispatch({ type: 'SET_ERROR', msgId, language: langCode });
        } finally {
            pendingRef.current.delete(pendingKey);
        }
    }, []);

    
    const clearTranslation = useCallback((msgId) => {
        dispatch({ type: 'CLEAR', msgId });
    }, []);

    return { getTranslation, requestTranslation, clearTranslation };
}
