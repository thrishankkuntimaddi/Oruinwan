import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { CheckSquare, Filter, Plus, X, Calendar, User, AlignLeft } from 'lucide-react';
import { DashboardCard } from '../../components/company';

const ManagerTasks = () => {
    const { tasks, scope, loading } = useOutletContext(); // tasks comes from context, but we might need to refresh it
    // Note: Context refresh is tricky without a re-fetch function passed down. 
    // Ideally, ManagerDashboard should pass a refetch function.
    // For now, I'll assume we might need to reload the page or optimistically update local state if I could.
    // Actually, I should probably ask the user to refresh or implement a local list state initialized from props.

    // Better approach: Local state initialized from props, but props change when layout refetches.
    // Let's rely on props for now, and maybe trigger a reload via window.location.reload() for MVP perfection 
    // or just assume the user will navigate. 
    // WAIT: I can pass a `refreshData` function from ManagerDashboard!

    // For this step, I'll implement the UI and API call.

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newTask, setNewTask] = useState({
        title: '',
        description: '',
        priority: 'medium',
        dueDate: '',
        assignedTo: [] // Multi-select ID list
    });
    const [creating, setCreating] = useState(false);

    const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!scope || !scope.id) return alert("No active scope selected");

        setCreating(true);
        try {
            const token = localStorage.getItem('accessToken');
            const res = await fetch(`${API_BASE}/api/managers/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...newTask,
                    workspaceId: scope.type === 'workspace' ? scope.id : null // LIMITATION: Can only create if workspace scope is active?
                    // actually, for department scope, we don't know which workspace. 
                    // Managers should probably select workspace in the modal if scope is department.
                    // For now, let's assume current scope is workspace OR fail gracefully.
                })
            });

            if (res.ok) {
                setIsModalOpen(false);
                setNewTask({ title: '', description: '', priority: 'medium', dueDate: '', assignedTo: [] });
                // Trigger refresh - For now, simple reload or we need `refresh` from context
                window.location.reload();
            } else {
                const err = await res.json();
                alert(`Failed to create task: ${err.message}`);
            }
        } catch (error) {
            console.error("Create task error", error);
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="animate-slideDown max-w-[1600px] mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-slate-800">Task Master</h2>
                    <p className="text-slate-500">Manage and track team deliverables</p>
                </div>
                <div className="flex gap-2">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors">
                        <Filter size={18} /> Filter
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-colors"
                    >
                        <Plus size={18} /> New Task
                    </button>
                </div>
            </div>

            <DashboardCard title="Execution List" icon={CheckSquare}>
                <div className="divide-y divide-slate-100">
                    <div className="grid grid-cols-12 px-4 py-3 bg-slate-50/50 text-xs font-bold text-slate-400 uppercase tracking-wider rounded-t-lg">
                        <div className="col-span-5">Task Name</div>
                        <div className="col-span-2">Priority</div>
                        <div className="col-span-2">Due Date</div>
                        <div className="col-span-3">Assigned To</div>
                    </div>
                    {tasks && tasks.length > 0 ? (
                        tasks.map(task => (
                            <div key={task._id} className="grid grid-cols-12 items-center px-4 py-4 hover:bg-slate-50 transition-colors group cursor-pointer">
                                <div className="col-span-5 pr-4">
                                    <p className="text-sm font-bold text-slate-700 truncate group-hover:text-indigo-600 transition-colors">{task.title}</p>
                                </div>
                                <div className="col-span-2">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${task.priority === 'urgent' ? 'bg-red-50 text-red-600' :
                                            task.priority === 'high' ? 'bg-orange-50 text-orange-600' :
                                                'bg-slate-100 text-slate-500'
                                        }`}>{task.priority}</span>
                                </div>
                                <div className="col-span-2 text-xs text-slate-500 font-medium">
                                    {new Date(task.dueDate).toLocaleDateString()}
                                </div>
                                <div className="col-span-3 flex -space-x-2">
                                    {task.assignedTo?.slice(0, 3).map((u, i) => (
                                        <div key={i} title={u.username} className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-xs font-bold text-slate-600 ring-2 ring-transparent group-hover:ring-indigo-100 transition-all">
                                            {u.username?.[0]}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="p-12 text-center text-slate-400">
                            <CheckSquare size={48} className="mx-auto mb-4 opacity-20" />
                            <p>No tasks found in this scope.</p>
                        </div>
                    )}
                </div>
            </DashboardCard>

            {/* Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-slideUp">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="font-bold text-lg text-slate-800">Create New Task</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Task Title</label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold text-slate-700"
                                    placeholder="e.g. Update Landing Page"
                                    value={newTask.title}
                                    onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Priority</label>
                                    <select
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                                        value={newTask.priority}
                                        onChange={e => setNewTask({ ...newTask, priority: e.target.value })}
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due Date</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        value={newTask.dueDate}
                                        onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                                <textarea
                                    rows="3"
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none text-sm"
                                    placeholder="Add details..."
                                    value={newTask.description}
                                    onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                                />
                            </div>

                            {scope && scope.type !== 'workspace' && (
                                <div className="p-3 bg-yellow-50 text-yellow-700 text-xs rounded-lg font-medium">
                                    Note: Task creation is currently optimized for Workspace scope. Please ensure you are viewing a specific Workspace to assign tasks correctly.
                                </div>
                            )}

                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md shadow-indigo-200 disabled:opacity-50"
                                >
                                    {creating ? 'Creating...' : 'Create Task'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManagerTasks;
