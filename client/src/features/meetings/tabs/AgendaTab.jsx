import React, { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Edit3, Save, ArrowUp, ListOrdered } from 'lucide-react';
import { Btn, EmptyState, IconBtn } from '../../../components/ui/page';
import { useToast } from '../../../contexts/ToastContext';
import { errorText } from '../meetingModel';

/** Agenda: an ordered list everyone with the meeting open sees once saved. */
export default function AgendaTab({ meeting, onSave, readOnly = false }) {
    const { showToast } = useToast();
    const [items, setItems] = useState(meeting.agenda || []);
    const [dirty, setDirty] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(null);
    const dirtyRef = useRef(false);
    dirtyRef.current = dirty;

    // Someone else saved: take theirs unless I have unsaved changes.
    useEffect(() => { if (!dirtyRef.current) setItems(meeting.agenda || []); }, [meeting.agenda]);

    const change = (fn) => { setItems(fn); setDirty(true); };
    const add = () => {
        const t = newTitle.trim();
        if (!t) return;
        change((prev) => [...prev, { title: t, notes: '', order: prev.length }]);
        setNewTitle('');
    };
    const move = (idx) => change((prev) => {
        if (idx <= 0) return prev;
        const next = prev.slice();
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
        return next;
    });

    const save = async () => {
        setSaving(true);
        try {
            await onSave(items.filter((it) => (it.title || '').trim()).map((it, i) => ({ ...it, title: it.title.trim(), order: i })));
            setDirty(false);
            showToast('Agenda saved', 'success');
        } catch (err) {
            showToast(errorText(err, 'Could not save the agenda'), 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mt-stack mt-stack--wide" data-testid="meeting-tab-agenda">
            {!readOnly && (
                <div className="mt-add">
                    <input className="gl-input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} aria-label="New agenda item"
                        onKeyDown={(e) => { if (e.key === 'Enter') add(); }} placeholder="Add an agenda item…" maxLength={300} />
                    <Btn icon={Plus} onClick={add} disabled={!newTitle.trim()}>Add</Btn>
                </div>
            )}
            {items.length === 0 ? (
                <EmptyState icon={ListOrdered} title="No agenda yet" text="List what you want to cover. Everyone sees it before and during the huddle." />
            ) : (
                <div className="mt-stack" style={{ gap: 6 }}>
                    {items.map((item, idx) => (
                        <div key={item._id || `new-${idx}`} className="mt-item" data-testid="agenda-item">
                            <span className="mt-item-num">{idx + 1}</span>
                            <div className="mt-grow">
                                {editing === idx ? (
                                    <input className="gl-input" autoFocus value={item.title} aria-label="Agenda item"
                                        onChange={(e) => change((prev) => prev.map((it, i) => (i === idx ? { ...it, title: e.target.value } : it)))}
                                        onBlur={() => setEditing(null)} onKeyDown={(e) => { if (e.key === 'Enter') setEditing(null); }} />
                                ) : <p className="mt-item-text">{item.title}</p>}
                                {item.notes && <p className="mt-muted" style={{ marginTop: 2 }}>{item.notes}</p>}
                            </div>
                            {!readOnly && (
                                <span className="mt-item-tools">
                                    {idx > 0 && <IconBtn label="Move up" onClick={() => move(idx)}><ArrowUp size={13} /></IconBtn>}
                                    <IconBtn label="Edit item" onClick={() => setEditing(idx)}><Edit3 size={13} /></IconBtn>
                                    <IconBtn label="Remove item" onClick={() => change((prev) => prev.filter((_, i) => i !== idx))}><Trash2 size={13} /></IconBtn>
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
            {!readOnly && (dirty || items.length > 0) && (
                <div className="mt-row">
                    <Btn variant={dirty ? 'primary' : undefined} icon={Save} onClick={save} loading={saving} disabled={!dirty}>Save agenda</Btn>
                    {dirty && <span className="mt-muted">Unsaved changes</span>}
                </div>
            )}
        </div>
    );
}
