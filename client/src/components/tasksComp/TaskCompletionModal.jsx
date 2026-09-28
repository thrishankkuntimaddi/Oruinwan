import React, { useState } from "react";
import { CheckCircle2, Trash2, Ban, Loader2 } from "lucide-react";
import { TaskDialog } from "./taskUi";

/**
 * Confirmation step for task actions that need one:
 *  - completion: optional completion note, then mark done
 *  - blocked:    required reason, then mark blocked
 *  - deletion:   move to trash (or hide, for an assignee of a done task)
 *  - purge:      delete forever from Trash
 * onConfirm(text) may return a promise; the dialog shows progress meanwhile.
 */
const MODES = {
    completion: { title: 'Mark as done', Icon: CheckCircle2, accent: 'var(--state-success)', cta: 'Mark done', btn: 'tk-btn-primary' },
    blocked: { title: 'Mark as blocked', Icon: Ban, accent: 'var(--state-danger)', cta: 'Mark blocked', btn: 'tk-btn-danger' },
    deletion: { title: 'Move to trash?', Icon: Trash2, accent: 'var(--state-danger)', cta: 'Move to trash', btn: 'tk-btn-danger' },
    hide: { title: 'Remove from your list?', Icon: Trash2, accent: 'var(--state-danger)', cta: 'Remove', btn: 'tk-btn-danger' },
    purge: { title: 'Delete forever?', Icon: Trash2, accent: 'var(--state-danger)', cta: 'Delete forever', btn: 'tk-btn-danger' },
};

export default function TaskCompletionModal({ task, onClose, onConfirm, mode = "completion" }) {
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);
    const m = MODES[mode] || MODES.completion;
    const needsText = mode === 'blocked';
    const hasText = mode === 'blocked' || mode === 'completion';
    const disabled = busy || (needsText && !text.trim());

    const confirm = async () => {
        if (disabled) return;
        setBusy(true);
        try { await onConfirm(text.trim()); } finally { setBusy(false); }
    };

    return (
        <TaskDialog
            title={m.title}
            subtitle={task?.title}
            icon={<m.Icon size={16} />}
            accent={m.accent}
            onClose={busy ? undefined : onClose}
            width={440}
            footer={(
                <>
                    <button type="button" className="tk-btn" onClick={onClose} disabled={busy}>Cancel</button>
                    <button type="button" className={`tk-btn ${m.btn}`} onClick={confirm} disabled={disabled}>
                        {busy ? <Loader2 size={13} className="tk-spin" /> : <m.Icon size={13} />} {m.cta}
                    </button>
                </>
            )}
        >
            {hasText ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label className="tk-label" htmlFor="tk-confirm-text" style={{ marginBottom: 0 }}>
                        {mode === 'blocked' ? 'What is blocking this task? (required)' : 'Completion note (optional)'}
                    </label>
                    <textarea
                        id="tk-confirm-text"
                        className="tk-field"
                        autoFocus
                        rows={3}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) confirm(); }}
                        placeholder={mode === 'blocked' ? 'e.g. Waiting on API keys from the vendor' : 'Summarise what was done for the reporter…'}
                        style={{ resize: 'vertical', minHeight: '76px', fontSize: '13px', lineHeight: 1.5 }}
                    />
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {mode === 'blocked' ? 'The reason is shown on the task until it is unblocked.' : 'You can leave this empty — the task is marked done either way.'}
                    </p>
                </div>
            ) : (
                <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                    {mode === 'deletion' && <>“<strong style={{ color: 'var(--text-primary)' }}>{task?.title}</strong>” moves to Trash. You can restore it from there.</>}
                    {mode === 'hide' && <>“<strong style={{ color: 'var(--text-primary)' }}>{task?.title}</strong>” is removed from your task list. The creator still sees it.</>}
                    {mode === 'purge' && <>“<strong style={{ color: 'var(--text-primary)' }}>{task?.title}</strong>” is deleted permanently. This cannot be undone.</>}
                </p>
            )}
        </TaskDialog>
    );
}
