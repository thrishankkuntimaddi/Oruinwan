import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, CheckSquare, CalendarClock, BookOpen, CornerDownLeft, ArrowRight, AlertTriangle, Loader2, ListTodo } from 'lucide-react';
import { Chip } from '../ui/page';
import './aiPalette.css';

const EXAMPLES = [
    { Icon: CheckSquare, text: 'Create task for design review tomorrow' },
    { Icon: Sparkles, text: 'Summarize this channel' },
    { Icon: CalendarClock, text: 'Schedule a meeting for Q2 planning' },
    { Icon: BookOpen, text: 'What are our coding standards?' },
];

const INTENT = {
    create_task: { tone: 'success', Icon: CheckSquare },
    generate_tasks: { tone: 'success', Icon: ListTodo },
    summarize_channel: { tone: 'accent', Icon: Sparkles },
    schedule_meeting: { tone: 'accent', Icon: CalendarClock },
    ask_question: { tone: 'warning', Icon: BookOpen },
    unknown: { tone: undefined, Icon: Sparkles },
};

/**
 * ⌘/ quick launcher: hands the command to the Oruinwan AI panel, which runs it
 * with the full assistant (streaming answer, workspace tools, memory).
 */
export default function AICommandBox({ workspaceId, isOpen, onClose }) {
    const [command, setCommand] = useState('');
    const [result, setResult]   = useState(null);
    const loading = false; // the command runs in the AI panel, not here
    const [error, setError]     = useState(null);
    const inputRef = useRef(null);

    useEffect(() => { if (isOpen) { inputRef.current?.focus(); setCommand(''); setResult(null); setError(null); } }, [isOpen]);

    useEffect(() => {
        const handler = e => { if (e.key === 'Escape') onClose?.(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const handleSubmit = async (text = command) => {
        if (!text.trim() || loading) return;
        if (!workspaceId) { setError('Open a workspace first, then try again.'); return; }
        window.dispatchEvent(new CustomEvent('oruinwan-ai:open', { detail: { prompt: text.trim() } }));
        onClose?.();
    };

    if (!isOpen) return null;

    const intent = INTENT[result?.intent] || INTENT.unknown;

    return (
        <div className="aip-backdrop" onClick={e => e.target === e.currentTarget && onClose?.()}>
            <div className="aip" role="dialog" aria-modal="true" aria-label="Ask Oruinwan AI">
                <div className="aip-bar">
                    <span className="aip-mark" aria-hidden="true"><Sparkles size={15} /></span>
                    <input
                        ref={inputRef}
                        className="aip-input"
                        type="text" value={command}
                        onChange={e => { setCommand(e.target.value); setResult(null); setError(null); }}
                        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                        placeholder="Ask or tell Oruinwan AI to do something"
                        aria-label="Command for Oruinwan AI"
                    />
                    {loading && <Loader2 size={16} className="cd-spin" style={{ color: 'var(--accent)' }} />}
                    <button
                        type="button"
                        className="gl-btn gl-btn--primary gl-btn--sm"
                        onClick={() => handleSubmit()}
                        disabled={loading || !command.trim()}
                    >
                        Ask <CornerDownLeft size={12} />
                    </button>
                </div>

                {error && <div className="aip-error" role="alert"><AlertTriangle size={14} /> {error}</div>}

                {result && (
                    <div className="aip-result-box">
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <intent.Icon size={14} style={{ color: 'var(--accent)' }} />
                            <Chip tone={intent.tone}>{(result.intent || 'unknown').replace(/_/g, ' ')}</Chip>
                        </span>
                        <p style={{ margin: 0 }}>{result.result?.message || 'Done.'}</p>
                        {result.result?.task && (
                            <div className="aip-note"><strong>Task:</strong> {result.result.task.title}</div>
                        )}
                        {result.result?.tasks?.length > 0 && (
                            <ul style={{ margin: 0, paddingLeft: 18, listStyle: 'disc' }}>
                                {result.result.tasks.map((t, i) => <li key={i}>{t}</li>)}
                            </ul>
                        )}
                        {result.result?.suggested && (
                            <div className="aip-note">
                                <strong>Suggested time:</strong> {new Date(result.result.suggested.suggestedStart).toLocaleString()}
                            </div>
                        )}
                    </div>
                )}

                {!result && !loading && !command && (
                    <div className="aip-section">
                        <span className="aip-cap">Try</span>
                        {EXAMPLES.map(({ Icon, text }) => (
                            <button key={text} type="button" className="aip-row" onClick={() => { setCommand(text); inputRef.current?.focus(); }}>
                                <Icon size={15} aria-hidden="true" />
                                {text}
                                <span className="aip-row-end" style={{ fontSize: 11 }}>Use <ArrowRight size={11} style={{ verticalAlign: -1 }} /></span>
                            </button>
                        ))}
                    </div>
                )}

                <div className="aip-foot">
                    <span>Opens in the AI panel with your workspace as context.</span>
                    <span className="aip-hide-sm"><kbd className="aip-kbd">Esc</kbd> to close</span>
                </div>
            </div>
        </div>
    );
}
