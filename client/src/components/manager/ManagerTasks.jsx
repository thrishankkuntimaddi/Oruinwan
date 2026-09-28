import React, { useState } from 'react';
import { Plus, CircleDot, Clock, CheckCircle2, RefreshCw, CalendarDays, AlertTriangle } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';
import {
    DashPage, PageHead, Btn, Chip, Avatar, Dialog, Field, SelectBox, KpiGrid, Kpi,
    ErrorState, EmptyState, LoadingState, useAsync, errorMessage,
} from '../company-dash/dashUi';
import { useDepartment, DepartmentGate } from './managerScope';

const PRIORITIES = ['lowest', 'low', 'medium', 'high', 'highest'];
const PRIORITY_TONE = { highest: 'danger', high: 'warning', medium: 'accent', low: undefined, lowest: undefined };
const COLUMNS = [
    { key: 'open', title: 'To do', icon: CircleDot, next: { status: 'in_progress', label: 'Start' } },
    { key: 'inProgress', title: 'In progress', icon: Clock, next: { status: 'done', label: 'Complete' } },
    { key: 'completed', title: 'Done', icon: CheckCircle2, next: { status: 'todo', label: 'Reopen' } },
];
const EMPTY_FORM = { title: '', description: '', priority: 'medium', dueDate: '', assignedTo: '' };

const isOverdue = (t) => t.dueDate && new Date(t.dueDate) < new Date() && !['done', 'cancelled'].includes(t.status);

/** Department task board: create tasks for the team and move them along. */
export default function ManagerTasks() {
    const scope = useDepartment();
    const { departmentId, department } = scope;
    const { showToast } = useToast();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [formError, setFormError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [moving, setMoving] = useState(null);

    const tasks = useAsync(
        () => api.get(`/api/manager/tasks/${departmentId}`).then((r) => r.data),
        [departmentId],
        { enabled: !!departmentId },
    );
    // Assignee choices: active members of the department.
    const team = useAsync(
        () => api.get(`/api/manager/dashboard/team-load/${departmentId}`).then((r) => r.data?.teamMembers || []),
        [departmentId],
        { enabled: !!departmentId },
    );

    const groups = tasks.data?.tasks;
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const create = async (e) => {
        e?.preventDefault();
        if (!form.title.trim()) { setFormError('Give the task a title'); return; }
        setSaving(true);
        setFormError(null);
        try {
            await api.post(`/api/manager/tasks/${departmentId}`, {
                title: form.title.trim(),
                description: form.description,
                priority: form.priority,
                dueDate: form.dueDate || null,
                assignedTo: form.assignedTo ? [form.assignedTo] : [],
            });
            showToast('Task created', 'success');
            setOpen(false);
            setForm(EMPTY_FORM);
            tasks.reload();
        } catch (err) {
            setFormError(errorMessage(err, 'Could not create the task'));
        } finally {
            setSaving(false);
        }
    };

    const move = async (task, status) => {
        setMoving(task._id);
        try {
            await api.patch(`/api/manager/tasks/${task._id}/status`, { status });
            await tasks.reload();
        } catch (err) {
            showToast(errorMessage(err, 'Could not update the task'), 'error');
        } finally {
            setMoving(null);
        }
    };

    return (
        <DashPage
            wide
            head={(
                <PageHead
                    eyebrow="Manager console"
                    title="Tasks"
                    lead={`Tasks created by or assigned to${department?.name ? ` ${department.name}` : ' your department'}.`}
                    actions={departmentId && (
                        <>
                            <Btn icon={RefreshCw} loading={tasks.loading} onClick={tasks.reload}>Refresh</Btn>
                            <Btn variant="primary" icon={Plus} onClick={() => { setForm(EMPTY_FORM); setFormError(null); setOpen(true); }}>New task</Btn>
                        </>
                    )}
                />
            )}
        >
            <DepartmentGate scope={scope}>
                {tasks.error && !groups ? (
                    <ErrorState message={tasks.error} onRetry={tasks.reload} />
                ) : !groups ? (
                    <LoadingState label="Loading tasks…" />
                ) : (
                    <>
                        <KpiGrid>
                            <Kpi label="To do" value={groups.open.length} icon={CircleDot} />
                            <Kpi label="In progress" value={groups.inProgress.length} icon={Clock} />
                            <Kpi label="Done" value={groups.completed.length} icon={CheckCircle2} tone="success" />
                            <Kpi label="Overdue" value={groups.overdue.length} icon={AlertTriangle} tone={groups.overdue.length ? 'danger' : 'muted'} />
                        </KpiGrid>
                        {tasks.data.total === 0 ? (
                            <EmptyState
                                icon={CheckCircle2}
                                title="No tasks yet"
                                text="Create a task and assign it to someone on your team."
                                action={<Btn variant="primary" icon={Plus} onClick={() => setOpen(true)}>New task</Btn>}
                            />
                        ) : (
                            <div className="mg-board">
                                {COLUMNS.map((col) => {
                                    const items = groups[col.key] || [];
                                    return (
                                        <section key={col.key} className="gl-card mg-col" aria-label={col.title}>
                                            <div className="mg-col-head">
                                                <col.icon size={14} /> {col.title}
                                                <span className="gl-count" style={{ marginLeft: 'auto' }}>{items.length}</span>
                                            </div>
                                            <div className="mg-col-body">
                                                {items.length === 0 && <p className="cd-muted" style={{ margin: 0, fontSize: 12, textAlign: 'center', padding: '12px 0' }}>Nothing here</p>}
                                                {items.map((t) => (
                                                    <article key={t._id} className="mg-task">
                                                        <div className="mg-task-meta">
                                                            <Chip tone={PRIORITY_TONE[t.priority]}>{t.priority || 'medium'}</Chip>
                                                            {t.status === 'review' && <Chip>review</Chip>}
                                                            {t.status === 'blocked' && <Chip tone="danger">blocked</Chip>}
                                                            {isOverdue(t) && <Chip tone="danger">overdue</Chip>}
                                                        </div>
                                                        <h4 className="mg-task-title">{t.title}</h4>
                                                        {t.description && <p className="mg-task-desc">{t.description}</p>}
                                                        {t.dueDate && (
                                                            <div className="mg-task-meta"><CalendarDays size={12} /> Due {new Date(t.dueDate).toLocaleDateString()}</div>
                                                        )}
                                                        <div className="mg-task-foot">
                                                            <span className="cd-cell-user" style={{ fontSize: 12 }}>
                                                                {(t.assignedTo || []).length ? (
                                                                    <>
                                                                        <Avatar user={t.assignedTo[0]} size="sm" />
                                                                        <span className="cd-cell-sub" style={{ color: 'var(--text-primary)' }}>
                                                                            {t.assignedTo[0].username}{t.assignedTo.length > 1 ? ` +${t.assignedTo.length - 1}` : ''}
                                                                        </span>
                                                                    </>
                                                                ) : <span className="cd-muted">Unassigned</span>}
                                                            </span>
                                                            <Btn size="sm" variant={col.key === 'completed' ? 'ghost' : undefined} loading={moving === t._id} onClick={() => move(t, col.next.status)}>
                                                                {col.next.label}
                                                            </Btn>
                                                        </div>
                                                    </article>
                                                ))}
                                            </div>
                                        </section>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </DepartmentGate>

            <Dialog
                open={open}
                title="New task"
                lead={department?.name ? `For ${department.name}` : undefined}
                onClose={() => setOpen(false)}
                busy={saving}
                footer={(
                    <>
                        <Btn variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Btn>
                        <Btn variant="primary" loading={saving} onClick={create}>Create task</Btn>
                    </>
                )}
            >
                <form onSubmit={create} style={{ display: 'contents' }}>
                    <Field label="Title" htmlFor="mg-task-title" error={formError}>
                        <input id="mg-task-title" className="gl-input" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="What needs to be done?" maxLength={200} />
                    </Field>
                    <Field label="Description" htmlFor="mg-task-desc">
                        <textarea id="mg-task-desc" className="gl-input" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Optional details" />
                    </Field>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                        <Field label="Priority">
                            <SelectBox value={form.priority} onChange={(v) => set('priority', v)} label="Priority">
                                {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                            </SelectBox>
                        </Field>
                        <Field label="Due date" htmlFor="mg-task-due">
                            <input id="mg-task-due" type="date" className="gl-input" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
                        </Field>
                    </div>
                    <Field label="Assignee" hint={team.error ? 'Could not load the team list' : undefined}>
                        <SelectBox value={form.assignedTo} onChange={(v) => set('assignedTo', v)} label="Assignee">
                            <option value="">Unassigned</option>
                            {(team.data || []).map((m) => <option key={m._id} value={m._id}>{m.username}</option>)}
                        </SelectBox>
                    </Field>
                    <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
                </form>
            </Dialog>
        </DashPage>
    );
}
