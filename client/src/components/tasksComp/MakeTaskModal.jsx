import React, { useState } from 'react';
import { CheckSquare, Loader2 } from 'lucide-react';
import api from '@services/api';
import ToolbarModalShell, { fieldStyle, labelStyle, PrimaryButton, SecondaryButton } from '../../features/messaging/chatWindowComp/modals/ToolbarModalShell';
import { PRIORITIES, PRIORITY_META, taskErrorMessage } from '../../utils/taskMeta';
import { sourceTaskEndpoint } from '../../utils/sourceTask';

const themedField = () => ({
    ...fieldStyle,
    colorScheme: typeof document !== 'undefined' && document.documentElement.classList.contains('light') ? 'light' : 'dark',
});

/**
 * "Make a task" from a note or a file, pre-filled. POSTs /api/v2/notes|files/:id/task.
 * onCreated(task) after it is made; onExisting(taskId) when the source already has a task.
 */
export default function MakeTaskModal({ kind, sourceId, draft, onClose, onCreated, onExisting }) {
    const [title, setTitle] = useState(draft?.title || '');
    const [description, setDescription] = useState(draft?.description || '');
    const [priority, setPriority] = useState('medium');
    const [dueDate, setDueDate] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const field = themedField();

    const submit = async (e) => {
        e?.preventDefault?.();
        const t = title.trim();
        if (!t) { setError('Title is required'); return; }
        setSaving(true);
        setError(null);
        try {
            const res = await api.post(sourceTaskEndpoint(kind, sourceId), {
                title: t.slice(0, 200),
                ...(description.trim() && { description: description.trim() }),
                priority,
                ...(dueDate && { dueDate: new Date(`${dueDate}T00:00:00`).toISOString() }),
            });
            onCreated?.(res.data?.task);
            onClose();
        } catch (err) {
            const existing = err?.response?.status === 409 ? err.response.data?.taskId : null;
            if (existing) { onExisting?.(existing); onClose(); return; }
            if (err?.response?.status === 409) setError('This is already a task.');
            else setError(taskErrorMessage(err, 'Could not make the task'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <ToolbarModalShell
            title={kind === 'note' ? 'Make a task from this note' : 'Make a task from this file'}
            icon={<CheckSquare size={14} style={{ color: 'var(--accent)' }} />}
            onClose={onClose}
            footer={(
                <>
                    <SecondaryButton onClick={onClose} disabled={saving}>Cancel</SecondaryButton>
                    <PrimaryButton onClick={submit} disabled={saving || !title.trim()}>
                        {saving && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
                        Make task
                    </PrimaryButton>
                </>
            )}
        >
            <form onSubmit={submit} data-testid="make-task-form" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                    <label style={labelStyle} htmlFor="make-task-title">Title</label>
                    <input id="make-task-title" autoFocus value={title} maxLength={200} onChange={e => setTitle(e.target.value)} style={field} />
                </div>
                <div>
                    <label style={labelStyle} htmlFor="make-task-desc">Description</label>
                    <textarea id="make-task-desc" rows={5} value={description} onChange={e => setDescription(e.target.value)} style={{ ...field, resize: 'vertical', lineHeight: 1.5 }} />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                        <label style={labelStyle} htmlFor="make-task-priority">Priority</label>
                        <select id="make-task-priority" value={priority} onChange={e => setPriority(e.target.value)} style={field}>
                            {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={labelStyle} htmlFor="make-task-due">Due date (optional)</label>
                        <input id="make-task-due" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={field} />
                    </div>
                </div>
                {error && <div role="alert" style={{ fontSize: '12px', color: 'var(--state-danger)' }}>{error}</div>}
                <button type="submit" style={{ display: 'none' }} aria-hidden="true" tabIndex={-1} />
            </form>
        </ToolbarModalShell>
    );
}
