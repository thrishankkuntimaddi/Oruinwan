import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MessageSquare, FileText, NotebookPen, CheckSquare, CalendarClock, Loader2, AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import { Chip } from '../ui/page';
import './aiPalette.css';

const TYPE_ICONS = { message: MessageSquare, knowledge: FileText, note: NotebookPen, task: CheckSquare, meeting: CalendarClock };
const TYPE_LABELS = { message: 'Message', knowledge: 'Page', note: 'Note', task: 'Task', meeting: 'Meeting' };
const TYPE_TONE = { knowledge: 'success', meeting: 'accent' };
const SUGGESTIONS = ['meeting notes', 'design review', 'Q2 roadmap', 'onboarding'];

async function apiSearch(query, workspaceId) {
    const { data } = await api.post('/api/ai/search', { query, workspaceId });
    return data;
}

export default function AISearchBar({ workspaceId, onClose }) {
    const [query, setQuery]     = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState(null);
    const inputRef              = useRef(null);
    const debounceRef           = useRef(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const runSearch = useCallback(async (q) => {
        if (!q.trim() || q.trim().length < 2) { setResults([]); return; }
        setLoading(true); setError(null);
        try {
            const data = await apiSearch(q.trim(), workspaceId);
            setResults(data.results || []);
        } catch { setError('Search is unavailable right now. Try again in a moment.'); setResults([]); }
        finally { setLoading(false); }
    }, [workspaceId]);

    const handleChange = (e) => {
        const q = e.target.value;
        setQuery(q);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => runSearch(q), 400);
    };

    return (
        <div className="aip-backdrop" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
            <div className="aip" role="dialog" aria-modal="true" aria-label="Search with AI">
                <div className="aip-bar">
                    <span className="aip-mark" aria-hidden="true"><Search size={15} /></span>
                    <input
                        ref={inputRef}
                        className="aip-input"
                        type="search"
                        value={query}
                        onChange={handleChange}
                        placeholder="Search messages, pages and meetings"
                        aria-label="Search"
                    />
                    {loading && <Loader2 size={16} className="cd-spin" style={{ color: 'var(--accent)' }} />}
                    <kbd className="aip-kbd">Esc</kbd>
                </div>

                {error && <div className="aip-error" role="alert"><AlertTriangle size={14} /> {error}</div>}
                {!loading && !error && results.length === 0 && query.length >= 2 && (
                    <div className="aip-empty">Nothing found for “{query}”. Try fewer or different words.</div>
                )}
                {results.length > 0 && (
                    <ul className="aip-results">
                        {results.map((r, i) => {
                            const Icon = TYPE_ICONS[r.type] || Search;
                            return (
                                <li key={r.id || i}>
                                    <div className="aip-row aip-result" role="button" tabIndex={0}>
                                        <span className="aip-result-icon" aria-hidden="true"><Icon size={14} /></span>
                                        <div style={{ minWidth: 0 }}>
                                            <div className="aip-result-title">{r.title}</div>
                                            <div className="aip-result-snip">
                                                {r.snippet?.substring(0, 120)}{r.snippet?.length > 120 ? '…' : ''}
                                            </div>
                                            <div style={{ marginTop: 4 }}><Chip tone={TYPE_TONE[r.type]}>{TYPE_LABELS[r.type] || r.type}</Chip></div>
                                        </div>
                                        {r.score > 0 && <span className="aip-result-score" title="Match">{Math.round(r.score * 100)}%</span>}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {!query && (
                    <div className="aip-section">
                        <span className="aip-cap">Search across your workspace</span>
                        <div className="aip-chips">
                            {SUGGESTIONS.map(s => (
                                <button key={s} type="button" className="aip-chip" onClick={() => { setQuery(s); runSearch(s); }}>{s}</button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
