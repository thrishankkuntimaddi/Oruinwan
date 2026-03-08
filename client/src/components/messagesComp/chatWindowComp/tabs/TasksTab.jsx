import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
    Plus, CheckCircle2, Clock, Trash2, Calendar, Flag, X,
    AlignLeft, Loader2, Circle, BarChart2, SlidersHorizontal
} from 'lucide-react';
import api from '../../../../services/api';
import { useWorkspace } from '../../../../contexts/WorkspaceContext';

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUSES = [
    { key: 'todo', label: 'To Do', color: '#6366f1', light: 'rgba(99,102,241,0.08)' },
    { key: 'in_progress', label: 'In Progress', color: '#f59e0b', light: 'rgba(245,158,11,0.08)' },
    { key: 'done', label: 'Done', color: '#10b981', light: 'rgba(16,185,129,0.08)' },
];

const PRIORITIES = [
    { key: 'low', label: 'Low', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
    { key: 'medium', label: 'Medium', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    { key: 'high', label: 'High', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
];

const priorityMap = Object.fromEntries(PRIORITIES.map(p => [p.key, p]));
const statusMap = Object.fromEntries(STATUSES.map(s => [s.key, s]));
const cycleStatus = { todo: 'in_progress', in_progress: 'done', done: 'todo' };

const pMeta = (k) => priorityMap[k] || priorityMap.medium;
const sMeta = (k) => statusMap[k] || statusMap.todo;

// ─── New Task Modal ───────────────────────────────────────────────────────────

function NewTaskModal({ onClose, onSubmit }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('medium');
    const [status, setStatus] = useState('todo');
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-[460px] mx-4 overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                            <Plus size={14} className="text-indigo-600 dark:text-indigo-400" strokeWidth={2.5} />
                        </div>
                        New Task
                    </h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors">
                        <X size={14} />
                    </button>
                </div>

                <form onSubmit={submit} className="p-6 space-y-4">
                    <input
                        ref={ref}
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="Task title..."
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />

                    <div className="relative">
                        <AlignLeft size={13} className="absolute left-3.5 top-3 text-gray-400" />
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Add description (optional)..."
                            rows={2}
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Priority</p>
                            <select value={priority} onChange={e => setPriority(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Status</p>
                            <select value={status} onChange={e => setStatus(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Due Date</p>
                            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-1">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={!title.trim() || saving}
                            className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white transition-all flex items-center justify-center gap-2 shadow-sm">
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                            Create Task
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task, onCycle, onDelete }) {
    const pm = pMeta(task.priority || 'medium');
    const sm = sMeta(task.status || 'todo');
    const overdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';
    const isDone = task.status === 'done';

    return (
        <div className="group relative bg-white dark:bg-gray-850 rounded-xl border border-gray-200/80 dark:border-gray-700/60 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm transition-all duration-150 cursor-default overflow-hidden"
            style={{ borderLeft: `3px solid ${pm.color}` }}>

            <div className="px-3.5 pt-3 pb-2.5">
                {/* Title row */}
                <div className="flex items-start gap-2">
                    <button onClick={() => onCycle(task._id, task.status)}
                        className="mt-0.5 flex-shrink-0 transition-transform hover:scale-110"
                        title="Advance status">
                        {isDone
                            ? <CheckCircle2 size={15} style={{ color: sm.color }} strokeWidth={2} />
                            : task.status === 'in_progress'
                                ? <Clock size={15} style={{ color: sm.color }} strokeWidth={2} />
                                : <Circle size={15} style={{ color: sm.color }} strokeWidth={2} />
                        }
                    </button>
                    <p className={`flex-1 text-sm leading-snug font-medium ${isDone ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100'}`}>
                        {task.title}
                    </p>
                    <button onClick={() => onDelete(task._id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-300 hover:text-red-500 transition-all ml-1 flex-shrink-0">
                        <Trash2 size={12} />
                    </button>
                </div>

                {/* Description */}
                {task.description && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 ml-5.5 line-clamp-1">{task.description}</p>
                )}

                {/* Footer */}
                <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                    {/* Priority */}
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                        style={{ color: pm.color, background: pm.bg }}>
                        <Flag size={8} strokeWidth={2.5} />
                        {pm.label}
                    </span>

                    {/* Due date */}
                    {task.dueDate && (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${overdue ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400'}`}>
                            <Calendar size={8} />
                            {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumn({ meta, tasks, onCycle, onDelete }) {
    const StatusIcon = meta.key === 'done' ? CheckCircle2 : meta.key === 'in_progress' ? Clock : Circle;

    return (
        <div className="flex-1 flex flex-col h-full min-h-0" style={{ minWidth: 0 }}>
            {/* Column header */}
            <div className="flex items-center gap-2 px-1 mb-3 flex-shrink-0">
                <StatusIcon size={13} strokeWidth={2.5} style={{ color: meta.color }} />
                <span className="text-xs font-bold uppercase tracking-widest text-gray-600 dark:text-gray-400">{meta.label}</span>
                <div className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: meta.light, color: meta.color }}>
                    {tasks.length}
                </div>
            </div>

            {/* Task list */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-0.5"
                style={{ scrollbarWidth: 'thin', scrollbarColor: '#e2e8f0 transparent' }}>
                {tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed gap-2"
                        style={{ borderColor: `${meta.color}30` }}>
                        <StatusIcon size={20} style={{ color: meta.color, opacity: 0.3 }} strokeWidth={1.5} />
                        <p className="text-xs text-gray-400 font-medium">No {meta.label.toLowerCase()} tasks</p>
                    </div>
                ) : (
                    tasks.map(task => (
                        <TaskCard key={task._id} task={task} onCycle={onCycle} onDelete={onDelete} />
                    ))
                )}
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TasksTab({ channelId, channelName, workspaceId: workspaceIdProp, currentUserId, socket }) {
    const { activeWorkspace } = useWorkspace();
    const workspaceId = workspaceIdProp || activeWorkspace?.id || activeWorkspace?._id;

    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [filter, setFilter] = useState('all');

    // ── Data ──────────────────────────────────────────────────────────────────

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

    // ── Actions ───────────────────────────────────────────────────────────────

    const handleCreate = useCallback(async ({ title, description, priority, status, dueDate }) => {
        try {
            const res = await api.post('/api/v2/tasks', {
                title, description, priority, status,
                workspaceId, channelId,
                assignmentType: 'channel',
                visibility: 'channel',
                ...(dueDate ? { dueDate } : {}),
            });
            if (res.data.tasks?.[0]) {
                const t = res.data.tasks[0];
                setTasks(p => p.find(x => x._id === t._id) ? p : [...p, t]);
            }
            setShowModal(false);
        } catch (err) { console.error('Create task failed:', err.response?.data || err.message); }
    }, [channelId, workspaceId]);

    const handleCycle = useCallback(async (taskId, cur) => {
        const ns = cycleStatus[cur] || 'todo';
        setTasks(p => p.map(t => t._id === taskId ? { ...t, status: ns } : t));
        try { await api.put(`/api/v2/tasks/${taskId}`, { status: ns }); }
        catch { loadTasks(); }
    }, [loadTasks]);

    const handleDelete = useCallback(async (taskId) => {
        setTasks(p => p.filter(t => t._id !== taskId));
        try { await api.delete(`/api/v2/tasks/${taskId}`); }
        catch { loadTasks(); }
    }, [loadTasks]);

    // ── Derived ───────────────────────────────────────────────────────────────

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
    const progress = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

    // ── Loading ───────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex flex-col h-full bg-white dark:bg-gray-900">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <div className="h-5 w-36 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
                    <div className="h-9 w-28 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 animate-pulse" />
                </div>
                <div className="flex-1 p-6 flex gap-5 overflow-hidden">
                    {[0, 1, 2].map(i => (
                        <div key={i} className="flex-1 flex flex-col gap-2.5 animate-pulse">
                            <div className="h-4 w-24 rounded bg-gray-100 dark:bg-gray-800 mb-1" />
                            {[90, 70, 80, 60].map((w, j) => (
                                <div key={j} className="h-16 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700" />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-gray-900">

            {/* ── Top bar ── */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                            <BarChart2 size={16} className="text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-sm font-bold text-gray-900 dark:text-white leading-none">Task Board</h2>
                            <p className="text-xs text-gray-400 mt-0.5 truncate">
                                #{(channelName || '').replace(/^#/, '')} · {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                        {/* Progress */}
                        {tasks.length > 0 && (
                            <div className="hidden sm:flex items-center gap-2 ml-2 pl-3 border-l border-gray-100 dark:border-gray-800">
                                <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden" style={{ width: 80 }}>
                                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                                </div>
                                <span className="text-xs text-gray-400 tabular-nums">{doneCount}/{tasks.length}</span>
                            </div>
                        )}
                    </div>

                    <button onClick={() => setShowModal(true)}
                        className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-xl shadow-sm transition-all hover:shadow-md">
                        <Plus size={14} strokeWidth={2.5} /> New Task
                    </button>
                </div>

                {/* Filter row */}
                <div className="flex items-center gap-1.5 mt-3">
                    <SlidersHorizontal size={13} className="text-gray-400 mr-0.5" />
                    {[
                        { key: 'all', label: 'All' },
                        { key: 'mine', label: 'Mine' },
                        { key: 'high', label: 'High Priority' },
                    ].map(f => (
                        <button key={f.key} onClick={() => setFilter(f.key)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${filter === f.key
                                ? 'bg-indigo-600 text-white'
                                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}>
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Kanban board — fills all remaining height ── */}
            <div className="flex-1 min-h-0 overflow-y-auto p-5">
                <div className="flex gap-4 w-full h-full">
                    {STATUSES.map(s => (
                        <KanbanColumn
                            key={s.key}
                            meta={s}
                            tasks={byStatus(s.key)}
                            onCycle={handleCycle}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            </div>

            {showModal && <NewTaskModal onClose={() => setShowModal(false)} onSubmit={handleCreate} />}
        </div>
    );
}
