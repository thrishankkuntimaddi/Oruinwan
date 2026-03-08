import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Plus, X, AlignLeft, Loader2, ChevronUp, ChevronDown, Minus, Calendar } from 'lucide-react';
import api from '../../../../services/api';
import { useWorkspace } from '../../../../contexts/WorkspaceContext';

// ─── Jira-style design tokens ────────────────────────────────────────────────

const JIRA_BLUE = '#0052CC';

const COLUMNS = [
    { key: 'todo', label: 'TO DO', headerBg: '#DFE1E6', headerColor: '#42526E' },
    { key: 'in_progress', label: 'IN PROGRESS', headerBg: '#DEEBFF', headerColor: '#0052CC' },
    { key: 'done', label: 'DONE', headerBg: '#E3FCEF', headerColor: '#006644' },
];

const PRIORITIES = [
    { key: 'highest', label: 'Highest', color: '#CD1317', icon: '↑↑' },
    { key: 'high', label: 'High', color: '#E97F33', icon: '↑' },
    { key: 'medium', label: 'Medium', color: '#E2B203', icon: '═' },
    { key: 'low', label: 'Low', color: '#3E7FC1', icon: '↓' },
    { key: 'lowest', label: 'Lowest', color: '#7A869A', icon: '↓↓' },
];

const pMap = Object.fromEntries(PRIORITIES.map(p => [p.key, p]));
const pMeta = k => pMap[k] || pMap.medium;
const cycleStatus = { todo: 'in_progress', in_progress: 'done', done: 'todo' };

// ─── Priority Icon (Jira arrow style) ────────────────────────────────────────

function PriorityIcon({ priority }) {
    const m = pMeta(priority);
    const isHighest = priority === 'highest';
    const isHigh = priority === 'high';
    const isLow = priority === 'low';
    const isLowest = priority === 'lowest';
    const size = 14;

    if (isHighest) return (
        <span title={m.label} className="inline-flex flex-col" style={{ color: m.color, lineHeight: 1, fontSize: 9, fontWeight: 900 }}>▲▲</span>
    );
    if (isHigh) return (
        <ChevronUp size={size} strokeWidth={3} style={{ color: m.color }} title={m.label} />
    );
    if (isLow) return (
        <ChevronDown size={size} strokeWidth={3} style={{ color: m.color }} title={m.label} />
    );
    if (isLowest) return (
        <span title={m.label} className="inline-flex flex-col" style={{ color: m.color, lineHeight: 1, fontSize: 9, fontWeight: 900 }}>▼▼</span>
    );
    return <Minus size={size} strokeWidth={2.5} style={{ color: m.color }} title={m.label} />;
}

// ─── Quick-Add inline form (appears under column header) ─────────────────────

function InlineAdd({ onSubmit, onCancel }) {
    const [title, setTitle] = useState('');
    const ref = useRef();
    useEffect(() => ref.current?.focus(), []);

    const submit = (e) => {
        e.preventDefault();
        if (title.trim()) onSubmit(title.trim());
    };

    return (
        <div className="bg-white rounded border-2 p-2 mb-2" style={{ borderColor: JIRA_BLUE }}>
            <input
                ref={ref}
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}
                onBlur={() => { if (!title.trim()) onCancel(); }}
                placeholder="What needs to be done?"
                className="w-full text-sm text-gray-800 focus:outline-none"
            />
            <div className="flex gap-2 mt-2">
                <button onMouseDown={submit}
                    className="px-3 py-1 text-xs font-semibold text-white rounded"
                    style={{ background: JIRA_BLUE }}>
                    Create
                </button>
                <button onMouseDown={onCancel}
                    className="px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded transition-colors">
                    Cancel
                </button>
            </div>
        </div>
    );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task, onClick, onDelete }) {
    const overdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';
    const initials = (name) => name ? name.slice(0, 2).toUpperCase() : '?';
    const assignee = task.assignedTo?.[0];
    const assigneeName = assignee?.username || assignee?.name || '';

    return (
        <div
            onClick={() => onClick(task)}
            className="group bg-white rounded cursor-pointer transition-shadow duration-150 mb-2"
            style={{
                boxShadow: '0 1px 2px rgba(9,30,66,0.25)',
                border: '1px solid transparent',
            }}
            onMouseEnter={e => {
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(9,30,66,0.25), 0 0 0 1px rgba(0,82,204,0.5)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(9,30,66,0.25)';
            }}
        >
            <div className="p-2.5">
                {/* Summary */}
                <p className={`text-sm text-gray-800 leading-snug mb-2 ${task.status === 'done' ? 'line-through text-gray-400' : ''}`}>
                    {task.title}
                </p>

                {/* Description preview */}
                {task.description && (
                    <p className="text-xs text-gray-400 mb-2 line-clamp-1">{task.description}</p>
                )}

                {/* Bottom row: priority + due date + assignee */}
                <div className="flex items-center gap-1.5">
                    {/* Issue type icon (story/task dot) */}
                    <div className="w-4 h-4 rounded-sm flex items-center justify-center flex-shrink-0"
                        style={{ background: task.status === 'done' ? '#006644' : task.status === 'in_progress' ? '#0052CC' : '#42526E' }}>
                        <div className="w-2 h-2 rounded-full bg-white opacity-90" />
                    </div>

                    {/* Priority */}
                    <PriorityIcon priority={task.priority || 'medium'} />

                    {/* Due date */}
                    {task.dueDate && (
                        <span className={`text-[10px] font-medium flex items-center gap-0.5 ml-0.5 ${overdue ? 'text-red-600' : 'text-gray-400'}`}>
                            <Calendar size={10} />
                            {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                    )}

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Delete (hover) */}
                    <button
                        onClick={e => { e.stopPropagation(); onDelete(task._id); }}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-0.5 rounded"
                    >
                        <X size={11} />
                    </button>

                    {/* Assignee avatar */}
                    {assigneeName && (
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                            style={{ background: '#6554C0' }}
                            title={assigneeName}>
                            {initials(assigneeName)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Task Detail Side Panel ───────────────────────────────────────────────────

function TaskDetailPanel({ task, onClose, onCycle, onUpdate }) {
    const [editing, setEditing] = useState(false);
    const [title, setTitle] = useState(task.title);
    const sm = COLUMNS.find(c => c.key === (task.status || 'todo'));

    const save = async () => {
        if (title.trim() && title !== task.title) await onUpdate(task._id, { title: title.trim() });
        setEditing(false);
    };

    return (
        <div className="w-72 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col h-full overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-sm flex items-center justify-center"
                        style={{ background: sm?.headerColor || '#42526E' }}>
                        <div className="w-2 h-2 rounded-full bg-white opacity-90" />
                    </div>
                    <span className="text-xs font-semibold text-gray-500">Task detail</span>
                </div>
                <button onClick={onClose} className="p-1 rounded hover:bg-gray-200 text-gray-400 transition-colors">
                    <X size={14} />
                </button>
            </div>

            <div className="p-4 space-y-4">
                {/* Title */}
                {editing ? (
                    <div>
                        <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
                            onBlur={save} onKeyDown={e => e.key === 'Enter' && save()}
                            className="w-full font-semibold text-sm text-gray-900 border-b-2 focus:outline-none pb-1"
                            style={{ borderColor: JIRA_BLUE }} />
                    </div>
                ) : (
                    <p onClick={() => setEditing(true)}
                        className="font-semibold text-sm text-gray-900 cursor-pointer hover:bg-blue-50 rounded -mx-1 px-1 py-0.5">
                        {task.title}
                    </p>
                )}

                {/* Status */}
                <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Status</p>
                    <button onClick={() => onCycle(task._id, task.status)}
                        className="px-3 py-1 rounded text-xs font-bold uppercase tracking-wide transition-all"
                        style={{ background: sm?.headerBg, color: sm?.headerColor }}>
                        {sm?.label}  →  {COLUMNS.find(c => c.key === (cycleStatus[task.status] || 'todo'))?.label}
                    </button>
                </div>

                {/* Priority */}
                <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Priority</p>
                    <div className="flex items-center gap-1.5">
                        <PriorityIcon priority={task.priority || 'medium'} />
                        <span className="text-xs text-gray-700">{pMeta(task.priority || 'medium').label}</span>
                    </div>
                </div>

                {/* Due date */}
                {task.dueDate && (
                    <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Due date</p>
                        <p className="text-xs text-gray-700">{new Date(task.dueDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                )}

                {/* Description */}
                {task.description && (
                    <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Description</p>
                        <p className="text-xs text-gray-700 leading-relaxed">{task.description}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Create Task Modal ────────────────────────────────────────────────────────

function CreateModal({ defaultStatus, onClose, onSubmit }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('medium');
    const [status, setStatus] = useState(defaultStatus || 'todo');
    const [dueDate, setDueDate] = useState('');
    const [saving, setSaving] = useState(false);
    const ref = useRef();
    useEffect(() => ref.current?.focus(), []);

    const submit = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setSaving(true);
        await onSubmit({ title: title.trim(), description, priority, status, dueDate: dueDate || undefined });
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-white rounded-[3px] shadow-2xl w-[520px] mx-4 overflow-hidden"
                style={{ boxShadow: '0 8px 32px rgba(9,30,66,0.35)' }}>
                {/* Jira modal header */}
                <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #DFE1E6' }}>
                    <h3 className="font-semibold text-gray-900 text-base">Create task</h3>
                    <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={submit} className="px-6 py-5 space-y-4">
                    {/* Summary (Jira calls title "Summary") */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Summary <span className="text-red-500">*</span></label>
                        <input ref={ref} value={title} onChange={e => setTitle(e.target.value)}
                            className="w-full px-3 py-2 text-sm border rounded-[3px] focus:outline-none focus:ring-2 transition-all text-gray-900"
                            style={{ borderColor: '#DFE1E6', focusRingColor: JIRA_BLUE }}
                            onFocus={e => e.target.style.borderColor = JIRA_BLUE}
                            onBlur={e => e.target.style.borderColor = '#DFE1E6'}
                            placeholder="e.g. Add login page layout"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Description</label>
                        <div className="relative">
                            <AlignLeft size={12} className="absolute left-3 top-2.5 text-gray-400" />
                            <textarea value={description} onChange={e => setDescription(e.target.value)}
                                rows={2} placeholder="Add a description..."
                                className="w-full pl-8 pr-3 py-2 text-sm border rounded-[3px] focus:outline-none resize-none text-gray-700"
                                style={{ borderColor: '#DFE1E6' }}
                                onFocus={e => e.target.style.borderColor = JIRA_BLUE}
                                onBlur={e => e.target.style.borderColor = '#DFE1E6'}
                            />
                        </div>
                    </div>

                    {/* Priority and Status row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Priority</label>
                            <select value={priority} onChange={e => setPriority(e.target.value)}
                                className="w-full px-3 py-2 text-sm border rounded-[3px] focus:outline-none text-gray-800 bg-white"
                                style={{ borderColor: '#DFE1E6' }}>
                                {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Status</label>
                            <select value={status} onChange={e => setStatus(e.target.value)}
                                className="w-full px-3 py-2 text-sm border rounded-[3px] focus:outline-none text-gray-800 bg-white"
                                style={{ borderColor: '#DFE1E6' }}>
                                {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Due date */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Due date</label>
                        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                            className="w-full px-3 py-2 text-sm border rounded-[3px] focus:outline-none text-gray-800"
                            style={{ borderColor: '#DFE1E6' }} />
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-2 pt-2" style={{ borderTop: '1px solid #DFE1E6' }}>
                        <button type="button" onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-[3px] transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={!title.trim() || saving}
                            className="px-4 py-2 text-sm font-semibold text-white rounded-[3px] transition-all disabled:opacity-50 flex items-center gap-2"
                            style={{ background: JIRA_BLUE }}>
                            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                            Create
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumn({ col, tasks, onCardClick, onDelete, onCycle, onInlineAdd }) {
    const [showInline, setShowInline] = useState(false);

    const handleInline = async (title) => {
        await onInlineAdd(title, col.key);
        setShowInline(false);
    };

    return (
        <div className="flex-1 flex flex-col min-w-0 min-h-0" style={{ background: '#F4F5F7', borderRadius: 3 }}>
            {/* Column header */}
            <div className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0"
                style={{ borderTop: `3px solid ${col.key === 'todo' ? '#42526E' : col.key === 'in_progress' ? JIRA_BLUE : '#00875A'}` }}>
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: col.headerColor }}>
                    {col.label}
                </span>
                <span className="text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
                    style={{ background: col.headerBg, color: col.headerColor }}>
                    {tasks.length}
                </span>
                <div className="flex-1" />
                <button onClick={() => setShowInline(v => !v)}
                    className="p-0.5 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors"
                    title="Add task">
                    <Plus size={15} strokeWidth={2} />
                </button>
            </div>

            {/* Cards area */}
            <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 pt-1"
                style={{ scrollbarWidth: 'thin', scrollbarColor: '#C1C7D0 transparent' }}>

                {showInline && (
                    <InlineAdd onSubmit={handleInline} onCancel={() => setShowInline(false)} />
                )}

                {tasks.length === 0 && !showInline ? (
                    <div className="flex flex-col items-center justify-center h-20 rounded opacity-50">
                        <p className="text-xs text-gray-400">No issues</p>
                    </div>
                ) : (
                    tasks.map(t => (
                        <TaskCard
                            key={t._id}
                            task={t}
                            onClick={onCardClick}
                            onDelete={onDelete}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

// ─── Main TasksTab ────────────────────────────────────────────────────────────

export default function TasksTab({ channelId, channelName, workspaceId: workspaceIdProp, currentUserId, socket }) {
    const { activeWorkspace } = useWorkspace();
    const workspaceId = workspaceIdProp || activeWorkspace?.id || activeWorkspace?._id;

    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selected, setSelected] = useState(null);
    const [filter, setFilter] = useState('all');

    // Load tasks
    const loadTasks = useCallback(async () => {
        if (!channelId || !workspaceId) { setLoading(false); return; }
        try {
            setLoading(true);
            const res = await api.get('/api/v2/tasks', { params: { workspaceId } });
            const mine = (res.data.tasks || []).filter(t =>
                t.channel && (t.channel._id === channelId || t.channel === channelId)
            );
            setTasks(mine);
        } catch { setTasks([]); }
        finally { setLoading(false); }
    }, [channelId, workspaceId]);

    useEffect(() => { loadTasks(); }, [loadTasks]);

    // Socket
    useEffect(() => {
        if (!socket || !channelId) return;
        const add = t => {
            if (t.channel && (t.channel._id === channelId || t.channel === channelId))
                setTasks(p => p.find(x => x._id === t._id) ? p : [...p, t]);
        };
        const upd = t => {
            if (t.channel && (t.channel._id === channelId || t.channel === channelId))
                setTasks(p => p.map(x => x._id === t._id ? t : x));
        };
        const del = ({ taskId }) => setTasks(p => p.filter(x => x._id !== taskId));
        socket.on('task-created', add);
        socket.on('task-updated', upd);
        socket.on('task-deleted', del);
        return () => { socket.off('task-created', add); socket.off('task-updated', upd); socket.off('task-deleted', del); };
    }, [socket, channelId]);

    // Actions
    const handleCreate = useCallback(async (data) => {
        try {
            const res = await api.post('/api/v2/tasks', {
                title: data.title,
                description: data.description,
                priority: data.priority,
                status: data.status,
                workspaceId, channelId,
                assignmentType: 'channel',
                visibility: 'channel',
                ...(data.dueDate ? { dueDate: data.dueDate } : {}),
            });
            if (res.data.tasks?.[0]) {
                const t = res.data.tasks[0];
                setTasks(p => p.find(x => x._id === t._id) ? p : [...p, t]);
            }
            setShowModal(false);
        } catch (err) { console.error('Create task failed:', err.response?.data || err.message); }
    }, [channelId, workspaceId]);

    const handleInlineAdd = useCallback(async (title, status) => {
        await handleCreate({ title, priority: 'medium', status });
    }, [handleCreate]);

    const handleCycle = useCallback(async (taskId, cur) => {
        const ns = cycleStatus[cur] || 'todo';
        setTasks(p => p.map(t => t._id === taskId ? { ...t, status: ns } : t));
        if (selected?._id === taskId) setSelected(s => s ? { ...s, status: ns } : s);
        try { await api.put(`/api/v2/tasks/${taskId}`, { status: ns }); }
        catch { loadTasks(); }
    }, [loadTasks, selected]);

    const handleUpdate = useCallback(async (taskId, updates) => {
        try {
            await api.put(`/api/v2/tasks/${taskId}`, updates);
            setTasks(p => p.map(t => t._id === taskId ? { ...t, ...updates } : t));
            setSelected(s => s?._id === taskId ? { ...s, ...updates } : s);
        } catch { loadTasks(); }
    }, [loadTasks]);

    const handleDelete = useCallback(async (taskId) => {
        setTasks(p => p.filter(t => t._id !== taskId));
        if (selected?._id === taskId) setSelected(null);
        try { await api.delete(`/api/v2/tasks/${taskId}`); }
        catch { loadTasks(); }
    }, [loadTasks, selected]);

    // Filtered tasks
    const filtered = useMemo(() => {
        if (filter === 'mine') return tasks.filter(t =>
            (t.createdBy?._id || t.createdBy) === currentUserId ||
            t.assignedTo?.some(a => (a._id || a) === currentUserId)
        );
        if (filter === 'high') return tasks.filter(t => t.priority === 'high' || t.priority === 'highest');
        return tasks;
    }, [tasks, filter, currentUserId]);

    const byStatus = s => filtered.filter(t => (t.status || 'todo') === s);
    const doneCount = tasks.filter(t => t.status === 'done').length;

    // Loading skeleton
    if (loading) {
        return (
            <div className="flex-1 flex flex-col overflow-hidden" style={{ background: '#F4F5F7' }}>
                <div className="px-4 py-3 bg-white border-b border-gray-200 flex items-center justify-between animate-pulse">
                    <div className="h-4 w-40 bg-gray-200 rounded" />
                    <div className="h-8 w-24 bg-blue-100 rounded" />
                </div>
                <div className="flex-1 flex gap-3 p-4">
                    {[0, 1, 2].map(i => (
                        <div key={i} className="flex-1 rounded-sm animate-pulse" style={{ background: '#EBECF0', borderTop: '3px solid #DFE1E6' }}>
                            <div className="p-3 flex gap-2">
                                <div className="h-3 w-16 bg-gray-300 rounded" />
                                <div className="h-4 w-5 bg-gray-300 rounded-full" />
                            </div>
                            {[1, 2].map(j => (
                                <div key={j} className="mx-2 mb-2 bg-white rounded p-3 shadow-sm">
                                    <div className="h-3 w-4/5 bg-gray-200 rounded mb-2" />
                                    <div className="h-2.5 w-1/2 bg-gray-100 rounded" />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden" style={{ background: '#F4F5F7' }}>

            {/* ── Jira-style toolbar ── */}
            <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 bg-white border-b"
                style={{ borderColor: '#DFE1E6' }}>
                <span className="text-sm font-semibold text-gray-800">
                    #{(channelName || '').replace(/^#/, '')} board
                </span>

                {tasks.length > 0 && (
                    <span className="text-xs text-gray-400">{doneCount}/{tasks.length} done</span>
                )}

                <div className="w-px h-4 bg-gray-200 mx-1" />

                {/* Filters */}
                {[
                    { key: 'all', label: 'All' },
                    { key: 'mine', label: 'Only My Issues' },
                    { key: 'high', label: 'High Priority' },
                ].map(f => (
                    <button key={f.key} onClick={() => setFilter(f.key)}
                        className="text-xs font-medium px-2.5 py-1 rounded transition-all"
                        style={{
                            background: filter === f.key ? '#DEEBFF' : 'transparent',
                            color: filter === f.key ? JIRA_BLUE : '#42526E',
                            fontWeight: filter === f.key ? 700 : 500,
                        }}>
                        {f.label}
                    </button>
                ))}

                <div className="flex-1" />

                <button onClick={() => setShowModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-[3px] transition-opacity hover:opacity-90"
                    style={{ background: JIRA_BLUE }}>
                    <Plus size={13} strokeWidth={2.5} />
                    Create
                </button>
            </div>

            {/* ── Board ── */}
            <div className="flex-1 min-h-0 flex gap-3 p-4 overflow-y-hidden overflow-x-auto">
                {COLUMNS.map(col => (
                    <KanbanColumn
                        key={col.key}
                        col={col}
                        tasks={byStatus(col.key)}
                        onCardClick={setSelected}
                        onDelete={handleDelete}
                        onCycle={handleCycle}
                        onInlineAdd={handleInlineAdd}
                    />
                ))}

                {/* Detail panel */}
                {selected && (
                    <TaskDetailPanel
                        task={selected}
                        onClose={() => setSelected(null)}
                        onCycle={handleCycle}
                        onUpdate={handleUpdate}
                    />
                )}
            </div>

            {showModal && (
                <CreateModal
                    defaultStatus="todo"
                    onClose={() => setShowModal(false)}
                    onSubmit={handleCreate}
                />
            )}
        </div>
    );
}
