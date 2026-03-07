/**
 * useLinkPreview.js — Phase 7.5
 *
 * Detects URLs in a message input string, debounces the detection,
 * and fetches Open Graph preview data from the backend.
 *
 * Usage:
 *   const { preview, clearPreview } = useLinkPreview(messageText);
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../../../services/api';

// Regex to find the first http(s) URL in a string
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
        // Extract first URL from text
        const match = text?.match(URL_REGEX);
        const url = match?.[0] ?? null;

        // If no URL or same URL as last fetch, skip
        if (!url) {
            setPreview(null);
            lastFetchedUrl.current = null;
            return;
        }

        if (url === lastFetchedUrl.current) return;

        // Debounce — wait 600 ms after user stops typing
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
                // silently ignore — SSRF-blocked, network error, unparseable page, etc.
                setPreview(null);
            } finally {
                setLoading(false);
            }
        }, 600);

        return () => clearTimeout(debounceTimer.current);
    }, [text]);

    return { preview, loading, clearPreview };
}
