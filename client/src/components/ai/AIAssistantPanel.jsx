// client/src/components/ai/AIAssistantPanel.jsx
import React, { useState, useCallback } from 'react';

const API = (path) => `/api/ai${path}`;

const fetchAI = async (path, body, token) => {
    const res = await fetch(API(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`AI request failed: ${res.status}`);
    return res.json();
};

// ─── Loading Spinner ──────────────────────────────────────────────────────────
const Spinner = () => (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '12px' }}>
        <div style={{
            width: 20, height: 20,
            border: '2px solid rgba(139,92,246,0.3)',
            borderTopColor: '#8b5cf6',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
);

// ─── Action Items List ────────────────────────────────────────────────────────
const ActionItemsList = ({ items }) => (
    <ul style={{ listStyle: 'none', padding: '0', margin: '8px 0 0 0' }}>
        {items.map((item, i) => (
            <li key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '6px 8px', marginBottom: 4,
                background: 'rgba(139,92,246,0.08)', borderRadius: 6,
                fontSize: 13, color: 'var(--text-primary, #f1f5f9)',
            }}>
                <span style={{ color: '#a78bfa', flexShrink: 0, marginTop: 1 }}>✓</span>
                <span>{item}</span>
            </li>
        ))}
    </ul>
);

// ─── Summary Card ─────────────────────────────────────────────────────────────
const SummaryCard = ({ summary, messageCount, fallback }) => (
    <div style={{
        background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(59,130,246,0.08))',
        border: '1px solid rgba(139,92,246,0.25)',
        borderRadius: 10, padding: '12px 14px', marginTop: 8,
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 14 }}>✨</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                AI Summary {fallback ? '(local)' : ''}
            </span>
            {messageCount > 0 && (
                <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', marginLeft: 'auto' }}>
                    {messageCount} msgs
                </span>
            )}
        </div>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary, #e2e8f0)' }}>
            {summary}
        </p>
    </div>
);

// ─── Smart Reply Chips ────────────────────────────────────────────────────────
export const SmartReplyChips = ({ suggestions = [], onSelect, style = {} }) => {
    if (!suggestions.length) return null;
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '6px 0', ...style }}>
            {suggestions.map((s, i) => (
                <button
                    key={i}
                    onClick={() => onSelect && onSelect(s)}
                    style={{
                        background: 'rgba(139,92,246,0.12)',
                        border: '1px solid rgba(139,92,246,0.3)',
                        borderRadius: 16, padding: '4px 12px',
                        fontSize: 12, color: '#c4b5fd', cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => {
                        e.target.style.background = 'rgba(139,92,246,0.25)';
                        e.target.style.borderColor = '#8b5cf6';
                        e.target.style.color = '#fff';
                    }}
                    onMouseLeave={e => {
                        e.target.style.background = 'rgba(139,92,246,0.12)';
                        e.target.style.borderColor = 'rgba(139,92,246,0.3)';
                        e.target.style.color = '#c4b5fd';
                    }}
                >
                    {s}
                </button>
            ))}
        </div>
    );
};

// ─── Main Panel ───────────────────────────────────────────────────────────────
export default function AIAssistantPanel({ channelId, workspaceId, onClose, token }) {
    const [tab, setTab]             = useState('summary');  // 'summary' | 'actions'
    const [summary, setSummary]     = useState(null);
    const [items, setItems]         = useState([]);
    const [actionText, setActionText] = useState('');
    const [loading, setLoading]     = useState(false);
    const [error, setError]         = useState(null);

    const handleSummarize = useCallback(async () => {
        if (!channelId || !workspaceId) return;
        setLoading(true); setError(null); setSummary(null);
        try {
            const data = await fetchAI('/channel-summary', { channelId, workspaceId }, token);
            setSummary(data);
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }, [channelId, workspaceId, token]);

    const handleExtractActions = useCallback(async () => {
        if (!actionText.trim()) return;
        setLoading(true); setError(null); setItems([]);
        try {
            const data = await fetchAI('/action-items', { text: actionText }, token);
            setItems(data.items || []);
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }, [actionText, token]);

    const panelStyle = {
        position: 'fixed', right: 0, top: 60, bottom: 0,
        width: 340, zIndex: 500,
        background: 'var(--bg-secondary, #1e1b4b)',
        borderLeft: '1px solid rgba(139,92,246,0.2)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.3)',
        fontFamily: 'Inter, system-ui, sans-serif',
    };

    return (
        <div style={panelStyle}>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '14px 16px', borderBottom: '1px solid rgba(139,92,246,0.15)',
                background: 'rgba(139,92,246,0.06)',
            }}>
                <span style={{ fontSize: 18 }}>🤖</span>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#e2e8f0', flex: 1 }}>
                    AI Assistant
                </h3>
                {onClose && (
                    <button onClick={onClose} style={{
                        background: 'none', border: 'none', color: '#94a3b8',
                        cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 2,
                    }}>×</button>
                )}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(139,92,246,0.1)' }}>
                {['summary', 'actions'].map(t => (
                    <button key={t} onClick={() => setTab(t)} style={{
                        flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
                        background: tab === t ? 'rgba(139,92,246,0.15)' : 'transparent',
                        color: tab === t ? '#c4b5fd' : '#64748b',
                        fontWeight: tab === t ? 600 : 400,
                        fontSize: 13, borderBottom: tab === t ? '2px solid #8b5cf6' : '2px solid transparent',
                        fontFamily: 'inherit', transition: 'all 0.15s',
                        textTransform: 'capitalize',
                    }}>
                        {t === 'summary' ? '✨ Summary' : '✅ Actions'}
                    </button>
                ))}
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                {error && (
                    <div style={{
                        background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 8, padding: '10px 12px', marginBottom: 12,
                        fontSize: 13, color: '#fca5a5',
                    }}>
                        ⚠️ {error}
                    </div>
                )}

                {tab === 'summary' && (
                    <div>
                        <p style={{ margin: '0 0 12px 0', fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
                            Generate an AI-powered summary of the recent channel conversation.
                        </p>
                        <button onClick={handleSummarize} disabled={loading || !channelId} style={{
                            width: '100%', padding: '10px 0',
                            background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                            border: 'none', borderRadius: 8, color: '#fff',
                            fontSize: 14, fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
                            opacity: (!channelId || loading) ? 0.6 : 1,
                            fontFamily: 'inherit', transition: 'opacity 0.15s',
                        }}>
                            {loading ? 'Summarizing…' : '✨ Summarize Channel'}
                        </button>
                        {loading && <Spinner />}
                        {summary && <SummaryCard {...summary} />}
                    </div>
                )}

                {tab === 'actions' && (
                    <div>
                        <p style={{ margin: '0 0 10px 0', fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
                            Paste any text (message, meeting notes) to extract action items.
                        </p>
                        <textarea
                            value={actionText}
                            onChange={e => setActionText(e.target.value)}
                            placeholder="Paste message or meeting notes here…"
                            rows={5}
                            style={{
                                width: '100%', boxSizing: 'border-box',
                                background: 'var(--bg-hover)',
                                border: '1px solid rgba(139,92,246,0.25)', borderRadius: 8,
                                color: '#e2e8f0', fontSize: 13, padding: '8px 10px',
                                resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5,
                                outline: 'none',
                            }}
                        />
                        <button onClick={handleExtractActions} disabled={loading || !actionText.trim()} style={{
                            width: '100%', marginTop: 8, padding: '10px 0',
                            background: 'linear-gradient(135deg, #059669, #0284c7)',
                            border: 'none', borderRadius: 8, color: '#fff',
                            fontSize: 14, fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
                            opacity: (!actionText.trim() || loading) ? 0.6 : 1,
                            fontFamily: 'inherit', transition: 'opacity 0.15s',
                        }}>
                            {loading ? 'Extracting…' : '✅ Extract Action Items'}
                        </button>
                        {loading && <Spinner />}
                        {items.length > 0 && (
                            <>
                                <p style={{ margin: '12px 0 4px 0', fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
                                    FOUND {items.length} ITEM{items.length > 1 ? 'S' : ''}
                                </p>
                                <ActionItemsList items={items} />
                            </>
                        )}
                        {items.length === 0 && !loading && actionText && (
                            <p style={{ marginTop: 12, fontSize: 13, color: '#64748b', textAlign: 'center' }}>
                                No action items detected. Try with more specific text.
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Footer branding */}
            <div style={{
                padding: '10px 16px', borderTop: '1px solid rgba(139,92,246,0.1)',
                textAlign: 'center', fontSize: 11, color: '#475569',
            }}>
                Powered by Chttrix AI · Gemini 1.5 Flash
            </div>
        </div>
    );
}
