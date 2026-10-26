import React, { useEffect, useState } from 'react';
import { CheckSquare } from 'lucide-react';
import api from '@services/api';
import { openTaskInApp } from '../../utils/sourceTask';

const STATUS_WORDS = { todo: 'To do', in_progress: 'In progress', review: 'In review', blocked: 'Blocked', done: 'Done', cancelled: 'Cancelled', backlog: 'Backlog' };

// One fetch per task while the page is open.
const briefs = new Map();
export function taskBrief(taskId) {
    const key = String(taskId);
    if (!briefs.has(key)) {
        briefs.set(key, api.get(`/api/v2/tasks/${key}`)
            .then((r) => { const t = r.data?.task || r.data; return t ? { key: t.issueKey || null, title: t.title || '', status: t.status || '' } : null; })
            .catch(() => null));
    }
    return briefs.get(key);
}

/** The task made from a note or file: key, title and status; clicking opens it. */
export default function LinkedTaskPill({ taskId, workspaceId, label = 'Task' }) {
    const [brief, setBrief] = useState(null);
    useEffect(() => {
        let alive = true;
        taskBrief(taskId).then((b) => alive && setBrief(b));
        return () => { alive = false; };
    }, [taskId]);
    const text = [brief?.key || label, brief?.title, brief?.status && (STATUS_WORDS[brief.status] || brief.status)].filter(Boolean).join(' · ');
    return (
        <button type="button" className="cd-chip" data-testid="source-task-pill"
            onClick={(e) => { e.stopPropagation(); openTaskInApp(workspaceId, taskId); }}
            title="Open the task made from this"
            style={{ cursor: 'pointer', border: 'none', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--accent)', flexShrink: 1 }}>
            <CheckSquare size={12} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
        </button>
    );
}
