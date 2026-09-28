import React, { useEffect, useState } from 'react';
import {
    X, Loader2, Eye, Activity, ChevronRight, Plus, ArrowRight, User, Tag, AlertTriangle, Check, Trash2,
} from 'lucide-react';
import api from '@services/api';
import {
    TRANSITIONS, STATUS_META, PRIORITIES, PRIORITY_META, statusLabel,
} from '../../../../../utils/taskMeta';
import { FONT, dateInputValue, canToggleSubtask } from './channelTaskUtils';
import {
    Avatar, StatusBadge, PriorityIcon, IssueTypeIcon, IconButton, sectionLabel, tint, readable, useColorScheme, primaryBtn,
} from './ChannelTaskUi';

const PANEL_WIDTH = 300;

const inputStyle = (scheme) => ({
    width: '100%', boxSizing: 'border-box', padding: '6px 8px', fontSize: 12, fontFamily: FONT,
    background: 'var(--bg-input)', color: 'var(--text-primary)', colorScheme: scheme,
    border: '1px solid var(--border-default)', borderRadius: '2px', outline: 'none',
});

function Chip({ active, color = 'var(--text-secondary)', disabled, onClick, title, children }) {
    const [hover, setHover] = useState(false);
    return (
        <button type="button" title={title} disabled={disabled} onClick={onClick}
            onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
            style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
                padding: '3px 8px', fontSize: 11, fontWeight: 600, fontFamily: FONT, borderRadius: '2px',
                color: readable(color), cursor: disabled ? 'default' : 'pointer',
                background: active ? tint(color, 18) : hover && !disabled ? 'var(--bg-hover)' : 'var(--bg-active)',
                border: `1px solid ${active ? color : 'var(--border-default)'}`,
                opacity: disabled && !active ? 0.55 : 1,
            }}>
            {children}
        </button>
    );
}

const ACTIVITY_TEXT = {
    created: () => 'created this task',
    status_changed: (a) => `moved ${statusLabel(a.from)} → ${statusLabel(a.to)}`,
    updated: (a) => `updated ${a.field || 'the task'}`,
    assignee_added: () => 'added an assignee',
    assignee_removed: () => 'removed an assignee',
    unblocked: () => 'unblocked the task',
    subtask_added: (a) => `added child issue${a.metadata?.subtaskTitle ? ` “${a.metadata.subtaskTitle}”` : ''}`,
};
const ACTIVITY_ICON = {
    created: <Plus size={11} style={{ color: 'var(--state-success)' }} />,
    status_changed: <ArrowRight size={11} style={{ color: 'var(--accent)' }} />,
    assignee_added: <User size={11} style={{ color: 'var(--text-secondary)' }} />,
    assignee_removed: <User size={11} style={{ color: 'var(--state-danger)' }} />,
};

function ActivityLog({ taskId }) {
    const [log, setLog] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        setError(null);
        api.get(`/api/v2/tasks/${taskId}/activity`)
            .then((r) => { if (alive) setLog(r.data.activities || r.data.activity || []); })
            .catch((e) => { if (alive) { setLog([]); setError(e?.response?.data?.message || 'Could not load activity.'); } })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [taskId]);

    const muted = { fontSize: 12, color: 'var(--text-secondary)', margin: 0 };
    if (loading) return <p style={muted}>Loading activity…</p>;
    if (error) return <p style={{ ...muted, color: 'var(--state-danger)' }}>{error}</p>;
    if (!log.length) return <p style={muted}>No activity yet.</p>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {log.map((a, i) => (
                <div key={a._id || i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{
                        width: 20, height: 20, borderRadius: '50%', flexShrink: 0, background: 'var(--bg-active)',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>{ACTIVITY_ICON[a.action] || <Activity size={11} style={{ color: 'var(--text-secondary)' }} />}</span>
                    <div style={{ minWidth: 0, fontSize: 12, lineHeight: 1.45 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{a.user?.username || 'Someone'}</span>{' '}
                        <span style={{ color: 'var(--text-secondary)' }}>{(ACTIVITY_TEXT[a.action] || (() => String(a.action || '').replace(/_/g, ' ')))(a)}</span>
                        {a.createdAt && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(a.createdAt).toLocaleString()}</div>}
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function ChannelTaskDetail({
    task, perms, members, currentUserId, isManager,
    onClose, onUpdate, onDelete, onRequestBlock, onToggleSubtask, onAddSubtask,
}) {
    const scheme = useColorScheme();
    const [tab, setTab] = useState('details');
    const [editTitle, setEditTitle] = useState(false);
    const [title, setTitle] = useState(task.title);
    const [editDesc, setEditDesc] = useState(false);
    const [desc, setDesc] = useState(task.description || '');
    const [pickAssignee, setPickAssignee] = useState(false);
    const [addingSub, setAddingSub] = useState(false);
    const [newSub, setNewSub] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => { if (!editTitle) setTitle(task.title); }, [task.title, editTitle]);
    useEffect(() => { if (!editDesc) setDesc(task.description || ''); }, [task.description, editDesc]);

    const run = async (fn) => { setBusy(true); try { return await fn(); } finally { setBusy(false); } };
    const save = (updates) => run(() => onUpdate(task, updates));

    const commitTitle = () => {
        setEditTitle(false);
        const t = title.trim();
        if (t && t !== task.title) save({ title: t }); else setTitle(task.title);
    };
    const commitDesc = () => {
        setEditDesc(false);
        if (desc !== (task.description || '')) save({ description: desc });
    };
    const moveTo = (s) => (s === 'blocked' ? onRequestBlock(task) : save({ status: s }));

    const assignable = members.filter((m) => !task.assigneeIds.includes(m.id));
    const nextStatuses = (TRANSITIONS[task.status] || []).filter((s) => s !== task.status);
    const submitSub = async () => {
        const t = newSub.trim();
        if (!t) return;
        const ok = await run(() => onAddSubtask(task, t));
        if (ok) { setNewSub(''); setAddingSub(false); }
    };

    const clickable = (enabled) => ({
        cursor: enabled ? 'text' : 'default', borderRadius: '2px', margin: '0 -4px', padding: '2px 4px',
    });

    return (
        <aside data-testid="channel-task-detail" style={{
            width: PANEL_WIDTH, flexShrink: 0, display: 'flex', flexDirection: 'column', height: '100%',
            backgroundColor: 'var(--bg-surface)', borderLeft: '1px solid var(--border-default)', overflow: 'hidden', fontFamily: FONT,
        }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px 10px 14px', flexShrink: 0,
                borderBottom: '1px solid var(--border-default)', backgroundColor: 'var(--bg-active)',
            }}>
                <IssueTypeIcon type={task.issueType || 'task'} />
                {task.issueKey && <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>{task.issueKey}</span>}
                <StatusBadge status={task.status} />
                <div style={{ flex: 1 }} />
                {busy && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-secondary)' }} />}
                <IconButton title="Close" onClick={onClose}><X size={14} /></IconButton>
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>
                {[{ key: 'details', label: 'Details', icon: <Eye size={12} /> }, { key: 'activity', label: 'Activity', icon: <Activity size={12} /> }].map((t) => (
                    <button key={t.key} type="button" onClick={() => setTab(t.key)} style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 12, fontWeight: 500, fontFamily: FONT,
                        color: tab === t.key ? 'var(--accent)' : 'var(--text-secondary)', background: 'none', border: 'none',
                        borderBottom: `2px solid ${tab === t.key ? 'var(--accent)' : 'transparent'}`, cursor: 'pointer',
                    }}>{t.icon} {t.label}</button>
                ))}
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {tab === 'activity' ? (
                    <div style={{ padding: 16 }}><ActivityLog taskId={task.id} /></div>
                ) : (
                    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
                        {/* Title */}
                        <div>
                            {editTitle ? (
                                <input autoFocus value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)}
                                    onBlur={commitTitle}
                                    onKeyDown={(e) => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') { setTitle(task.title); setEditTitle(false); } }}
                                    style={{ ...inputStyle(scheme), fontSize: 14, fontWeight: 600, borderColor: 'var(--accent)' }} />
                            ) : (
                                <p data-testid="channel-task-title" title={perms.edit ? 'Click to edit' : undefined}
                                    onClick={() => perms.edit && setEditTitle(true)}
                                    onMouseEnter={(e) => { if (perms.edit) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                    style={{ ...clickable(perms.edit), margin: '0 -4px', fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                                    {task.title}
                                </p>
                            )}
                        </div>

                        {task.status === 'blocked' && (
                            <div style={{
                                display: 'flex', gap: 8, padding: '8px 10px', borderRadius: '2px',
                                background: tint('var(--state-danger)', 10), border: `1px solid ${tint('var(--state-danger)', 45)}`,
                            }}>
                                <AlertTriangle size={13} style={{ color: 'var(--state-danger)', flexShrink: 0, marginTop: 1 }} />
                                <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.45, wordBreak: 'break-word' }}>
                                    <strong style={{ color: 'var(--state-danger)' }}>Blocked</strong>{task.blockedReason ? `: ${task.blockedReason}` : ''}
                                </div>
                            </div>
                        )}

                        {/* Description */}
                        <div>
                            <p style={sectionLabel}>Description</p>
                            {editDesc ? (
                                <textarea autoFocus rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={commitDesc}
                                    style={{ ...inputStyle(scheme), resize: 'vertical', lineHeight: 1.5, borderColor: 'var(--accent)' }} />
                            ) : (
                                <p onClick={() => perms.edit && setEditDesc(true)}
                                    onMouseEnter={(e) => { if (perms.edit) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                    style={{ ...clickable(perms.edit), fontSize: 12, lineHeight: 1.5, minHeight: 20, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: task.description ? 'var(--text-primary)' : 'var(--text-secondary)', fontStyle: task.description ? 'normal' : 'italic' }}>
                                    {task.description || (perms.edit ? 'Click to add a description…' : 'No description')}
                                </p>
                            )}
                        </div>

                        {/* Status */}
                        <div>
                            <p style={sectionLabel}>Move to</p>
                            {!perms.status ? (
                                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>Only assignees or workspace admins can change the status.</p>
                            ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {nextStatuses.map((s) => (
                                        <Chip key={s} color={STATUS_META[s]?.color} onClick={() => moveTo(s)} title={`Move to ${statusLabel(s)}`}>
                                            <ChevronRight size={10} /> {statusLabel(s)}
                                        </Chip>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Priority */}
                        <div>
                            <p style={sectionLabel}>Priority</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {PRIORITIES.map((p) => (
                                    <Chip key={p} active={task.priority === p} color={PRIORITY_META[p].color}
                                        disabled={!perms.edit} onClick={() => perms.edit && task.priority !== p && save({ priority: p })}>
                                        <PriorityIcon priority={p} size={11} /> {PRIORITY_META[p].label}
                                    </Chip>
                                ))}
                            </div>
                        </div>

                        {/* Assignees */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <p style={sectionLabel}>Assignees ({task.assignees.length})</p>
                                {perms.assignees && assignable.length > 0 && (
                                    <button type="button" onClick={() => setPickAssignee((v) => !v)} style={{ background: 'none', border: 'none', padding: 0, marginBottom: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--accent)', fontFamily: FONT }}>
                                        {pickAssignee ? 'Done' : '+ Add'}
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {task.assignees.length === 0 && <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>Unassigned</p>}
                                {task.assignees.map((a) => (
                                    <div key={a.id} data-testid="channel-task-assignee" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
                                        <Avatar user={a} size={22} />
                                        <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {a.username}{a.id === String(currentUserId) ? ' (you)' : ''}
                                        </span>
                                        {perms.assignees && (
                                            <IconButton title={`Remove ${a.username}`} danger
                                                onClick={() => save({ assignedTo: task.assigneeIds.filter((id) => id !== a.id) })}>
                                                <X size={12} />
                                            </IconButton>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {pickAssignee && perms.assignees && (
                                <div style={{ marginTop: 6, border: '1px solid var(--border-default)', borderRadius: '2px', maxHeight: 160, overflowY: 'auto', background: 'var(--bg-active)' }}>
                                    {assignable.length === 0 && <p style={{ margin: 0, padding: 8, fontSize: 12, color: 'var(--text-secondary)' }}>Everyone in the channel is assigned.</p>}
                                    {assignable.map((m) => (
                                        <button key={m.id} type="button" onClick={() => save({ assignedTo: [...task.assigneeIds, m.id] })}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: FONT }}>
                                            <Avatar user={m} size={18} />
                                            <span style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.username}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Due date */}
                        <div>
                            <label htmlFor={`due-${task.id}`} style={{ ...sectionLabel, display: 'block' }}>Due date</label>
                            <input id={`due-${task.id}`} type="date" disabled={!perms.edit}
                                value={dateInputValue(task.dueDate)}
                                onChange={(e) => save({ dueDate: e.target.value ? new Date(`${e.target.value}T00:00:00`).toISOString() : null })}
                                style={{ ...inputStyle(scheme), opacity: perms.edit ? 1 : 0.7 }} />
                        </div>

                        {/* Child issues */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <p style={sectionLabel}>Child issues ({task.subtasks.filter((s) => s.status === 'done').length}/{task.subtasks.length})</p>
                                {perms.subtask && (
                                    <button type="button" onClick={() => setAddingSub((v) => !v)} style={{ background: 'none', border: 'none', padding: 0, marginBottom: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--accent)', fontFamily: FONT }}>
                                        {addingSub ? 'Cancel' : '+ Add'}
                                    </button>
                                )}
                            </div>
                            {addingSub && (
                                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                                    <input autoFocus value={newSub} maxLength={200} onChange={(e) => setNewSub(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') submitSub(); if (e.key === 'Escape') setAddingSub(false); }}
                                        placeholder="Child issue title…" style={{ ...inputStyle(scheme), flex: 1, borderColor: 'var(--accent)' }} />
                                    <button type="button" onClick={submitSub} disabled={!newSub.trim()} style={{ ...primaryBtn, padding: '4px 10px', fontSize: 11, opacity: newSub.trim() ? 1 : 0.5 }}>Add</button>
                                </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {task.subtasks.map((s) => {
                                    const done = s.status === 'done';
                                    const can = canToggleSubtask(s, currentUserId, isManager) && s.status !== 'cancelled';
                                    return (
                                        <div key={s.id} data-testid="channel-task-subtask" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 2px' }}>
                                            <button type="button" role="checkbox" aria-checked={done} disabled={!can}
                                                title={can ? (done ? 'Mark as to do' : 'Mark as done') : 'Only its assignees or workspace admins can change this'}
                                                onClick={() => can && onToggleSubtask(task, s)}
                                                style={{
                                                    width: 14, height: 14, padding: 0, borderRadius: '2px', flexShrink: 0,
                                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                    border: `1px solid ${done ? 'var(--state-success)' : 'var(--border-accent)'}`,
                                                    background: done ? 'var(--state-success)' : 'transparent',
                                                    cursor: can ? 'pointer' : 'not-allowed', opacity: can ? 1 : 0.6,
                                                }}>
                                                {done && <Check size={10} strokeWidth={3} style={{ color: '#fff' }} />}
                                            </button>
                                            <span style={{
                                                flex: 1, minWidth: 0, fontSize: 12, wordBreak: 'break-word',
                                                color: done ? 'var(--text-secondary)' : 'var(--text-primary)',
                                                textDecoration: done ? 'line-through' : 'none',
                                                fontStyle: s.title ? 'normal' : 'italic',
                                            }}>{s.title || 'Child issue'}</span>
                                            {!done && s.status !== 'todo' && <span style={{ fontSize: 10, color: readable(STATUS_META[s.status]?.color || 'var(--text-secondary)'), whiteSpace: 'nowrap' }}>{statusLabel(s.status)}</span>}
                                        </div>
                                    );
                                })}
                                {task.subtasks.length === 0 && !addingSub && <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>No child issues</p>}
                            </div>
                        </div>

                        {task.labels?.length > 0 && (
                            <div>
                                <p style={sectionLabel}>Labels</p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {task.labels.map((l) => (
                                        <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', fontSize: 11, borderRadius: '2px', background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                                            <Tag size={9} /> {l}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {task.creator && (
                            <div>
                                <p style={sectionLabel}>Reporter</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Avatar user={task.creator} size={20} />
                                    <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{task.creator.username}</span>
                                </div>
                            </div>
                        )}

                        {perms.delete && (
                            <div style={{ paddingTop: 12, borderTop: '1px solid var(--border-default)' }}>
                                <button type="button" onClick={() => onDelete(task)} style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', fontSize: 12, fontWeight: 500, fontFamily: FONT,
                                    color: 'var(--state-danger)', background: 'transparent', border: `1px solid ${tint('var(--state-danger)', 45)}`, borderRadius: '2px', cursor: 'pointer',
                                }}><Trash2 size={12} /> Delete issue</button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </aside>
    );
}
