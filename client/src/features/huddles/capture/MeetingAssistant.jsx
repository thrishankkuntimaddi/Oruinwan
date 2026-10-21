import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Loader2, ListChecks } from 'lucide-react';
import { aiService, aiErrorMessage } from '../../../services/aiService';
import { captureApi, errorText } from './captureApi';
import { QUICK_ASKS, assistantRequest, normaliseActionItems } from './meetingAi';
import { isMarker } from './captions';
import './capture.css';

/**
 * Ask the AI about a meeting, answered from its transcript (sent as context to
 * /api/ai/conversation). With `ended`, it also offers the summary and action
 * items from the meeting/huddle summarize endpoints.
 *
 * Props: segments (transcript so far), target (captureTarget), workspaceId,
 * title, myId, ended, names ({ userId: name } for action item assignees).
 */
export default function MeetingAssistant({ segments = [], target, workspaceId, title, myId, ended = false, names = {} }) {
    const [question, setQuestion] = useState('');
    const [thread, setThread] = useState([]); // { q, a, error }
    const [busy, setBusy] = useState(false);
    const [wrap, setWrap] = useState({ loading: false, summary: '', actionItems: [], note: '', error: null, done: false });
    const endRef = useRef(null);
    useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'nearest' }); }, [thread.length]);

    const spoken = segments.filter((s) => s?.text && !isMarker(s));
    const hasTranscript = spoken.length > 0;

    const ask = async ({ q, mode, label }) => {
        const body = assistantRequest({ workspaceId, segments, question: q, mode, title, myId });
        if (!body) return;
        setBusy(true);
        const entry = { q: label || q };
        setThread((t) => [...t, entry]);
        try {
            const res = await aiService.conversation(body);
            const items = Array.isArray(res?.items) && res.items.length ? `\n${res.items.map((i) => `• ${typeof i === 'string' ? i : (i.text || i.title || '')}`).join('\n')}` : '';
            entry.a = `${res?.text || ''}${items}`.trim() || 'No answer.';
        } catch (err) {
            entry.error = aiErrorMessage(err, 'The assistant could not answer.');
        } finally {
            setThread((t) => t.map((x) => (x === entry ? { ...entry } : x)));
            setBusy(false);
        }
    };

    const submit = (e) => {
        e.preventDefault();
        const q = question.trim();
        if (!q || busy) return;
        setQuestion('');
        ask({ q, mode: 'question' });
    };

    const loadWrapUp = async () => {
        if (!target) return;
        setWrap((w) => ({ ...w, loading: true, error: null }));
        try {
            const res = await captureApi.summarize(target);
            let actionItems = normaliseActionItems(res?.actionItems, names);
            if (target.kind === 'meeting' && !res?.actionItems) {
                const ex = await captureApi.extractActionItems(target, false).catch(() => null);
                actionItems = normaliseActionItems(ex?.extracted, names);
            }
            setWrap({
                loading: false, done: true, error: null, summary: res?.summary || '', actionItems,
                note: res?.aiFallback ? 'No AI provider is set up, so this is a plain excerpt of the transcript.' : '',
            });
        } catch (err) {
            setWrap((w) => ({ ...w, loading: false, error: errorText(err, 'Could not summarise the meeting') }));
        }
    };

    return (
        <div className="cc-chat" data-testid="meeting-assistant">
            {ended && (
                <div>
                    <div className="hw-section"><span>Summary & action items</span></div>
                    {!wrap.done && (
                        <button type="button" className="gl-btn gl-btn--sm gl-btn--primary" onClick={loadWrapUp} disabled={wrap.loading} data-testid="assistant-wrapup">
                            {wrap.loading ? <Loader2 size={12} className="animate-spin" /> : <ListChecks size={12} />} Summarise the meeting
                        </button>
                    )}
                    {wrap.error && <p className="hw-error">{wrap.error}</p>}
                    {wrap.done && (
                        <>
                            <div className="cc-msg">{wrap.summary || 'Nothing to summarise yet.'}</div>
                            {wrap.note && <p className="cc-note">{wrap.note}</p>}
                            {wrap.actionItems.length > 0 ? (
                                <ul className="cc-actions-list" style={{ marginTop: 8 }}>
                                    {wrap.actionItems.map((a, i) => <li key={i}>{a.text}{a.assignee ? ` — ${a.assignee}` : ''}</li>)}
                                </ul>
                            ) : <p className="cc-note">No action items found.</p>}
                        </>
                    )}
                </div>
            )}

            <div className="hw-section"><span>Ask about this meeting</span></div>
            {!hasTranscript ? (
                <p className="hw-muted" data-testid="assistant-no-transcript">
                    The assistant answers from the transcript. {ended ? 'This meeting has none.' : 'Turn on live captions so there is something to go on.'}
                </p>
            ) : (
                <>
                    <div className="cc-controls">
                        {QUICK_ASKS.map((qa) => (
                            <button key={qa.id} type="button" className="gl-btn gl-btn--sm" disabled={busy} onClick={() => ask({ mode: qa.mode, label: qa.label })}>
                                <Sparkles size={12} /> {qa.label}
                            </button>
                        ))}
                    </div>
                    {thread.map((t, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div className="cc-msg cc-msg--q"><span className="cc-msg-label">You asked</span>{t.q}</div>
                            {t.error ? <p className="hw-error" role="alert">{t.error}</p>
                                : t.a ? <div className="cc-msg"><span className="cc-msg-label">Assistant</span>{t.a}</div>
                                    : <p className="hw-muted"><Loader2 size={12} className="animate-spin" /> Thinking…</p>}
                        </div>
                    ))}
                    <div ref={endRef} />
                    <form className="cc-ask" onSubmit={submit}>
                        <input className="gl-input" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What did we decide about…?" aria-label="Ask the assistant" maxLength={1000} />
                        <button type="submit" className="gl-btn gl-btn--primary" disabled={busy || !question.trim()} aria-label="Ask">
                            {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                        </button>
                    </form>
                    <p className="cc-note">Answers use only the transcript so far ({spoken.length} lines). AI can make mistakes.</p>
                </>
            )}
        </div>
    );
}
