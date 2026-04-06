// ManagerTasks — Monolith Flow Design System
import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '@services/api';
import { Plus, CheckCircle2, Clock, AlertCircle, User, X, CheckSquare } from 'lucide-react';

const inpSt = { background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', padding: '8px 12px', width: '100%', boxSizing: 'border-box' };
const priorityColor = { highest: 'var(--state-danger)', high: '#e07852', medium: 'var(--accent)', low: 'var(--text-muted)', lowest: 'var(--text-muted)' };

const COLS = [
    { key: 'open',       title: 'To Do',      icon: AlertCircle,  nextStatus: 'in-progress', nextLabel: 'Start' },
    { key: 'inProgress', title: 'In Progress', icon: Clock,        nextStatus: 'done',        nextLabel: 'Complete' },
    { key: 'completed',  title: 'Completed',   icon: CheckCircle2, nextStatus: null,          nextLabel: null },
];

export default function ManagerTasks() {
    const { selectedDepartment } = useOutletContext();
    const [tasks, setTasks] = useState({ open: [], inProgress: [], completed: [], overdue: [] });
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium', dueDate: '' });

    const fetchTasks = useCallback(async () => {
        if (!selectedDepartment?._id) return;
        try {
            setLoading(true);
            const r = await api.get(`/api/manager/tasks/${selectedDepartment._id}`);
            setTasks(r.data.tasks);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [selectedDepartment]);

    useEffect(() => { if (selectedDepartment) fetchTasks(); }, [selectedDepartment, fetchTasks]);

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/api/manager/tasks/${selectedDepartment._id}`, newTask);
            setModalOpen(false);
            setNewTask({ title: '', description: '', priority: 'medium', dueDate: '' });
            fetchTasks();
        } catch (err) { console.error(err); }
    };

    const handleStatusChange = async (taskId, status) => {
        try { await api.patch(`/api/manager/tasks/${taskId}/status`, { status }); fetchTasks(); }
        catch (e) { console.error(e); }
    };

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Header skeleton */}
            <div style={{ height: '56px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div><div className="sk" style={{ height: '13px', width: '110px', marginBottom: '5px' }} /><div className="sk" style={{ height: '9px', width: '200px' }} /></div>
                <div className="sk" style={{ height: '30px', width: '90px' }} />
            </div>
            {/* Kanban skeleton */}
            <div style={{ flex: 1, padding: '20px 28px', display: 'flex', gap: '12px', overflow: 'hidden' }}>
                {['To Do', 'In Progress', 'Completed'].map(col => (
                    <div key={col} style={{ flex: '1 1 280px', minWidth: '260px', display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                        {/* Column header */}
                        <div style={{ padding: '10px 14px', background: 'var(--bg-active)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '7px' }}>
                            <div className="sk" style={{ width: '13px', height: '13px' }} />
                            <div className="sk" style={{ flex: 1, height: '9px' }} />
                            <div className="sk" style={{ width: '28px', height: '18px' }} />
                        </div>
                        {/* Task card skeletons */}
                        <div style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {[1,2,3].map(i => (
                                <div key={i} style={{ background: 'var(--bg-active)', border: '1px solid var(--border-subtle)', padding: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <div className="sk" style={{ height: '16px', width: '52px' }} />
                                    </div>
                                    <div className="sk" style={{ height: '11px', width: '90%', marginBottom: '5px' }} />
                                    <div className="sk" style={{ height: '9px', width: '70%', marginBottom: '5px' }} />
                                    <div className="sk" style={{ height: '9px', width: '50%', marginBottom: '10px' }} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                                        <div className="sk" style={{ width: '20px', height: '20px', borderRadius: '50%' }} />
                                        <div className="sk" style={{ height: '22px', width: '60px' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Header */}
            <header style={{ height: '56px', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <CheckSquare size={16} style={{ color: 'var(--accent)' }} /> Task Board
                    </h2>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', marginLeft: '24px' }}>Tasks for {selectedDepartment?.name || 'department'}</p>
                </div>
                <NewTaskBtn onClick={() => setModalOpen(true)} />
            </header>

            {/* Kanban */}
            <div style={{ flex: 1, overflowX: 'auto', padding: '20px 28px', display: 'flex', gap: '12px' }} className="custom-scrollbar">
                {COLS.map(col => (
                    <div key={col.key} style={{ flex: '1 1 280px', minWidth: '260px', display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                        {/* Col header */}
                        <div style={{ padding: '10px 14px', background: 'var(--bg-active)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0 }}>
                            <col.icon size={13} style={{ color: 'var(--accent)' }} />
                            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', flex: 1 }}>{col.title}</span>
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 7px', background: 'var(--bg-base)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>{tasks[col.key]?.length || 0}</span>
                        </div>
                        {/* Cards */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }} className="custom-scrollbar">
                            {(!tasks[col.key] || tasks[col.key].length === 0) && (
                                <div style={{ padding: '32px 16px', textAlign: 'center', border: '1px dashed var(--border-accent)', color: 'var(--text-muted)', fontSize: '11px' }}>No tasks</div>
                            )}
                            {(tasks[col.key] || []).map(task => (
                                <TaskCard key={task._id} task={task} col={col} onStatus={handleStatusChange} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Create Modal */}
            {modalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', width: '100%', maxWidth: '480px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Create New Task</h3>
                            <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleCreate} style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {[{ key: 'title', label: 'Task Title *', type: 'text', req: true, ph: 'e.g. Update API Documentation' }].map(f => (
                                <div key={f.key}>
                                    <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '5px' }}>{f.label}</label>
                                    <input type={f.type} required={f.req} value={newTask[f.key]} onChange={e => setNewTask(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph} style={inpSt} />
                                </div>
                            ))}
                            <div>
                                <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '5px' }}>Description</label>
                                <textarea rows={3} value={newTask.description} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))} placeholder="Add details about this task..." style={{ ...inpSt, resize: 'none' }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '5px' }}>Priority</label>
                                    <select value={newTask.priority} onChange={e => setNewTask(p => ({ ...p, priority: e.target.value }))} style={{ ...inpSt }}>
                                        {['lowest', 'low', 'medium', 'high', 'highest'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '5px' }}>Due Date</label>
                                    <input type="date" value={newTask.dueDate} onChange={e => setNewTask(p => ({ ...p, dueDate: e.target.value }))} style={inpSt} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                                <button type="button" onClick={() => setModalOpen(false)} style={{ padding: '7px 14px', background: 'none', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', borderRadius: '2px' }}>Cancel</button>
                                <button type="submit" style={{ padding: '7px 16px', background: 'var(--accent)', border: 'none', color: 'var(--bg-base)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', borderRadius: '2px' }}>Create Task</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

const TaskCard = ({ task, col, onStatus }) => {
    const [hov, setHov] = React.useState(false);
    const pColor = priorityColor[task.priority] || 'var(--text-muted)';
    return (
        <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ background: hov ? 'var(--bg-hover)' : 'var(--bg-active)', border: '1px solid var(--border-subtle)', padding: '12px', marginBottom: '6px', transition: 'background 150ms ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 6px', border: `1px solid ${pColor}`, color: pColor }}>{task.priority}</span>
            </div>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '3px', lineHeight: '1.4' }}>{task.title}</p>
            {task.description && <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: '1.5', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{task.description}</p>}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                {task.assignedTo?.length > 0 ? (
                    <div style={{ display: 'flex' }}>
                        {task.assignedTo.slice(0, 3).map((a, i) => (
                            <div key={i} style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(184,149,106,0.15)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: 'var(--accent)', marginLeft: i > 0 ? '-6px' : 0 }} title={a.username}>
                                {a.username?.charAt(0).toUpperCase()}
                            </div>
                        ))}
                    </div>
                ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-muted)' }}><User size={10} /> Unassigned</span>
                )}
                {col.nextStatus && (
                    <button onClick={() => onStatus(task._id, col.nextStatus)}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', background: 'none', border: '1px solid var(--border-default)', color: 'var(--text-muted)', fontSize: '10px', fontWeight: 600, cursor: 'pointer', transition: 'all 150ms ease' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                        {col.key === 'open' ? <Clock size={10} /> : <CheckCircle2 size={10} />} {col.nextLabel}
                    </button>
                )}
            </div>
        </div>
    );
};

const NewTaskBtn = ({ onClick }) => {
    const [hov, setHov] = useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: hov ? 'var(--accent-hover)' : 'var(--accent)', border: 'none', color: 'var(--bg-base)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', borderRadius: '2px', transition: 'background 150ms ease' }}>
            <Plus size={13} /> New Task
        </button>
    );
};
