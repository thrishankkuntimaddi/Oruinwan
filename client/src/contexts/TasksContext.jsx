import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import api from "../services/api";
import { useToast } from "./ToastContext";
import { useAuth } from "./AuthContext";

const TasksContext = createContext();

export const useTasks = () => useContext(TasksContext);

export const TasksProvider = ({ children }) => {
    const location = useLocation();
    const { showToast } = useToast();
    const { user } = useAuth();

    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    // Extract workspaceId from URL path
    const getWorkspaceId = useCallback(() => {
        const match = location.pathname.match(/\/workspace\/([^/]+)/);
        return match ? match[1] : null;
    }, [location.pathname]);

    // Load tasks from backend
    const loadTasks = useCallback(async () => {
        try {
            const workspaceId = getWorkspaceId();
            if (!workspaceId) {
                setTasks([]);
                setLoading(false);
                return;
            }

            setLoading(true);
            const response = await api.get(`/api/tasks?workspaceId=${workspaceId}`);

            // Map backend tasks to frontend format
            const mappedTasks = response.data.tasks.map(task => ({
                id: task._id,
                title: task.title,
                description: task.description || "",
                // If assignedTo is null, it's assigned to creator (self)
                assignee: task.assignedTo?.username || task.createdBy?.username || user?.username || "Self",
                assigneeId: task.assignedTo?._id || task.createdBy?._id || user?._id || null,
                assigner: task.createdBy?.username || user?.username || "Unknown",
                assignerId: task.createdBy?._id || user?._id,
                status: mapBackendStatus(task.status),
                priority: mapBackendPriority(task.priority),
                dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : null,
                project: task.channel || "General",
                completedAt: task.completedAt,
                completionNote: task.completionNote || "",
                deleted: false,
                tags: task.tags || [],
                createdAt: task.createdAt,
                updatedAt: task.updatedAt
            }));

            setTasks(mappedTasks);
        } catch (error) {
            console.error("Failed to load tasks:", error);
            showToast("Failed to load tasks", "error");
            setTasks([]);
        } finally {
            setLoading(false);
        }
    }, [getWorkspaceId, showToast, user]);

    // Map backend status to frontend format
    const mapBackendStatus = (status) => {
        const statusMap = {
            'todo': 'To Do',
            'in-progress': 'In Progress',
            'review': 'In Progress',
            'done': 'Completed',
            'cancelled': 'Terminated'
        };
        return statusMap[status] || 'To Do';
    };

    // Map frontend status to backend format
    const mapFrontendStatus = (status) => {
        const statusMap = {
            'To Do': 'todo',
            'In Progress': 'in-progress',
            'Completed': 'done',
            'Done': 'done',
            'Terminated': 'cancelled'
        };
        return statusMap[status] || 'todo';
    };

    // Map backend priority to frontend format
    const mapBackendPriority = (priority) => {
        const priorityMap = {
            'low': 'Low',
            'medium': 'Medium',
            'high': 'High',
            'urgent': 'Emergency'
        };
        return priorityMap[priority] || 'Medium';
    };

    // Map frontend priority to backend format
    const mapFrontendPriority = (priority) => {
        const priorityMap = {
            'Low': 'low',
            'Medium': 'medium',
            'High': 'high',
            'Emergency': 'urgent'
        };
        return priorityMap[priority] || 'medium';
    };

    // Load tasks when workspace changes
    useEffect(() => {
        loadTasks();
    }, [loadTasks]);

    // Create new task
    const createTask = useCallback(async (taskData) => {
        try {
            const workspaceId = getWorkspaceId();
            if (!workspaceId) {
                showToast("Please select a workspace first", "error");
                return null;
            }

            const response = await api.post("/api/tasks", {
                workspaceId,
                title: taskData.title,
                description: taskData.description || "",
                assignedTo: taskData.assigneeId || null,
                status: mapFrontendStatus(taskData.status || "To Do"),
                priority: mapFrontendPriority(taskData.priority || "Medium"),
                dueDate: taskData.dueDate || null,
                tags: taskData.tags || []
            });

            const newTask = {
                id: response.data.task._id,
                title: response.data.task.title,
                description: response.data.task.description || "",
                // If assignedTo is null, task is assigned to creator (self)
                assignee: response.data.task.assignedTo?.username || response.data.task.createdBy?.username || user?.username || "Self",
                assigneeId: response.data.task.assignedTo?._id || response.data.task.createdBy?._id || user?._id || null,
                assigner: response.data.task.createdBy?.username || user?.username || "Self",
                assignerId: response.data.task.createdBy?._id || user?._id,
                status: mapBackendStatus(response.data.task.status),
                priority: mapBackendPriority(response.data.task.priority),
                dueDate: response.data.task.dueDate ? new Date(response.data.task.dueDate).toISOString().split('T')[0] : null,
                project: response.data.task.channel || "General",
                deleted: false,
                tags: response.data.task.tags || []
            };

            setTasks(prev => [newTask, ...prev]);
            showToast("Task created", "success");

            return newTask;
        } catch (error) {
            console.error("Failed to create task:", error);
            showToast("Failed to create task", "error");
            return null;
        }
    }, [getWorkspaceId, showToast, user]);

    // Update task
    const updateTask = useCallback(async (id, updates) => {
        // Optimistically update UI
        setTasks(prev => prev.map(task =>
            task.id === id ? { ...task, ...updates } : task
        ));

        try {
            const backendUpdates = {};

            if (updates.title !== undefined) backendUpdates.title = updates.title;
            if (updates.description !== undefined) backendUpdates.description = updates.description;
            if (updates.status !== undefined) backendUpdates.status = mapFrontendStatus(updates.status);
            if (updates.priority !== undefined) backendUpdates.priority = mapFrontendPriority(updates.priority);
            if (updates.dueDate !== undefined) backendUpdates.dueDate = updates.dueDate;
            if (updates.assigneeId !== undefined) backendUpdates.assignedTo = updates.assigneeId;
            if (updates.tags !== undefined) backendUpdates.tags = updates.tags;

            await api.put(`/ api / tasks / ${id} `, backendUpdates);
        } catch (error) {
            console.error("Failed to update task:", error);
            showToast("Failed to update task", "error");

            // Reload tasks on error
            loadTasks();
        }
    }, [showToast, loadTasks]);

    // Delete task (soft delete)
    const deleteTask = useCallback(async (id) => {
        try {
            // For now, mark as deleted locally
            // You can implement soft delete on backend later
            setTasks(prev => prev.map(task =>
                task.id === id ? { ...task, deleted: true } : task
            ));

            showToast("Task moved to trash", "success");
        } catch (error) {
            console.error("Failed to delete task:", error);
            showToast("Failed to delete task", "error");
        }
    }, [showToast]);

    // Permanently delete task
    const permanentlyDeleteTask = useCallback(async (id) => {
        try {
            await api.delete(`/ api / tasks / ${id} `);
            setTasks(prev => prev.filter(task => task.id !== id));
            showToast("Task permanently deleted", "success");
        } catch (error) {
            console.error("Failed to permanently delete task:", error);
            showToast("Failed to permanently delete task", "error");
        }
    }, [showToast]);

    // Restore task
    const restoreTask = useCallback((id) => {
        setTasks(prev => prev.map(task =>
            task.id === id ? { ...task, deleted: false } : task
        ));
        showToast("Task restored", "success");
    }, [showToast]);

    return (
        <TasksContext.Provider value={{
            tasks,
            loading,
            createTask,
            updateTask,
            deleteTask,
            permanentlyDeleteTask,
            restoreTask,
            refreshTasks: loadTasks
        }}>
            {children}
        </TasksContext.Provider>
    );
};
