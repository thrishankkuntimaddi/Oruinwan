import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { BOARD_STATUSES, PRIORITIES, PRIORITY_META, statusLabel } from '../../../../../utils/taskMeta';
import { FONT } from './channelTaskUtils';
import { Avatar, IconButton, primaryBtn, secondaryBtn, sectionLabel, useColorScheme } from './ChannelTaskUi';

// Blocked needs a reason, so new tasks start in any other open column.
const CREATE_STATUSES = BOARD_STATUSES.filter((s) => s !== 'blocked');

export default function ChannelTaskCreateModal({ channelName, members, defaultStatus = 'todo', onClose, onSubmit }) {
    const scheme = useColorScheme();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('medium');
    const [status, setStatus] = useState(CREATE_STATUSES.includes(defaultStatus) ? defaultStatus : 'todo');
    const [dueDate, setDueDate] = useState('');
    const [assigneeIds, setAssigneeIds] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const ref = useRef(null);
    useEffect(() => { ref.current?.focus(); }, []);
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, saving]);

    const field = {
        width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 13, fontFamily: FONT,
        background: 'var(--bg-input)', color: 'var(--text-primary)', colorScheme: scheme,
        border: '1px solid var(--border-default)', borderRadius: '2px', outline: 'none',
    };
    const toggle = (id) => setAssigneeIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

    const submit = async (e) => {
        e.preventDefault();
        if (!title.trim() || saving) return;
        setSaving(true);
        setError(null);
        const err = await onSubmit({
            title: title.trim(), description, priority, status, assignedToIds: assigneeIds,
            ...(dueDate ? { dueDate: new Date(`${dueDate}T00:00:00`).toISOString() } : {}),
        });
        setSaving(false);
        if (err) setError(err);
    };

    return (
        <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }} style={{
            position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'var(--bg-overlay, rgba(0,0,0,0.6))',
        }}>
            <form role="dialog" aria-label="Create issue" onSubmit={submit} style={{
                width: 480, maxWidth: 'calc(100vw - 32px)', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-accent)', borderRadius: '2px',
                boxShadow: '0 16px 48px rgba(0,0,0,0.35)', fontFamily: FONT, overflow: 'hidden',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-default)', backgroundColor: 'var(--bg-active)' }}>
                    <h3 style={{ margin: 0, flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                        Create issue{channelName ? <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}> in #{channelName}</span> : null}
                    </h3>
                    <IconButton title="Close" onClick={onClose}><X size={15} /></IconButton>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <label htmlFor="ct-title" style={{ ...sectionLabel, display: 'block' }}>Summary <span style={{ color: 'var(--state-danger)' }}>*</span></label>
                        <input id="ct-title" ref={ref} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" style={field} />
                    </div>
                    <div>
                        <label htmlFor="ct-desc" style={{ ...sectionLabel, display: 'block' }}>Description</label>
                        <textarea id="ct-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add a description…" style={{ ...field, resize: 'vertical', lineHeight: 1.5 }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label htmlFor="ct-status" style={{ ...sectionLabel, display: 'block' }}>Status</label>
                            <select id="ct-status" value={status} onChange={(e) => setStatus(e.target.value)} style={field}>
                                {CREATE_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="ct-priority" style={{ ...sectionLabel, display: 'block' }}>Priority</label>
                            <select id="ct-priority" value={priority} onChange={(e) => setPriority(e.target.value)} style={field}>
                                {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="ct-due" style={{ ...sectionLabel, display: 'block' }}>Due date</label>
                        <input id="ct-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={field} />
                    </div>
                    <div>
                        <p style={sectionLabel}>Assignees</p>
                        <div style={{ border: '1px solid var(--border-default)', borderRadius: '2px', maxHeight: 150, overflowY: 'auto', background: 'var(--bg-input)' }}>
                            {members.length === 0 && <p style={{ margin: 0, padding: 8, fontSize: 12, color: 'var(--text-secondary)' }}>No channel members loaded.</p>}
                            {members.map((m) => (
                                <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}>
                                    <input type="checkbox" checked={assigneeIds.includes(m.id)} onChange={() => toggle(m.id)} style={{ accentColor: 'var(--accent)', colorScheme: scheme }} />
                                    <Avatar user={m} size={18} />
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.username}</span>
                                </label>
                            ))}
                        </div>
                        <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-secondary)' }}>
                            {assigneeIds.length ? `${assigneeIds.length} selected` : 'None selected: everyone in the channel is assigned.'}
                        </p>
                    </div>
                    {error && <div role="alert" style={{ fontSize: 12, color: 'var(--state-danger)' }}>{error}</div>}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border-default)' }}>
                    <button type="button" onClick={onClose} disabled={saving} style={secondaryBtn}>Cancel</button>
                    <button type="submit" disabled={!title.trim() || saving} style={{ ...primaryBtn, opacity: !title.trim() || saving ? 0.5 : 1, cursor: !title.trim() || saving ? 'not-allowed' : 'pointer' }}>
                        {saving && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />} Create
                    </button>
                </div>
            </form>
        </div>
    );
}
