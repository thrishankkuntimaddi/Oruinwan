import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import api from '@services/api';
import { useToast } from "./ToastContext";
import { useAuth } from "./AuthContext";
import { useSocket } from "./SocketContext";
import logger from '../utils/logger';
import { mapTask, upsertTask, toStatus, toPriority, taskErrorMessage, statusLabel } from '../utils/taskMeta';

/**
 * Workspace tasks for the Tasks page. Tasks are kept in the server's shape
 * (see utils/taskMeta.mapTask) — statuses/priorities are server values and
 * only turned into labels when rendered. The list includes the viewer's
 * trashed tasks (deleted: true) so the Trash view works; subtasks are not
 * top-level rows (the server leaves them out, the client double-checks).
 */
const TasksContext = createContext();

export const useTasks = () => useContext(TasksContext);

const idOf = (v) => (v && typeof v === 'object' ? String(v._id || v.id || '') : v ? String(v) : '');
/** Socket payloads are either the task itself or `{ task }`. */
const taskFromPayload = (p) => (p && p.task && typeof p.task === 'object' ? p.task : p);

/** Only the fields the server accepts on PUT /api/v2/tasks/:id, in server values. */
function toUpdatePayload(updates) {
    const out = {};
    const copy = ['title', 'description', 'dueDate', 'tags', 'labels', 'completionNote', 'blockedReason',
        'storyPoints', 'estimatedHours', 'actualHours', 'resolution', 'sprintId'];
    for (const key of copy) if (updates[key] !== undefined) out[key] = updates[key];
    if (updates.status !== undefined) out.status = toStatus(updates.status);
    if (updates.priority !== undefined) out.priority = toPriority(updates.priority);
    if (updates.attachments !== undefined) {
        out.attachments = (updates.attachments || []).map((a) => ({ name: a.name || a.url, url: a.url }));
    }
    if (updates.assignedTo !== undefined) out.assignedTo = updates.assignedTo;
    else if (updates.assignedToIds !== undefined) out.assignedTo = updates.assignedToIds;
    if (updates.channelId !== undefined) out.channelId = updates.channelId;
    return out;
}

export const TasksProvider = ({ children }) => {
    const location = useLocation();
    const { showToast } = useToast();
    const { user } = useAuth();
    const { socket } = useSocket();
    const currentUserId = user?._id || user?.id || null;

    // Only the workspace id matters: navigating inside the app must not refetch.
    const workspaceId = useMemo(() => {
        const match = location.pathname.match(/\/workspace\/([^/]+)/);
        return match ? match[1] : null;
    }, [location.pathname]);

    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const tasksRef = useRef(tasks);
    tasksRef.current = tasks;
    const latestWorkspace = useRef(workspaceId);
    latestWorkspace.current = workspaceId;

    const loadTasks = useCallback(async ({ silent = false } = {}) => {
        const wsId = latestWorkspace.current;
        if (!wsId) {
            setTasks([]);
            setLoading(false);
            return;
        }
        if (silent) setRefreshing(true); else setLoading(true);
        try {
            const response = await api.get('/api/v2/tasks', { params: { workspaceId: wsId, includeDeleted: 'true' } });
            if (latestWorkspace.current !== wsId) return; // workspace changed meanwhile
            const mapped = (response.data.tasks || []).map(mapTask).filter((t) => t && !t.isSubtask);
            setTasks(mapped);
        } catch (error) {
            logger.error("Failed to load tasks:", error);
            if (latestWorkspace.current === wsId) {
                showToast(taskErrorMessage(error, "Failed to load tasks"), "error");
                if (!silent) setTasks([]);
            }
        } finally {
            if (latestWorkspace.current === wsId) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [showToast]);

    // Fetch when the workspace (or signed-in user) changes — not on every route change.
    useEffect(() => {
        setTasks([]);
        loadTasks();
    }, [workspaceId, currentUserId, loadTasks]);

    /** Apply one server task to the list (replaces by id, never duplicates). */
    const applyServerTask = useCallback((raw, extra) => {
        const t = mapTask(raw);
        if (!t?.id) return null;
        const ws = idOf(raw.workspace);
        if (ws && latestWorkspace.current && ws !== latestWorkspace.current) return null;
        const next = extra ? { ...t, ...extra } : t;
        if (next.isSubtask) {
            // Keep a parent's child list in step instead of adding a top-level row.
            setTasks((prev) => prev.map((p) => (p.id === next.parentTaskId || p.subtasks?.some((s) => s.id === next.id)
                ? { ...p, subtasks: upsertTask(p.subtasks || [], { id: next.id, title: next.title, status: next.status, assignees: next.assignees }) }
                : p)));
            return next;
        }
        setTasks((prev) => upsertTask(prev, next));
        return next;
    }, []);

    /**
     * Re-read one task (GET /api/v2/tasks/:id). With dropIfMissing, a 403/404
     * removes it from the list (used after "task-removed"); otherwise failures
     * are ignored and the list copy stays as it is.
     */
    const fetchTask = useCallback(async (id, { dropIfMissing = false } = {}) => {
        try {
            const res = await api.get(`/api/v2/tasks/${id}`);
            const raw = res.data?.task || res.data;
            return raw?._id ? applyServerTask(raw) : null;
        } catch (err) {
            const code = err?.response?.status;
            if (dropIfMissing && (code === 403 || code === 404)) setTasks((prev) => prev.filter((t) => t.id !== String(id)));
            return null;
        }
    }, [applyServerTask]);

    // Live updates: every event is applied in place — no full refetch.
    useEffect(() => {
        if (!socket) return undefined;

        const onCreated = (p) => { const raw = taskFromPayload(p); if (raw?._id) applyServerTask(raw); };
        const onUpdated = (p) => { const raw = taskFromPayload(p); if (raw?._id) applyServerTask(raw); };
        const onAssigned = (p) => {
            const raw = taskFromPayload(p);
            if (!raw?._id) return;
            const t = applyServerTask(raw);
            if (t && !t.isSubtask && String(t.creatorId) !== String(currentUserId)) {
                showToast(`New task assigned: ${t.title}`, "info");
            }
        };
        const onDeleted = (data) => {
            const id = String(data?.taskId || '');
            if (!id) return;
            if (data.permanent) setTasks((prev) => prev.filter((t) => t.id !== id));
            else setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, deleted: true } : t)));
        };
        const onRestored = (p) => {
            const raw = taskFromPayload(p);
            if (raw?._id) applyServerTask(raw, { deleted: false });
            else if (p?.taskId) setTasks((prev) => prev.map((t) => (t.id === String(p.taskId) ? { ...t, deleted: false } : t)));
        };
        // Unassigned from a task: it may still be visible (creator, workspace task), so re-check it.
        const onRemoved = (data) => {
            if (!data?.taskId) return;
            const id = String(data.taskId);
            // 'hidden': this user hid a finished task for themselves — it is gone for them.
            if (data.reason === 'hidden') setTasks((prev) => prev.filter((t) => t.id !== id));
            else fetchTask(id, { dropIfMissing: true });
        };

        socket.on("task-created", onCreated);
        socket.on("task-updated", onUpdated);
        socket.on("task-assigned", onAssigned);
        socket.on("task-deleted", onDeleted);
        socket.on("task-restored", onRestored);
        socket.on("task-removed", onRemoved);
        return () => {
            socket.off("task-created", onCreated);
            socket.off("task-updated", onUpdated);
            socket.off("task-assigned", onAssigned);
            socket.off("task-deleted", onDeleted);
            socket.off("task-restored", onRestored);
            socket.off("task-removed", onRemoved);
        };
    }, [socket, showToast, applyServerTask, fetchTask, currentUserId]);

    /**
     * Create one task (or one per member in split mode).
     * data: { title, description, assignmentType: 'self'|'individual'|'channel',
     *         assignedToIds, channelId, taskMode, status, priority, dueDate, attachments, tags }
     */
    const createTask = useCallback(async (data) => {
        if (!workspaceId) {
            showToast("Please select a workspace first", "error");
            return null;
        }
        const payload = {
            title: data.title,
            description: data.description || "",
            workspaceId,
            assignmentType: data.assignmentType || "self",
            status: toStatus(data.status || 'todo'),
            priority: toPriority(data.priority || 'medium'),
            dueDate: data.dueDate || null,
            tags: data.tags || [],
            attachments: (data.attachments || []).map((a) => ({ name: a.name || a.url, url: a.url })),
        };
        if (data.channelId) payload.channelId = data.channelId;
        if (payload.assignmentType === "individual") {
            payload.assignedToIds = data.assignedToIds || [];
            payload.taskMode = data.taskMode || 'split';
        }
        try {
            const response = await api.post('/api/v2/tasks', payload);
            const created = (response.data.tasks || [response.data.task]).filter(Boolean).map(mapTask);
            // The socket event may already have added them: upsert by id.
            setTasks((prev) => created.reduce((list, t) => upsertTask(list, t), prev));
            showToast(created.length > 1 ? `Created ${created.length} tasks` : "Task created", "success");
            return created;
        } catch (error) {
            logger.error("Failed to create task:", error);
            showToast(taskErrorMessage(error, "Failed to create task"), "error");
            return null;
        }
    }, [workspaceId, showToast]);

    /**
     * Update a task. Status/priority changes show immediately and roll back if
     * the server refuses. Returns the saved task, or null on failure (toasted).
     */
    const updateTask = useCallback(async (id, updates, { successMessage } = {}) => {
        const body = toUpdatePayload(updates);
        if (Object.keys(body).length === 0) return null;
        const before = tasksRef.current.find((t) => t.id === id) || null;
        const optimistic = {};
        if (body.status) optimistic.status = body.status;
        if (body.priority) optimistic.priority = body.priority;
        if (before && Object.keys(optimistic).length) {
            setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...optimistic } : t)));
        }
        try {
            const response = await api.put(`/api/v2/tasks/${id}`, body);
            const raw = response.data.task || response.data;
            const saved = raw?._id ? applyServerTask(raw) : null;
            if (successMessage) showToast(successMessage, "success");
            else if (body.status === 'done' && before?.status !== 'done') showToast("Task marked done", "success");
            else if (body.status && before && body.status !== before.status) showToast(`Moved to ${statusLabel(body.status)}`, "success");
            return saved;
        } catch (error) {
            logger.error("Failed to update task:", error);
            if (before) setTasks((prev) => prev.map((t) => (t.id === id ? before : t)));
            showToast(taskErrorMessage(error, "Failed to update task"), "error");
            return null;
        }
    }, [showToast, applyServerTask]);

    /** Merge local-only fields (e.g. timer state returned by a sub-endpoint). */
    const patchTaskLocal = useCallback((id, patch) => {
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    }, []);

    /** Trash a task, or (assignee of a done task) just hide it from this user. */
    const deleteTask = useCallback(async (id, { hideOnly = false } = {}) => {
        try {
            await api.delete(`/api/v2/tasks/${id}`);
            if (hideOnly) {
                setTasks((prev) => prev.filter((t) => t.id !== id));
                showToast("Task removed from your view", "success");
            } else {
                setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, deleted: true } : t)));
                showToast("Task moved to trash", "success");
            }
            return true;
        } catch (error) {
            logger.error("Failed to delete task:", error);
            showToast(taskErrorMessage(error, "Failed to delete task"), "error");
            return false;
        }
    }, [showToast]);

    const permanentlyDeleteTask = useCallback(async (id) => {
        try {
            await api.delete(`/api/v2/tasks/${id}/permanent`);
            setTasks((prev) => prev.filter((t) => t.id !== id));
            showToast("Task permanently deleted", "success");
            return true;
        } catch (error) {
            logger.error("Failed to permanently delete task:", error);
            showToast(taskErrorMessage(error, "Failed to permanently delete task"), "error");
            return false;
        }
    }, [showToast]);

    const restoreTask = useCallback(async (id) => {
        try {
            const res = await api.post(`/api/v2/tasks/${id}/restore`);
            const raw = res.data?.task;
            if (raw?._id) applyServerTask(raw, { deleted: false });
            else setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, deleted: false } : t)));
            showToast("Task restored", "success");
            return true;
        } catch (error) {
            logger.error("Failed to restore task:", error);
            showToast(taskErrorMessage(error, "Failed to restore task"), "error");
            return false;
        }
    }, [showToast, applyServerTask]);

    /** Assignee asks the creator to hand the task to someone else. */
    const requestTransfer = useCallback(async (id, newAssigneeId, note, requestedTo) => {
        try {
            const res = await api.post(`/api/v2/tasks/${id}/transfer-request`, { newAssigneeId, note });
            const tr = res.data?.transferRequest || {};
            setTasks((prev) => prev.map((t) => (t.id === id
                ? { ...t, transferRequest: { ...tr, status: 'pending', note, requestedTo: requestedTo || tr.requestedTo } }
                : t)));
            showToast("Transfer request sent — waiting for the creator's approval", "success");
            return true;
        } catch (error) {
            logger.error("Failed to request transfer:", error);
            showToast(taskErrorMessage(error, "Failed to send transfer request"), "error");
            return false;
        }
    }, [showToast]);

    const handleTransferResponse = useCallback(async (taskId, action) => {
        try {
            const response = await api.post(`/api/v2/tasks/${taskId}/transfer-request/${action}`);
            const raw = response.data?.task;
            if (raw?._id) applyServerTask(raw);
            else setTasks((prev) => prev.map((t) => (t.id === taskId
                ? { ...t, transferRequest: { ...(t.transferRequest || {}), status: action === 'approve' ? 'approved' : 'rejected' } }
                : t)));
            showToast(action === 'approve' ? "Transfer approved" : "Transfer rejected", "success");
            return true;
        } catch (error) {
            logger.error("Failed to handle transfer request:", error);
            showToast(taskErrorMessage(error, "Failed to process request"), "error");
            return false;
        }
    }, [showToast, applyServerTask]);

    const refreshTasks = useCallback(() => loadTasks({ silent: true }), [loadTasks]);

    const value = useMemo(() => ({
        tasks,
        loading,
        refreshing,
        workspaceId,
        createTask,
        updateTask,
        patchTaskLocal,
        deleteTask,
        permanentlyDeleteTask,
        restoreTask,
        requestTransfer,
        handleTransferResponse,
        fetchTask,
        refreshTasks,
    }), [tasks, loading, refreshing, workspaceId, createTask, updateTask, patchTaskLocal, deleteTask,
        permanentlyDeleteTask, restoreTask, requestTransfer, handleTransferResponse, fetchTask, refreshTasks]);

    return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
};
