// Phase 4 — Smart Reply Suggestions UI Component
// Shows 3 AI-generated reply chips below the chat, clicking inserts text into composer

import React, { useState, useEffect, useCallback } from "react";
import { Zap, X } from "lucide-react";
import api from '@services/api';

/**
 * @param {object} props
 * @param {Array} props.recentMessages - Last N messages in the chat [{sender, text}]
 * @param {function} props.onSelect - Called with the selected suggestion string
 * @param {boolean} props.enabled - Whether smart reply is active
 */
export default function SmartReplySuggestions({ recentMessages = [], onSelect, enabled = true }) {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [lastMsgCount, setLastMsgCount] = useState(0);

    const fetchSuggestions = useCallback(async () => {
        if (!enabled || recentMessages.length === 0) return;
        setLoading(true);
        setDismissed(false);
        try {
            const res = await api.post("/api/ai/smart-reply", {
                messages: recentMessages.slice(-5)
            });
            setSuggestions(res.data.suggestions || []);
        } catch {
            setSuggestions([]);
        } finally {
            setLoading(false);
        }
    }, [enabled, recentMessages]);

    // Re-fetch when new messages arrive (debounced)
    useEffect(() => {
        if (recentMessages.length === lastMsgCount) return;
        setLastMsgCount(recentMessages.length);
        const timer = setTimeout(fetchSuggestions, 800);
        return () => clearTimeout(timer);
    }, [recentMessages.length, fetchSuggestions, lastMsgCount]);

    if (!enabled || dismissed || (suggestions.length === 0 && !loading)) return null;

    return (
        <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto scrollbar-hide">
            <Zap size={13} className="text-violet-400 flex-shrink-0" />
            {loading ? (
                <div className="flex gap-2">
                    {[80, 100, 72].map((w, i) => (
                        <div key={i} className={`h-7 rounded-full bg-gray-100 animate-pulse`} style={{ width: w }} />
                    ))}
                </div>
            ) : (
                <>
                    {suggestions.map((s, i) => (
                        <button
                            key={i}
                            onClick={() => { onSelect?.(s); setDismissed(true); }}
                            className="flex-shrink-0 px-3 py-1.5 bg-white border border-gray-200 hover:border-violet-300 hover:bg-violet-50 rounded-full text-xs text-gray-700 hover:text-violet-700 transition-all shadow-sm"
                        >
                            {s}
                        </button>
                    ))}
                    <button
                        onClick={() => setDismissed(true)}
                        className="flex-shrink-0 p-1 text-gray-300 hover:text-gray-500 transition-colors"
                        title="Dismiss"
                    >
                        <X size={12} />
                    </button>
                </>
            )}
        </div>
    );
}
