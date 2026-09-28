import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    X, Eye, Activity, Plus, CheckCircle2, Tag, Loader2, ArrowRight, User, Edit2, Calendar, Trash2,
    Timer, Link2, PlayCircle, StopCircle, Paperclip, Ban, Users, Search, Check, Send, Hash, Lock, RotateCcw,
} from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useAIContext } from '../../contexts/AIContext';
import AITaskAssist from './AITaskAssist';
import { STATUS_META, TRANSITIONS, PRIORITIES, PRIORITY_META, statusLabel, priorityLabel, toDateInput, taskErrorMessage } from '../../utils/taskMeta';
import { StatusBadge, PriorityIcon, UserAvatar, IssueTypeIcon, fmtDate, tint, FONT } from './taskUi';

function fmtSeconds(s) {
    const total = Math.max(0, Math.floor(s || 0));
    const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), sec = total % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
}

const Section = ({ label, icon, action, children }) => (
    <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
            <p className="tk-label" style={{ margin: 0 }}>{icon}{label}</p>
            {action}
        </div>
        {children}
    </section>
);

const valueLabel = (field, v) => {
    if (v == null || v === '') return '—';
    if (field === 'status') return statusLabel(v);
    if (field === 'priority') return priorityLabel(v);
    if (field === 'dueDate') return fmtDate(v);
    if (typeof v === 'object') return Array.isArray(v) ? v.join(', ') : '…';
    return String(v).length > 40 ? `${String(v).slice(0, 40)}…` : String(v);
};

function describeActivity(a) {
    switch (a.action) {
        case 'created': return 'created this task';
        case 'status_changed': return <>moved it from <b>{statusLabel(a.from)}</b> to <b>{statusLabel(a.to)}</b>{a.metadata?.reason ? ` — “${a.metadata.reason}”` : ''}</>;
        case 'unblocked': return 'unblocked it';
        case 'blocked': return 'marked it blocked';
        case 'updated':
            if (a.field === 'description') return 'updated the description';
            if (a.field === 'title') return <>renamed it to <b>{valueLabel('title', a.to)}</b></>;
            return <>changed {a.field === 'dueDate' ? 'due date' : a.field} {a.from != null ? <>from <b>{valueLabel(a.field, a.from)}</b> </> : ''}to <b>{valueLabel(a.field, a.to)}</b></>;
        case 'assignee_added': return 'added an assignee';
        case 'assignee_removed': return 'removed an assignee';
        case 'deleted': return 'moved it to trash';
        case 'restored': return 'restored it';
        default: return String(a.action || 'updated').replace(/_/g, ' ');
    }
}

function ActivityLog({ taskId }) {
    const [log, setLog] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!taskId) return;
        let alive = true;
        setLoading(true);
        api.get(`/api/v2/tasks/${taskId}/activity`)
            .then((r) => { if (alive) setLog(r.data.activities || r.data.activity || []); })
            .catch(() => { if (alive) setLog([]); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [taskId]);

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', padding: '32px 0', color: 'var(--text-secondary)', fontSize: '12px' }}>
            <Loader2 size={13} className="tk-spin" /> Loading activity…
        </div>
    );
    if (!log.length) return <p style={{ padding: '32px 0', textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>No activity recorded yet.</p>;

    return (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {log.map((a, i) => (
                <li key={a._id || i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    {a.user ? <UserAvatar user={a.user} size={22} /> : <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-active)', flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{a.user?.username || 'Someone'}</span>{' '}{describeActivity(a)}
                        </p>
                        <p style={{ fontSize: '10px', color: 'var(--text-secondary)', margin: '2px 0 0', opacity: 0.8 }}>{a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}</p>
                    </div>
                </li>
            ))}
        </ol>
    );
}

/** Choose assignees from workspace members (ids are sent as `assignedTo`). */
function AssigneeEditor({ members, initial, onCancel, onSave }) {
    const [sel, setSel] = useState(initial);
    const [q, setQ] = useState('');
    const [busy, setBusy] = useState(false);
    const list = members.filter((m) => (m.username || m.email || '').toLowerCase().includes(q.toLowerCase()));
    const toggle = (id) => setSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    return (
        <div style={{ border: '1px solid var(--border-default)', borderRadius: '2px', background: 'var(--bg-base)' }}>
            <div style={{ position: 'relative', borderBottom: '1px solid var(--border-subtle)' }}>
                <Search size={12} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input autoFocus className="tk-field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members…" style={{ border: 'none', paddingLeft: '28px', background: 'transparent' }} />
            </div>
            <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {list.map((m) => {
                    const id = String(m._id || m.id);
                    const on = sel.includes(id);
                    return (
                        <button key={id} type="button" onClick={() => toggle(id)} aria-pressed={on}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: on ? 'var(--accent-dim)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: FONT }}>
                            <UserAvatar user={{ id, username: m.username, profilePicture: m.profilePicture }} size={20} />
                            <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.username || m.email}</span>
                            <span style={{ width: '14px', height: '14px', borderRadius: '2px', border: `1px solid ${on ? 'var(--accent)' : 'var(--border-accent)'}`, background: on ? 'var(--accent)' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                {on && <Check size={10} strokeWidth={3} style={{ color: '#0c0c0c' }} />}
                            </span>
                        </button>
                    );
                })}
                {list.length === 0 && <p style={{ margin: 0, padding: '12px', fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>No members found.</p>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', padding: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                <button type="button" className="tk-btn" onClick={onCancel} disabled={busy}>Cancel</button>
                <button type="button" className="tk-btn tk-btn-primary" disabled={busy || sel.length === 0}
                    title={sel.length === 0 ? 'A task needs at least one assignee' : undefined}
                    onClick={async () => { setBusy(true); try { await onSave(sel); } finally { setBusy(false); } }}>
                    {busy ? <Loader2 size={12} className="tk-spin" /> : <Check size={12} />} Save
                </button>
            </div>
        </div>
    );
}

export default function WorkspaceTaskDetailPanel({
    task, members = [], allTasks = [], can = {}, fullScreen = false, onClose, onUpdate, onStatusChange, onDelete,
    onRestore, onRequestTransfer, onTransferRespond, onPatchLocal, onFetch,
}) {
    const { activeWorkspace } = useWorkspace();
    const aiWorkspaceId = activeWorkspace?.id || activeWorkspace?._id || null;
    const aiCtx = useAIContext();
    const setAITask = aiCtx?.setTask;
    const { showToast } = useToast();

    useEffect(() => {
        if (!setAITask || !task) return undefined;
        setAITask({ id: task.id, title: task.title, description: task.description, status: statusLabel(task.status), priority: priorityLabel(task.priority), dueDate: task.dueDate });
        return () => setAITask(null);
    }, [setAITask, task]);

    // Load the full task once per open (populated subtasks, dependencies…).
    useEffect(() => { if (task?.id && onFetch) onFetch(task.id); }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const [tab, setTab] = useState('details');
    const [editTitle, setEditTitle] = useState(false);
    const [title, setTitle] = useState(task.title || '');
    const [desc, setDesc] = useState(task.description || '');
    const [editDesc, setEditDesc] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editAssignees, setEditAssignees] = useState(false);
    const [linkInput, setLinkInput] = useState('');

    useEffect(() => { setTab('details'); setEditTitle(false); setEditDesc(false); setEditAssignees(false); }, [task.id]);
    useEffect(() => { if (!editTitle) setTitle(task.title || ''); }, [task.title, editTitle]);
    useEffect(() => { if (!editDesc) setDesc(task.description || ''); }, [task.description, editDesc]);

    const save = useCallback(async (updates) => {
        setSaving(true);
        try { return await onUpdate(task.id, updates); } finally { setSaving(false); }
    }, [task.id, onUpdate]);

    // ── Time tracking: state lives on the task (timeTracking), so it survives closing the panel.
    const sessions = task.timeTracking?.sessions || [];
    const openSession = [...sessions].reverse().find((s) => s.start && !s.end);
    const totalTime = task.timeTracking?.totalTime || 0;
    const [now, setNow] = useState(Date.now());
    const [timerLoading, setTimerLoading] = useState(false);
    useEffect(() => {
        if (!openSession) return undefined;
        const iv = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(iv);
    }, [openSession]);
    const runningFor = openSession ? (now - new Date(openSession.start).getTime()) / 1000 : 0;

    const toggleTimer = async () => {
        setTimerLoading(true);
        try {
            const res = await api.post(`/api/v2/tasks/${task.id}/time/${openSession ? 'stop' : 'start'}`);
            if (res.data?.timeTracking) onPatchLocal?.(task.id, { timeTracking: res.data.timeTracking });
            setNow(Date.now());
            showToast(openSession ? `Timer stopped — +${fmtSeconds(res.data.elapsed)}` : 'Timer started', 'success');
        } catch (err) {
            showToast(taskErrorMessage(err, 'Timer update failed'), 'error');
        } finally { setTimerLoading(false); }
    };

    // ── Dependencies: pick another task from this workspace.
    const [depPick, setDepPick] = useState('');
    const [depLoading, setDepLoading] = useState(false);
    const byId = useMemo(() => new Map(allTasks.map((t) => [t.id, t])), [allTasks]);
    // Subtask assignees may arrive as bare ids: resolve names/pictures from workspace members.
    const memberById = (u) => {
        const m = members.find((x) => String(x._id || x.id) === String(u?.id));
        return m ? { id: String(m._id || m.id), username: m.username, profilePicture: m.profilePicture } : u;
    };
    const depIds = (task.dependencies || []).map((d) => d.id);
    const depCandidates = allTasks.filter((t) => !t.deleted && t.id !== task.id && !depIds.includes(t.id));
    const addDependency = async () => {
        if (!depPick) return;
        setDepLoading(true);
        try {
            const res = await api.post(`/api/v2/tasks/${task.id}/dependency`, { dependencyTaskId: depPick });
            const ids = (res.data.dependencies || []).map((d) => String(d?._id || d));
            onPatchLocal?.(task.id, { dependencies: ids.map((id) => ({ id, title: byId.get(id)?.title || '', status: byId.get(id)?.status || null })) });
            setDepPick('');
            showToast('Dependency added', 'success');
        } catch (err) {
            showToast(taskErrorMessage(err, 'Failed to add dependency'), 'error');
        } finally { setDepLoading(false); }
    };

    const addLink = () => {
        const url = linkInput.trim();
        if (!url) return;
        save({ attachments: [...(task.attachments || []), { name: url, url }] });
        setLinkInput('');
    };

    const nextStatuses = TRANSITIONS[task.status] || [];
    const assignees = task.assignees || [];
    const deleted = task.deleted;
    const readOnlyHint = (what) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-secondary)' }}><Lock size={9} /> {what}</span>;

    return (
        <aside className="tasks-ui" aria-label="Task details" style={{ ...(fullScreen ? { position: 'fixed', inset: 0, zIndex: 55, width: '100%' } : { width: 'min(360px, 42%)', minWidth: '300px' }), flexShrink: 0, display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-default)', overflow: 'hidden', fontFamily: FONT }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px 10px 16px', borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>
                <IssueTypeIcon type={task.issueType} />
                {task.issueKey && <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-secondary)' }}>{task.issueKey}</span>}
                <StatusBadge status={task.status} compact />
                {deleted && <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--state-danger)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>In trash</span>}
                <span style={{ flex: 1 }} />
                {saving && <Loader2 size={13} className="tk-spin" style={{ color: 'var(--accent)' }} />}
                <button type="button" className="tk-icon-btn" onClick={onClose} aria-label="Close details"><X size={15} /></button>
            </div>

            <div role="tablist" style={{ display: 'flex', borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>
                {[{ key: 'details', label: 'Details', icon: <Eye size={12} /> }, { key: 'activity', label: 'Activity', icon: <Activity size={12} /> }].map((t) => (
                    <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', fontSize: '12px', fontWeight: 600, background: 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.key ? 'var(--accent)' : 'transparent'}`, color: tab === t.key ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: FONT }}>
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', scrollbarWidth: 'thin' }}>
                {tab === 'activity' ? (
                    <div style={{ padding: '16px' }}><ActivityLog taskId={task.id} /></div>
                ) : (
                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                        {/* Title */}
                        {editTitle ? (
                            <input autoFocus className="tk-field" value={title} onChange={(e) => setTitle(e.target.value)}
                                onBlur={() => { const v = title.trim(); if (v && v !== task.title) save({ title: v }); setEditTitle(false); }}
                                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setTitle(task.title); setEditTitle(false); } }}
                                style={{ fontSize: '15px', fontWeight: 700 }} />
                        ) : (
                            <h2 onClick={() => can.edit && !deleted && setEditTitle(true)}
                                style={{ margin: 0, fontSize: '15px', fontWeight: 700, lineHeight: 1.4, color: 'var(--text-primary)', cursor: can.edit && !deleted ? 'text' : 'default', display: 'flex', gap: '6px', wordBreak: 'break-word' }}>
                                <span style={{ flex: 1, textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>{task.title}</span>
                                {can.edit && !deleted && <Edit2 size={11} style={{ color: 'var(--text-secondary)', flexShrink: 0, marginTop: '5px' }} />}
                            </h2>
                        )}

                        {task.transferRequest?.status === 'pending' && (
                            <div style={{ padding: '10px', borderRadius: '2px', background: 'var(--accent-dim)', border: `1px solid ${tint('var(--accent)', 35)}`, fontSize: '12px', color: 'var(--text-primary)' }}>
                                <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                                    <Send size={12} style={{ color: 'var(--accent)' }} /> Transfer pending → {task.transferRequest.requestedTo?.username || 'another member'}
                                </p>
                                {task.transferRequest.note && <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontStyle: 'italic' }}>“{task.transferRequest.note}”</p>}
                                {can.handleTransfer && onTransferRespond && (
                                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                                        <button type="button" className="tk-btn tk-btn-primary" onClick={() => onTransferRespond(task.id, 'approve')}>Approve</button>
                                        <button type="button" className="tk-btn" onClick={() => onTransferRespond(task.id, 'reject')}>Reject</button>
                                    </div>
                                )}
                            </div>
                        )}

                        {task.status === 'blocked' && task.blockedReason && (
                            <div style={{ padding: '10px', borderRadius: '2px', background: tint('var(--state-danger)', 8), border: `1px solid ${tint('var(--state-danger)', 30)}` }}>
                                <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: 'var(--state-danger)', display: 'flex', alignItems: 'center', gap: '5px' }}><Ban size={11} /> Blocked</p>
                                <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-primary)' }}>{task.blockedReason}</p>
                            </div>
                        )}

                        {/* Status */}
                        {!deleted && (
                            <Section label="Move to" action={!can.status && readOnlyHint('Creator, assignees and admins')}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {nextStatuses.map((s) => {
                                        const c = STATUS_META[s].color;
                                        const reopen = task.status === 'done' || task.status === 'cancelled';
                                        return (
                                            <button key={s} type="button" disabled={!can.status} onClick={() => onStatusChange(task, s)}
                                                className="tk-btn" style={{ padding: '4px 9px', fontSize: '11px', borderColor: tint(c, 45), color: 'var(--text-primary)', background: tint(c, 10) }}>
                                                {reopen ? <RotateCcw size={10} /> : <ArrowRight size={10} />} {statusLabel(s)}
                                            </button>
                                        );
                                    })}
                                </div>
                            </Section>
                        )}

                        {/* Description */}
                        <Section label="Description">
                            {editDesc ? (
                                <textarea autoFocus className="tk-field" value={desc} rows={4} onChange={(e) => setDesc(e.target.value)}
                                    onBlur={() => { if (desc !== task.description) save({ description: desc }); setEditDesc(false); }}
                                    style={{ resize: 'vertical', lineHeight: 1.6 }} />
                            ) : (
                                <p onClick={() => can.edit && !deleted && setEditDesc(true)}
                                    style={{ margin: 0, fontSize: '12px', lineHeight: 1.6, whiteSpace: 'pre-wrap', color: task.description ? 'var(--text-primary)' : 'var(--text-secondary)', fontStyle: task.description ? 'normal' : 'italic', cursor: can.edit && !deleted ? 'text' : 'default' }}>
                                    {task.description || (can.edit ? 'Click to add a description…' : 'No description')}
                                </p>
                            )}
                            {can.edit && !deleted && (
                                <div style={{ marginTop: '8px' }}>
                                    <AITaskAssist task={task} workspaceId={aiWorkspaceId} onApplyDescription={(text) => { setDesc(text); save({ description: text }); }} />
                                </div>
                            )}
                        </Section>

                        {/* Priority */}
                        <Section label="Priority" action={!can.edit && readOnlyHint('Creator and admins')}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                {PRIORITIES.map((p) => {
                                    const on = task.priority === p;
                                    return (
                                        <button key={p} type="button" disabled={!can.edit || deleted} aria-pressed={on} onClick={() => !on && save({ priority: p })}
                                            className="tk-btn" style={{ padding: '4px 8px', fontSize: '11px', gap: '3px', background: on ? tint(PRIORITY_META[p].color, 16) : 'transparent', borderColor: on ? tint(PRIORITY_META[p].color, 55) : 'var(--border-default)', color: on ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                            <PriorityIcon priority={p} size={11} /> {priorityLabel(p)}
                                        </button>
                                    );
                                })}
                            </div>
                        </Section>

                        {/* Assignees */}
                        <Section label={`Assignees${assignees.length ? ` (${assignees.length})` : ''}`} icon={<Users size={10} />}
                            action={can.assignees && !deleted && !editAssignees
                                ? <button type="button" className="tk-btn" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => setEditAssignees(true)}><Edit2 size={10} /> Change</button>
                                : (!can.assignees ? readOnlyHint('Creator and admins') : null)}>
                            {editAssignees ? (
                                <AssigneeEditor members={members} initial={task.assigneeIds || []} onCancel={() => setEditAssignees(false)}
                                    onSave={async (ids) => { const ok = await save({ assignedTo: ids }); if (ok) setEditAssignees(false); }} />
                            ) : assignees.length ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {assignees.map((a) => (
                                        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <UserAvatar user={a} size={22} />
                                            <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{a.username}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Unassigned</span>}
                            {can.transfer && onRequestTransfer && !deleted && (
                                <button type="button" className="tk-btn" style={{ marginTop: '8px', padding: '4px 9px', fontSize: '11px' }} onClick={() => onRequestTransfer(task)}>
                                    <Send size={11} /> Request transfer
                                </button>
                            )}
                        </Section>

                        {/* Due date */}
                        <Section label="Due date" icon={<Calendar size={10} />} action={!can.edit && readOnlyHint('Creator and admins')}>
                            <input type="date" className="tk-field" value={toDateInput(task.dueDate)} disabled={!can.edit || deleted}
                                onChange={(e) => save({ dueDate: e.target.value || null })} />
                        </Section>

                        {/* Child issues */}
                        {task.subtasks?.length > 0 && (
                            <Section label={`Child issues (${task.subtasks.filter((s) => s.status === 'done').length}/${task.subtasks.length} done)`}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    {task.subtasks.map((s) => (
                                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 6px', borderRadius: '2px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }}>
                                            {s.status === 'done' ? <CheckCircle2 size={12} style={{ color: 'var(--state-success)', flexShrink: 0 }} /> : <span style={{ width: 10, height: 10, border: '1px solid var(--border-accent)', borderRadius: '2px', flexShrink: 0 }} />}
                                            <span style={{ flex: 1, minWidth: 0, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: s.status === 'done' ? 'var(--text-secondary)' : 'var(--text-primary)', textDecoration: s.status === 'done' ? 'line-through' : 'none' }}>{s.title || 'Subtask'}</span>
                                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{statusLabel(s.status)}</span>
                                            {s.assignees?.[0] && <UserAvatar user={memberById(s.assignees[0])} size={16} />}
                                        </div>
                                    ))}
                                </div>
                            </Section>
                        )}

                        {/* Labels */}
                        {task.labels?.length > 0 && (
                            <Section label="Labels" icon={<Tag size={10} />}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                    {task.labels.map((l) => (
                                        <span key={l} style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '2px', background: 'var(--accent-dim)', color: 'var(--text-primary)', border: `1px solid ${tint('var(--accent)', 30)}` }}>{l}</span>
                                    ))}
                                </div>
                            </Section>
                        )}

                        {/* Resources */}
                        {(task.attachments?.length > 0 || (can.edit && !deleted)) && (
                            <Section label="Resources" icon={<Paperclip size={10} />}>
                                {task.attachments?.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: can.edit ? '8px' : 0 }}>
                                        {task.attachments.map((att, i) => (
                                            <div key={`${att.url}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', borderRadius: '2px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }}>
                                                <Link2 size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                                                <a href={att.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, minWidth: 0, fontSize: '12px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name || att.url}</a>
                                                {can.edit && !deleted && (
                                                    <button type="button" className="tk-icon-btn danger" style={{ width: 20, height: 20 }} aria-label="Remove resource"
                                                        onClick={() => save({ attachments: task.attachments.filter((_, j) => j !== i) })}><X size={11} /></button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {can.edit && !deleted && (
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <input className="tk-field" value={linkInput} onChange={(e) => setLinkInput(e.target.value)} placeholder="Paste a link…" onKeyDown={(e) => e.key === 'Enter' && addLink()} />
                                        <button type="button" className="tk-btn" onClick={addLink} disabled={!linkInput.trim()} aria-label="Add link"><Plus size={12} /></button>
                                    </div>
                                )}
                            </Section>
                        )}

                        {/* Time tracking */}
                        <Section label="Time tracking" icon={<Timer size={10} />}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '12px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Logged</span>
                                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fmtSeconds(totalTime)}</span>
                                {openSession && <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontWeight: 700, color: 'var(--state-success)' }}>● running {fmtSeconds(runningFor)}</span>}
                            </div>
                            <button type="button" className={`tk-btn ${openSession ? 'tk-btn-danger' : ''}`} onClick={toggleTimer} disabled={timerLoading || deleted} style={{ width: '100%' }}>
                                {timerLoading ? <Loader2 size={12} className="tk-spin" /> : openSession ? <><StopCircle size={13} /> Stop timer</> : <><PlayCircle size={13} /> Start timer</>}
                            </button>
                        </Section>

                        {/* Dependencies */}
                        <Section label="Depends on" icon={<Link2 size={10} />}>
                            {task.dependencies?.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                                    {task.dependencies.map((d) => {
                                        const known = byId.get(d.id);
                                        const st = known?.status || d.status;
                                        return (
                                            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', borderRadius: '2px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', fontSize: '12px' }}>
                                                <Link2 size={10} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                                                <span style={{ flex: 1, minWidth: 0, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{known?.title || d.title || `Task ${d.id.slice(-6)}`}</span>
                                                {st && <span style={{ fontSize: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{statusLabel(st)}</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>No dependencies</p>}
                            {can.dependency && !deleted && (
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <select className="tk-field" value={depPick} onChange={(e) => setDepPick(e.target.value)} aria-label="Task this depends on">
                                        <option value="">Choose a task…</option>
                                        {depCandidates.map((t) => <option key={t.id} value={t.id}>{t.issueKey ? `${t.issueKey} · ` : ''}{t.title}</option>)}
                                    </select>
                                    <button type="button" className="tk-btn" onClick={addDependency} disabled={!depPick || depLoading}>
                                        {depLoading ? <Loader2 size={11} className="tk-spin" /> : 'Add'}
                                    </button>
                                </div>
                            )}
                        </Section>

                        {task.channel?.name && (
                            <Section label="Channel" icon={<Hash size={10} />}>
                                <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>#{task.channel.name}</span>
                            </Section>
                        )}

                        {task.creator && (
                            <Section label="Reporter" icon={<User size={10} />}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <UserAvatar user={task.creator} size={22} />
                                    <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{task.creator.username}</span>
                                    {task.createdAt && <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-secondary)' }}>{fmtDate(task.createdAt)}</span>}
                                </div>
                            </Section>
                        )}

                        {task.completionNote && (
                            <div style={{ padding: '10px', borderRadius: '2px', background: tint('var(--state-success)', 8), border: `1px solid ${tint('var(--state-success)', 30)}` }}>
                                <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: 'var(--state-success)', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={11} /> Completion note</p>
                                <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-primary)' }}>{task.completionNote}</p>
                                {task.completedAt && <p style={{ margin: '4px 0 0', fontSize: '10px', color: 'var(--text-secondary)' }}>{fmtDate(task.completedAt)}</p>}
                            </div>
                        )}

                        <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-default)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {deleted ? (
                                can.restore && onRestore && <button type="button" className="tk-btn" onClick={() => onRestore(task.id)}><RotateCcw size={12} /> Restore</button>
                            ) : can.del ? (
                                <button type="button" className="tk-btn tk-btn-danger" onClick={() => onDelete(task)}><Trash2 size={12} /> {can.edit ? 'Move to trash' : 'Remove from my list'}</button>
                            ) : readOnlyHint('Only the creator or an admin can delete this task')}
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}
