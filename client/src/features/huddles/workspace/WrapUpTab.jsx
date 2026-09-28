import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Send, Loader2, RotateCcw, CheckCircle2, Eye, Pencil } from 'lucide-react';
import { useMessageActions } from '../../../hooks/useMessageActions';
import { aiService, aiErrorMessage } from '../../../services/aiService';
import MessageMarkdown from '../../../shared/components/messages/MessageMarkdown';
import { useToast } from '../../../contexts/ToastContext';
import { huddleApi, errorText } from './huddleApi';
import { buildWrapUp, notesAsText } from './wrapUp';

const AI_INSTRUCTION = 'Summarise this huddle for the team in 3 to 5 short Markdown bullet points: decisions made, open questions, and who owns what next. Use only what the notes say. Return only the bullet points.';

/**
 * Post the huddle's wrap-up to its channel (or DM): duration, people, notes
 * link, action items and task changes, plus an optional summary written by
 * Oruinwan AI (our own engine) from the notes. Everything is editable before
 * posting; the message goes through the normal end-to-end encrypted send path,
 * then the server notifies everyone who was in the call.
 */
export default function WrapUpTab({
    huddleId, workspaceId, title, durationSec, participants, notes, notesHref, taskChanges,
    target, channels, onPickChannel, session, onPosted, targetHref,
}) {
    const { showToast } = useToast();
    const { sendMessage } = useMessageActions(target?.id || null, target?.type || 'channel', workspaceId);
    const [summary, setSummary] = useState('');
    const [aiBusy, setAiBusy] = useState(false);
    const [aiError, setAiError] = useState(null);
    const [message, setMessage] = useState('');
    const [edited, setEdited] = useState(false);
    const [preview, setPreview] = useState(false);
    const [posting, setPosting] = useState(false);
    const [posted, setPosted] = useState(null);

    const notesText = useMemo(() => notesAsText(notes), [notes]);
    const generated = useMemo(() => buildWrapUp({
        title,
        durationSec,
        participants,
        summary,
        actions: notes.actions.map((a) => ({ text: a.text, done: a.done, taskKey: taskChanges.find((t) => t.id === a.taskId)?.key })),
        tasks: taskChanges,
        notesUrl: notesHref ? `${window.location.origin}${notesHref}` : null,
        notesTitle: notes.title,
    }), [title, durationSec, participants, summary, notes.actions, notes.title, taskChanges, notesHref]);

    // The message follows the data until someone edits it by hand.
    const editedRef = useRef(edited);
    editedRef.current = edited;
    useEffect(() => { if (!editedRef.current) setMessage(generated); }, [generated]);

    const summarise = async () => {
        if (!notesText.trim()) { setAiError('Write some notes first: the summary is made from them.'); return; }
        setAiBusy(true);
        setAiError(null);
        try {
            const res = await aiService.noteAssist({ workspaceId, action: 'custom', text: notesText, title, instruction: AI_INSTRUCTION });
            setSummary(String(res?.text || '').trim());
        } catch (err) {
            setAiError(aiErrorMessage(err, 'Oruinwan AI could not summarise the notes right now.'));
        } finally {
            setAiBusy(false);
        }
    };

    const post = async () => {
        const text = message.trim();
        if (!text || !target?.id || posting) return;
        setPosting(true);
        try {
            const res = await sendMessage({ text });
            if (!res?.success || !res.message?._id) {
                showToast(res?.message || res?.error || 'Could not post the summary.', 'error');
                return;
            }
            let notified = 0;
            try {
                const out = await huddleApi.wrapUp(huddleId, res.message._id);
                notified = out?.notified || 0;
            } catch (err) {
                showToast(errorText(err, 'The summary was posted, but participants could not be notified.'), 'info');
            }
            setPosted({ messageId: res.message._id, notified });
            onPosted?.(res.message);
            showToast(notified ? `Summary posted. ${notified} ${notified === 1 ? 'person was' : 'people were'} notified.` : 'Summary posted.', 'success');
        } finally {
            setPosting(false);
        }
    };

    const alreadyPosted = posted || session?.summary;

    return (
        <div data-testid="huddle-wrapup">
            {target?.type !== 'dm' && (
                <>
                    <div className="hw-section"><span>Post to</span></div>
                    {channels && !session?.channelId ? (
                        <select className="hw-select" style={{ width: '100%', height: 32 }} value={target?.id || ''} aria-label="Channel for the summary"
                            onChange={(e) => onPickChannel?.(e.target.value || null)}>
                            <option value="">Choose a channel…</option>
                            {channels.map((c) => <option key={c.id} value={c.id}># {c.label}</option>)}
                        </select>
                    ) : (
                        <p className="hw-muted" style={{ margin: 0 }}># {target?.name || 'this channel'}</p>
                    )}
                </>
            )}

            <div className="hw-section"><span>Summary (optional)</span></div>
            <textarea className="hw-textarea" value={summary} onChange={(e) => setSummary(e.target.value)} aria-label="Summary"
                placeholder="A few lines on what was decided. Or let Oruinwan AI draft it from the notes." style={{ minHeight: 70 }} />
            <div className="hw-row" style={{ marginTop: 6 }}>
                <button type="button" className="gl-btn gl-btn--sm" onClick={summarise} disabled={aiBusy} data-testid="huddle-ai-summary">
                    {aiBusy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {aiBusy ? 'Summarising…' : 'Summarise with Oruinwan AI'}
                </button>
                <span className="hw-muted" style={{ fontSize: 11 }}>Runs on Oruinwan's own engine.</span>
            </div>
            {aiError && <p className="hw-error" role="alert" style={{ marginTop: 6 }}>{aiError}</p>}

            <div className="hw-section">
                <span>Message</span>
                <button type="button" className="gl-icon-btn" aria-pressed={preview} title={preview ? 'Edit' : 'Preview'} aria-label={preview ? 'Edit message' : 'Preview message'} onClick={() => setPreview((v) => !v)}>
                    {preview ? <Pencil size={12} /> : <Eye size={12} />}
                </button>
                {edited && (
                    <button type="button" className="gl-icon-btn" title="Rebuild from the notes and tasks" aria-label="Rebuild message" onClick={() => { setEdited(false); setMessage(generated); }}>
                        <RotateCcw size={12} />
                    </button>
                )}
            </div>
            {preview
                ? <div className="hw-preview"><MessageMarkdown text={message} /></div>
                : (
                    <textarea className="hw-textarea" value={message} aria-label="Wrap-up message" style={{ minHeight: 180, fontFamily: 'var(--font-mono, ui-monospace, monospace)', fontSize: 12 }}
                        onChange={(e) => { setEdited(true); setMessage(e.target.value); }} />
                )}

            {alreadyPosted && (
                <div className="hw-success" style={{ marginTop: 10 }} data-testid="huddle-wrapup-posted">
                    <CheckCircle2 size={14} style={{ color: 'var(--state-success)' }} />
                    <span className="hw-grow">
                        Summary posted{posted?.notified ? `; ${posted.notified} notified` : ''}.
                        {targetHref && <> <a href={targetHref} style={{ color: 'var(--accent)' }}>View</a></>}
                    </span>
                </div>
            )}

            <button type="button" className="gl-btn gl-btn--primary gl-btn--block" style={{ marginTop: 12 }} onClick={post}
                disabled={!message.trim() || !target?.id || posting} data-testid="huddle-post-summary">
                {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {alreadyPosted ? 'Post again' : `Post summary to ${target?.type === 'dm' ? 'the conversation' : 'channel'}`}
            </button>
            <p className="hw-muted" style={{ marginTop: 8, fontSize: 11 }}>Posted as you, end-to-end encrypted like any message. Everyone who was in the huddle gets a notification.</p>
        </div>
    );
}
