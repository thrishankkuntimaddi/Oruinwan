import React, { useEffect, useState } from 'react';
import { CheckSquare } from 'lucide-react';
import { Btn, IconBtn } from '../ui/page';
import MakeTaskModal from './MakeTaskModal';
import { fileTaskDraft, openTaskInApp, sourceTaskMenuLabel } from '../../utils/sourceTask';

/**
 * "Make a task" / "Open task" for a file. A file uploaded to Files (kind 'file') links to
 * its own task; a file sent in a chat (kind 'message') becomes a task through its message.
 *   variant 'icon' (file rows and cards) or 'button' (the preview panel)
 */
export default function FileTaskButton({ kind = 'file', sourceId, name, linkedTaskId, workspaceId, variant = 'icon', onLinked }) {
    const [taskId, setTaskId] = useState(linkedTaskId || null);
    const [open, setOpen] = useState(false);
    useEffect(() => { setTaskId(linkedTaskId || null); }, [linkedTaskId, sourceId]);
    if (!sourceId) return null;

    const label = sourceTaskMenuLabel(taskId);
    const onClick = (e) => {
        e?.stopPropagation?.();
        if (taskId) openTaskInApp(workspaceId, taskId);
        else setOpen(true);
    };
    const linked = (id) => { if (!id) return; setTaskId(String(id)); onLinked?.(String(id)); };

    return (
        <>
            {variant === 'button'
                ? <Btn variant="ghost" icon={CheckSquare} onClick={onClick} data-testid="file-task-button">{label}</Btn>
                : <IconBtn label={`${label}: ${name}`} onClick={onClick} data-testid="file-task-button"
                    style={taskId ? { color: 'var(--accent)' } : undefined}><CheckSquare size={14} /></IconBtn>}
            {open && (
                <MakeTaskModal kind={kind} sourceId={sourceId} draft={fileTaskDraft(name)}
                    onClose={() => setOpen(false)}
                    onCreated={(task) => linked(task?._id)}
                    onExisting={(id) => { linked(id); openTaskInApp(workspaceId, id); }} />
            )}
        </>
    );
}
