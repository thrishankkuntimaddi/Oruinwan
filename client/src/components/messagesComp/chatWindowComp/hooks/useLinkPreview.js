import { useState, useEffect, useRef, useCallback } from 'react';
import api from '@services/api';

const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/;

export function useLinkPreview(text) {
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const lastFetchedUrl = useRef(null);
    const debounceTimer = useRef(null);

    const clearPreview = useCallback(() => {
        setPreview(null);
        lastFetchedUrl.current = null;
    }, []);

    useEffect(() => {
        
        const match = text?.match(URL_REGEX);
        const url = match?.[0] ?? null;

        
        if (!url) {
            setPreview(null);
            lastFetchedUrl.current = null;
            return;
        }

        if (url === lastFetchedUrl.current) return;

        
        clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(async () => {
            lastFetchedUrl.current = url;
            setLoading(true);
            try {
                const { data } = await api.post('/api/v2/link-preview', { url });
                if (data?.preview?.url) {
                    setPreview(data.preview);
                } else {
                    setPreview(null);
                }
            } catch {
                
                setPreview(null);
            } finally {
                setLoading(false);
            }
        }, 600);

        return () => clearTimeout(debounceTimer.current);
    }, [text]);

    return { preview, loading, clearPreview };
}
