import React, { useMemo, useState } from 'react';
import { Flag, Plus, Pencil, Trash2, ChevronDown, ChevronRight, X, Calendar } from 'lucide-react';
import { Dialog, Confirm, Btn, IconBtn, Field, EmptyState, LoadingState, ErrorState, Meter, Chip } from '../ui/page';
import { useToast } from '../../contexts/ToastContext';
import { toDateInput } from '../../utils/taskMeta';
import { StatusBadge, fmtDate, FONT } from './taskUi';
import { MILESTONE_STATUSES, milestoneStatusMeta, milestoneProgress } from './useTaskPlanning';

const TONE = { completed: 'success', at_risk: 'danger', in_progress: 'accent' };
const EMPTY_FORM = { name: '', description: '', startDate: '', dueDate: '', status: 'not_started' };
const idOf = (v) => (v && typeof v === 'object' ? String(v._id || v.id || '') : v ? String(v) : '');

/** Milestone form values -> POST/PUT /api/milestones body. */
export function milestoneFormToBody(form) {
    const date = (v) => (v ? `${v}T00:00:00.000Z` : null);
    return {
        name: form.name.trim(),
        description: form.description || '',
        startDate: date(form.startDate),
        dueDate: date(form.dueDate),
        status: MILESTONE_STATUSES.some((s) => s.id === form.status) ? form.status : 'not_started',
    };
}

export function MilestoneFormDialog({ open, initial, busy, onClose, onSubmit }) {
    // Mount with a `key` per milestone so the form starts from that milestone.
    const [form, setForm] = useState(() => (initial ? {
        name: initial.name || '', description: initial.description || '', status: initial.status || 'not_started',
        startDate: toDateInput(initial.startDate), dueDate: toDateInput(initial.dueDate),
    } : EMPTY_FORM));
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
    const badRange = form.startDate && form.dueDate && form.startDate > form.dueDate;
    const valid = form.name.trim() && !badRange;
    const submit = () => { if (valid) onSubmit(milestoneFormToBody(form)); };

    return (
        <Dialog open={open} title={initial ? 'Edit milestone' : 'New milestone'} lead="A milestone groups tasks toward one goal and shows how far along they are."
            onClose={onClose} busy={busy}
            footer={(
                <>
                    <Btn variant="ghost" onClick={onClose} disabled={busy}>Cancel</Btn>
                    <Btn variant="primary" loading={busy} disabled={!valid} onClick={submit}>{initial ? 'Save milestone' : 'Create milestone'}</Btn>
                </>
            )}>
            <form onSubmit={(e) => { e.preventDefault(); submit(); }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Field label="Name" htmlFor="ms-name">
                    <input id="ms-name" className="gl-input" value={form.name} maxLength={120} onChange={set('name')} placeholder="e.g. Beta launch" required />
                </Field>
                <Field label="Description" htmlFor="ms-desc">
                    <textarea id="ms-desc" className="gl-input" rows={3} value={form.description} onChange={set('description')} style={{ resize: 'vertical', minHeight: 60 }} />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                    <Field label="Start date" htmlFor="ms-start">
                        <input id="ms-start" type="date" className="gl-input" value={form.startDate} max="2100-12-31" onChange={set('startDate')} />
                    </Field>
                    <Field label="Due date" htmlFor="ms-due" error={badRange ? 'Due date is before the start date' : null}>
                        <input id="ms-due" type="date" className="gl-input" value={form.dueDate} max="2100-12-31" onChange={set('dueDate')} />
                    </Field>
                    <Field label="Status" htmlFor="ms-status">
                        <select id="ms-status" className="gl-input" value={form.status} onChange={set('status')}>
                            {MILESTONE_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                    </Field>
                </div>
            </form>
        </Dialog>
    );
}

function MilestoneCard({ milestone, tasks, candidates, onOpenTask, onLink, canLink, onEdit, onDelete }) {
    const [open, setOpen] = useState(false);
    const [pick, setPick] = useState('');
    const [busy, setBusy] = useState(false);
    const progress = milestoneProgress(milestone, tasks);
    const meta = milestoneStatusMeta(milestone.status);
    const overdue = milestone.dueDate && milestone.status !== 'completed' && toDateInput(milestone.dueDate) < toDateInput(new Date());
    const link = async (taskId, milestoneId) => {
        setBusy(true);
        try { await onLink(taskId, milestoneId); setPick(''); } finally { setBusy(false); }
    };

    return (
        <li className="gl-card" data-testid="milestone-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px' }}>
                <button type="button" className="gl-icon-btn" aria-expanded={open} aria-label={open ? 'Hide tasks' : 'Show tasks'} onClick={() => setOpen((v) => !v)}>
                    {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Flag size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{milestone.name}</span>
                        <Chip tone={TONE[milestone.status]}>{meta.label}</Chip>
                        {overdue && <Chip tone="danger">Overdue</Chip>}
                    </div>
                    {milestone.description && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{milestone.description}</p>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                        <div style={{ flex: 1 }}><Meter value={progress.pct} tone={progress.pct === 100 ? 'success' : undefined} label={`${milestone.name} progress`} /></div>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                            {progress.total ? `${progress.done}/${progress.total} done · ${progress.pct}%` : 'No tasks yet'}
                        </span>
                    </div>
                    {(milestone.startDate || milestone.dueDate) && (
                        <p style={{ margin: '6px 0 0', fontSize: 11, color: overdue ? 'var(--state-danger)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Calendar size={11} />
                            {milestone.startDate ? fmtDate(milestone.startDate) : ''}{milestone.startDate && milestone.dueDate ? ' → ' : ''}{milestone.dueDate ? `due ${fmtDate(milestone.dueDate)}` : ''}
                        </p>
                    )}
                </div>
                <IconBtn label={`Edit ${milestone.name}`} onClick={() => onEdit(milestone)}><Pencil size={14} /></IconBtn>
                <IconBtn label={`Delete ${milestone.name}`} onClick={() => onDelete(milestone)}><Trash2 size={14} /></IconBtn>
            </div>
            {open && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '8px 14px 12px', background: 'var(--bg-base)' }}>
                    {progress.tasks.length === 0 ? (
                        <p style={{ margin: '4px 0 8px', fontSize: 12, color: 'var(--text-secondary)' }}>No tasks linked yet. Add one below or pick this milestone in a task’s details.</p>
                    ) : (
                        <ul style={{ listStyle: 'none', margin: '0 0 8px', padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {progress.tasks.map((t) => (
                                <li key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 32 }}>
                                    <button type="button" onClick={() => onOpenTask?.(t)} className="gl-item" style={{ flex: 1, minWidth: 0, minHeight: 30 }}>
                                        {t.issueKey && <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-secondary)' }}>{t.issueKey}</span>}
                                        <span className="gl-x-item-title" style={{ textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</span>
                                        <StatusBadge status={t.status} compact />
                                    </button>
                                    {canLink(t) && <IconBtn label={`Remove ${t.title} from milestone`} disabled={busy} onClick={() => link(t.id, null)}><X size={13} /></IconBtn>}
                                </li>
                            ))}
                        </ul>
                    )}
                    {candidates.length > 0 && (
                        <div style={{ display: 'flex', gap: 6 }}>
                            <select className="gl-input" aria-label={`Add a task to ${milestone.name}`} value={pick} onChange={(e) => setPick(e.target.value)} style={{ flex: 1, minWidth: 0 }}>
                                <option value="">Add a task…</option>
                                {candidates.map((t) => <option key={t.id} value={t.id}>{t.issueKey ? `${t.issueKey} · ` : ''}{t.title}</option>)}
                            </select>
                            <Btn size="sm" loading={busy} disabled={!pick} onClick={() => link(pick, milestone.id)}>Add</Btn>
                        </div>
                    )}
                </div>
            )}
        </li>
    );
}

/**
 * Milestones view of the Tasks page: create/edit/delete milestones, progress
 * from linked tasks, and link/unlink tasks. `planning` is useMilestones().
 * `onLink(taskId, milestoneId|null)` saves the task's milestone.
 */
export default function MilestonesView({ planning, tasks = [], onOpenTask, onLink, canLink = () => true }) {
    const { showToast } = useToast();
    const { milestones, loading, loaded, error, load, createMilestone, updateMilestone, deleteMilestone } = planning;
    const [editing, setEditing] = useState(null); // null | 'new' | milestone
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [busy, setBusy] = useState(false);

    const linkable = useMemo(() => tasks.filter((t) => !t.deleted && !t.isSubtask && t.status !== 'cancelled' && canLink(t)), [tasks, canLink]);

    const submit = async (body) => {
        setBusy(true);
        try {
            const saved = editing === 'new' ? await createMilestone(body) : await updateMilestone(editing.id, body);
            if (saved) { showToast(editing === 'new' ? 'Milestone created' : 'Milestone saved', 'success'); setEditing(null); }
        } finally { setBusy(false); }
    };
    const remove = async () => {
        setBusy(true);
        try {
            if (await deleteMilestone(confirmDelete.id)) showToast('Milestone deleted', 'success');
            setConfirmDelete(null);
        } finally { setBusy(false); }
    };

    return (
        <div data-testid="milestones-view" style={{ height: '100%', overflowY: 'auto', padding: '16px 20px', boxSizing: 'border-box', fontFamily: FONT }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <p style={{ flex: 1, margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>Group tasks toward a goal and watch them get done.</p>
                {milestones.length > 0 && <Btn icon={Plus} onClick={() => setEditing('new')}>New milestone</Btn>}
            </div>
            {loading && !loaded ? (
                <LoadingState label="Loading milestones…" />
            ) : error && !loaded ? (
                <ErrorState title="Could not load milestones" message={error} onRetry={load} />
            ) : milestones.length === 0 ? (
                <EmptyState icon={Flag} title="No milestones yet"
                    text="Create a milestone for a launch or a deadline, link tasks to it and follow its progress here."
                    action={<Btn variant="primary" icon={Plus} onClick={() => setEditing('new')}>Create milestone</Btn>} />
            ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {milestones.map((m) => (
                        <MilestoneCard key={m.id} milestone={m} tasks={tasks}
                            candidates={linkable.filter((t) => idOf(t.milestoneId) !== m.id)}
                            onOpenTask={onOpenTask} onLink={onLink} canLink={canLink}
                            onEdit={setEditing} onDelete={setConfirmDelete} />
                    ))}
                </ul>
            )}
            <MilestoneFormDialog key={editing === 'new' ? 'new' : editing?.id || 'closed'} open={!!editing} initial={editing === 'new' ? null : editing} busy={busy} onClose={() => setEditing(null)} onSubmit={submit} />
            <Confirm open={!!confirmDelete} title="Delete milestone?" tone="danger" confirmLabel="Delete" busy={busy}
                onConfirm={remove} onClose={() => setConfirmDelete(null)}>
                “{confirmDelete?.name}” will be removed. Its tasks stay; they are just no longer grouped under it.
            </Confirm>
        </div>
    );
}

/**
 * Compact progress of the milestones that have tasks in a list (channel
 * Tasks tab). Renders nothing when no task is linked to a milestone.
 */
export function MilestoneProgressStrip({ milestones = [], tasks = [] }) {
    const rows = milestones
        .map((m) => ({ m, p: milestoneProgress(m, tasks) }))
        .filter((r) => r.p.tasks.length > 0);
    if (!rows.length) return null;
    return (
        <div data-testid="milestone-strip" aria-label="Milestones" style={{ display: 'flex', gap: 8, padding: '8px 16px', overflowX: 'auto', borderBottom: '1px solid var(--border-default)', background: 'var(--bg-surface)', flexShrink: 0, fontFamily: FONT }}>
            {rows.map(({ m, p }) => (
                <div key={m.id} title={`${m.name}: ${p.done}/${p.total} done`} style={{ flex: '0 0 auto', minWidth: 160, maxWidth: 240, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <Flag size={10} style={{ color: 'var(--accent)', flexShrink: 0 }} /> {m.name}
                        <span style={{ marginLeft: 'auto', fontWeight: 400, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{p.done}/{p.total}</span>
                    </span>
                    <Meter value={p.pct} tone={p.pct === 100 ? 'success' : undefined} label={`${m.name} progress`} />
                </div>
            ))}
        </div>
    );
}
