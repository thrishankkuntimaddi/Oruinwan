import React, { useCallback, useState } from 'react';
import { Link2, CheckCircle2 } from 'lucide-react';
import { Dialog, Btn } from '../ui/page';
import { statusLabel } from '../../utils/taskMeta';

/**
 * Shown when completing a task answers 409 TASK_BLOCKED: lists the open
 * blockers and lets the person complete it anyway (ignoreBlockers: true).
 */
export default function BlockedTaskDialog({ open, blocked, taskTitle, onCancel, onConfirm }) {
  const blockers = blocked?.blockers || [];
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      size="sm"
      title="This task is still blocked"
      lead={`${taskTitle ? `“${taskTitle}” depends on` : 'It depends on'} ${blockers.length === 1 ? 'a task that isn’t' : `${blockers.length || 'some'} tasks that aren’t`} done yet.`}
      footer={(
        <>
          <Btn variant="ghost" onClick={onCancel}>Keep it open</Btn>
          <Btn variant="primary" icon={CheckCircle2} onClick={onConfirm} data-autofocus="true">Complete anyway</Btn>
        </>
      )}
    >
      {blockers.length > 0 ? (
        <ul data-testid="task-blockers" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {blockers.map((b) => (
            <li key={b.id || b.title} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', fontSize: 13,
              background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--gl-radius)' }}>
              <Link2 size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                {b.issueKey ? `${b.issueKey} · ` : ''}{b.title || 'Untitled task'}
              </span>
              {b.status && <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{statusLabel(b.status)}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>{blocked?.message}</p>
      )}
    </Dialog>
  );
}

/**
 * `ask(blocked, taskTitle)` opens the dialog and resolves true ("Complete anyway")
 * or false. Render `dialog` somewhere in the tree.
 */
export function useBlockedPrompt() {
  const [state, setState] = useState(null);
  const ask = useCallback((blocked, taskTitle) => new Promise((resolve) => setState({ blocked, taskTitle, resolve })), []);
  const close = (answer) => { state?.resolve(answer); setState(null); };
  const dialog = (
    <BlockedTaskDialog open={Boolean(state)} blocked={state?.blocked} taskTitle={state?.taskTitle}
      onCancel={() => close(false)} onConfirm={() => close(true)} />
  );
  return { ask, dialog };
}
