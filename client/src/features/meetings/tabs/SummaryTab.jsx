import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Sparkles, Pencil, Save, X, Send, CheckCircle2, ListChecks, Plus, Trash2, ExternalLink, ListTodo,
} from 'lucide-react';
import { Btn, Chip, EmptyState, IconBtn } from '../../../components/ui/page';
import { useToast } from '../../../contexts/ToastContext';
import { useContacts } from '../../../contexts/ContactsContext';
import { useMessageActions } from '../../../hooks/useMessageActions';
import MeetingAssistant from '../../huddles/capture/MeetingAssistant';
import { huddleApi } from '../../huddles/workspace/huddleApi';
import { buildWrapUp } from '../../huddles/workspace/wrapUp';
import {
    normaliseSummary, summarySourceLabel, normaliseActionItems, meetingPeople, meetingConversation,
    conversationLabel, meetingTimes, meetingTitle, meetingPath, meetingIdOf, errorText,
} from '../meetingModel';

const toDateInput = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
};
const ago = (d) => {
    if (!d) return '';
    const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    return h < 24 ? `${h} h ago` : new Date(d).toLocaleDateString([], { dateStyle: 'medium' });
};

/** The summary: read, generate with AI, edit by hand. */
export function SummaryBlock({ meeting, onSummarize, onSave, readOnly = false }) {
    const { showToast } = useToast();
    const summary = normaliseSummary(meeting.summary);
    const text = summary?.text || '';
    const [busy, setBusy] = useState(false);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [saving, setSaving] = useState(false);

    const generate = async () => {
        setBusy(true);
        try {
            const res = await onSummarize();
            if (res?.source === 'none') showToast('Nothing to summarise yet: add notes, an agenda or a transcript.', 'info');
            else showToast(res?.aiFallback ? 'Summary written (no AI provider is set up, so it is a plain excerpt).' : 'Summary ready', 'success');
        } catch (err) {
            showToast(errorText(err, 'Could not write a summary'), 'error');
        } finally {
            setBusy(false);
        }
    };
    const save = async () => {
        setSaving(true);
        try {
            await onSave(draft.trim());
            setEditing(false);
            showToast('Summary saved', 'success');
        } catch (err) {
            showToast(errorText(err, 'Could not save the summary'), 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mt-stack" style={{ gap: 8 }} data-testid="meeting-summary">
            <p className="mt-label">
                <span>Summary</span>
                {text && !editing && <span className="mt-muted" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500, fontSize: 11 }}>{summarySourceLabel(summary)}{summary?.generatedAt ? ` · ${ago(summary.generatedAt)}` : ''}</span>}
            </p>
            {editing ? (
                <>
                    <textarea className="mt-textarea" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Summary" autoFocus
                        placeholder="What was decided, open questions, who does what next." />
                    <div className="mt-row">
                        <Btn variant="primary" size="sm" icon={Save} onClick={save} loading={saving} disabled={!draft.trim()}>Save summary</Btn>
                        <Btn size="sm" variant="ghost" icon={X} onClick={() => setEditing(false)}>Cancel</Btn>
                    </div>
                </>
            ) : text ? (
                <div className="mt-summary" data-testid="meeting-summary-text">{text}</div>
            ) : (
                <p className="mt-muted">No summary yet. Oruinwan AI writes it from the transcript, the notes and the agenda.</p>
            )}
            {!editing && !readOnly && (
                <div className="mt-row">
                    <Btn size="sm" variant={text ? undefined : 'primary'} icon={Sparkles} onClick={generate} loading={busy} data-testid="meeting-summarize">
                        {busy ? 'Writing…' : text ? 'Regenerate' : 'Generate summary'}
                    </Btn>
                    <Btn size="sm" variant="ghost" icon={Pencil} onClick={() => { setDraft(text); setEditing(true); }}>{text ? 'Edit' : 'Write it yourself'}</Btn>
                </div>
            )}
        </div>
    );
}

/** "Post summary to #channel": the wrap-up message in the meeting's conversation (E2EE send path). */
export function PostSummary({ meeting, workspaceId }) {
    const { showToast } = useToast();
    const contacts = useContacts() || {};
    const conv = meetingConversation(meeting);
    const [picked, setPicked] = useState('');
    const channels = useMemo(() => (contacts.channels || []).filter((c) => c.isMember !== false), [contacts.channels]);
    const target = conv.kind === 'channel' || conv.kind === 'dm'
        ? { type: conv.kind, id: conv.id, name: conv.name }
        : (() => { const c = channels.find((x) => String(x.id) === String(picked)); return c ? { type: 'channel', id: String(c.id), name: c.label } : null; })();
    const { sendMessage } = useMessageActions(target?.id || null, target?.type || 'channel', workspaceId);
    const [posting, setPosting] = useState(false);
    const [posted, setPosted] = useState(null);
    const summary = normaliseSummary(meeting.summary);
    const text = summary?.text || '';
    const items = normaliseActionItems(meeting.actionItems);
    const people = meetingPeople(meeting);
    const { durationSec } = meetingTimes(meeting);
    const label = target?.type === 'dm' ? 'the conversation' : target?.name ? `#${String(target.name).replace(/^#\s*/, '')}` : 'a channel';
    const already = posted || summary?.messageId;

    const post = async () => {
        if (!target?.id || !meeting.huddleId || posting) return;
        const page = meetingPath(workspaceId, meetingIdOf(meeting));
        const message = buildWrapUp({
            title: meetingTitle(meeting),
            durationSec: Number.isFinite(durationSec) ? durationSec : null,
            participants: people.map((p) => p.name),
            summary: text,
            actions: items.map((a) => ({ text: a.text, done: a.done })),
            notesUrl: page ? `${window.location.origin}${page}` : null,
            notesTitle: 'Meeting page',
        });
        setPosting(true);
        try {
            const res = await sendMessage({ text: message });
            if (!res?.success || !res.message?._id) { showToast(res?.message || res?.error || 'Could not post the summary.', 'error'); return; }
            let notified = 0;
            try {
                const out = await huddleApi.wrapUp(meeting.huddleId, res.message._id, text || undefined);
                notified = out?.notified || 0;
            } catch (err) {
                showToast(errorText(err, 'The summary was posted, but people could not be notified.'), 'info');
            }
            setPosted({ notified });
            showToast(notified ? `Summary posted. ${notified} ${notified === 1 ? 'person was' : 'people were'} notified.` : 'Summary posted.', 'success');
        } finally {
            setPosting(false);
        }
    };

    if (!meeting.huddleId) return null;
    return (
        <div className="mt-stack" style={{ gap: 8 }} data-testid="meeting-post-summary">
            <p className="mt-label"><span>Share</span></p>
            {conv.kind === 'workspace' && (
                <select className="mt-select" style={{ height: 32 }} value={picked} onChange={(e) => setPicked(e.target.value)} aria-label="Channel for the summary">
                    <option value="">Choose a channel…</option>
                    {channels.map((c) => <option key={c.id} value={c.id}># {c.label}</option>)}
                </select>
            )}
            {already && (
                <div className="mt-success" data-testid="meeting-summary-posted">
                    <CheckCircle2 size={14} style={{ color: 'var(--state-success)' }} />
                    <span className="mt-grow">Summary posted{posted?.notified ? `; ${posted.notified} notified` : ''}.</span>
                </div>
            )}
            <Btn icon={Send} onClick={post} loading={posting} disabled={!target?.id || (!text && !items.length)} data-testid="meeting-post-summary-btn">
                {already ? 'Post again' : `Post summary to ${label}`}
            </Btn>
            <p className="mt-muted" style={{ fontSize: 11 }}>Posted as you, end-to-end encrypted like any message, with the action items and a link to this page. Everyone who was in the huddle is notified.</p>
        </div>
    );
}

/** The one action item list: add, edit, assign, due date, done, convert to task, delete. */
export function ActionItems({ meeting, workspaceId, record, readOnly = false }) {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const items = normaliseActionItems(meeting.actionItems);
    const people = meetingPeople(meeting);
    const names = useMemo(() => Object.fromEntries(people.map((p) => [p.id, p.name])), [people]);
    const [text, setText] = useState('');
    const [adding, setAdding] = useState(false);
    const [editing, setEditing] = useState(null); // { id, text }
    const [busyId, setBusyId] = useState(null);
    const [extracting, setExtracting] = useState(false);

    const run = async (id, fn, fail) => {
        setBusyId(id);
        try { return await fn(); } catch (err) { showToast(errorText(err, fail), 'error'); return null; } finally { setBusyId(null); }
    };
    const add = async () => {
        const t = text.trim();
        if (!t) return;
        setAdding(true);
        try { await record.addActionItem({ text: t }); setText(''); } catch (err) { showToast(errorText(err, 'Could not add the action item'), 'error'); } finally { setAdding(false); }
    };
    const saveText = async () => {
        if (!editing) return;
        const t = editing.text.trim();
        const { id } = editing;
        setEditing(null);
        const before = items.find((a) => a.id === id);
        if (!t || t === before?.text) return;
        await run(id, () => record.updateActionItem(id, { text: t }), 'Could not update the action item');
    };
    const convert = async (a) => {
        const res = await run(a.id, () => record.convertActionItem(a.id, {}), 'Could not create a task');
        if (res?.task) showToast('Task created', 'success');
        else if (res?.alreadyConverted) showToast('This item already has a task', 'info');
    };
    const extract = async () => {
        setExtracting(true);
        try {
            const res = await record.extractActionItems();
            showToast(res?.added ? `Added ${res.added} action item${res.added === 1 ? '' : 's'}` : 'No new action items found', res?.added ? 'success' : 'info');
        } catch (err) {
            showToast(errorText(err, 'Could not find action items'), 'error');
        } finally {
            setExtracting(false);
        }
    };

    const open = items.filter((a) => !a.done).length;
    return (
        <div className="mt-stack" style={{ gap: 8 }} data-testid="meeting-action-items">
            <p className="mt-label">
                <span>Action items</span>
                {items.length > 0 && <Chip tone={open ? 'accent' : 'success'}>{open ? `${open} open` : 'All done'}</Chip>}
            </p>
            {!readOnly && (
                <div className="mt-add">
                    <input className="gl-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add an action item…" aria-label="New action item"
                        maxLength={500} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
                    <Btn icon={Plus} onClick={add} loading={adding} disabled={!text.trim()} data-testid="action-item-add">Add</Btn>
                </div>
            )}
            {items.length === 0 ? (
                <EmptyState icon={ListTodo} title="No action items yet" text="Add them as you go, or let Oruinwan find them in the transcript." />
            ) : items.map((a) => (
                <div key={a.id} className={`mt-item${a.done ? ' is-done' : ''}`} data-testid="action-item">
                    <input type="checkbox" checked={a.done} disabled={readOnly || busyId === a.id} aria-label={a.done ? 'Mark as not done' : 'Mark as done'}
                        onChange={() => run(a.id, () => record.toggleActionItem(a.id), 'Could not update the action item')} />
                    <div className="mt-grow">
                        {editing?.id === a.id ? (
                            <input className="gl-input" autoFocus value={editing.text} aria-label="Action item"
                                onChange={(e) => setEditing({ id: a.id, text: e.target.value })} onBlur={saveText}
                                onKeyDown={(e) => { if (e.key === 'Enter') saveText(); if (e.key === 'Escape') setEditing(null); }} />
                        ) : (
                            <p className="mt-item-text" onDoubleClick={readOnly ? undefined : () => setEditing({ id: a.id, text: a.text })}>{a.text}</p>
                        )}
                        <div className="mt-item-meta">
                            {readOnly ? (
                                <>
                                    {a.assigneeId && <Chip>{names[a.assigneeId] || a.assigneeName || 'Assigned'}</Chip>}
                                    {a.dueDate && <Chip>Due {new Date(a.dueDate).toLocaleDateString([], { dateStyle: 'medium' })}</Chip>}
                                </>
                            ) : (
                                <>
                                    <select className="mt-select" value={a.assigneeId || ''} aria-label="Assignee" disabled={busyId === a.id}
                                        onChange={(e) => run(a.id, () => record.updateActionItem(a.id, { assigneeId: e.target.value || null }), 'Could not assign the action item')}>
                                        <option value="">Unassigned</option>
                                        {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        {a.assigneeId && !names[a.assigneeId] && <option value={a.assigneeId}>{a.assigneeName || 'Someone'}</option>}
                                    </select>
                                    <input type="date" className="mt-date" value={toDateInput(a.dueDate)} aria-label="Due date" disabled={busyId === a.id}
                                        onChange={(e) => run(a.id, () => record.updateActionItem(a.id, { dueDate: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null }), 'Could not set the due date')} />
                                </>
                            )}
                            {a.source === 'ai' && <Chip tone="accent">Found by AI</Chip>}
                            {a.taskId ? (
                                <button type="button" className="gl-x-link" onClick={() => navigate(`/workspace/${workspaceId}/tasks/${a.taskId}`)}>
                                    <ExternalLink size={11} /> Task
                                </button>
                            ) : !readOnly && (
                                <button type="button" className="gl-x-link" onClick={() => convert(a)} disabled={busyId === a.id} data-testid="action-item-convert">
                                    <ListTodo size={11} /> Convert to task
                                </button>
                            )}
                        </div>
                    </div>
                    {!readOnly && (
                        <span className="mt-item-tools">
                            <IconBtn label="Edit action item" onClick={() => setEditing({ id: a.id, text: a.text })}><Pencil size={13} /></IconBtn>
                            <IconBtn label="Delete action item" onClick={() => run(a.id, () => record.deleteActionItem(a.id), 'Could not delete the action item')}><Trash2 size={13} /></IconBtn>
                        </span>
                    )}
                </div>
            ))}
            {!readOnly && (
                <div>
                    <Btn size="sm" variant="ghost" icon={ListChecks} onClick={extract} loading={extracting} title="Find action items in the transcript (or the notes)">
                        {extracting ? 'Looking…' : 'Find action items'}
                    </Btn>
                </div>
            )}
        </div>
    );
}

/**
 * Summary & actions: the summary (generate / edit / post to the conversation),
 * the action items and the meeting assistant (ask AI about the transcript).
 */
export default function SummaryTab({ meeting, workspaceId, record, transcript, myId, compact = false }) {
    const people = meetingPeople(meeting);
    const names = useMemo(() => Object.fromEntries(people.map((p) => [p.id, p.name])), [people]);
    const conv = meetingConversation(meeting);
    return (
        <div className="mt-cols" data-testid="meeting-tab-summary">
            <div className="mt-stack" style={{ gap: 18 }}>
                <SummaryBlock meeting={meeting} onSummarize={record.summarize} onSave={record.saveSummary} />
                <ActionItems meeting={meeting} workspaceId={workspaceId} record={record} />
                <PostSummary key={`${conv.kind}:${conv.id}`} meeting={meeting} workspaceId={workspaceId} />
                {compact && conv.kind !== 'workspace' && <p className="mt-muted" style={{ fontSize: 11 }}>Posts to {conversationLabel(conv)}.</p>}
            </div>
            <div className="mt-stack">
                <MeetingAssistant
                    segments={transcript?.segments || []}
                    target={transcript?.target || null}
                    workspaceId={workspaceId}
                    title={meetingTitle(meeting)}
                    myId={myId}
                    names={names}
                />
            </div>
        </div>
    );
}
