// client/src/components/manager/ManagerTasks.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import {
    Plus, CheckCircle2, Clock, AlertCircle, MoreVertical,
    User, X
} from 'lucide-react';

const ManagerTasks = () => {
    const { selectedDepartment } = useOutletContext();
    const [tasks, setTasks] = useState({ open: [], inProgress: [], completed: [], overdue: [] });
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium', dueDate: '' });

    // Fetch tasks when department changes
    // Define fetchTasks with useCallback so it can be used in useEffect and other handlers
    const fetchTasks = useCallback(async () => {
        if (!selectedDepartment?._id) return;
        try {
            setLoading(true);
            const response = await axios.get(
                `${process.env.REACT_APP_BACKEND_URL}/api/manager/tasks/${selectedDepartment._id}`,
                { withCredentials: true }
            );
            setTasks(response.data.tasks);
        } catch (error) {
            console.error('Error fetching tasks:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedDepartment]);

    // Fetch tasks when department changes
    useEffect(() => {
        if (selectedDepartment) {
            fetchTasks();
        }
    }, [selectedDepartment, fetchTasks]);

    const handleCreateTask = async (e) => {
        e.preventDefault();
        try {
            await axios.post(
                `${process.env.REACT_APP_BACKEND_URL}/api/manager/tasks/${selectedDepartment._id}`,
                newTask,
                { withCredentials: true }
            );
            setIsCreateModalOpen(false);
            setNewTask({ title: '', description: '', priority: 'medium', dueDate: '' });
            fetchTasks(); // Refresh list
        } catch (error) {
            console.error('Error creating task:', error);
        }
    };

    const handleStatusChange = async (taskId, newStatus) => {
        try {
            await axios.patch(
                `${process.env.REACT_APP_BACKEND_URL}/api/manager/tasks/${taskId}/status`,
                { status: newStatus },
                { withCredentials: true }
            );
            fetchTasks(); // Refresh to move task to correct column
        } catch (error) {
            console.error('Error updating task status:', error);
        }
    };

    const StatusColumn = ({ title, items, status, icon: Icon, color }) => (
        <div className="flex-1 min-w-[300px] bg-gray-50 rounded-xl p-4 flex flex-col h-full max-h-full">
            <div className={`flex items-center gap-2 mb-4 font-bold ${color}`}>
                <Icon size={18} />
                <h3>{title}</h3>
                <span className="ml-auto bg-white px-2 py-0.5 rounded-full text-xs shadow-sm text-gray-600">
                    {items.length}
                </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {items.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                        <p className="text-sm">No tasks</p>
                    </div>
                ) : (
                    items.map(task => (
                        <div key={task._id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
                            <div className="flex justify-between items-start mb-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide
                  ${task.priority === 'urgent' ? 'bg-red-100 text-red-600' :
                                        task.priority === 'high' ? 'bg-orange-100 text-orange-600' :
                                            task.priority === 'medium' ? 'bg-blue-100 text-blue-600' :
                                                'bg-gray-100 text-gray-600'
                                    }`}>
                                    {task.priority}
                                </span>
                                <button className="text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <MoreVertical size={14} />
                                </button>
                            </div>

                            <h4 className="font-bold text-gray-800 mb-1">{task.title}</h4>
                            <p className="text-xs text-gray-500 mb-3 line-clamp-2">{task.description}</p>

                            <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                                <div className="flex items-center gap-2">
                                    {task.assignedTo && task.assignedTo.length > 0 ? (
                                        <div className="flex -space-x-2">
                                            {task.assignedTo.map((assignee, idx) => (
                                                <div key={idx} className="w-6 h-6 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-indigo-700" title={assignee.username}>
                                                    {assignee.username?.charAt(0).toUpperCase()}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 text-xs text-gray-400">
                                            <User size={12} /> Unassigned
                                        </div>
                                    )}
                                </div>

                                {/* Status Mover Actions */}
                                <div className="flex gap-1">
                                    {status === 'open' && (
                                        <button
                                            onClick={() => handleStatusChange(task._id, 'in-progress')}
                                            className="p-1 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded" title="Start"
                                        >
                                            <Clock size={14} />
                                        </button>
                                    )}
                                    {status === 'in-progress' && (
                                        <button
                                            onClick={() => handleStatusChange(task._id, 'done')}
                                            className="p-1 hover:bg-green-50 text-gray-400 hover:text-green-600 rounded" title="Complete"
                                        >
                                            <CheckCircle2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    if (loading) return <div className="p-8 text-center text-gray-500">Loading tasks...</div>;

    return (
        <div className="h-full flex flex-col bg-white">
            {/* Header */}
            <div className="px-8 py-6 border-b border-gray-200 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-gray-900">Task Board</h2>
                    <p className="text-sm text-gray-500">Manage tasks for {selectedDepartment?.name}</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 flex items-center gap-2"
                >
                    <Plus size={18} /> New Task
                </button>
            </div>

            {/* Kanban Board */}
            <div className="flex-1 overflow-x-auto p-6">
                <div className="flex gap-6 h-full min-w-max">
                    <StatusColumn
                        title="To Do"
                        items={tasks.open}
                        status="open"
                        icon={AlertCircle}
                        color="text-gray-600"
                    />
                    <StatusColumn
                        title="In Progress"
                        items={tasks.inProgress}
                        status="in-progress"
                        icon={Clock}
                        color="text-blue-600"
                    />
                    <StatusColumn
                        title="Completed"
                        items={tasks.completed}
                        status="done"
                        icon={CheckCircle2}
                        color="text-green-600"
                    />
                </div>
            </div>

            {/* Create Task Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-900">Create New Task</h3>
                            <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-gray-700">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateTask} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Task Title <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={newTask.title}
                                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="e.g. Update API Documentation"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                                <textarea
                                    value={newTask.description}
                                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                                    rows="3"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                    placeholder="Add details about this task..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Priority</label>
                                    <select
                                        value={newTask.priority}
                                        onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Due Date</label>
                                    <input
                                        type="date"
                                        value={newTask.dueDate}
                                        onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
                                >
                                    Create Task
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
