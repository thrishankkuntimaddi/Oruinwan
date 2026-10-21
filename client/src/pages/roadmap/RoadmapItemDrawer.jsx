import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, Save } from 'lucide-react';
import { Btn, IconBtn, Field, Meter, Chip, Confirm, SearchBox, errorMessage } from '../../components/ui/page';
import { STATUSES, COLORS, colorVar, isoDay, progressOf, progressLabel } from './roadmapTimeline';

const idOf = (v) => String(v?._id || v || '');

export const emptyForm = () => ({
    title: '', description: '', status: 'planned', color: 'accent',
    startDate: '', endDate: '', quarter: '', ownerId: '', milestoneIds: [], taskIds: [],
});

export function formFromItem(item) {
    if (!item) return emptyForm();
    return {
        title: item.title || '',
        description: item.description || '',
        status: item.status || 'planned',
        color: item.color || 'accent',
        startDate: isoDay(item.startDate),
        endDate: isoDay(item.endDate),
        quarter: item.quarter || '',
        ownerId: idOf(item.ownerId),
        milestoneIds: (item.milestoneIds || []).map(idOf),
        taskIds: (item.taskIds || []).map(idOf),
    };
}

/** Body for POST/PATCH from the form; null dates and empty quarter clear them. */
export function bodyFromForm(form) {
    return {
        title: form.title.trim(),
        description: form.description,
        status: form.status,
        color: form.color,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        quarter: form.quarter || null,
        ...(form.ownerId ? { ownerId: form.ownerId } : {}),
        milestoneIds: form.milestoneIds,
        taskIds: form.taskIds,
    };
}

export function validateForm(form) {
    if (!form.title.trim()) return 'Give the item a title.';
    if (form.startDate && form.endDate && form.startDate > form.endDate) return 'The end date must be on or after the start date.';
    if (form.quarter && !/^\d{4}-Q[1-4]$/.test(form.quarter)) return 'Quarter looks like 2026-Q4.';
    return null;
}

function PickList({ items, selected, onToggle, render, empty, label }) {
    const [q, setQ] = useState('');
    const shown = useMemo(() => {
        const needle = q.trim().toLowerCase();
        const list = needle ? items.filter((it) => render(it).title.toLowerCase().includes(needle)) : items;
        return [...list].sort((a, b) => Number(selected.includes(idOf(b))) - Number(selected.includes(idOf(a)))).slice(0, 200);
    }, [items, q, selected, render]);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.length > 6 && <SearchBox value={q} onChange={setQ} placeholder={`Search ${label}…`} label={`Search ${label}`} />}
            <div className="rm-picklist" role="group" aria-label={label}>
                {shown.length === 0 && <div className="rm-pick" style={{ cursor: 'default' }}>{empty}</div>}
                {shown.map((it) => {
                    const { title, hint } = render(it);
                    const id = idOf(it);
                    return (
                        <label key={id} className="rm-pick">
                            <input type="checkbox" checked={selected.includes(id)} onChange={() => onToggle(id)} />
                            <span title={title}>{title}</span>
                            {hint && <small>{hint}</small>}
                        </label>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * Create / edit drawer for a roadmap item. `item` null = new item.
 * `canManage` (workspace owner/admin/manager) may change the owner; `canEdit` may save.
 */
export default function RoadmapItemDrawer({ open, item, canManage, members = [], milestones = [], tasks = [], onSave, onDelete, onClose }) {
    const [form, setForm] = useState(emptyForm());
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const isNew = !item;
    const canEdit = isNew ? canManage : item?.canEdit !== false;

    useEffect(() => { if (open) { setForm(formFromItem(item)); setError(null); } }, [open, item]);
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape' && !saving && !confirmDelete) onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, saving, confirmDelete, onClose]);

    if (!open) return null;
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
    const toggle = (k) => (id) => setForm((f) => ({ ...f, [k]: f[k].includes(id) ? f[k].filter((x) => x !== id) : [...f[k], id] }));

    const save = async () => {
        const problem = validateForm(form);
        if (problem) { setError(problem); return; }
        setSaving(true);
        setError(null);
        try {
            await onSave(bodyFromForm(form));
        } catch (err) {
            setError(errorMessage(err, 'Couldn’t save the item'));
        } finally {
            setSaving(false);
        }
    };

    const doDelete = async () => {
        setDeleting(true);
        try { await onDelete(); setConfirmDelete(false); } catch (err) { setError(errorMessage(err, 'Couldn’t delete the item')); setConfirmDelete(false); } finally { setDeleting(false); }
    };

    const ms = item?.progress?.milestones?.items || [];
    const disabled = !canEdit || saving;

    return createPortal(
        <>
            <div className="rm-scrim" onMouseDown={() => !saving && onClose()} />
            <aside className="rm-drawer gl-liquid gl-liquid--strong" role="dialog" aria-modal="true" aria-label={isNew ? 'New roadmap item' : `Edit ${item.title}`}>
                <div className="rm-drawer-head">
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h2>{isNew ? 'New roadmap item' : (canEdit ? 'Edit roadmap item' : item.title)}</h2>
                        <p>{isNew ? 'Plan a theme or initiative and link the milestones and tasks that deliver it.' : progressLabel(item)}</p>
                    </div>
                    <IconBtn label="Close" onClick={onClose} disabled={saving}><X size={16} /></IconBtn>
                </div>

                <div className="rm-drawer-body">
                    {!isNew && (
                        <div>
                            <p className="rm-sub">Progress · {progressOf(item)}%</p>
                            <Meter value={progressOf(item)} tone={progressOf(item) >= 100 ? 'success' : undefined} label="Progress" />
                            {ms.length > 0 && (
                                <div style={{ marginTop: 8 }}>
                                    {ms.map((m) => (
                                        <div key={idOf(m)} className="rm-ms">
                                            <span title={m.name}>{m.name}</span>
                                            <Meter value={m.percent || 0} tone={m.complete ? 'success' : undefined} label={`${m.name} progress`} />
                                            <small style={{ width: 34, textAlign: 'right' }}>{m.percent || 0}%</small>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <Field label="Title" htmlFor="rm-title">
                        <input id="rm-title" className="gl-input" value={form.title} maxLength={200} onChange={set('title')} disabled={disabled} placeholder="e.g. Self-serve onboarding" />
                    </Field>
                    <Field label="Description" htmlFor="rm-desc">
                        <textarea id="rm-desc" className="gl-input" rows={3} value={form.description} maxLength={10000} onChange={set('description')} disabled={disabled} style={{ resize: 'vertical' }} />
                    </Field>
                    <div className="rm-two">
                        <Field label="Status" htmlFor="rm-status">
                            <select id="rm-status" className="gl-input cd-select" value={form.status} onChange={set('status')} disabled={disabled}>
                                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </Field>
                        <Field label="Owner" htmlFor="rm-owner" hint={!canManage ? 'Only admins and managers change owners.' : undefined}>
                            <select id="rm-owner" className="gl-input cd-select" value={form.ownerId} onChange={set('ownerId')} disabled={disabled || !canManage}>
                                <option value="">{isNew ? 'Me' : 'Unassigned'}</option>
                                {members.map((m) => <option key={idOf(m)} value={idOf(m)}>{m.username || m.name || m.email}</option>)}
                            </select>
                        </Field>
                    </div>
                    <div className="rm-two">
                        <Field label="Start" htmlFor="rm-start">
                            <input id="rm-start" type="date" className="gl-input" value={form.startDate} onChange={set('startDate')} disabled={disabled} />
                        </Field>
                        <Field label="End" htmlFor="rm-end">
                            <input id="rm-end" type="date" className="gl-input" value={form.endDate} onChange={set('endDate')} disabled={disabled} />
                        </Field>
                    </div>
                    <Field label="Quarter" htmlFor="rm-quarter" hint="Used when there are no dates, e.g. 2026-Q4.">
                        <input id="rm-quarter" className="gl-input" value={form.quarter} onChange={set('quarter')} disabled={disabled} placeholder="2026-Q4" />
                    </Field>
                    <Field label="Colour">
                        <div className="rm-colors" role="group" aria-label="Colour">
                            {COLORS.map((c) => (
                                <button key={c} type="button" className="rm-swatch" style={{ '--rm-color': colorVar(c) }} aria-pressed={form.color === c} aria-label={c} disabled={disabled} onClick={() => set('color')(c)} />
                            ))}
                        </div>
                    </Field>

                    <div>
                        <p className="rm-sub">Milestones {form.milestoneIds.length > 0 && <Chip tone="accent">{form.milestoneIds.length}</Chip>}</p>
                        <PickList
                            label="milestones" items={milestones} selected={form.milestoneIds} onToggle={canEdit ? toggle('milestoneIds') : () => {}}
                            render={(m) => ({ title: m.name || 'Untitled', hint: m.progress ? `${m.progress.percent}%` : null })}
                            empty="No milestones in this workspace yet."
                        />
                    </div>
                    <div>
                        <p className="rm-sub">Tasks {form.taskIds.length > 0 && <Chip tone="accent">{form.taskIds.length}</Chip>}</p>
                        <PickList
                            label="tasks" items={tasks} selected={form.taskIds} onToggle={canEdit ? toggle('taskIds') : () => {}}
                            render={(t) => ({ title: t.title || 'Untitled', hint: t.status ? String(t.status).replace(/_/g, ' ') : null })}
                            empty="No tasks you can see."
                        />
                    </div>

                    {error && <div className="cd-error-text" role="alert">{error}</div>}
                </div>

                <div className="rm-drawer-foot">
                    {!isNew && canEdit && onDelete && <Btn variant="ghost" icon={Trash2} onClick={() => setConfirmDelete(true)} disabled={saving} style={{ marginRight: 'auto' }}>Delete</Btn>}
                    <Btn variant="ghost" onClick={onClose} disabled={saving}>{canEdit ? 'Cancel' : 'Close'}</Btn>
                    {canEdit && <Btn variant="primary" icon={Save} loading={saving} onClick={save}>{isNew ? 'Create item' : 'Save'}</Btn>}
                </div>
            </aside>
            <Confirm open={confirmDelete} title="Delete this roadmap item?" confirmLabel="Delete" tone="danger" busy={deleting} onConfirm={doDelete} onClose={() => setConfirmDelete(false)}>
                The item leaves the roadmap for everyone. Linked milestones and tasks are not touched.
            </Confirm>
        </>,
        document.body,
    );
}
