import React, { useEffect, useRef, useState } from 'react';
import { Plus, X, Calendar, AlertTriangle, ListTodo } from 'lucide-react';
import { STATUS_META, PRIORITY_META, statusLabel, canTransition } from '../../../../../utils/taskMeta';
import { FONT, fmtDate, isOverdue } from './channelTaskUtils';
import { Avatar, IssueTypeIcon, PriorityIcon, IconButton, primaryBtn, secondaryBtn, readable } from './ChannelTaskUi';

const COLUMN_MIN_WIDTH = 168;

function InlineAdd({ onSubmit, onCancel }) {
    const [title, setTitle] = useState('');
    const ref = useRef(null);
    useEffect(() => { ref.current?.focus(); }, []);
    const submit = (e) => { e?.preventDefault(); if (title.trim()) onSubmit(title.trim()); };
    return (
        <div style={{ borderRadius: '2px', border: '1px solid var(--accent)', backgroundColor: 'var(--bg-active)', marginBottom: 6 }}>
            <input
                ref={ref}
                value={title}
                maxLength={200}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
                onBlur={() => { if (!title.trim()) onCancel(); }}
                placeholder="What needs to be done?"
                style={{
                    width: '100%', padding: '8px 10px', fontSize: 13, boxSizing: 'border-box',
                    background: 'transparent', color: 'var(--text-primary)', border: 'none', outline: 'none', fontFamily: FONT,
                }}
            />
            {title.trim() && (
                <div style={{ display: 'flex', gap: 6, padding: '0 8px 8px' }}>
                    <button type="button" onMouseDown={submit} style={{ ...primaryBtn, padding: '3px 10px', fontSize: 11 }}>Create</button>
                    <button type="button" onMouseDown={onCancel} style={{ ...secondaryBtn, padding: '3px 10px', fontSize: 11 }}>Cancel</button>
                </div>
            )}
        </div>
    );
}

export function TaskCard({ task, perms, selected, onOpen, onDelete, onDragStart, onDragEnd, dragging }) {
    const [hover, setHover] = useState(false);
    const blocked = task.status === 'blocked';
    const closed = task.status === 'done' || task.status === 'cancelled';
    const overdue = isOverdue(task);
    const subDone = task.subtasks.filter((s) => s.status === 'done').length;
    const priorityColor = PRIORITY_META[task.priority]?.color || PRIORITY_META.medium.color;
    const edge = `1px solid ${blocked ? 'var(--state-danger)' : selected ? 'var(--accent)' : hover ? 'var(--border-accent)' : 'var(--border-default)'}`;

    return (
        <div
            role="button"
            tabIndex={0}
            data-testid="channel-task-card"
            data-task-id={task.id}
            draggable={perms.status}
            onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', task.id);
                onDragStart(task);
            }}
            onDragEnd={onDragEnd}
            onClick={() => onOpen(task)}
            onKeyDown={(e) => { if (e.key === 'Enter') onOpen(task); }}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                backgroundColor: hover || selected ? 'var(--bg-hover)' : 'var(--bg-active)',
                borderRadius: '2px', cursor: perms.status ? 'grab' : 'pointer', marginBottom: 6, position: 'relative',
                borderTop: edge, borderRight: edge, borderBottom: edge,
                borderLeft: `3px solid ${priorityColor}`,
                opacity: dragging ? 0.45 : 1, outline: 'none',
                transition: 'background-color 150ms ease, border-color 150ms ease',
                fontFamily: FONT,
            }}
        >
            {blocked && (
                <div title={task.blockedReason || ''} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px 0',
                    fontSize: 10, fontWeight: 700, color: 'var(--state-danger)',
                    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                }}>
                    <AlertTriangle size={10} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        BLOCKED{task.blockedReason ? `: ${task.blockedReason}` : ''}
                    </span>
                </div>
            )}
            <div style={{ padding: '8px 10px 9px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, minHeight: 16 }}>
                    <IssueTypeIcon type={task.issueType || 'task'} />
                    {task.issueKey && (
                        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>{task.issueKey}</span>
                    )}
                    <div style={{ flex: 1 }} />
                    {perms.delete && (
                        <IconButton title="Delete task" danger onClick={(e) => { e.stopPropagation(); onDelete(task); }}
                            style={{ opacity: hover ? 1 : 0, padding: 2 }}>
                            <X size={11} />
                        </IconButton>
                    )}
                </div>
                <p style={{
                    margin: '0 0 8px', fontSize: 13, lineHeight: 1.4, wordBreak: 'break-word',
                    color: closed ? 'var(--text-secondary)' : 'var(--text-primary)',
                    textDecoration: task.status === 'done' ? 'line-through' : 'none',
                }}>{task.title}</p>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <span title={`${PRIORITY_META[task.priority]?.label || 'Medium'} priority`} style={{ display: 'inline-flex' }}>
                        <PriorityIcon priority={task.priority} size={13} />
                    </span>
                    {task.dueDate && (
                        <span title={overdue ? 'Overdue' : 'Due date'} style={{
                            display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 500,
                            color: overdue ? 'var(--state-danger)' : 'var(--text-secondary)',
                        }}><Calendar size={9} />{fmtDate(task.dueDate)}</span>
                    )}
                    {task.subtasks.length > 0 && (
                        <span title="Child issues done" style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-secondary)' }}>
                            <ListTodo size={9} /> {subDone}/{task.subtasks.length}
                        </span>
                    )}
                    <div style={{ flex: 1 }} />
                    <div style={{ display: 'flex' }}>
                        {task.assignees.slice(0, 3).map((a, i) => (
                            <span key={a.id} style={{ marginLeft: i ? -5 : 0, borderRadius: '50%', boxShadow: '0 0 0 1.5px var(--bg-active)', display: 'inline-flex' }}>
                                <Avatar user={a} size={18} />
                            </span>
                        ))}
                        {task.assignees.length > 3 && (
                            <span style={{ marginLeft: 3, fontSize: 10, color: 'var(--text-secondary)', alignSelf: 'center' }}>+{task.assignees.length - 3}</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function KanbanColumn({
    status, tasks, permsFor, selectedId, canAdd, onAdd, onOpen, onDelete,
    drag, onDragStart, onDragEnd, onDropTask,
}) {
    const [adding, setAdding] = useState(false);
    const [over, setOver] = useState(false);
    const color = readable(STATUS_META[status]?.color || 'var(--text-secondary)');
    const accepts = !!drag && drag.status !== status && canTransition(drag.status, status);
    const dimmed = !!drag && drag.status !== status && !accepts;

    return (
        <div
            data-testid={`channel-task-column-${status}`}
            onDragOver={(e) => { if (accepts) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!over) setOver(true); } }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); }}
            onDrop={(e) => { e.preventDefault(); setOver(false); if (accepts) onDropTask(drag, status); }}
            style={{
                flex: `1 0 ${COLUMN_MIN_WIDTH}px`, minWidth: COLUMN_MIN_WIDTH, display: 'flex', flexDirection: 'column', minHeight: 0,
                backgroundColor: over ? 'var(--bg-hover)' : 'var(--bg-surface)',
                outline: over ? '1px dashed var(--accent)' : accepts ? '1px dashed var(--border-accent)' : 'none',
                outlineOffset: -1, opacity: dimmed ? 0.5 : 1, borderRadius: '2px',
                transition: 'background-color 120ms ease, opacity 120ms ease',
            }}
        >
            <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', flexShrink: 0,
                borderTop: `2px solid ${color}`, borderBottom: '1px solid var(--border-subtle)',
            }}>
                <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
                    color, whiteSpace: 'nowrap', fontFamily: FONT,
                }}>{statusLabel(status)}</span>
                <span style={{
                    fontSize: 10, fontWeight: 700, minWidth: 18, height: 18, padding: '0 4px', boxSizing: 'border-box', borderRadius: '2px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'var(--bg-active)', color: 'var(--text-secondary)', fontFamily: FONT,
                }}>{tasks.length}</span>
                <div style={{ flex: 1 }} />
                {canAdd && (
                    <IconButton title={`Add to ${statusLabel(status)}`} onClick={() => setAdding((v) => !v)}><Plus size={13} /></IconButton>
                )}
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 8px 8px' }}>
                {adding && (
                    <InlineAdd
                        onSubmit={(title) => { onAdd(title, status); setAdding(false); }}
                        onCancel={() => setAdding(false)}
                    />
                )}
                {tasks.length === 0 && !adding ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 60 }}>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', fontFamily: FONT }}>
                            {accepts ? 'Drop here' : 'No issues'}
                        </p>
                    </div>
                ) : tasks.map((t) => (
                    <TaskCard
                        key={t.id}
                        task={t}
                        perms={permsFor(t)}
                        selected={selectedId === t.id}
                        dragging={drag?.id === t.id}
                        onOpen={onOpen}
                        onDelete={onDelete}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                    />
                ))}
            </div>
        </div>
    );
}
