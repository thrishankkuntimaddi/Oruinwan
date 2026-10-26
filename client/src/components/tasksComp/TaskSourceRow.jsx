import React, { useEffect, useState } from 'react';
import { FileText, Paperclip } from 'lucide-react';
import api from '@services/api';

const idOf = (v) => (v ? String(v._id || v.id || v) : null);

/** Which note or file a task was made from: { kind, id } or null. */
export function taskSource(task) {
    if (!task) return null;
    const note = idOf(task.linkedNote);
    if (note) return { kind: 'note', id: note };
    const file = idOf(task.linkedFile);
    if (file) return { kind: 'file', id: file };
    return null;
}

/**
 * "From note: <title>" / "From file: <name>": opens the note or file. People who cannot
 * open it see that it came from one, without its name.
 */
export default function TaskSourceRow({ task, workspaceId }) {
    const source = taskSource(task);
    const [state, setState] = useState({ status: 'loading', name: '' });
    const kind = source?.kind;
    const id = source?.id;

    useEffect(() => {
        if (!id) return undefined;
        let alive = true;
        setState({ status: 'loading', name: '' });
        const url = kind === 'note' ? `/api/v2/notes/${id}` : `/api/v2/files/${id}`;
        api.get(url)
            .then((r) => {
                const name = kind === 'note' ? (r.data?.note?.title || 'Untitled') : (r.data?.file?.name || r.data?.name || 'File');
                if (alive) setState({ status: 'ok', name });
            })
            .catch(() => alive && setState({ status: 'hidden', name: '' }));
        return () => { alive = false; };
    }, [kind, id]);

    if (!source) return null;
    const word = kind === 'note' ? 'note' : 'file';
    const Icon = kind === 'note' ? FileText : Paperclip;
    const ws = workspaceId || idOf(task.workspace);
    const path = kind === 'note' ? `/workspace/${ws}/notes/${id}` : `/workspace/${ws}/files/${id}`;
    const open = () => {
        window.history.pushState({}, '', path);
        window.dispatchEvent(new PopStateEvent('popstate'));
    };

    return (
        <div data-testid="task-source-row" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', minWidth: 0 }}>
            <Icon size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span style={{ flexShrink: 0 }}>From {word}:</span>
            {state.status === 'hidden' ? (
                <span style={{ fontStyle: 'italic' }}>you can’t open this {word}</span>
            ) : (
                <button type="button" onClick={open} disabled={state.status !== 'ok'}
                    style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)', fontWeight: 600, fontSize: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                    {state.status === 'ok' ? state.name : '…'}
                </button>
            )}
        </div>
    );
}
