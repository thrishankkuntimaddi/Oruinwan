import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Link2, X, Loader2, Search, ExternalLink } from 'lucide-react';
import api from '../../../services/api';
import { useTasks } from '../../../contexts/TasksContext';
import { useToast } from '../../../contexts/ToastContext';
import { TRANSITIONS, statusLabel, mapTask } from '../../../utils/taskMeta';
import { huddleApi, errorText } from './huddleApi';

const KEY_RE = /\b[A-Z][A-Z0-9]{1,9}-\d{1,6}\b/g;
const idOf = (v) => String(v?._id || v?.id || v || '');

/** Channel members (for assignees), or the people in the call when there is no channel. */
function useAssignees(channelId, people, me) {
    const [members, setMembers] = useState([]);
    useEffect(() => {
        let cancelled = false;
        if (!channelId) { setMembers([]); return undefined; }
        api.get(`/api/channels/${channelId}/members`, { params: { limit: 200 } })
            .then((res) => {
                if (cancelled) return;
                setMembers((res.data.members || []).map((m) => ({ id: idOf(m), username: m.username || 'Unknown' })));
            })
            .catch(() => { if (!cancelled) setMembers([]); });
        return () => { cancelled = true; };
    }, [channelId]);
    return useMemo(() => {
        const list = [...members];
        for (const p of [...people, me].filter(Boolean)) {
            if (p.id && !list.some((m) => m.id === p.id)) list.push({ id: p.id, username: p.username || 'Someone' });
        }
        return list;
    }, [members, people, me]);
}

/**
 * Tasks for the huddle: the channel's tasks, tasks linked to this huddle and
 * tasks mentioned in the notes (by key, e.g. ENG-12). Status and assignee change
 * inline (status follows the workflow in taskMeta); action items become tasks.
 */
export default function TasksTab({ huddleId, live, channelId, workspaceId, me, people, notes, session, onSessionChange, onTaskChanged, createFrom, onCreateHandled, startedAt }) {
    const { tasks, updateTask } = useTasks() || { tasks: [] };
    const { showToast } = useToast();
    const assignees = useAssignees(channelId, people, me);
    const [created, setCreated] = useState([]); // created here (shown even before the task list catches up)
    const [form, setForm] = useState(null);     // { title, assigneeId, actionId }
    const [busy, setBusy] = useState(false);
    const [linking, setLinking] = useState(false);
    const [query, setQuery] = useState('');

    // "Create task" pressed on an action item in the Notes tab.
    useEffect(() => {
        if (!createFrom) return;
        setForm({ title: createFrom.text || '', assigneeId: createFrom.assigneeId || me?.id || '', actionId: createFrom.id });
        onCreateHandled?.();
    }, [createFrom, me, onCreateHandled]);

    const linkedIds = useMemo(() => new Set(session?.linkedTaskIds || []), [session]);
    const mentionedKeys = useMemo(() => {
        const text = [...notes.paragraphs.map((p) => p.text), ...notes.actions.map((a) => a.text)].join('\n');
        return new Set(text.match(KEY_RE) || []);
    }, [notes.paragraphs, notes.actions]);
    const fromActions = useMemo(() => new Set(notes.actions.map((a) => a.taskId).filter(Boolean)), [notes.actions]);

    const all = useMemo(() => {
        const byId = new Map();
        for (const t of created) byId.set(t.id, t);
        for (const t of tasks || []) byId.set(t.id, t); // the live list wins once it has the task
        return [...byId.values()].filter((t) => !t.deleted && !t.isSubtask);
    }, [tasks, created]);

    const shown = useMemo(() => all
        .map((t) => {
            const why = linkedIds.has(t.id) ? 'linked'
                : created.some((c) => c.id === t.id) || fromActions.has(t.id) ? 'from this huddle'
                    : t.issueKey && mentionedKeys.has(t.issueKey) ? 'mentioned'
                        : channelId && t.channelId === channelId ? 'channel' : null;
            return why ? { ...t, why } : null;
        })
        .filter(Boolean)
        .sort((a, b) => {
            const rank = { 'from this huddle': 0, linked: 1, mentioned: 2, channel: 3 };
            return (rank[a.why] - rank[b.why]) || (a.status === 'done') - (b.status === 'done') || String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
        }), [all, linkedIds, created, fromActions, mentionedKeys, channelId]);

    const linkCandidates = useMemo(() => {
        const q = query.trim().toLowerCase();
        const shownIds = new Set(shown.map((t) => t.id));
        return all
            .filter((t) => !shownIds.has(t.id))
            .filter((t) => !q || t.title.toLowerCase().includes(q) || String(t.issueKey || '').toLowerCase().includes(q))
            .slice(0, 12);
    }, [all, shown, query]);

    const changeStatus = async (t, status) => {
        if (status === t.status) return;
        const saved = await updateTask(t.id, { status });
        if (saved) {
            setCreated((prev) => prev.map((c) => (c.id === t.id ? { ...c, status } : c)));
            onTaskChanged?.({ id: t.id, title: t.title, key: t.issueKey, change: `${statusLabel(t.status)} → ${statusLabel(status)}`, status });
        }
    };

    const changeAssignee = async (t, assigneeId) => {
        const saved = await updateTask(t.id, { assignedTo: assigneeId ? [assigneeId] : [] }, { successMessage: 'Assignee updated' });
        if (saved) {
            const who = assignees.find((a) => a.id === assigneeId)?.username || 'nobody';
            onTaskChanged?.({ id: t.id, title: t.title, key: t.issueKey, change: `assigned to ${who}`, status: t.status });
        }
    };

    const createTask = async (e) => {
        e.preventDefault();
        if (!form?.title.trim() || busy) return;
        setBusy(true);
        try {
            const assigneeIds = form.assigneeId ? [form.assigneeId] : (me?.id ? [me.id] : []);
            const payload = channelId
                ? { assignmentType: 'channel', channelId, assignedToIds: assigneeIds, visibility: 'channel' }
                : { assignmentType: 'individual', assignedToIds: assigneeIds, taskMode: 'shared' };
            const res = await api.post('/api/v2/tasks', {
                title: form.title.trim(),
                description: 'Created from a huddle action item.',
                workspaceId,
                status: 'todo',
                priority: 'medium',
                tags: ['huddle'],
                ...payload,
            });
            const made = (res.data.tasks || (res.data.task ? [res.data.task] : [])).map(mapTask).filter(Boolean);
            const task = made[0];
            if (task) {
                setCreated((prev) => [...prev, ...made]);
                onTaskChanged?.({ id: task.id, title: task.title, key: task.issueKey, change: 'created', status: task.status, created: true });
                if (form.actionId && live) {
                    const action = notes.actions.find((a) => a.id === form.actionId);
                    if (action) notes.upsertAction({ ...action, taskId: task.id, assigneeId: assigneeIds[0] || null }).catch(() => {});
                }
                showToast(`Task created${task.issueKey ? `: ${task.issueKey}` : ''}`, 'success');
            }
            setForm(null);
        } catch (err) {
            showToast(errorText(err, 'Could not create the task.'), 'error');
        } finally {
            setBusy(false);
        }
    };

    const link = async (t) => {
        try {
            const ids = await huddleApi.linkTask(huddleId, t.id);
            onSessionChange?.({ linkedTaskIds: ids });
            setQuery('');
            setLinking(false);
        } catch (err) {
            showToast(errorText(err, 'Could not link the task.'), 'error');
        }
    };
    const unlink = async (t) => {
        try {
            const ids = await huddleApi.unlinkTask(huddleId, t.id);
            onSessionChange?.({ linkedTaskIds: ids });
        } catch (err) {
            showToast(errorText(err, 'Could not unlink the task.'), 'error');
        }
    };

    const openActions = notes.actions.filter((a) => !a.taskId && (a.text || '').trim());

    return (
        <div data-testid="huddle-tasks">
            <div className="hw-row" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
                <button type="button" className="gl-btn gl-btn--sm gl-btn--primary" onClick={() => setForm({ title: '', assigneeId: me?.id || '', actionId: null })}>
                    <Plus size={12} /> New task
                </button>
                <button type="button" className="gl-btn gl-btn--sm" aria-expanded={linking} onClick={() => setLinking((v) => !v)}>
                    <Link2 size={12} /> Link a task
                </button>
                {workspaceId && (
                    <a className="gl-btn gl-btn--sm gl-btn--ghost" href={`/workspace/${workspaceId}/tasks`} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto' }}>
                        <ExternalLink size={12} /> Tasks
                    </a>
                )}
            </div>

            {form && (
                <form className="hw-form" onSubmit={createTask} data-testid="huddle-task-form">
                    <input className="gl-input" autoFocus value={form.title} aria-label="Task title" placeholder="Task title"
                        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                    <div className="hw-row">
                        <label className="hw-muted" htmlFor="hw-assignee">Assignee</label>
                        <select id="hw-assignee" className="hw-select hw-grow" value={form.assigneeId}
                            onChange={(e) => setForm((f) => ({ ...f, assigneeId: e.target.value }))}>
                            {assignees.map((a) => <option key={a.id} value={a.id}>{a.id === me?.id ? `${a.username} (you)` : a.username}</option>)}
                        </select>
                    </div>
                    <div className="hw-row" style={{ justifyContent: 'flex-end' }}>
                        <button type="button" className="gl-btn gl-btn--sm gl-btn--ghost" onClick={() => setForm(null)}>Cancel</button>
                        <button type="submit" className="gl-btn gl-btn--sm gl-btn--primary" disabled={!form.title.trim() || busy}>
                            {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Create task
                        </button>
                    </div>
                    {channelId && <p className="hw-muted" style={{ margin: 0 }}>Linked to this channel; channel members can see it.</p>}
                </form>
            )}

            {linking && (
                <div style={{ marginBottom: 12 }}>
                    <div className="gl-search">
                        <Search size={13} />
                        <input className="gl-input" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks by title or key" aria-label="Search tasks to link" />
                    </div>
                    <div className="hw-results">
                        {linkCandidates.length === 0
                            ? <p className="hw-muted" style={{ padding: '8px 10px', margin: 0 }}>No other tasks match.</p>
                            : linkCandidates.map((t) => (
                                <button key={t.id} type="button" className="hw-result" onClick={() => link(t)}>
                                    {t.issueKey && <span className="hw-task-key">{t.issueKey}</span>}
                                    <span className="hw-grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                                    <span className="hw-badge">{statusLabel(t.status)}</span>
                                </button>
                            ))}
                    </div>
                </div>
            )}

            {openActions.length > 0 && (
                <>
                    <div className="hw-section"><span>Action items without a task</span><span className="gl-count">{openActions.length}</span></div>
                    {openActions.map((a) => (
                        <div key={a.id} className="hw-action">
                            <span className="hw-action-text">{a.text}</span>
                            <button type="button" className="gl-btn gl-btn--sm" onClick={() => setForm({ title: a.text, assigneeId: a.assigneeId || me?.id || '', actionId: a.id })}>
                                <Plus size={12} /> Task
                            </button>
                        </div>
                    ))}
                </>
            )}

            <div className="hw-section"><span>{channelId ? 'Channel and huddle tasks' : 'Huddle tasks'}</span><span className="gl-count">{shown.length}</span></div>
            {shown.length === 0 && <p className="hw-muted">No tasks yet. Create one from an action item, or link an existing task.</p>}
            {shown.map((t) => {
                const options = [t.status, ...(TRANSITIONS[t.status] || [])];
                const assignee = t.assigneeIds?.[0] || '';
                const touched = startedAt && t.updatedAt && new Date(t.updatedAt) >= new Date(startedAt);
                return (
                    <div key={t.id} className="hw-task" data-testid="huddle-task">
                        <p className="hw-task-title">
                            {t.issueKey && <span className="hw-task-key">{t.issueKey}</span>}
                            {t.title}
                        </p>
                        <div className="hw-row" style={{ flexWrap: 'wrap' }}>
                            <select className="hw-select" value={t.status} aria-label={`Status of ${t.title}`} onChange={(e) => changeStatus(t, e.target.value)}>
                                {options.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                            </select>
                            <select className="hw-select" value={assignee} aria-label={`Assignee of ${t.title}`} onChange={(e) => changeAssignee(t, e.target.value)} style={{ maxWidth: 140 }}>
                                {!assignee && <option value="">Unassigned</option>}
                                {assignee && !assignees.some((a) => a.id === assignee) && <option value={assignee}>{t.assignees?.[0]?.username || 'Assigned'}</option>}
                                {assignees.map((a) => <option key={a.id} value={a.id}>{a.username}</option>)}
                            </select>
                            <span className="hw-badge" title="Why this task is here">{t.why}</span>
                            {touched && <span className="hw-badge hw-badge--accent">updated</span>}
                            {t.why === 'linked' && (
                                <button type="button" className="gl-icon-btn" style={{ marginLeft: 'auto' }} title="Unlink from this huddle" aria-label="Unlink from this huddle" onClick={() => unlink(t)}>
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
