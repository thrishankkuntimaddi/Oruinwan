import React, { useEffect, useState } from 'react';
import { LayoutTemplate, Plus, Pencil, Trash2, ListChecks, ArrowRight } from 'lucide-react';
import { Dialog, Confirm, Btn, IconBtn, Field, EmptyState, LoadingState, ErrorState, Chip } from '../ui/page';
import { useToast } from '../../contexts/ToastContext';
import { PRIORITIES, priorityLabel } from '../../utils/taskMeta';
import { PriorityIcon } from './taskUi';
import { useTaskTemplates } from './useTaskPlanning';

const EMPTY_FORM = { name: '', title: '', description: '', priority: 'medium', tags: '', subtasks: '' };

const toForm = (t) => (t ? {
    name: t.name || '', title: t.title || '', description: t.description || '', priority: t.priority || 'medium',
    tags: (t.tags || []).join(', '), subtasks: (t.subtaskTitles || []).join('\n'),
} : EMPTY_FORM);

/** Form values -> POST/PUT /api/task-templates body. */
export function templateFormToBody(form) {
    return {
        name: form.name.trim(),
        title: form.title.trim(),
        description: form.description,
        priority: PRIORITIES.includes(form.priority) ? form.priority : 'medium',
        tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
        subtaskTitles: form.subtasks.split('\n').map((s) => s.trim()).filter(Boolean),
    };
}

function TemplateForm({ initial, busy, onCancel, onSubmit }) {
    const [form, setForm] = useState(() => toForm(initial));
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
    const valid = form.name.trim().length > 0;
    return (
        <form onSubmit={(e) => { e.preventDefault(); if (valid) onSubmit(templateFormToBody(form)); }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Template name" htmlFor="tt-name" hint="What people pick from the list, e.g. “Bug report” or “Weekly review”.">
                <input id="tt-name" className="gl-input" value={form.name} maxLength={120} onChange={set('name')} required />
            </Field>
            <Field label="Task title" htmlFor="tt-title" hint="Optional. Filled in as the new task's title.">
                <input id="tt-title" className="gl-input" value={form.title} maxLength={200} onChange={set('title')} />
            </Field>
            <Field label="Description" htmlFor="tt-desc">
                <textarea id="tt-desc" className="gl-input" rows={3} value={form.description} onChange={set('description')} style={{ resize: 'vertical', minHeight: 64 }} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <Field label="Priority" htmlFor="tt-priority">
                    <select id="tt-priority" className="gl-input" value={form.priority} onChange={set('priority')}>
                        {PRIORITIES.map((p) => <option key={p} value={p}>{priorityLabel(p)}</option>)}
                    </select>
                </Field>
                <Field label="Tags" htmlFor="tt-tags" hint="Comma separated">
                    <input id="tt-tags" className="gl-input" value={form.tags} onChange={set('tags')} />
                </Field>
            </div>
            <Field label="Child issues" htmlFor="tt-subs" hint="One per line. Each becomes a child issue of the new task.">
                <textarea id="tt-subs" className="gl-input" rows={4} value={form.subtasks} onChange={set('subtasks')} style={{ resize: 'vertical', minHeight: 72 }} />
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Btn variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Btn>
                <Btn variant="primary" type="submit" loading={busy} disabled={!valid}>{initial ? 'Save template' : 'Create template'}</Btn>
            </div>
        </form>
    );
}

/**
 * Task templates of the workspace: create, edit, delete — and, when `onUse`
 * is given, pick one to start a new task from.
 */
export default function TaskTemplatesDialog({ open, workspaceId, onClose, onUse }) {
    const { showToast } = useToast();
    const { templates, loading, loaded, error, load, createTemplate, updateTemplate, deleteTemplate } = useTaskTemplates(workspaceId, (m) => showToast(m, 'error'));
    const [editing, setEditing] = useState(null); // null | 'new' | template
    const [busy, setBusy] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(null);

    useEffect(() => { if (open && workspaceId) load(); }, [open, workspaceId, load]);
    useEffect(() => { if (!open) { setEditing(null); setConfirmDelete(null); } }, [open]);

    const submit = async (body) => {
        setBusy(true);
        try {
            const saved = editing === 'new' ? await createTemplate(body) : await updateTemplate(editing.id, body);
            if (saved) { showToast(editing === 'new' ? 'Template created' : 'Template saved', 'success'); setEditing(null); }
        } finally { setBusy(false); }
    };

    const remove = async () => {
        setBusy(true);
        try {
            if (await deleteTemplate(confirmDelete.id)) showToast('Template deleted', 'success');
            setConfirmDelete(null);
        } finally { setBusy(false); }
    };

    const picking = typeof onUse === 'function';
    const title = editing ? (editing === 'new' ? 'New template' : `Edit “${editing.name}”`) : picking ? 'New task from template' : 'Task templates';
    const lead = editing ? 'Templates pre-fill a task and can add child issues for you.'
        : picking ? 'Pick a template to pre-fill a new task.' : 'Reusable starting points for tasks your team creates often.';

    return (
        <>
            <Dialog open={open && !confirmDelete} title={title} lead={lead} onClose={editing ? () => setEditing(null) : onClose} busy={busy} size="lg"
                footer={!editing && (
                    <>
                        <Btn variant="ghost" onClick={onClose}>Close</Btn>
                        <Btn variant={templates.length ? undefined : 'primary'} icon={Plus} onClick={() => setEditing('new')}>New template</Btn>
                    </>
                )}>
                {editing ? (
                    <TemplateForm initial={editing === 'new' ? null : editing} busy={busy} onCancel={() => setEditing(null)} onSubmit={submit} />
                ) : loading && !loaded ? (
                    <LoadingState label="Loading templates…" />
                ) : error && !loaded ? (
                    <ErrorState title="Could not load templates" message={error} onRetry={load} />
                ) : templates.length === 0 ? (
                    <EmptyState icon={LayoutTemplate} title="No templates yet"
                        text="Save the tasks your team repeats — a bug report, a release checklist — and start new ones in one click."
                        action={<Btn variant="primary" icon={Plus} onClick={() => setEditing('new')}>Create a template</Btn>} />
                ) : (
                    <ul data-testid="task-templates" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {templates.map((t) => (
                            <li key={t.id} className="gl-card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                                <LayoutTemplate size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                                        <PriorityIcon priority={t.priority} size={12} />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, fontSize: 11, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                                        {t.title && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{t.title}</span>}
                                        {t.subtaskTitles.length > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><ListChecks size={11} /> {t.subtaskTitles.length} child issue{t.subtaskTitles.length === 1 ? '' : 's'}</span>}
                                        {t.tags.slice(0, 3).map((tag) => <Chip key={tag}>{tag}</Chip>)}
                                    </div>
                                </div>
                                <IconBtn label={`Edit ${t.name}`} onClick={() => setEditing(t)}><Pencil size={14} /></IconBtn>
                                <IconBtn label={`Delete ${t.name}`} onClick={() => setConfirmDelete(t)}><Trash2 size={14} /></IconBtn>
                                {picking && <Btn size="sm" variant="primary" icon={ArrowRight} onClick={() => onUse(t)}>Use</Btn>}
                            </li>
                        ))}
                    </ul>
                )}
            </Dialog>
            <Confirm open={!!confirmDelete} title="Delete template?" tone="danger" confirmLabel="Delete" busy={busy}
                onConfirm={remove} onClose={() => setConfirmDelete(null)}>
                “{confirmDelete?.name}” will be removed for everyone in this workspace. Tasks already created from it stay as they are.
            </Confirm>
        </>
    );
}
