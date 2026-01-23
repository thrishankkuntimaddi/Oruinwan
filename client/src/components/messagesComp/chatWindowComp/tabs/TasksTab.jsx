import React, { useState, useMemo } from 'react';
import { Plus, CheckCircle, Clock, User, Trash2, Edit2, Layout, CheckSquare, MoreVertical, Calendar } from 'lucide-react';

export default function TasksTab({ channelId, channelName, currentUserId, socket }) {
    const [tasks, setTasks] = useState([]);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    // eslint-disable-next-line no-unused-vars
    const [editingTask, setEditingTask] = useState(null);

    const activeTasks = useMemo(() => tasks.filter(t => !t.completed), [tasks]);
    const completedTasks = useMemo(() => tasks.filter(t => t.completed), [tasks]);

    const completedCount = completedTasks.length;

    const handleAddTask = (e) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;

        const newTask = {
            id: Date.now(),
            title: newTaskTitle.trim(),
            completed: false,
            createdBy: currentUserId,
            createdAt: new Date().toISOString(),
            assignedTo: null,
            dueDate: null
        };

        setTasks([...tasks, newTask]);
        setNewTaskTitle('');

        // TODO: Emit socket event
        // socket?.emit('task:create', { channelId, task: newTask });
    };

    const toggleTask = (taskId) => {
        setTasks(tasks.map(t =>
            t.id === taskId ? { ...t, completed: !t.completed } : t
        ));

        // TODO: Emit socket event
        // socket?.emit('task:toggle', { channelId, taskId });
    };

    const deleteTask = (taskId) => {
        setTasks(tasks.filter(t => t.id !== taskId));

        // TODO: Emit socket event
        // socket?.emit('task:delete', { channelId, taskId });
    };

    return (
        <div className="flex flex-col h-full w-full bg-gray-50/50 dark:bg-gray-900 overflow-hidden">
            {/* Header Area */}
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm z-10 flex-shrink-0 backdrop-blur-sm bg-opacity-80 dark:bg-opacity-80 sticky top-0">
                <div className="w-full flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2.5">
                            <Layout className="text-indigo-600 dark:text-indigo-400" size={22} />
                            Task Board
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 text-xs mt-1 font-medium ml-8">
                            Managing items for <span className="text-gray-700 dark:text-gray-300">#{channelName}</span>
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex -space-x-2">
                            {/* Placeholder for assignees faces */}
                        </div>
                        <div className="h-4 w-px bg-gray-300 dark:bg-gray-700"></div>
                        <div className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm border border-indigo-100 dark:border-indigo-800/50">
                            {completedCount} / {tasks.length} Done
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area - Board Layout */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-900/50">
                <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[500px] w-full">

                    {/* Column 1: Active Tasks */}
                    <div className="flex-1 w-full flex flex-col h-full rounded-2xl bg-gray-100/50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-800/50 p-1">
                        <div className="p-3 mb-2 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider flex items-center gap-2">
                                <span className="flex h-2 w-2 rounded-full bg-indigo-500"></span>
                                To Do
                                <span className="ml-2 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-0.5 px-2 rounded-md text-[10px] font-bold shadow-sm border border-gray-200 dark:border-gray-600">
                                    {activeTasks.length}
                                </span>
                            </h3>
                        </div>

                        {/* Add Task Input */}
                        <form onSubmit={handleAddTask} className="relative group px-3 mb-4">
                            <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                                <Plus size={18} className="text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                value={newTaskTitle}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                placeholder="Add a new task..."
                                className="w-full pl-10 pr-12 py-3 bg-white dark:bg-gray-800 border border-transparent shadow-sm hover:shadow-md focus:shadow-lg rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none transition-all duration-200"
                            />
                            {newTaskTitle.trim() && (
                                <button
                                    type="submit"
                                    className="absolute right-5 top-1/2 -translate-y-1/2 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-md hover:scale-105"
                                >
                                    Add
                                </button>
                            )}
                        </form>

                        {/* Active Tasks List */}
                        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3 custom-scrollbar">
                            {activeTasks.length === 0 ? (
                                <div className="h-48 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl m-2 opacity-60">
                                    <p className="text-sm font-medium text-gray-500">No pending tasks</p>
                                    <p className="text-xs text-gray-400 mt-1">Add one above to get started</p>
                                </div>
                            ) : (
                                activeTasks.map(task => (
                                    <div
                                        key={task.id}
                                        className="group relative bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800 hover:shadow-md transition-all duration-200"
                                    >
                                        <div className="flex items-start gap-3">
                                            <button
                                                onClick={() => toggleTask(task.id)}
                                                className="mt-0.5 w-5 h-5 rounded-md border-2 border-gray-300 dark:border-gray-600 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
                                            />

                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-relaxed mb-2">
                                                    {task.title}
                                                </p>

                                                <div className="flex items-center gap-2">
                                                    {task.dueDate ? (
                                                        <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-md">
                                                            <Calendar size={12} />
                                                            {new Date(task.dueDate).toLocaleDateString()}
                                                        </div>
                                                    ) : (
                                                        <button className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Calendar size={12} /> Date
                                                        </button>
                                                    )}

                                                    {task.assignedTo ? (
                                                        <div className="flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-md">
                                                            <User size={12} />
                                                            {task.assignedTo}
                                                        </div>
                                                    ) : (
                                                        <button className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <User size={12} /> Assign
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                                <button
                                                    onClick={() => setEditingTask(task)}
                                                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => deleteTask(task.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Column 2: Completed Tasks */}
                    <div className="flex-1 w-full flex flex-col h-full rounded-2xl bg-gray-100/50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-800/50 p-1">
                        <div className="p-3 mb-2 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                <CheckSquare size={16} />
                                Completed
                                <span className="ml-2 bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 py-0.5 px-2 rounded-md text-[10px] font-bold shadow-sm">
                                    {completedTasks.length}
                                </span>
                            </h3>
                        </div>

                        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3 custom-scrollbar">
                            {completedTasks.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center opacity-40">
                                    <CheckCircle size={48} className="text-gray-300 dark:text-gray-600 mb-3" />
                                    <p className="text-sm font-medium text-gray-400">No completed tasks yet</p>
                                </div>
                            ) : (
                                completedTasks.map(task => (
                                    <div
                                        key={task.id}
                                        className="group relative bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-all duration-200"
                                    >
                                        <div className="flex items-start gap-3 opacity-60 hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => toggleTask(task.id)}
                                                className="mt-0.5 w-5 h-5 rounded-md bg-emerald-500 border-emerald-500 flex items-center justify-center text-white shadow-sm hover:bg-emerald-600 transition-colors"
                                            >
                                                <CheckCircle size={14} strokeWidth={3} />
                                            </button>

                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 line-through decoration-gray-300 dark:decoration-gray-600">
                                                    {task.title}
                                                </p>
                                            </div>

                                            <button
                                                onClick={() => deleteTask(task.id)}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
