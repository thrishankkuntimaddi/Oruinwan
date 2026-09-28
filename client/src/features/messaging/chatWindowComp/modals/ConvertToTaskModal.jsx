import React, { useState } from 'react';
import { CheckSquare, Loader2 } from 'lucide-react';
import api from '@services/api';
import ToolbarModalShell, { fieldStyle, labelStyle, PrimaryButton, SecondaryButton } from './ToolbarModalShell';
import { getMessageText, taskTitleFromText } from '../../../../utils/messageActionUtils';
import { PRIORITIES, PRIORITY_META, taskErrorMessage } from '../../../../utils/taskMeta';

// fieldStyle pins colorScheme to dark; follow the app theme so the native
// select/date popups are readable in light mode too.
const themedField = () => ({
    ...fieldStyle,
    colorScheme: typeof document !== 'undefined' && document.documentElement.classList.contains('light') ? 'light' : 'dark',
});

/** Create a task from a (decrypted) message. POSTs /api/v2/messages/:id/convert-task. */
export default function ConvertToTaskModal({ msg, onClose, onCreated }) {
    const fullText = getMessageText(msg);
    const [title, setTitle] = useState(taskTitleFromText(fullText));
    const [description, setDescription] = useState(fullText);
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
            const res = await api.post(`/api/v2/messages/${msg._id || msg.id}/convert-task`, {
                title: t.slice(0, 200),
                ...(description.trim() && { description: description.trim() }),
                priority,
                ...(dueDate && { dueDate: new Date(`${dueDate}T00:00:00`).toISOString() }),
            });
            onCreated?.(res.data?.task, t);
            onClose();
        } catch (err) {
            if (err?.response?.status === 409 && !err?.response?.data?.message) setError('This message was already converted to a task.');
            else setError(taskErrorMessage(err, 'Failed to create task'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <ToolbarModalShell
            title="Convert to task"
            icon={<CheckSquare size={14} style={{ color: 'var(--accent)' }} />}
            onClose={onClose}
            footer={(
                <>
                    <SecondaryButton onClick={onClose} disabled={saving}>Cancel</SecondaryButton>
                    <PrimaryButton onClick={submit} disabled={saving || !title.trim()}>
                        {saving && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
                        Create task
                    </PrimaryButton>
                </>
            )}
        >
            <form onSubmit={submit} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                    <label style={labelStyle} htmlFor="task-title">Title</label>
                    <input id="task-title" autoFocus value={title} maxLength={200} onChange={e => setTitle(e.target.value)} style={field} />
                </div>
                <div>
                    <label style={labelStyle} htmlFor="task-desc">Description</label>
                    <textarea id="task-desc" rows={4} value={description} onChange={e => setDescription(e.target.value)} style={{ ...field, resize: 'vertical', lineHeight: 1.5 }} />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                        <label style={labelStyle} htmlFor="task-priority">Priority</label>
                        <select id="task-priority" value={priority} onChange={e => setPriority(e.target.value)} style={field}>
                            {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={labelStyle} htmlFor="task-due">Due date (optional)</label>
                        <input id="task-due" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={field} />
                    </div>
                </div>
                {error && <div role="alert" style={{ fontSize: '12px', color: 'var(--state-danger)' }}>{error}</div>}
                <button type="submit" style={{ display: 'none' }} aria-hidden="true" tabIndex={-1} />
            </form>
        </ToolbarModalShell>
    );
}
