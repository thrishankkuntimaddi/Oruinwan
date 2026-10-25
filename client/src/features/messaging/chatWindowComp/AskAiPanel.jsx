import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, Sparkles, X } from 'lucide-react';
import aiService from '../../../services/aiService';

const SUGGESTIONS = ['What did I miss?', 'Any decisions?', 'What is open for me?'];

/**
 * The messages on screen as the AI reads them: [{ sender, text }], oldest first. Only what this
 * browser decrypted is sent (the conversation stays end-to-end encrypted on the server).
 */
export function chatTranscript(events = [], limit = 200) {
    return events
        .filter((e) => e && e.type !== 'system' && !e.payload?.isDeleted)
        .map((e) => ({
            sender: e.sender?.username || e.payload?.sender?.username || e.backend?.sender?.username || 'Someone',
            text: String(e.decryptedContent || e.payload?.decryptedContent || e.text || e.payload?.text || '').trim(),
        }))
        .filter((m) => m.text)
        .slice(-limit);
}

/** "Ask AI about this chat": a small floating panel under the conversation header. */
export default function AskAiPanel({ events, title, workspaceId, onClose }) {
    const [q, setQ] = useState('');
    const [busy, setBusy] = useState(false);
    const [answer, setAnswer] = useState(null); // { q, text } | { q, error }
    const input = useRef(null);
    useEffect(() => { input.current?.focus(); }, []);
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const ask = async (question) => {
        const text = String(question || q).trim();
        if (!text || busy) return;
        const messages = chatTranscript(events);
        if (!messages.length) { setAnswer({ q: text, error: 'There are no messages here to ask about yet.' }); return; }
        setBusy(true);
        setAnswer(null);
        try {
            const res = await aiService.conversation({ workspaceId, messages, mode: 'question', question: text, title });
            const reply = res?.answer || res?.text || res?.data?.answer || res?.data?.text || res?.result || '';
            setAnswer({ q: text, text: reply || 'No answer came back.' });
            setQ('');
        } catch (err) {
            setAnswer({ q: text, error: err?.response?.data?.message || err?.message || 'Oruinwan AI could not answer.' });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="gl-card" role="dialog" aria-label="Ask AI about this chat" data-testid="ask-ai-panel"
            style={{ position: 'absolute', top: 64, right: 16, width: 'min(420px, calc(100% - 32px))', zIndex: 30, padding: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Sparkles size={15} style={{ color: 'var(--accent)' }} />
                <strong style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Ask about {title || 'this chat'}</strong>
                <button type="button" aria-label="Close" onClick={onClose} className="gl-btn gl-btn--ghost gl-btn--sm"><X size={14} /></button>
            </div>
            {(answer || busy) && (
                <div aria-live="polite" style={{ maxHeight: '40vh', overflowY: 'auto', fontSize: 13.5, lineHeight: 1.6, marginBottom: 8 }}>
                    {answer?.q && <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--text-muted)' }}>“{answer.q}”</p>}
                    {busy ? <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Reading the conversation…</p>
                        : answer?.error ? <p style={{ margin: 0, color: 'var(--state-danger)' }}>{answer.error}</p>
                            : <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{answer.text}</p>}
                </div>
            )}
            {!answer && !busy && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {SUGGESTIONS.map((s) => (
                        <button key={s} type="button" className="gl-btn gl-btn--sm" onClick={() => ask(s)}>{s}</button>
                    ))}
                </div>
            )}
            <form style={{ display: 'flex', gap: 6 }} onSubmit={(e) => { e.preventDefault(); ask(); }}>
                <input ref={input} className="gl-input" style={{ flex: 1 }} value={q} onChange={(e) => setQ(e.target.value)}
                    placeholder={answer ? 'Ask a follow-up' : 'Ask anything about this conversation'} aria-label="Ask Oruinwan AI about this conversation" />
                <button type="submit" className="gl-btn gl-btn--primary" aria-label="Ask" disabled={!q.trim() || busy}><ArrowUp size={15} /></button>
            </form>
        </div>
    );
}
