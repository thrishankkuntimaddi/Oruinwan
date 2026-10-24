import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import {
    MessagesSquare, Send, Loader2, CheckCircle2, RotateCcw, UserPlus, X, Search, Check, Hash, Lock, Trash2, ArrowRight,
} from 'lucide-react';
import api from '@services/api';
import { useOptionalSocket } from '../../contexts/SocketContext';
import { batchDecryptMessages } from '../../services/messageEncryptionService';
import MessageMarkdown from '../../shared/components/messages/MessageMarkdown';
import { statusLabel, priorityLabel, taskErrorMessage } from '../../utils/taskMeta';
import { UserAvatar, fmtDate, FONT, tint } from './taskUi';

const idOf = (v) => (v == null ? '' : String(v._id || v.id || v));

/** One line for an automatic entry ("moved it from To do to In progress"). */
export function describeDiscussionEvent(e) {
    const ev = e?.event || {};
    const name = (id) => ev.names?.[String(id)] || 'someone';
    const names = (v) => (Array.isArray(v) ? v : [v]).filter(Boolean).map(name).join(', ');
    const day = (v) => (v ? fmtDate(v) : 'none');
    switch (ev.type) {
        case 'status': return <>moved it from <b>{statusLabel(ev.from)}</b> to <b>{statusLabel(ev.to)}</b>{ev.meta?.reason ? ` — “${ev.meta.reason}”` : ''}</>;
        case 'resolved': return 'resolved the discussion: the task is done';
        case 'reopened': return 'reopened the discussion: the task is no longer done';
        case 'assignee_added': return <>assigned <b>{name(ev.to)}</b></>;
        case 'assignee_removed': return <>unassigned <b>{name(ev.from)}</b></>;
        case 'reassigned': return <>reassigned it to <b>{names(ev.to)}</b></>;
        case 'due_date':
            if (!ev.to) return 'cleared the due date';
            return ev.from ? <>changed the due date from <b>{day(ev.from)}</b> to <b>{day(ev.to)}</b></> : <>set the due date to <b>{day(ev.to)}</b></>;
        case 'priority': return <>changed priority from <b>{priorityLabel(ev.from)}</b> to <b>{priorityLabel(ev.to)}</b></>;
        case 'participant_added': return <>added <b>{names(ev.to)}</b> to the discussion</>;
        case 'participant_removed': return <>removed <b>{name(ev.from)}</b> from the discussion</>;
        case 'thread_linked': return <>created this task from a thread{ev.meta?.channelName ? <> in <b>#{ev.meta.channelName}</b></> : ''}</>;
        default: return String(ev.type || 'updated').replace(/_/g, ' ');
    }
}

function threadHref(workspaceId, linked) {
    if (!linked || linked.restricted) return null;
    const conv = linked.channelId ? `channel/${linked.channelId}` : linked.dmId ? `dm/${linked.dmId}` : null;
    if (!conv || !workspaceId) return null;
    return `/workspace/${workspaceId}/${conv}?thread=${linked.messageId}`;
}

function OpenLink({ href, children, style }) {
    const inRouter = useInRouterContext();
    if (!href) return null;
    return inRouter
        ? <Link to={href} style={style}>{children}</Link>
        : <a href={href} style={style}>{children}</a>;
}

/**
 * The thread a task came from: "From #channel thread" and its latest replies, decrypted here
 * (thread replies are end-to-end encrypted with the conversation's key).
 */
export function LinkedThreadCard({ linked, workspaceId }) {
    const [items, setItems] = useState(null);
    useEffect(() => {
        if (!linked || linked.restricted) return undefined;
        let alive = true;
        const convId = linked.channelId || linked.dmId;
        const convType = linked.channelId ? 'channel' : 'dm';
        const list = [linked.parent, ...(linked.latestReplies || [])].filter(Boolean).map((m) => ({ ...m, id: m._id }));
        batchDecryptMessages(list.filter((m) => m.payload?.ciphertext), convId, convType, null)
            .then((dec) => {
                if (!alive) return;
                const byId = new Map((dec || []).map((m) => [idOf(m), m]));
                setItems(list.map((m) => byId.get(idOf(m)) || m));
            })
            .catch(() => { if (alive) setItems(list); });
        return () => { alive = false; };
    }, [linked]);

    if (!linked) return null;
    const where = linked.channelName ? `#${linked.channelName}` : linked.dmId ? 'a direct message' : 'a conversation';
    if (linked.restricted) {
        return (
            <div data-testid="task-linked-thread" style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lock size={11} /> From a thread you can’t see
            </div>
        );
    }
    const text = (m) => (m.payload?.isDeleted ? 'This message was deleted.' : m.decryptedContent || m.text || (m.payload?.ciphertext ? 'Encrypted message' : '') || (m.attachments?.length ? '📎 Attachment' : ''));
    const [parent, ...replies] = items || [];
    return (
        <div data-testid="task-linked-thread" style={{ border: '1px solid var(--border-default)', borderRadius: '2px', background: 'var(--bg-base)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <Hash size={11} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>From {where} thread · {linked.replyCount} {linked.replyCount === 1 ? 'reply' : 'replies'}</span>
                {linked.locked && <Lock size={11} aria-label="Locked thread" />}
                <OpenLink href={threadHref(workspaceId, linked)} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
                    Open <ArrowRight size={11} />
                </OpenLink>
            </div>
            {items === null ? (
                <p style={{ margin: 0, padding: '8px 10px', fontSize: '11px', color: 'var(--text-secondary)' }}><Loader2 size={11} className="tk-spin" /> Loading thread…</p>
            ) : (
                <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {parent && (
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <b>{parent.sender?.username || 'Someone'}:</b> {text(parent)}
                        </p>
                    )}
                    {replies.length > 0 && <p className="tk-label" style={{ margin: '2px 0 0' }}>Latest replies</p>}
                    {replies.map((m) => (
                        <div key={idOf(m)} data-testid="task-linked-reply" style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                            <UserAvatar user={m.sender} size={16} />
                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <b style={{ color: 'var(--text-primary)' }}>{m.sender?.username || 'Someone'}</b> {text(m)}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/** The discussion's data, kept live: { data, loading, error, reload, append, remove }. */
export function useTaskDiscussion(taskId) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const socketCtx = useOptionalSocket();
    const socket = socketCtx?.socket || null;

    const reload = useCallback(async () => {
        if (!taskId) return;
        try {
            const res = await api.get(`/api/v2/tasks/${taskId}/discussion`);
            setData(res.data);
            setError(null);
        } catch (err) {
            setError(taskErrorMessage(err, 'Could not load the discussion'));
        } finally {
            setLoading(false);
        }
    }, [taskId]);

    useEffect(() => { setLoading(true); setData(null); reload(); }, [reload]);

    const append = useCallback((entry) => {
        setData((d) => {
            if (!d || !entry || d.entries.some((e) => e._id === entry._id)) return d;
            const next = { ...d, entries: [...d.entries, entry] };
            if (entry.kind === 'comment') next.commentCount = (d.commentCount || 0) + 1;
            if (entry.event?.type === 'resolved') next.resolved = true;
            if (entry.event?.type === 'reopened') next.resolved = false;
            return next;
        });
        // People and permissions change with these.
        if (['participant_added', 'participant_removed', 'assignee_added', 'assignee_removed', 'reassigned'].includes(entry?.event?.type)) reload();
    }, [reload]);

    const remove = useCallback((commentId) => {
        setData((d) => (d ? { ...d, entries: d.entries.filter((e) => e._id !== commentId), commentCount: Math.max(0, (d.commentCount || 1) - 1) } : d));
    }, []);

    useEffect(() => {
        if (!socket || !taskId) return undefined;
        const onEntry = (p) => { if (String(p?.taskId) === String(taskId)) append(p.entry); };
        const onRemoved = (p) => { if (String(p?.taskId) === String(taskId)) remove(p.commentId); };
        socket.on('task:discussion', onEntry);
        socket.on('task:discussion-removed', onRemoved);
        return () => {
            socket.off('task:discussion', onEntry);
            socket.off('task:discussion-removed', onRemoved);
        };
    }, [socket, taskId, append, remove]);

    return { data, loading, error, reload, append, remove, setData };
}

/** Choose workspace members to add to the discussion. */
function AddPeople({ members, exclude, onCancel, onAdd }) {
    const [q, setQ] = useState('');
    const [sel, setSel] = useState([]);
    const [busy, setBusy] = useState(false);
    const list = members.filter((m) => !exclude.has(idOf(m)) && String(m.username || m.email || '').toLowerCase().includes(q.toLowerCase()));
    return (
        <div data-testid="task-discussion-add-people" style={{ border: '1px solid var(--border-default)', borderRadius: '2px', background: 'var(--bg-base)' }}>
            <div style={{ position: 'relative', borderBottom: '1px solid var(--border-subtle)' }}>
                <Search size={12} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input autoFocus className="tk-field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add people from this workspace…" style={{ border: 'none', paddingLeft: '28px', background: 'transparent' }} />
            </div>
            <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
                {list.map((m) => {
                    const id = idOf(m);
                    const on = sel.includes(id);
                    return (
                        <button key={id} type="button" aria-pressed={on} onClick={() => setSel((p) => (on ? p.filter((x) => x !== id) : [...p, id]))}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: on ? 'var(--accent-dim)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: FONT }}>
                            <UserAvatar user={{ id, username: m.username, profilePicture: m.profilePicture }} size={20} />
                            <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-primary)' }}>{m.username || m.email}</span>
                            {on && <Check size={12} style={{ color: 'var(--accent)' }} />}
                        </button>
                    );
                })}
                {list.length === 0 && <p style={{ margin: 0, padding: '12px', fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>Everyone is already here.</p>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', padding: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                <button type="button" className="tk-btn" onClick={onCancel} disabled={busy}>Cancel</button>
                <button type="button" className="tk-btn tk-btn-primary" disabled={busy || sel.length === 0}
                    onClick={async () => { setBusy(true); try { await onAdd(sel); } finally { setBusy(false); } }}>
                    {busy ? <Loader2 size={12} className="tk-spin" /> : <UserPlus size={12} />} Add
                </button>
            </div>
        </div>
    );
}

/** "Linked thread" on a task's details: only for tasks created from a message. */
export function TaskLinkedThread({ taskId, workspaceId }) {
    const { data } = useTaskDiscussion(taskId);
    if (!data?.linkedThread) return null;
    return <LinkedThreadCard linked={data.linkedThread} workspaceId={workspaceId} />;
}

/** @name suggestions for the word being typed at the end of the composer. */
function mentionQuery(text) {
    const m = /(^|\s)@([\w.-]*)$/.exec(text);
    return m ? m[2].toLowerCase() : null;
}

/**
 * A task's Discussion tab: the creator, assignees and anyone they add talk here; status,
 * assignee, due-date and priority changes appear automatically; resolved when the task is Done.
 */
export default function TaskDiscussion({ taskId, workspaceId, members = [], currentUserId, showToast }) {
    const { data, loading, error, reload, append, remove } = useTaskDiscussion(taskId);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [adding, setAdding] = useState(false);
    const endRef = useRef(null);
    const toast = (msg, type) => showToast?.(msg, type);

    const entries = data?.entries || [];
    useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }); }, [entries.length]);

    const participantIds = useMemo(() => new Set((data?.participants || []).map((p) => idOf(p))), [data]);
    const q = mentionQuery(text);
    const suggestions = q === null ? [] : members.filter((m) => m.username && m.username.toLowerCase().startsWith(q) && idOf(m) !== String(currentUserId)).slice(0, 6);

    const send = async () => {
        const body = text.trim();
        if (!body || sending) return;
        setSending(true);
        try {
            const res = await api.post(`/api/v2/tasks/${taskId}/discussion`, { text: body });
            append(res.data.entry);
            setText('');
            // Commenting or mentioning can add people.
            if (!participantIds.has(String(currentUserId)) || (res.data.entry?.mentions || []).some((id) => !participantIds.has(id))) reload();
        } catch (err) {
            toast(taskErrorMessage(err, 'Could not post your comment'), 'error');
        } finally {
            setSending(false);
        }
    };

    const addPeople = async (ids) => {
        try {
            const res = await api.post(`/api/v2/tasks/${taskId}/participants`, { userIds: ids });
            const n = (res.data.added || []).length;
            toast(n ? `Added ${n} ${n === 1 ? 'person' : 'people'} to the discussion` : 'They are already in the discussion', 'success');
            setAdding(false);
            reload();
        } catch (err) {
            toast(taskErrorMessage(err, 'Could not add people'), 'error');
        }
    };

    const removePerson = async (p) => {
        const self = idOf(p) === String(currentUserId);
        try {
            await api.delete(`/api/v2/tasks/${taskId}/participants/${idOf(p)}`);
            toast(self ? 'You left the discussion' : `${p.username || 'They'} left the discussion`, 'success');
            reload();
        } catch (err) {
            toast(taskErrorMessage(err, 'Could not remove them'), 'error');
        }
    };

    const deleteComment = async (entry) => {
        if (!window.confirm('Delete this comment?')) return;
        try {
            await api.delete(`/api/v2/tasks/${taskId}/discussion/${entry._id}`);
            remove(entry._id);
        } catch (err) {
            toast(taskErrorMessage(err, 'Could not delete the comment'), 'error');
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', padding: '32px 0', color: 'var(--text-secondary)', fontSize: '12px' }}>
                <Loader2 size={13} className="tk-spin" /> Loading discussion…
            </div>
        );
    }
    if (error || !data) {
        return (
            <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
                {error || 'Could not load the discussion'}
                <div style={{ marginTop: '8px' }}><button type="button" className="tk-btn" onClick={reload}>Try again</button></div>
            </div>
        );
    }

    const perms = data.permissions || {};
    const roleLabel = (roles = []) => (roles.includes('creator') ? 'Creator' : roles.includes('assignee') ? 'Assignee' : roles.includes('added') ? 'Added' : 'Watching');
    const removable = (p) => !p.roles?.includes('creator') && !p.roles?.includes('assignee') && (idOf(p) === String(currentUserId) || perms.canModerate);

    return (
        <div data-testid="task-discussion" className="tasks-ui" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {data.resolved ? (
                    <div data-testid="task-discussion-resolved" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', borderRadius: '2px', fontSize: '12px', color: 'var(--state-success)', background: tint('var(--state-success)', 8), border: `1px solid ${tint('var(--state-success)', 30)}` }}>
                        <CheckCircle2 size={12} /> Resolved — the task is done{data.resolvedAt ? ` (${fmtDate(data.resolvedAt)})` : ''}. It reopens if the task moves out of Done.
                    </div>
                ) : null}

                {/* People */}
                <section>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <p className="tk-label" style={{ margin: 0 }}>In this discussion ({data.participants.length})</p>
                        {perms.canAddPeople && !adding && (
                            <button type="button" className="tk-btn" onClick={() => setAdding(true)} data-testid="task-discussion-add"><UserPlus size={12} /> Add people</button>
                        )}
                    </div>
                    {adding ? (
                        <AddPeople members={members} exclude={participantIds} onCancel={() => setAdding(false)} onAdd={addPeople} />
                    ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {data.participants.map((p) => (
                                <span key={idOf(p)} data-testid="task-discussion-person" title={roleLabel(p.roles)}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 6px 2px 2px', borderRadius: '12px', border: '1px solid var(--border-default)', fontSize: '11px', color: 'var(--text-primary)' }}>
                                    <UserAvatar user={p} size={18} />
                                    {p.username || 'Someone'}
                                    <span style={{ color: 'var(--text-secondary)' }}>· {roleLabel(p.roles)}</span>
                                    {removable(p) && (
                                        <button type="button" aria-label={idOf(p) === String(currentUserId) ? 'Leave the discussion' : `Remove ${p.username || 'them'}`}
                                            onClick={() => removePerson(p)} style={{ display: 'inline-flex', border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                            <X size={11} />
                                        </button>
                                    )}
                                </span>
                            ))}
                        </div>
                    )}
                </section>

                {data.linkedThread && (
                    <section>
                        <p className="tk-label" style={{ margin: '0 0 8px' }}>Linked thread</p>
                        <LinkedThreadCard linked={data.linkedThread} workspaceId={workspaceId} />
                    </section>
                )}

                {/* Stream */}
                {entries.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)', fontSize: '12px' }}>
                        <MessagesSquare size={22} style={{ opacity: 0.5 }} />
                        <p style={{ margin: '6px 0 0' }}>No comments yet. Status changes, reassignments and due-date changes show up here too.</p>
                    </div>
                ) : (
                    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {entries.map((e) => (e.kind === 'event' ? (
                            <li key={e._id} data-testid="task-discussion-event" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                <span style={{ width: 22, display: 'inline-flex', justifyContent: 'center', flexShrink: 0 }}>
                                    {e.event?.type === 'resolved' ? <CheckCircle2 size={12} style={{ color: 'var(--state-success)' }} /> : e.event?.type === 'reopened' ? <RotateCcw size={12} /> : <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--border-accent)' }} />}
                                </span>
                                <span style={{ flex: 1, lineHeight: 1.5 }}>
                                    <b style={{ color: 'var(--text-primary)' }}>{e.author?.username || 'Oruinwan'}</b> {describeDiscussionEvent(e)}
                                    <span style={{ opacity: 0.7 }}> · {e.createdAt ? new Date(e.createdAt).toLocaleString() : ''}</span>
                                </span>
                            </li>
                        ) : (
                            <li key={e._id} data-testid="task-discussion-comment" style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                <UserAvatar user={e.author} size={22} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{e.author?.username || 'Someone'}</span>
                                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{e.createdAt ? new Date(e.createdAt).toLocaleString() : ''}</span>
                                        {(idOf(e.author) === String(currentUserId) || perms.canModerate) && (
                                            <button type="button" className="tk-icon-btn danger" aria-label="Delete comment" onClick={() => deleteComment(e)} style={{ marginLeft: 'auto', width: 20, height: 20 }}>
                                                <Trash2 size={11} />
                                            </button>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.55, wordBreak: 'break-word' }}>
                                        <MessageMarkdown text={e.text || ''} />
                                    </div>
                                    {(e.attachments || []).map((a) => (
                                        <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', fontSize: '11px', color: 'var(--accent)' }}>📎 {a.name || 'Attachment'}</a>
                                    ))}
                                </div>
                            </li>
                        )))}
                    </ol>
                )}
                <div ref={endRef} />
            </div>

            {/* Composer */}
            {perms.canComment && (
                <div style={{ borderTop: '1px solid var(--border-default)', padding: '10px 12px', position: 'relative', flexShrink: 0 }}>
                    {suggestions.length > 0 && (
                        <div role="listbox" aria-label="Mention someone" style={{ position: 'absolute', left: 12, right: 12, bottom: '100%', marginBottom: 4, background: 'var(--bg-surface)', border: '1px solid var(--border-accent)', borderRadius: '2px', boxShadow: 'var(--lg-shadow-sm)', zIndex: 2 }}>
                            {suggestions.map((m) => (
                                <button key={idOf(m)} type="button" role="option" aria-selected="false"
                                    onClick={() => setText((t) => t.replace(/@([\w.-]*)$/, `@${m.username} `))}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontSize: '12px', color: 'var(--text-primary)', fontFamily: FONT }}>
                                    <UserAvatar user={{ id: idOf(m), username: m.username, profilePicture: m.profilePicture }} size={18} /> {m.username}
                                </button>
                            ))}
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                        <textarea className="tk-field" rows={2} value={text} aria-label="Write a comment"
                            placeholder={data.resolved ? 'Comment on this resolved task… (@ to mention)' : 'Write a comment… (@ to mention)'}
                            onChange={(e) => setText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && suggestions.length === 0) { e.preventDefault(); send(); } }}
                            style={{ flex: 1, resize: 'none', fontFamily: FONT }} />
                        <button type="button" className="tk-btn tk-btn-primary" onClick={send} disabled={sending || !text.trim()} aria-label="Send comment">
                            {sending ? <Loader2 size={12} className="tk-spin" /> : <Send size={12} />}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
