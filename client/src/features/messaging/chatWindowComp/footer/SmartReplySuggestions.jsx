import React, { useState, useEffect, useCallback, useRef } from "react";
import { Zap, X } from "lucide-react";
import { aiService } from "../../../../services/aiService";

/**
 * Reply chips under the composer. `recentMessages` is the decrypted tail of
 * the conversation ([{ sender, text, isMe }]); suggestions are only fetched
 * when the last message came from someone else.
 */
export default function SmartReplySuggestions({ recentMessages = [], workspaceId, onSelect, enabled = true }) {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [dismissedFor, setDismissedFor] = useState(null);
    const lastKeyRef = useRef(null);

    const last = recentMessages[recentMessages.length - 1];
    const key = last ? `${last.id || ''}:${last.text?.slice(0, 40)}` : null;
    const shouldSuggest = enabled && !!workspaceId && !!last && !last.isMe && !!last.text?.trim();

    const fetchSuggestions = useCallback(async () => {
        setLoading(true);
        try {
            const res = await aiService.smartReplies({ workspaceId, messages: recentMessages.slice(-8) });
            setSuggestions(res.suggestions || []);
        } catch {
            setSuggestions([]);
        } finally {
            setLoading(false);
        }
    }, [workspaceId, recentMessages]);

    useEffect(() => {
        if (!shouldSuggest || key === lastKeyRef.current) return undefined;
        lastKeyRef.current = key;
        setSuggestions([]);
        const timer = setTimeout(fetchSuggestions, 700);
        return () => clearTimeout(timer);
    }, [shouldSuggest, key, fetchSuggestions]);

    if (!shouldSuggest || dismissedFor === key || (suggestions.length === 0 && !loading)) return null;

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', overflowX: 'auto', fontFamily: 'var(--font)' }}>
            <Zap size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} title="Smart replies" />
            {loading ? (
                <div style={{ display: 'flex', gap: '6px' }}>
                    {[80, 100, 72].map((w, i) => (
                        <div key={i} style={{ height: '24px', width: `${w}px`, borderRadius: '99px', backgroundColor: 'var(--bg-hover)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                    ))}
                </div>
            ) : (
                <>
                    {suggestions.map((s, i) => (
                        <button
                            key={i}
                            onClick={() => { onSelect?.(s); setDismissedFor(key); }}
                            style={{
                                flexShrink: 0, padding: '4px 12px', fontSize: '12px', fontWeight: 500,
                                backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-default)',
                                borderRadius: '99px', cursor: 'pointer', color: 'var(--text-secondary)',
                                transition: '150ms ease', whiteSpace: 'nowrap', fontFamily: 'var(--font)', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                        >
                            {s}
                        </button>
                    ))}
                    <button
                        onClick={() => setDismissedFor(key)}
                        style={{ flexShrink: 0, display: 'flex', padding: '3px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', transition: '150ms ease' }}
                        title="Dismiss"
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                        <X size={12} />
                    </button>
                </>
            )}
        </div>
    );
}
