// client/src/components/ai/AISearchBar.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';

const TYPE_ICONS = { message: '💬', knowledge: '📄', meeting: '📅', default: '🔍' };
const TYPE_LABELS = { message: 'Message', knowledge: 'Knowledge', meeting: 'Meeting' };

async function apiSearch(query, workspaceId, token) {
    const res = await fetch('/api/ai/search', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body:    JSON.stringify({ query, workspaceId }),
    });
    if (!res.ok) throw new Error('Search failed');
    return res.json();
}

export default function AISearchBar({ workspaceId, token, onClose }) {
    const [query, setQuery]     = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState(null);
    const inputRef              = useRef(null);
    const debounceRef           = useRef(null);

    // Focus on mount
    useEffect(() => { inputRef.current?.focus(); }, []);

    // Cmd+K / Escape handling
    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const runSearch = useCallback(async (q) => {
        if (!q.trim() || q.trim().length < 2) { setResults([]); return; }
        setLoading(true); setError(null);
        try {
            const data = await apiSearch(q.trim(), workspaceId, token);
            setResults(data.results || []);
        } catch (e) { setError('Search unavailable'); setResults([]); }
        finally { setLoading(false); }
    }, [workspaceId, token]);

    const handleChange = (e) => {
        const q = e.target.value;
        setQuery(q);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => runSearch(q), 400);
    };

    const overlayStyle = {
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12vh',
        fontFamily: 'Inter, system-ui, sans-serif',
    };

    const boxStyle = {
        width: '100%', maxWidth: 600,
        background: 'var(--bg-secondary, #1e1b35)',
        border: '1px solid rgba(139,92,246,0.35)',
        borderRadius: 14, boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        overflow: 'hidden',
    };

    return (
        <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose?.()}>
            <div style={boxStyle}>
                {/* Search Input */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '14px 16px',
                    borderBottom: results.length || loading || error ? '1px solid rgba(139,92,246,0.15)' : 'none',
                }}>
                    <span style={{ fontSize: 20, opacity: 0.7 }}>🔍</span>
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={handleChange}
                        placeholder="Search messages, knowledge, meetings…"
                        style={{
                            flex: 1, background: 'none', border: 'none', outline: 'none',
                            color: '#f1f5f9', fontSize: 16, fontFamily: 'inherit',
                        }}
                    />
                    {loading && (
                        <div style={{
                            width: 16, height: 16,
                            border: '2px solid rgba(139,92,246,0.3)', borderTopColor: '#8b5cf6',
                            borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0,
                        }} />
                    )}
                    <kbd style={{
                        padding: '2px 6px', background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4,
                        fontSize: 11, color: '#64748b',
                    }}>ESC</kbd>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

                {/* Results */}
                {error && (
                    <div style={{ padding: '12px 16px', fontSize: 13, color: '#f87171' }}>
                        ⚠️ {error}
                    </div>
                )}
                {!loading && !error && results.length === 0 && query.length >= 2 && (
                    <div style={{ padding: '20px 16px', textAlign: 'center', color: '#475569', fontSize: 14 }}>
                        No results found for "{query}"
                    </div>
                )}
                {results.length > 0 && (
                    <ul style={{ listStyle: 'none', padding: '8px 0', margin: 0, maxHeight: 400, overflowY: 'auto' }}>
                        {results.map((r, i) => (
                            <li key={r.id || i} style={{
                                display: 'flex', alignItems: 'flex-start', gap: 10,
                                padding: '10px 16px', cursor: 'pointer',
                                transition: 'background 0.1s',
                            }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.1)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>
                                    {TYPE_ICONS[r.type] || TYPE_ICONS.default}
                                </span>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 2 }}>
                                        {r.title}
                                    </div>
                                    <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4, }}>
                                        {r.snippet?.substring(0, 120)}{r.snippet?.length > 120 ? '…' : ''}
                                    </div>
                                    <span style={{
                                        display: 'inline-block', marginTop: 4,
                                        fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                                        color: r.type === 'knowledge' ? '#34d399' : r.type === 'meeting' ? '#60a5fa' : '#a78bfa',
                                        background: r.type === 'knowledge' ? 'rgba(52,211,153,0.12)' : r.type === 'meeting' ? 'rgba(96,165,250,0.12)' : 'rgba(167,139,250,0.12)',
                                        padding: '2px 6px', borderRadius: 4,
                                    }}>
                                        {TYPE_LABELS[r.type] || r.type}
                                    </span>
                                </div>
                                {r.score > 0 && (
                                    <div style={{ marginLeft: 'auto', fontSize: 11, color: '#475569', flexShrink: 0 }}>
                                        {Math.round(r.score * 100)}%
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}

                {/* Empty state */}
                {!query && (
                    <div style={{ padding: '16px 16px', color: '#475569', fontSize: 13 }}>
                        <p style={{ margin: '0 0 8px 0', fontWeight: 600, color: '#64748b' }}>Search across your workspace</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {['meeting notes', 'design review', 'Q2 roadmap', 'onboarding'].map(s => (
                                <button key={s} onClick={() => { setQuery(s); runSearch(s); }} style={{
                                    background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
                                    borderRadius: 12, padding: '3px 10px', fontSize: 12, color: '#a78bfa',
                                    cursor: 'pointer', fontFamily: 'inherit',
                                }}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
