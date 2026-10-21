import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@services/api';
import { taskErrorMessage } from '../../utils/taskMeta';

/**
 * Task templates (/api/task-templates) and milestones (/api/milestones) of a
 * workspace. Both lists load lazily per workspace; every write returns the
 * saved document (or null on failure, with `onError` called).
 */

const idOf = (v) => (v && typeof v === 'object' ? String(v._id || v.id || '') : v ? String(v) : '');

export const MILESTONE_STATUSES = [
    { id: 'not_started', label: 'Not started', color: 'var(--text-muted)' },
    { id: 'in_progress', label: 'In progress', color: '#6ea8fe' },
    { id: 'at_risk', label: 'At risk', color: 'var(--state-danger, #e05252)' },
    { id: 'completed', label: 'Completed', color: 'var(--state-success, #5aba8a)' },
];
export const milestoneStatusMeta = (s) => MILESTONE_STATUSES.find((x) => x.id === s) || MILESTONE_STATUSES[0];

export const mapMilestone = (m) => (m ? { ...m, id: idOf(m), _id: idOf(m) } : null);
export const mapTemplate = (t) => (t ? {
    ...t, id: idOf(t), _id: idOf(t), tags: t.tags || [], subtaskTitles: t.subtaskTitles || [],
} : null);

/**
 * Progress of a milestone: counted from the tasks the viewer has loaded
 * (tasks carry `milestoneId`); falls back to the server's `taskCounts`.
 */
export function milestoneProgress(milestone, tasks = []) {
    const id = idOf(milestone);
    const linked = tasks.filter((t) => !t.deleted && !t.isSubtask && t.status !== 'cancelled' && idOf(t.milestoneId) === id);
    if (linked.length) {
        const done = linked.filter((t) => t.status === 'done').length;
        return { total: linked.length, done, pct: Math.round((done / linked.length) * 100), tasks: linked };
    }
    const c = milestone?.taskCounts;
    if (c && c.total) return { total: c.total, done: c.done || 0, pct: Math.round(((c.done || 0) / c.total) * 100), tasks: [] };
    return { total: 0, done: 0, pct: 0, tasks: [] };
}

/** Template -> the fields TaskModal pre-fills. */
export function templateToTaskDraft(template) {
    const t = mapTemplate(template);
    return {
        title: t.title || t.name || '',
        description: t.description || '',
        priority: t.priority || 'medium',
        tags: t.tags,
        subtaskTitles: t.subtaskTitles.filter((s) => String(s || '').trim()),
        templateName: t.name,
    };
}

function useCollection(path, key, mapper, workspaceId, onError) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(null);
    const wsRef = useRef(workspaceId);
    wsRef.current = workspaceId;
    const errRef = useRef(onError);
    errRef.current = onError;
    const fail = (err, fallback) => { if (errRef.current) errRef.current(taskErrorMessage(err, fallback)); };

    const load = useCallback(async () => {
        const ws = wsRef.current;
        if (!ws) { setItems([]); return []; }
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(path, { params: { workspaceId: ws } });
            if (wsRef.current !== ws) return [];
            const list = (res.data?.[key] || []).map(mapper).filter(Boolean);
            setItems(list);
            setLoaded(true);
            return list;
        } catch (err) {
            // Loading quietly fails (no toast on every page open); screens show `error`.
            if (wsRef.current === ws) setError(taskErrorMessage(err, `Could not load ${key}`));
            return [];
        } finally {
            if (wsRef.current === ws) setLoading(false);
        }
    }, [path, key, mapper]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { setItems([]); setLoaded(false); setError(null); }, [workspaceId]);

    const singular = key.replace(/s$/, '');
    const create = useCallback(async (data) => {
        try {
            const res = await api.post(path, { ...data, workspaceId: wsRef.current });
            const saved = mapper(res.data?.[singular]);
            if (saved) setItems((p) => [saved, ...p.filter((x) => x.id !== saved.id)]);
            return saved;
        } catch (err) { fail(err, `Could not create the ${singular}`); return null; }
    }, [path, singular, mapper]); // eslint-disable-line react-hooks/exhaustive-deps

    const update = useCallback(async (id, data) => {
        try {
            const res = await api.put(`${path}/${id}`, data);
            const saved = mapper(res.data?.[singular]);
            if (saved) setItems((p) => p.map((x) => (x.id === saved.id ? { ...x, ...saved } : x)));
            return saved;
        } catch (err) { fail(err, `Could not save the ${singular}`); return null; }
    }, [path, singular, mapper]); // eslint-disable-line react-hooks/exhaustive-deps

    const remove = useCallback(async (id) => {
        try {
            await api.delete(`${path}/${id}`);
            setItems((p) => p.filter((x) => x.id !== id));
            return true;
        } catch (err) { fail(err, `Could not delete the ${singular}`); return false; }
    }, [path, singular]); // eslint-disable-line react-hooks/exhaustive-deps

    return { items, loading, loaded, error, load, create, update, remove };
}

export function useTaskTemplates(workspaceId, onError) {
    const c = useCollection('/api/task-templates', 'templates', mapTemplate, workspaceId, onError);
    return { templates: c.items, loading: c.loading, loaded: c.loaded, error: c.error, load: c.load, createTemplate: c.create, updateTemplate: c.update, deleteTemplate: c.remove };
}

export function useMilestones(workspaceId, onError, { autoLoad = true } = {}) {
    const c = useCollection('/api/milestones', 'milestones', mapMilestone, workspaceId, onError);
    const { load } = c;
    useEffect(() => { if (autoLoad && workspaceId) load(); }, [autoLoad, workspaceId, load]);
    const sorted = [...c.items].sort((a, b) => new Date(a.dueDate || '2999-01-01') - new Date(b.dueDate || '2999-01-01'));
    return { milestones: sorted, loading: c.loading, loaded: c.loaded, error: c.error, load, createMilestone: c.create, updateMilestone: c.update, deleteMilestone: c.remove };
}
