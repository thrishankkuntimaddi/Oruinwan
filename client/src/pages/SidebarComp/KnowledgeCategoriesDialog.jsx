import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, Folder } from 'lucide-react';
import { Dialog, Btn, IconBtn, EmptyState, Confirm, errorMessage } from '../../components/ui/page';

/** The server only lists and creates categories on older builds; say so plainly instead of failing. */
export function categoryErrorMessage(err, action) {
    const status = err?.response?.status;
    if (status === 404 || status === 405 || status === 501) {
        return `This server can’t ${action} categories yet. Ask your admin to update Oruinwan.`;
    }
    return errorMessage(err, `Couldn’t ${action} the category`);
}

export const cleanCategoryName = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 60);

/**
 * Create, rename and delete knowledge categories. `counts` maps categoryId -> number of pages.
 */
export default function KnowledgeCategoriesDialog({ open, onClose, categories = [], counts = {}, onCreate, onRename, onDelete, showToast }) {
    const [name, setName] = useState('');
    const [creating, setCreating] = useState(false);
    const [editing, setEditing] = useState(null); // { id, name }
    const [savingEdit, setSavingEdit] = useState(false);
    const [confirm, setConfirm] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const exists = (n, exceptId) => categories.some((c) => c._id !== exceptId && c.name.toLowerCase() === n.toLowerCase());

    const create = async () => {
        const n = cleanCategoryName(name);
        if (!n) return;
        if (exists(n)) { showToast?.(`“${n}” already exists`, 'error'); return; }
        setCreating(true);
        try {
            await onCreate(n);
            setName('');
        } catch (err) {
            showToast?.(categoryErrorMessage(err, 'create'), 'error');
        } finally { setCreating(false); }
    };

    const saveEdit = async () => {
        const n = cleanCategoryName(editing?.name);
        if (!n) return;
        const current = categories.find((c) => c._id === editing.id);
        if (current && current.name === n) { setEditing(null); return; }
        if (exists(n, editing.id)) { showToast?.(`“${n}” already exists`, 'error'); return; }
        setSavingEdit(true);
        try {
            await onRename(editing.id, n);
            setEditing(null);
        } catch (err) {
            showToast?.(categoryErrorMessage(err, 'rename'), 'error');
        } finally { setSavingEdit(false); }
    };

    const doDelete = async () => {
        setDeleting(true);
        try {
            await onDelete(confirm._id);
            setConfirm(null);
        } catch (err) {
            showToast?.(categoryErrorMessage(err, 'delete'), 'error');
        } finally { setDeleting(false); }
    };

    return (
        <>
            <Dialog
                open={open && !confirm}
                title="Categories"
                lead="Group pages by topic so people can browse them. A page sits in one category."
                onClose={onClose}
                footer={<Btn variant="ghost" onClick={onClose}>Done</Btn>}
            >
                <form className="kb-cat-new" onSubmit={(e) => { e.preventDefault(); create(); }}>
                    <input
                        className="gl-input"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="New category, e.g. Engineering"
                        aria-label="New category name"
                        maxLength={60}
                    />
                    <Btn type="submit" variant="primary" icon={Plus} loading={creating} disabled={!cleanCategoryName(name)}>Add</Btn>
                </form>
                <ul className="kb-cat-list gl-card">
                    {categories.length === 0 && (
                        <li><EmptyState icon={Folder} title="No categories yet" text="Add one above, then pick it from a page’s Category menu." /></li>
                    )}
                    {categories.map((c) => (
                        <li key={c._id} className="kb-cat-row">
                            <Folder size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                            {editing?.id === c._id ? (
                                <>
                                    <input
                                        className="gl-input"
                                        autoFocus
                                        value={editing.name}
                                        maxLength={60}
                                        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                                        onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { e.stopPropagation(); setEditing(null); } }}
                                        aria-label={`Rename ${c.name}`}
                                        style={{ flex: 1, minWidth: 0, height: 30 }}
                                    />
                                    <IconBtn label="Save name" onClick={saveEdit} disabled={savingEdit}><Check size={14} /></IconBtn>
                                    <IconBtn label="Cancel rename" onClick={() => setEditing(null)}><X size={14} /></IconBtn>
                                </>
                            ) : (
                                <>
                                    <span className="kb-cat-name">{c.name}</span>
                                    <span className="kb-row-meta" style={{ marginTop: 0 }}>{counts[c._id] || 0} page{counts[c._id] === 1 ? '' : 's'}</span>
                                    <IconBtn label={`Rename ${c.name}`} onClick={() => setEditing({ id: c._id, name: c.name })}><Pencil size={13} /></IconBtn>
                                    <IconBtn label={`Delete ${c.name}`} onClick={() => setConfirm(c)}><Trash2 size={13} /></IconBtn>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            </Dialog>
            <Confirm
                open={Boolean(confirm)}
                title={`Delete “${confirm?.name}”?`}
                confirmLabel="Delete category"
                tone="danger"
                busy={deleting}
                onConfirm={doDelete}
                onClose={() => setConfirm(null)}
            >
                Its {counts[confirm?._id] || 0} page{counts[confirm?._id] === 1 ? '' : 's'} stay where they are, just without a category.
            </Confirm>
        </>
    );
}

export const KB_CATEGORY_CSS = `
.kb-cat-new { display: flex; gap: 8px; margin-bottom: 12px; }
.kb-cat-new .gl-input { flex: 1; min-width: 0; }
.kb-cat-list { list-style: none; margin: 0; padding: 0; max-height: 320px; overflow-y: auto; }
.kb-cat-list > li + li { border-top: 1px solid var(--border-subtle); }
.kb-cat-row { display: flex; align-items: center; gap: 8px; padding: 6px 8px 6px 12px; min-height: 42px; }
.kb-cat-name { flex: 1; min-width: 0; font-size: 13.5px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;
