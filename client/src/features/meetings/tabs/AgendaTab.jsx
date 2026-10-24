import React, { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Edit3, ArrowUp, ListOrdered, Check } from 'lucide-react';
import { Btn, EmptyState, IconBtn } from '../../../components/ui/page';
import { useToast } from '../../../contexts/ToastContext';
import { errorText } from '../meetingModel';

const clean = (items) => items
    .filter((it) => (it.title || '').trim())
    .map((it, i) => ({ ...it, title: it.title.trim(), order: i }));

/**
 * Agenda: an ordered list everyone with the meeting open sees. Every change saves at once
 * (adding, removing, moving, and an edit when you leave the field), so nothing is lost when
 * the tab or the call panel closes, and others see it straight away.
 */
export default function AgendaTab({ meeting, onSave, readOnly = false }) {
    const { showToast } = useToast();
    const [items, setItems] = useState(meeting.agenda || []);
    const [newTitle, setNewTitle] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [editing, setEditing] = useState(null);
    // Unsaved typing in an item, or a save on its way: don't let a refresh overwrite it.
    const busyRef = useRef(0);
    const typingRef = useRef(false);
    const queueRef = useRef(Promise.resolve());

    // Someone else saved: take theirs unless I'm typing or saving.
    useEffect(() => {
        if (!typingRef.current && busyRef.current === 0) setItems(meeting.agenda || []);
    }, [meeting.agenda]);

    const commit = (next) => {
        setItems(next);
        setSaved(false);
        busyRef.current += 1;
        setSaving(true);
        // One save at a time, in order, so the last change is the one that stays.
        queueRef.current = queueRef.current.then(async () => {
            try {
                await onSave(clean(next));
                setSaved(true);
            } catch (err) {
                showToast(errorText(err, 'Could not save the agenda'), 'error');
            } finally {
                busyRef.current -= 1;
                if (busyRef.current === 0) setSaving(false);
            }
        });
        return queueRef.current;
    };

    const add = () => {
        const t = newTitle.trim();
        if (!t) return;
        commit([...items, { title: t, notes: '', order: items.length }]);
        setNewTitle('');
    };
    const move = (idx) => {
        if (idx <= 0) return;
        const next = items.slice();
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
        commit(next);
    };
    const remove = (idx) => commit(items.filter((_, i) => i !== idx));
    const finishEdit = () => {
        setEditing(null);
        if (!typingRef.current) return;
        typingRef.current = false;
        commit(items);
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
                                        onChange={(e) => {
                                            typingRef.current = true;
                                            const title = e.target.value;
                                            setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, title } : it)));
                                        }}
                                        onBlur={finishEdit} onKeyDown={(e) => { if (e.key === 'Enter') finishEdit(); }} />
                                ) : <p className="mt-item-text">{item.title}</p>}
                                {item.notes && <p className="mt-muted" style={{ marginTop: 2 }}>{item.notes}</p>}
                            </div>
                            {!readOnly && (
                                <span className="mt-item-tools">
                                    {idx > 0 && <IconBtn label="Move up" onClick={() => move(idx)}><ArrowUp size={13} /></IconBtn>}
                                    <IconBtn label="Edit item" onClick={() => setEditing(idx)}><Edit3 size={13} /></IconBtn>
                                    <IconBtn label="Remove item" onClick={() => remove(idx)}><Trash2 size={13} /></IconBtn>
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
            {!readOnly && (saving || saved) && (
                <p className="mt-muted" role="status" data-testid="agenda-status">
                    {saving ? 'Saving…' : <><Check size={12} aria-hidden="true" /> Saved for everyone</>}
                </p>
            )}
        </div>
    );
}
