import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Plus, AlertTriangle, RotateCcw, BookOpen, Archive } from 'lucide-react';
import api from '@services/api';
import { useWorkspace } from '../../../../contexts/WorkspaceContext';
import { useToast } from '../../../../contexts/ToastContext';
import {
    BOARD_STATUSES, STATUS_META, canTransition, statusLabel, upsertTask, taskErrorMessage,
} from '../../../../utils/taskMeta';
import {
    FONT, mapChannelTask, isBoardTask, resolveSubtasks, taskPerms, applyLocalUpdate,
} from './channelTasks/channelTaskUtils';
import { BlockedReasonDialog, primaryBtn, tint } from './channelTasks/ChannelTaskUi';
import { KanbanColumn } from './channelTasks/ChannelTaskBoard';
import ChannelTaskDetail from './channelTasks/ChannelTaskDetail';
import ChannelTaskCreateModal from './channelTasks/ChannelTaskCreateModal';

const NO_INLINE_ADD = ['blocked', 'done', 'cancelled'];

/** Upsert a task, keeping subtask titles we already know when the new copy only has ids. */
function mergeTask(list, task) {
    const old = list.find((x) => x.id === task.id);
    if (!old) return upsertTask(list, task);
    const known = new Map(old.subtasks.map((s) => [s.id, s]));
    return upsertTask(list, { ...task, subtasks: task.subtasks.map((s) => (s.title ? s : known.get(s.id) || s)) });
}

/** Add, update or (when `remove`) drop a child issue inside its parent card. */
function patchSubtask(list, sub, remove = false) {
    return list.map((t) => {
        const has = t.subtasks.some((s) => s.id === sub.id);
        if (remove) return has ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== sub.id) } : t;
        if (t.id !== sub.parentTaskId && !has) return t;
        const entry = { id: sub.id, title: sub.title, status: sub.status, assigneeIds: sub.assigneeIds || [] };
        return has
            ? { ...t, subtasks: t.subtasks.map((s) => (s.id === sub.id ? { ...s, ...entry } : s)) }
            : { ...t, subtasks: [...t.subtasks, entry] };
    });
}

const toSub = (m) => ({ id: m.id, title: m.title, status: m.status, assigneeIds: m.assigneeIds, parentTaskId: m.parentTaskId });

export default function TasksTab({ channelId, channelName, workspaceId: workspaceIdProp, currentUserId, socket }) {
    const { activeWorkspace } = useWorkspace();
    const { showToast } = useToast();
    const workspaceId = workspaceIdProp || activeWorkspace?.id || activeWorkspace?._id;
    const isManager = ['owner', 'admin'].includes(activeWorkspace?.role);
    const me = String(currentUserId || '');

    const [tasks, setTasks] = useState([]);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [createStatus, setCreateStatus] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const [filter, setFilter] = useState('all');
    const [showCancelled, setShowCancelled] = useState(false);
    const [drag, setDrag] = useState(null);
    const [blockTarget, setBlockTarget] = useState(null);

    const tasksRef = useRef(tasks);
    tasksRef.current = tasks;
    const loadSeq = useRef(0);

    const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
    const permsFor = useCallback((t) => taskPerms(t, me, isManager), [me, isManager]);
    const fail = useCallback((err, fallback) => showToast(taskErrorMessage(err, fallback), 'error'), [showToast]);

    const loadTasks = useCallback(async () => {
        const seq = ++loadSeq.current;
        if (!channelId || !workspaceId) { setLoading(false); return; }
        try {
            setFetchError(null);
            const res = await api.get('/api/v2/tasks', { params: { workspaceId } });
            if (seq !== loadSeq.current) return;
            const all = (res.data.tasks || []).map(mapChannelTask).filter(Boolean);
            const byId = new Map(all.map((t) => [t.id, t]));
            setTasks(all.filter((t) => isBoardTask(t, channelId)).map((t) => resolveSubtasks(t, byId)));
        } catch (err) {
            if (seq !== loadSeq.current) return;
            setTasks([]);
            setFetchError(taskErrorMessage(err, 'Could not load tasks. Check your connection and try again.'));
        } finally {
            if (seq === loadSeq.current) setLoading(false);
        }
    }, [channelId, workspaceId]);

    const loadMembers = useCallback(async () => {
        if (!channelId) return;
        try {
            const res = await api.get(`/api/channels/${channelId}/members`, { params: { limit: 200 } });
            setMembers((res.data.members || []).map((m) => ({
                id: String(m._id || m.id), username: m.username || 'Unknown', profilePicture: m.profilePicture || null,
            })));
        } catch { setMembers([]); }
    }, [channelId]);

    useEffect(() => {
        setLoading(true);
        setSelectedId(null);
        loadTasks();
        loadMembers();
    }, [loadTasks, loadMembers]);

    // Live updates from the channel room and the viewer's own user room.
    useEffect(() => {
        if (!socket || !channelId) return undefined;
        const onUpsert = (raw) => {
            const t = mapChannelTask(raw?.task && !raw?.title ? raw.task : raw);
            if (!t?.id) return;
            if (t.isSubtask) { setTasks((p) => patchSubtask(p, toSub(t), t.deleted)); return; }
            setTasks((p) => (isBoardTask(t, channelId) ? mergeTask(p, t) : p.filter((x) => x.id !== t.id)));
        };
        const onDeleted = (payload) => {
            const id = String(payload?.taskId || payload?._id || '');
            if (!id) return;
            setTasks((p) => patchSubtask(p.filter((x) => x.id !== id), { id }, true));
            setSelectedId((s) => (s === id ? null : s));
        };
        // An assignee hiding a finished task only removes it for themselves.
        const onRemoved = (payload) => { if (payload?.reason === 'hidden') onDeleted(payload); };
        const onSubtask = ({ subtask, parentTaskId } = {}) => {
            const s = mapChannelTask(subtask);
            if (s) setTasks((p) => patchSubtask(p, { ...toSub(s), parentTaskId: s.parentTaskId || String(parentTaskId || '') }));
        };
        socket.on('task-created', onUpsert);
        socket.on('task-updated', onUpsert);
        socket.on('task-restored', onUpsert);
        socket.on('task-deleted', onDeleted);
        socket.on('task-removed', onRemoved);
        socket.on('subtask-created', onSubtask);
        return () => {
            socket.off('task-created', onUpsert);
            socket.off('task-updated', onUpsert);
            socket.off('task-restored', onUpsert);
            socket.off('task-deleted', onDeleted);
            socket.off('task-removed', onRemoved);
            socket.off('subtask-created', onSubtask);
        };
    }, [socket, channelId]);

    const handleCreate = useCallback(async (data) => {
        try {
            const res = await api.post('/api/v2/tasks', {
                title: data.title,
                description: data.description || '',
                priority: data.priority,
                status: data.status,
                workspaceId,
                assignmentType: 'channel',
                channelId,
                assignedToIds: data.assignedToIds || [],
                visibility: 'channel',
                ...(data.dueDate ? { dueDate: data.dueDate } : {}),
            });
            const created = (res.data.tasks || (res.data.task ? [res.data.task] : [])).map(mapChannelTask).filter(Boolean);
            setTasks((p) => created.filter((t) => isBoardTask(t, channelId)).reduce(mergeTask, p));
            setCreateStatus(null);
            return null;
        } catch (err) {
            return taskErrorMessage(err, 'Could not create the task.');
        }
    }, [channelId, workspaceId]);

    const handleInlineAdd = useCallback(async (title, status) => {
        const error = await handleCreate({ title, priority: 'medium', status });
        if (error) showToast(error, 'error');
    }, [handleCreate, showToast]);

    /** Optimistic update with rollback. Resolves true on success. */
    const handleUpdate = useCallback(async (task, updates) => {
        const prev = tasksRef.current.find((x) => x.id === task.id);
        if (!prev) return false;
        setTasks((p) => p.map((x) => (x.id === task.id ? applyLocalUpdate(x, updates, memberById) : x)));
        try {
            const res = await api.put(`/api/v2/tasks/${task.id}`, updates);
            const updated = mapChannelTask(res.data.task);
            if (updated) setTasks((p) => mergeTask(p, updated));
            return true;
        } catch (err) {
            setTasks((p) => p.map((x) => (x.id === task.id ? prev : x)));
            fail(err, 'Could not update the task.');
            return false;
        }
    }, [memberById, fail]);

    const handleDelete = useCallback(async (task) => {
        const list = tasksRef.current;
        const index = list.findIndex((x) => x.id === task.id);
        if (index === -1) return;
        const prev = list[index];
        setTasks((p) => p.filter((x) => x.id !== task.id));
        setSelectedId((s) => (s === task.id ? null : s));
        try {
            await api.delete(`/api/v2/tasks/${task.id}`);
            showToast(`Deleted “${prev.title}”`, 'success');
        } catch (err) {
            setTasks((p) => {
                if (p.some((x) => x.id === prev.id)) return p;
                const next = p.slice();
                next.splice(Math.min(index, next.length), 0, prev);
                return next;
            });
            fail(err, 'Could not delete the task.');
        }
    }, [fail, showToast]);

    const handleMove = useCallback((task, status) => {
        if (task.status === status) return;
        if (!canTransition(task.status, status)) {
            showToast(`Can't move from ${statusLabel(task.status)} to ${statusLabel(status)}.`, 'warning');
            return;
        }
        if (status === 'blocked') { setBlockTarget(task); return; }
        handleUpdate(task, { status });
    }, [handleUpdate, showToast]);

    const handleToggleSubtask = useCallback(async (parent, sub) => {
        const next = sub.status === 'done' ? 'todo' : 'done';
        const patch = (status) => setTasks((p) => p.map((t) => (t.id === parent.id
            ? { ...t, subtasks: t.subtasks.map((s) => (s.id === sub.id ? { ...s, status } : s)) }
            : t)));
        patch(next);
        try {
            await api.put(`/api/v2/tasks/${sub.id}`, { status: next });
        } catch (err) {
            patch(sub.status);
            fail(err, 'Could not update the child issue.');
        }
    }, [fail]);

    const handleAddSubtask = useCallback(async (parent, title) => {
        try {
            // Assign the child issue to its author so they can tick it off
            // (the server lets only assignees and admins change a status).
            const res = await api.post(`/api/v2/tasks/${parent.id}/subtasks`, {
                title, priority: parent.priority, ...(me ? { assignedTo: [me] } : {}),
            });
            const s = mapChannelTask(res.data.subtask);
            if (s) setTasks((p) => patchSubtask(p, { ...toSub(s), parentTaskId: parent.id }));
            return true;
        } catch (err) {
            fail(err, 'Could not add the child issue.');
            return false;
        }
    }, [fail, me]);

    const filtered = useMemo(() => {
        if (filter === 'mine') return tasks.filter((t) => t.assigneeIds.includes(me) || t.creatorId === me);
        if (filter === 'high') return tasks.filter((t) => t.priority === 'high' || t.priority === 'highest');
        return tasks;
    }, [tasks, filter, me]);

    const columns = showCancelled ? [...BOARD_STATUSES, 'cancelled'] : BOARD_STATUSES;
    const byStatus = useMemo(() => {
        const map = Object.fromEntries([...BOARD_STATUSES, 'cancelled'].map((s) => [s, []]));
        filtered.forEach((t) => { (map[t.status] || map.todo).push(t); });
        return map;
    }, [filtered]);

    const selected = selectedId ? tasks.find((t) => t.id === selectedId) : null;
    const doneCount = tasks.filter((t) => t.status === 'done').length;
    const blockedCount = tasks.filter((t) => t.status === 'blocked').length;
    const cancelledCount = byStatus.cancelled.length;
    const activeCount = tasks.filter((t) => t.status !== 'cancelled').length;

    if (loading) {
        return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: 'var(--bg-base)' }}>
                <div style={{ padding: '10px 16px', backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', opacity: 0.6 }}>
                    <div style={{ height: 14, width: 180, backgroundColor: 'var(--bg-active)', borderRadius: '2px' }} />
                    <div style={{ height: 28, width: 72, backgroundColor: 'var(--bg-active)', borderRadius: '2px' }} />
                </div>
                <div style={{ flex: 1, display: 'flex', gap: 8, padding: 12, minHeight: 0, overflow: 'hidden' }}>
                    {BOARD_STATUSES.map((s) => (
                        <div key={s} style={{ flex: '1 0 168px', borderRadius: '2px', backgroundColor: 'var(--bg-surface)', borderTop: `2px solid ${STATUS_META[s].color}`, padding: 10 }}>
                            <div style={{ height: 10, width: 72, backgroundColor: 'var(--bg-hover)', borderRadius: '2px', marginBottom: 10 }} />
                            {[1, 2].map((i) => (
                                <div key={i} style={{ backgroundColor: 'var(--bg-active)', borderRadius: '2px', marginBottom: 6, padding: 10 }}>
                                    <div style={{ height: 10, width: '80%', backgroundColor: 'var(--bg-hover)', borderRadius: '2px', marginBottom: 6 }} />
                                    <div style={{ height: 8, width: '50%', backgroundColor: 'var(--bg-hover)', borderRadius: '2px' }} />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const filterBtn = (active) => ({
        fontSize: 12, padding: '3px 10px', borderRadius: '2px', whiteSpace: 'nowrap', fontFamily: FONT,
        backgroundColor: active ? 'var(--accent-dim)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: active ? 600 : 400,
        border: '1px solid transparent', cursor: 'pointer',
    });

    return (
        <div data-testid="channel-tasks-tab" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', backgroundColor: 'var(--bg-base)', fontFamily: FONT }}>
            <div style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, rowGap: 6,
                padding: '8px 16px', backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)',
            }}>
                <BookOpen size={14} style={{ color: 'var(--text-secondary)' }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    #{(channelName || '').replace(/^#/, '')}
                </span>
                <div style={{ width: 1, height: 14, backgroundColor: 'var(--border-default)', margin: '0 4px' }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {activeCount} issue{activeCount !== 1 ? 's' : ''}
                    {doneCount > 0 && <> · <span style={{ color: 'var(--state-success)', fontWeight: 500 }}>{doneCount} done</span></>}
                    {blockedCount > 0 && <> · <span style={{ color: 'var(--state-danger)', fontWeight: 500 }}>{blockedCount} blocked</span></>}
                </span>
                <div style={{ width: 1, height: 14, backgroundColor: 'var(--border-default)', margin: '0 4px' }} />
                {[{ key: 'all', label: 'All issues' }, { key: 'mine', label: 'My issues' }, { key: 'high', label: 'High priority' }].map((f) => (
                    <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)} style={filterBtn(filter === f.key)}>{f.label}</button>
                ))}
                <button type="button" aria-pressed={showCancelled} onClick={() => setShowCancelled((v) => !v)}
                    title={showCancelled ? 'Hide the Cancelled column' : 'Show the Cancelled column'}
                    style={{ ...filterBtn(showCancelled), display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid var(--border-default)' }}>
                    <Archive size={11} /> Cancelled ({cancelledCount})
                </button>
                <div style={{ flex: 1 }} />
                <button type="button" onClick={() => setCreateStatus('todo')} style={primaryBtn}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent)'; }}>
                    <Plus size={13} strokeWidth={2.5} /> Create
                </button>
            </div>

            {fetchError && (
                <div role="alert" style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    margin: '12px 16px 0', padding: '10px 14px', borderRadius: '2px', fontSize: 13,
                    backgroundColor: tint('var(--state-danger)', 8), border: `1px solid ${tint('var(--state-danger)', 40)}`,
                    borderLeft: '3px solid var(--state-danger)', color: 'var(--text-primary)',
                }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AlertTriangle size={15} style={{ color: 'var(--state-danger)', flexShrink: 0 }} /> {fetchError}
                    </span>
                    <button type="button" onClick={() => { setLoading(true); loadTasks(); }} style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, fontFamily: FONT, flexShrink: 0,
                        color: 'var(--text-primary)', backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-default)', borderRadius: '2px', cursor: 'pointer',
                    }}><RotateCcw size={12} /> Retry</button>
                </div>
            )}

            <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
                <div data-testid="channel-task-board" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', gap: 8, padding: 12, overflowX: 'auto', overflowY: 'hidden' }}>
                    {columns.map((s) => (
                        <KanbanColumn
                            key={s}
                            status={s}
                            tasks={byStatus[s]}
                            permsFor={permsFor}
                            selectedId={selectedId}
                            canAdd={!NO_INLINE_ADD.includes(s)}
                            onAdd={handleInlineAdd}
                            onOpen={(t) => setSelectedId(t.id)}
                            onDelete={handleDelete}
                            drag={drag}
                            onDragStart={(t) => setDrag({ id: t.id, status: t.status })}
                            onDragEnd={() => setDrag(null)}
                            onDropTask={(d, status) => {
                                setDrag(null);
                                const t = tasksRef.current.find((x) => x.id === d.id);
                                if (t) handleMove(t, status);
                            }}
                        />
                    ))}
                </div>

                {selected && (
                    <ChannelTaskDetail
                        key={selected.id}
                        task={selected}
                        perms={permsFor(selected)}
                        members={members}
                        currentUserId={me}
                        isManager={isManager}
                        onClose={() => setSelectedId(null)}
                        onUpdate={handleUpdate}
                        onDelete={handleDelete}
                        onRequestBlock={setBlockTarget}
                        onToggleSubtask={handleToggleSubtask}
                        onAddSubtask={handleAddSubtask}
                    />
                )}
            </div>

            {createStatus && (
                <ChannelTaskCreateModal
                    channelName={(channelName || '').replace(/^#/, '')}
                    members={members}
                    defaultStatus={createStatus}
                    onClose={() => setCreateStatus(null)}
                    onSubmit={handleCreate}
                />
            )}

            {blockTarget && (
                <BlockedReasonDialog
                    taskTitle={blockTarget.title}
                    onCancel={() => setBlockTarget(null)}
                    onConfirm={(reason) => {
                        const t = blockTarget;
                        setBlockTarget(null);
                        handleUpdate(t, { status: 'blocked', blockedReason: reason });
                    }}
                />
            )}
        </div>
    );
}
