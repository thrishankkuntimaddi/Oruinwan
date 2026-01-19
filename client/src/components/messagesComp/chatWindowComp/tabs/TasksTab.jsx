import React, { useState, useMemo } from 'react';
import { Plus, CheckCircle, Circle, Clock, User, Trash2, Edit2, X } from 'lucide-react';

export default function TasksTab({ channelId, channelName, currentUserId, socket }) {
    const [tasks, setTasks] = useState([]);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [showCompleted, setShowCompleted] = useState(true);
    const [editingTask, setEditingTask] = useState(null);

    const filteredTasks = useMemo(() => {
        if (showCompleted) return tasks;
        return tasks.filter(t => !t.completed);
    }, [tasks, showCompleted]);

    const completedCount = tasks.filter(t => t.completed).length;

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
        <div className="flex flex-col h-full bg-white dark:bg-gray-900">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Tasks</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {tasks.length} total · {completedCount} completed
                        </p>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showCompleted}
                            onChange={(e) => setShowCompleted(e.target.checked)}
                            className="rounded"
                        />
                        Show completed
                    </label>
                </div>

                {/* Add task form */}
                <form onSubmit={handleAddTask} className="flex gap-2">
                    <input
                        type="text"
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        placeholder="Add a new task..."
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400"
                    />
                    <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                        <Plus size={18} />
                        Add
                    </button>
                </form>
            </div>

            {/* Task list */}
            <div className="flex-1 overflow-y-auto p-6 space-y-2">
                {filteredTasks.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <Circle size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No tasks yet. Add one above to get started!</p>
                    </div>
                ) : (
                    filteredTasks.map(task => (
                        <div
                            key={task.id}
                            className={`group p-4 rounded-lg border transition-all ${task.completed
                                    ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
                                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:shadow-md'
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                {/* Checkbox */}
                                <button
                                    onClick={() => toggleTask(task.id)}
                                    className="mt-0.5 flex-shrink-0"
                                >
                                    {task.completed ? (
                                        <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
                                    ) : (
                                        <Circle size={20} className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400" />
                                    )}
                                </button>

                                {/* Task content */}
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium ${task.completed
                                            ? 'line-through text-gray-500 dark:text-gray-400'
                                            : 'text-gray-900 dark:text-gray-100'
                                        }`}>
                                        {task.title}
                                    </p>

                                    {task.dueDate && (
                                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                            <Clock size={12} />
                                            {new Date(task.dueDate).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => setEditingTask(task)}
                                        className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                        title="Edit"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button
                                        onClick={() => deleteTask(task.id)}
                                        className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                        title="Delete"
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
    );
}
