import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import api from "../services/api";
import { useToast } from "./ToastContext";
import { useAuth } from "./AuthContext";
import { useSocket } from "./SocketContext";

const TasksContext = createContext();

export const useTasks = () => useContext(TasksContext);

export const TasksProvider = ({ children }) => {
    const location = useLocation();
    const { showToast } = useToast();
    const { user } = useAuth();
    const { socket } = useSocket();

    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    // Extract workspaceId from URL path
    const getWorkspaceId = useCallback(() => {
        const match = location.pathname.match(/\/workspace\/([^/]+)/);
        return match ? match[1] : null;
    }, [location.pathname]);

    // Map backend status to frontend format
    const mapBackendStatus = useCallback((status) => {
        const statusMap = {
            'todo': 'To Do',
            'in-progress': 'In Progress',
            'review': 'In Progress',
            'done': 'Completed',
            'cancelled': 'Cancelled'
        };
        return statusMap[status] || 'To Do';
    }, []);

    // Map frontend status to backend format
    const mapFrontendStatus = useCallback((status) => {
        const statusMap = {
            'To Do': 'todo',
            'In Progress': 'in-progress',
            'Completed': 'done',
            'Cancelled': 'cancelled'
        };
        return statusMap[status] || 'todo';
    }, []);

    // Map backend priority to frontend format
    const mapBackendPriority = useCallback((priority) => {
        const priorityMap = {
            'low': 'Low',
            'medium': 'Medium',
            'high': 'High',
            'urgent': 'Emergency'
        };
        return priorityMap[priority] || 'Medium';
    }, []);

    // Map frontend priority to backend format
    const mapFrontendPriority = useCallback((priority) => {
        const priorityMap = {
            'Low': 'low',
            'Medium': 'medium',
            'High': 'high',
            'Emergency': 'urgent'
        };
        return priorityMap[priority] || 'medium';
    }, []);

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
            const mappedTasks = response.data.tasks.map(task => {
                // Handle multiple assignees display
                const validAssignees = (task.assignedTo || []).filter(u => u);

                let assigneeDisplay = "Self";
                if (validAssignees.length > 0) {
                    if (validAssignees.length === 1) {
                        assigneeDisplay = validAssignees[0].username || "Unknown";
                    } else {
                        assigneeDisplay = `${validAssignees.length} members`;
                    }
                }

                return {
                    id: task._id,
                    title: task.title,
                    description: task.description || "",
                    assignee: assigneeDisplay,
                    assigneeId: validAssignees.length > 0 ? validAssignees[0]._id : user?._id || null,
                    assigner: task.createdBy?.username || user?.username || "Unknown",
                    assignerId: task.createdBy?._id || user?._id,
                    status: mapBackendStatus(task.status),
                    priority: mapBackendPriority(task.priority),
                    dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : null,
                    project: task.channel?.name || "General",
                    completedAt: task.completedAt,
                    completionNote: task.completionNote || "",
                    deleted: task.deleted || false,
                    tags: task.tags || [],
                    createdAt: task.createdAt,
                    updatedAt: task.updatedAt,
                    visibility: task.visibility || "private",
                    assignees: validAssignees, // Keep full valid assignee list
                    attachments: task.attachments || [],
                    transferRequest: task.transferRequest || null
                };
            });

            setTasks(mappedTasks);
        } catch (error) {
            console.error("Failed to load tasks:", error);
            showToast(error.response?.data?.message || "Failed to load tasks", "error");
            setTasks([]);
        } finally {
            setLoading(false);
        }
    }, [getWorkspaceId, showToast, user, mapBackendStatus, mapBackendPriority]);


    // Load tasks when workspace changes
    useEffect(() => {
        loadTasks();
    }, [loadTasks]);

    // WebSocket listeners for task events
    useEffect(() => {
        if (!socket) return;

        const mapTaskToFrontend = (task) => {
            const validAssignees = (task.assignedTo || []).filter(u => u);
            const assigneeDisplay = validAssignees.length === 1
                ? validAssignees[0].username || "Unknown"
                : validAssignees.length > 1 ? `${validAssignees.length} members` : "Self";

            return {
                id: task._id,
                title: task.title,
                description: task.description || "",
                assignee: assigneeDisplay,
                assigneeId: validAssignees[0]?._id || user?._id,
                assigner: task.createdBy?.username || "Unknown",
                assignerId: task.createdBy?._id,
                status: mapBackendStatus(task.status),
                priority: mapBackendPriority(task.priority),
                dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : null,
                project: task.channel?.name || "General",
                completedAt: task.completedAt,
                completionNote: task.completionNote || "",
                deleted: task.deleted || false,
                tags: task.tags || [],
                createdAt: task.createdAt,
                updatedAt: task.updatedAt,
                visibility: task.visibility || "private",
                assignees: validAssignees,
                attachments: task.attachments || [],
                transferRequest: task.transferRequest || null
            };
        };

        const handleTaskCreated = (task) => {

            setTasks(prev => {
                if (prev.some(t => t.id === task._id)) return prev; // Prevent duplicates
                return [mapTaskToFrontend(task), ...prev];
            });
        };

        const handleTaskDeleted = (data) => {

            setTasks(prev => prev.filter(t => t.id !== data.taskId));
        };

        const handleTaskAssigned = (task) => {

            showToast(`New task assigned: ${task.title}`, "info");
            setTasks(prev => {
                if (prev.some(t => t.id === task._id)) return prev;
                return [mapTaskToFrontend(task), ...prev];
            });
        };

        const handleTaskRemoved = (data) => {

            showToast("A task has been reassigned", "info");
            setTasks(prev => prev.filter(t => t.id !== data.taskId));
        };

        const handleTaskUpdated = (task) => {

            setTasks(prev => {
                const existingIndex = prev.findIndex(t => t.id === task._id);
                if (existingIndex === -1) return prev; // Task not in list? Maybe we should add it if it's now relevant?
                // For now, only update if existing.

                const updatedTask = mapTaskToFrontend(task);
                return prev.map((t, idx) => idx === existingIndex ? updatedTask : t);
            });
        };

        socket.on("task-created", handleTaskCreated);
        socket.on("task-deleted", handleTaskDeleted);
        socket.on("task-assigned", handleTaskAssigned);
        socket.on("task-removed", handleTaskRemoved);
        socket.on("task-updated", handleTaskUpdated);

        return () => {
            socket.off("task-created", handleTaskCreated);
            socket.off("task-deleted", handleTaskDeleted);
            socket.off("task-assigned", handleTaskAssigned);
            socket.off("task-removed", handleTaskRemoved);
            socket.off("task-updated", handleTaskUpdated);
        };
    }, [socket, showToast, user, mapBackendStatus, mapBackendPriority]);

    // Create new task
    const createTask = useCallback(async (taskData) => {
        try {
            const workspaceId = getWorkspaceId();
            if (!workspaceId) {
                showToast("Please select a workspace first", "error");
                return null;
            }

            const backendPayload = {
                title: taskData.title,
                description: taskData.description || "",
                workspaceId: workspaceId,
                assignmentType: taskData.assignmentType || "self",
                taskMode: taskData.taskMode, // Add task mode here
                status: mapFrontendStatus(taskData.status || "To Do"),
                priority: mapFrontendPriority(taskData.priority || "Medium"),
                dueDate: taskData.dueDate || null,
                tags: taskData.tags || [],
                attachments: taskData.attachments || []
            };

            // Add assignment-specific fields
            if (backendPayload.assignmentType === "individual") {
                backendPayload.assignedToIds = taskData.assignedToIds;
            } else if (backendPayload.assignmentType === "channel") {
                backendPayload.channelId = taskData.channelId;
            }

            // Add channel info
            if (taskData.project) {
                backendPayload.channelName = taskData.project;
            }


            const response = await api.post('/api/tasks', backendPayload);

            // Handle both single task and array of tasks (for split individual assignments)
            const backendTasks = response.data.tasks || [response.data.task];

            const newFrontendTasks = backendTasks.map(task => {
                // Handle multiple assignees display
                let assigneeDisplay = "Self";
                if (task.assignedTo && task.assignedTo.length > 0) {
                    if (task.assignedTo.length === 1) {
                        assigneeDisplay = task.assignedTo[0].username || "Unknown";
                    } else {
                        assigneeDisplay = `${task.assignedTo.length} members`;
                    }
                }

                // Determine project/channel name
                let projectName = taskData.project || "General";
                if (task.channel && task.channel.name) {
                    projectName = task.channel.name;
                }

                return {
                    id: task._id,
                    title: task.title,
                    description: task.description || "",
                    assignee: assigneeDisplay,
                    assigneeId: task.assignedTo && task.assignedTo.length > 0 ? task.assignedTo[0]._id : user?._id || null,
                    assigner: task.createdBy?.username || user?.username || "Unknown",
                    assignerId: task.createdBy?._id || user?._id,
                    status: mapBackendStatus(task.status),
                    priority: mapBackendPriority(task.priority),
                    dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : null,
                    project: projectName,
                    deleted: false,
                    tags: task.tags || [],
                    visibility: task.visibility || "private",
                    assignees: task.assignedTo || [],
                    attachments: task.attachments || [],
                    transferRequest: task.transferRequest || null
                };
            });

            setTasks(prev => [...newFrontendTasks, ...prev]);
            showToast(`Created ${newFrontendTasks.length} task(s) successfully`, "success");

            return newFrontendTasks;
        } catch (error) {
            console.error("Failed to create task:", error);
            showToast(error.response?.data?.message || "Failed to create task", "error");
            return null;
        }
    }, [getWorkspaceId, showToast, user, mapBackendStatus, mapBackendPriority, mapFrontendStatus, mapFrontendPriority]);

    // Update task
    const updateTask = useCallback(async (id, updates) => {
        try {
            const backendUpdates = {};

            // Handle TaskModal format (from full task editing)
            if (updates.title !== undefined) backendUpdates.title = updates.title;
            if (updates.description !== undefined) backendUpdates.description = updates.description;
            if (updates.project !== undefined) backendUpdates.channelName = updates.project;
            if (updates.status !== undefined) backendUpdates.status = mapFrontendStatus(updates.status);
            if (updates.priority !== undefined) backendUpdates.priority = mapFrontendPriority(updates.priority);
            if (updates.dueDate !== undefined) backendUpdates.dueDate = updates.dueDate;
            if (updates.tags !== undefined) backendUpdates.tags = updates.tags;
            if (updates.completionNote !== undefined) backendUpdates.completionNote = updates.completionNote;
            if (updates.completedAt !== undefined) backendUpdates.completedAt = updates.completedAt;
            if (updates.attachments !== undefined) backendUpdates.attachments = updates.attachments;

            // Handle assignment updates from TaskModal
            if (updates.assignmentType !== undefined) {
                if (updates.assignmentType === "self") {
                    backendUpdates.assignedTo = [user._id];
                } else if (updates.assignmentType === "individual" && updates.assignedToIds) {
                    backendUpdates.assignedTo = updates.assignedToIds;
                } else if (updates.assignmentType === "channel" && updates.channelId) {
                    // Channel assignment handled differently - might need backend support
                    backendUpdates.channelId = updates.channelId;
                }
            } else if (updates.assigneeId !== undefined) {
                // Handle simple assignee update (from dropdown)
                backendUpdates.assignedTo = [updates.assigneeId];
            }

            const response = await api.put(`/api/tasks/${id}`, backendUpdates);
            const updatedBackendTask = response.data.task;

            // Map backend task to frontend format
            const validAssignees = (updatedBackendTask.assignedTo || []).filter(u => u);
            let assigneeDisplay = "Self";
            if (validAssignees.length > 0) {
                if (validAssignees.length === 1) {
                    assigneeDisplay = validAssignees[0].username || "Unknown";
                } else {
                    assigneeDisplay = `${validAssignees.length} members`;
                }
            }

            const updatedTask = {
                id: updatedBackendTask._id,
                title: updatedBackendTask.title,
                description: updatedBackendTask.description || "",
                assignee: assigneeDisplay,
                assigneeId: validAssignees.length > 0 ? validAssignees[0]._id : user?._id || null,
                assigner: updatedBackendTask.createdBy?.username || user?.username || "Unknown",
                assignerId: updatedBackendTask.createdBy?._id || user?._id,
                status: mapBackendStatus(updatedBackendTask.status),
                priority: mapBackendPriority(updatedBackendTask.priority),
                dueDate: updatedBackendTask.dueDate ? new Date(updatedBackendTask.dueDate).toISOString().split('T')[0] : null,
                project: updatedBackendTask.channel?.name || "General",
                completedAt: updatedBackendTask.completedAt,
                completionNote: updatedBackendTask.completionNote || "",
                deleted: updatedBackendTask.deleted || false,
                tags: updatedBackendTask.tags || [],
                createdAt: updatedBackendTask.createdAt,
                updatedAt: updatedBackendTask.updatedAt,
                visibility: updatedBackendTask.visibility || "private",
                assignees: validAssignees,
                attachments: updatedBackendTask.attachments || []
            };

            setTasks(prev => prev.map(task =>
                task.id === id ? updatedTask : task
            ));

            if (updates.status === "Completed") {
                showToast("Task completed successfully", "success");
            }
        } catch (error) {
            console.error("Failed to update task:", error);
            showToast("Failed to update task", "error");

            // Reload tasks on error
            loadTasks();
        }
    }, [showToast, loadTasks, user, mapBackendStatus, mapBackendPriority, mapFrontendStatus, mapFrontendPriority]);

    // Delete task (soft delete)
    const deleteTask = useCallback(async (id) => {
        try {
            await api.delete(`/api/tasks/${id}`);

            setTasks(prev => prev.map(task =>
                task.id === id ? { ...task, deleted: true } : task
            ));

            showToast("Task moved to trash", "success");
        } catch (error) {
            console.error("Failed to delete task:", error);
            showToast("Failed to delete task", "error");
            // Revert optimistic update if needed or just reload
            loadTasks();
        }
    }, [showToast, loadTasks]);

    // Permanently delete task
    const permanentlyDeleteTask = useCallback(async (id) => {
        try {
            await api.delete(`/api/tasks/${id}/permanent`);
            setTasks(prev => prev.filter(task => task.id !== id));
            showToast("Task permanently deleted", "success");
        } catch (error) {
            console.error("Failed to permanently delete task:", error);
            showToast("Failed to permanently delete task", "error");
        }
    }, [showToast]);

    // Restore task
    const restoreTask = useCallback(async (id) => {
        try {
            await api.put(`/api/tasks/${id}/restore`);
            setTasks(prev => prev.map(task =>
                task.id === id ? { ...task, deleted: false } : task
            ));
            showToast("Task restored", "success");
        } catch (error) {
            console.error("Failed to restore task:", error);
            showToast("Failed to restore task", "error");
        }
    }, [showToast]);

    // Handle Transfer Request (Approve/Reject)
    const handleTransferResponse = useCallback(async (taskId, action) => {
        try {
            const response = await api.post(`/api/tasks/${taskId}/transfer-request/${action}`);

            if (action === 'approve') {
                const updatedBackendTask = response.data.task;
                // Map and update local state
                // Note: The structure needs to match other mapping areas
                const validAssignees = (updatedBackendTask.assignedTo || []).filter(u => u);

                let assigneeDisplay = "Self";
                if (validAssignees.length > 0) {
                    if (validAssignees.length === 1) {
                        assigneeDisplay = validAssignees[0].username || "Unknown";
                    } else {
                        assigneeDisplay = `${validAssignees.length} members`;
                    }
                }

                const updatedTask = {
                    id: updatedBackendTask._id,
                    title: updatedBackendTask.title,
                    description: updatedBackendTask.description || "",
                    assignee: assigneeDisplay,
                    assigneeId: validAssignees.length > 0 ? validAssignees[0]._id : user?._id || null,
                    assigner: updatedBackendTask.createdBy?.username || user?.username || "Unknown",
                    assignerId: updatedBackendTask.createdBy?._id || user?._id,
                    status: mapBackendStatus(updatedBackendTask.status),
                    priority: mapBackendPriority(updatedBackendTask.priority),
                    dueDate: updatedBackendTask.dueDate ? new Date(updatedBackendTask.dueDate).toISOString().split('T')[0] : null,
                    project: updatedBackendTask.channel?.name || "General",
                    completedAt: updatedBackendTask.completedAt,
                    completionNote: updatedBackendTask.completionNote || "",
                    deleted: updatedBackendTask.deleted || false,
                    tags: updatedBackendTask.tags || [],
                    createdAt: updatedBackendTask.createdAt,
                    updatedAt: updatedBackendTask.updatedAt,
                    visibility: updatedBackendTask.visibility || "private",
                    assignees: validAssignees,
                    attachments: updatedBackendTask.attachments || [],
                    transferRequest: updatedBackendTask.transferRequest || null
                };

                setTasks(prev => prev.map(task =>
                    task.id === taskId ? updatedTask : task
                ));
                showToast("Transfer request approved", "success");
            } else {
                // For reject, we just update the transferRequest status locally or reload
                // Since backend doesn't return full task on reject (only message), we might need to update locally manually or reload
                // Let's manually update the transferRequest status locally
                setTasks(prev => prev.map(task => {
                    if (task.id === taskId) {
                        return {
                            ...task,
                            transferRequest: {
                                ...task.transferRequest,
                                status: 'rejected'
                            }
                        };
                    }
                    return task;
                }));
                showToast("Transfer request rejected", "success");
            }

        } catch (error) {
            console.error("Failed to handle transfer request:", error);
            showToast(error.response?.data?.message || "Failed to process request", "error");
        }
    }, [showToast, user, mapBackendStatus, mapBackendPriority]);

    return (
        <TasksContext.Provider value={{
            tasks,
            loading,
            createTask,
            updateTask,
            deleteTask,
            permanentlyDeleteTask,
            restoreTask,
            handleTransferResponse,
            refreshTasks: loadTasks
        }}>
            {children}
        </TasksContext.Provider>
    );
};
