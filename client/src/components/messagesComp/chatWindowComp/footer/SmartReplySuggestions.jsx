import React, { useState, useEffect, useCallback } from "react";
import { Zap, X } from "lucide-react";
import api from '@services/api';

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
            const res = await api.post("/api/ai/smart-reply", { messages: recentMessages.slice(-5) });
            setSuggestions(res.data.suggestions || []);
        } catch {
            setSuggestions([]);
        } finally {
            setLoading(false);
        }
    }, [enabled, recentMessages]);

    useEffect(() => {
        if (recentMessages.length === lastMsgCount) return;
        setLastMsgCount(recentMessages.length);
        const timer = setTimeout(fetchSuggestions, 800);
        return () => clearTimeout(timer);
    }, [recentMessages.length, fetchSuggestions, lastMsgCount]);

    if (!enabled || dismissed || (suggestions.length === 0 && !loading)) return null;

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', overflowX: 'auto', fontFamily: 'var(--font)' }}>
            <Zap size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            {loading ? (
                <div style={{ display: 'flex', gap: '6px' }}>
                    {[80, 100, 72].map((w, i) => (
                        <div key={i} style={{ height: '24px', width: `${w}px`, borderRadius: '2px', backgroundColor: 'var(--bg-hover)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                    ))}
                </div>
            ) : (
                <>
                    {suggestions.map((s, i) => (
                        <button
                            key={i}
                            onClick={() => { onSelect?.(s); setDismissed(true); }}
                            style={{
                                flexShrink: 0, padding: '4px 12px', fontSize: '12px', fontWeight: 500,
                                backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-default)',
                                borderRadius: '99px', cursor: 'pointer', color: 'var(--text-secondary)',
                                transition: '150ms ease', whiteSpace: 'nowrap', fontFamily: 'var(--font)',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                        >
                            {s}
                        </button>
                    ))}
                    <button
                        onClick={() => setDismissed(true)}
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
