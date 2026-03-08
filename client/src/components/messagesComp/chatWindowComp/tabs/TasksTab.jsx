import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
    Plus, CheckCircle2, Clock, User, Trash2, Edit3, ChevronRight,
    Calendar, Flag, X, AlignLeft, Loader2, CheckSquare, Circle, BarChart2
} from 'lucide-react';
import api from '../../../../services/api';
import { useWorkspace } from '../../../../contexts/WorkspaceContext';

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUSES = [
    { key: 'todo', label: 'To Do', color: '#6366f1', bg: '#eef2ff', dot: '#6366f1' },
    { key: 'in_progress', label: 'In Progress', color: '#f59e0b', bg: '#fffbeb', dot: '#f59e0b' },
    { key: 'done', label: 'Done', color: '#10b981', bg: '#ecfdf5', dot: '#10b981' },
];

const PRIORITIES = [
    { key: 'low', label: 'Low', color: '#22c55e', bg: '#f0fdf4' },
    { key: 'medium', label: 'Medium', color: '#f59e0b', bg: '#fffbeb' },
    { key: 'high', label: 'High', color: '#ef4444', bg: '#fef2f2' },
];

const nextStatus = { todo: 'in_progress', in_progress: 'done', done: 'todo' };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function priorityMeta(p) {
    return PRIORITIES.find(x => x.key === p) || PRIORITIES[1];
}
function statusMeta(s) {
    return STATUSES.find(x => x.key === s) || STATUSES[0];
}
function isOverdue(dueDate) {
    return dueDate && new Date(dueDate) < new Date();
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PriorityBadge({ priority }) {
    const m = priorityMeta(priority);
    return (
        <span style={{ background: m.bg, color: m.color }}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase">
            <Flag size={9} strokeWidth={2.5} />
            {m.label}
        </span>
    );
}

function StatusChip({ status, onClick, small }) {
    const m = statusMeta(status);
    return (
        <button
            onClick={onClick}
            title="Click to advance status"
            style={{ background: m.bg, color: m.color, border: `1px solid ${m.color}33` }}
            className={`inline-flex items-center gap-1 rounded-full font-medium transition-all hover:opacity-80 ${small ? 'px-1.5 py-0.5 text-[9px]' : 'px-2.5 py-1 text-xs'}`}>
            {status === 'todo' && <Circle size={small ? 8 : 10} strokeWidth={2.5} />}
            {status === 'in_progress' && <Clock size={small ? 8 : 10} strokeWidth={2.5} />}
            {status === 'done' && <CheckCircle2 size={small ? 8 : 10} strokeWidth={2.5} />}
            {m.label}
            {!small && <ChevronRight size={10} className="opacity-60" />}
        </button>
    );
}

// ─── New Task Modal ───────────────────────────────────────────────────────────

function NewTaskModal({ onClose, onSubmit, channelMembers }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('medium');
    const [dueDate, setDueDate] = useState('');
    const [status, setStatus] = useState('todo');
    const [submitting, setSubmitting] = useState(false);
    const titleRef = useRef(null);

    useEffect(() => { titleRef.current?.focus(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setSubmitting(true);
        await onSubmit({ title: title.trim(), description, priority, status, dueDate: dueDate || undefined });
        setSubmitting(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-gray-200 dark:border-gray-700">
                {/* Modal header */}
                <div className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
                        <Plus size={18} className="text-indigo-500" /> New Task
                    </h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                    {/* Title */}
                    <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Title *</label>
                        <input
                            ref={titleRef}
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="What needs to be done?"
                            className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                            <AlignLeft size={11} /> Description
                        </label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Add more detail (optional)..."
                            rows={2}
                            className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all resize-none"
                        />
                    </div>

                    {/* Priority + Status row */}
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                                <Flag size={11} /> Priority
                            </label>
                            <select
                                value={priority}
                                onChange={e => setPriority(e.target.value)}
                                className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                                {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                                <Clock size={11} /> Status
                            </label>
                            <select
                                value={status}
                                onChange={e => setStatus(e.target.value)}
                                className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                                {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Due date */}
                    <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                            <Calendar size={11} /> Due Date
                        </label>
                        <input
                            type="date"
                            value={dueDate}
                            onChange={e => setDueDate(e.target.value)}
                            className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                    </div>

                    {/* Footer */}
                    <div className="flex gap-3 pt-1">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={!title.trim() || submitting}
                            className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition-colors flex items-center justify-center gap-2 shadow-sm">
                            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                            Create Task
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task, onToggleStatus, onDelete }) {
    const overdue = isOverdue(task.dueDate);

    return (
        <div className="group relative bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-700 hover:shadow-md transition-all duration-200">
            {/* Priority indicator strip */}
            <div className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full"
                style={{ background: priorityMeta(task.priority).color }} />

            <div className="pl-2">
                {/* Top row: title + actions */}
                <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-medium leading-snug flex-1 ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-100'}`}>
                        {task.title}
                    </p>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => onDelete(task._id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <Trash2 size={13} />
                        </button>
                    </div>
                </div>

                {/* Description preview */}
                {task.description && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-1">{task.description}</p>
                )}

                {/* Footer chips */}
                <div className="flex items-center flex-wrap gap-1.5 mt-2.5">
                    <PriorityBadge priority={task.priority || 'medium'} />

                    {task.dueDate && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${overdue ? 'bg-red-50 text-red-500 dark:bg-red-900/20' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                            }`}>
                            <Calendar size={9} />
                            {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {overdue && ' · Overdue'}
                        </span>
                    )}

                    {task.assignedTo && task.assignedTo.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300">
                            <User size={9} />
                            {task.assignedTo[0]?.username || task.assignedTo[0]?.name || 'Assigned'}
                        </span>
                    )}

                    {/* Status chip — right-aligned via margin-left auto */}
                    <div className="ml-auto">
                        <StatusChip status={task.status || 'todo'} onClick={() => onToggleStatus(task._id, task.status)} small />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Column ───────────────────────────────────────────────────────────────────

function Column({ statusKey, tasks, onToggleStatus, onDelete }) {
    const meta = statusMeta(statusKey);
    const Icon = statusKey === 'todo' ? Circle : statusKey === 'in_progress' ? Clock : CheckCircle2;

    return (
        <div className="flex-1 min-w-0 flex flex-col rounded-2xl"
            style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0' }}>
            {/* Column header */}
            <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-gray-200 dark:border-gray-700">
                <Icon size={14} strokeWidth={2.5} style={{ color: meta.color }} />
                <span className="text-xs font-bold uppercase tracking-widest text-gray-600 dark:text-gray-300">{meta.label}</span>
                <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: meta.bg, color: meta.color }}>
                    {tasks.length}
                </span>
            </div>

            {/* Tasks */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5" style={{ minHeight: 200, maxHeight: 520 }}>
                {tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-36 opacity-50">
                        <Icon size={28} style={{ color: meta.color, opacity: 0.4 }} strokeWidth={1.5} />
                        <p className="text-xs text-gray-400 mt-2 font-medium">No {meta.label.toLowerCase()} tasks</p>
                    </div>
                ) : (
                    tasks.map(task => (
                        <TaskCard
                            key={task._id}
                            task={task}
                            onToggleStatus={onToggleStatus}
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
    const [filter, setFilter] = useState('all'); // all | mine | high

    // ── Load tasks ──
    const loadTasks = useCallback(async () => {
        if (!channelId || !workspaceId) { setLoading(false); return; }
        try {
            setLoading(true);
            const res = await api.get('/api/v2/tasks', { params: { workspaceId } });
            const channelTasks = (res.data.tasks || []).filter(t =>
                t.channel && (t.channel._id === channelId || t.channel === channelId)
            );
            setTasks(channelTasks);
        } catch (err) {
            console.error('Failed to load tasks:', err);
            setTasks([]);
        } finally {
            setLoading(false);
        }
    }, [channelId, workspaceId]);

    useEffect(() => { loadTasks(); }, [loadTasks]);

    // ── Socket real-time ──
    useEffect(() => {
        if (!socket || !channelId) return;
        const addTask = (task) => {
            if (task.channel && (task.channel._id === channelId || task.channel === channelId)) {
                setTasks(prev => prev.find(t => t._id === task._id) ? prev : [...prev, task]);
            }
        };
        const updateTask = (task) => {
            if (task.channel && (task.channel._id === channelId || task.channel === channelId)) {
                setTasks(prev => prev.map(t => t._id === task._id ? task : t));
            }
        };
        const removeTask = ({ taskId }) => setTasks(prev => prev.filter(t => t._id !== taskId));

        socket.on('task-created', addTask);
        socket.on('task-updated', updateTask);
        socket.on('task-deleted', removeTask);
        return () => {
            socket.off('task-created', addTask);
            socket.off('task-updated', updateTask);
            socket.off('task-deleted', removeTask);
        };
    }, [socket, channelId]);

    // ── Create task ──
    const handleCreate = useCallback(async ({ title, description, priority, status, dueDate }) => {
        if (!workspaceId) return;
        try {
            const res = await api.post('/api/v2/tasks', {
                title,
                description,
                workspaceId,           // ✅ Fixed: was `workspace`
                channelId,             // ✅ Fixed: was `channel`
                assignmentType: 'channel',
                visibility: 'channel',
                status,
                priority,
                ...(dueDate ? { dueDate } : {}),
            });
            if (res.data.tasks?.[0]) {
                const newTask = res.data.tasks[0];
                setTasks(prev => prev.find(t => t._id === newTask._id) ? prev : [...prev, newTask]);
            }
            setShowModal(false);
        } catch (err) {
            console.error('Failed to create task:', err.response?.data || err.message);
        }
    }, [channelId, workspaceId]);

    // ── Toggle status (cycle through statuses) ──
    const handleToggleStatus = useCallback(async (taskId, currentStatus) => {
        const newStatus = nextStatus[currentStatus] || 'todo';
        setTasks(prev => prev.map(t => t._id === taskId ? { ...t, status: newStatus } : t));
        try {
            await api.put(`/api/v2/tasks/${taskId}`, { status: newStatus });
        } catch {
            loadTasks(); // revert on error
        }
    }, [loadTasks]);

    // ── Delete task ──
    const handleDelete = useCallback(async (taskId) => {
        setTasks(prev => prev.filter(t => t._id !== taskId));
        try {
            await api.delete(`/api/v2/tasks/${taskId}`);
        } catch {
            loadTasks();
        }
    }, [loadTasks]);

    // ── Filtered tasks ──
    const filteredTasks = useMemo(() => {
        if (filter === 'mine') return tasks.filter(t =>
            t.assignedTo?.some(a => (a._id || a) === currentUserId) || (t.createdBy?._id || t.createdBy) === currentUserId
        );
        if (filter === 'high') return tasks.filter(t => t.priority === 'high' || t.priority === 'highest');
        return tasks;
    }, [tasks, filter, currentUserId]);

    const byStatus = (s) => filteredTasks.filter(t => (t.status || 'todo') === s);
    const doneCount = tasks.filter(t => t.status === 'done').length;
    const progress = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

    // ── Loading skeleton ──
    if (loading) {
        return (
            <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 animate-pulse">
                <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between">
                    <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                    <div className="h-9 w-28 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl" />
                </div>
                <div className="flex-1 p-6 flex gap-4">
                    {[0, 1, 2].map(i => (
                        <div key={i} className="flex-1 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-3">
                            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                            {[80, 60, 70].map((w, j) => (
                                <div key={j} className="rounded-xl bg-gray-100 dark:bg-gray-700 p-4 flex flex-col gap-2">
                                    <div className={`h-3 bg-gray-200 dark:bg-gray-600 rounded`} style={{ width: `${w}%` }} />
                                    <div className="h-2.5 w-2/5 bg-gray-100 dark:bg-gray-700 rounded" />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 overflow-hidden">

            {/* ── Header ── */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <BarChart2 size={18} className="text-indigo-500" />
                            Task Board
                            <span className="text-xs font-normal text-gray-400 ml-1">
                                #{(channelName || '').replace(/^#/, '')}
                            </span>
                        </h2>
                        {tasks.length > 0 && (
                            <div className="flex items-center gap-2 mt-1.5">
                                <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden" style={{ width: 120 }}>
                                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                        style={{ width: `${progress}%` }} />
                                </div>
                                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                    {doneCount}/{tasks.length} done
                                </span>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all hover:scale-[1.02] active:scale-95">
                        <Plus size={16} strokeWidth={2.5} />
                        New Task
                    </button>
                </div>

                {/* Filter chips */}
                <div className="flex items-center gap-2">
                    {[
                        { key: 'all', label: 'All Tasks' },
                        { key: 'mine', label: 'My Tasks' },
                        { key: 'high', label: '🔴 High Priority' },
                    ].map(f => (
                        <button key={f.key}
                            onClick={() => setFilter(f.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filter === f.key
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}>
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Board ── */}
            <div className="flex-1 overflow-y-auto p-5">
                <div className="flex flex-col lg:flex-row gap-4 min-h-full">
                    {STATUSES.map(s => (
                        <Column
                            key={s.key}
                            statusKey={s.key}
                            tasks={byStatus(s.key)}
                            onToggleStatus={handleToggleStatus}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            </div>

            {/* ── Modal ── */}
            {showModal && (
                <NewTaskModal
                    onClose={() => setShowModal(false)}
                    onSubmit={handleCreate}
                />
            )}
        </div>
    );
}
