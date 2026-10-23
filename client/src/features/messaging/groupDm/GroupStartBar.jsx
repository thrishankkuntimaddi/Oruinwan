import { useState } from 'react';
import { Users } from 'lucide-react';
import { createGroupDM, MAX_GROUP_MEMBERS } from './groupDmApi';
import { getErrorMessage } from '../../../utils/apiHelpers';

/**
 * Footer of the "New message" dialogs: shows who is picked for a group and starts it.
 * `selected` are people (objects with _id/id and username); the creator is added by the server.
 */
export default function GroupStartBar({ workspaceId, selected, onClear, onStarted }) {
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    if (!selected.length) return null;

    const ids = selected.map((u) => String(u._id || u.id));
    const tooMany = ids.length + 1 > MAX_GROUP_MEMBERS;
    const ready = ids.length >= 2 && !tooMany;

    const start = async () => {
        if (!ready || busy) return;
        setBusy(true);
        setError(null);
        try {
            const dm = await createGroupDM(workspaceId, ids, name);
            onStarted?.(dm);
        } catch (err) {
            setError(getErrorMessage(err));
            setBusy(false);
        }
    };

    return (
        <div data-testid="group-start-bar" style={{ borderTop: '1px solid var(--border-default)', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0, background: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <Users size={13} aria-hidden="true" />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selected.map((u) => u.name || u.username).join(', ')}
                </span>
                <button type="button" onClick={onClear} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px' }}>Clear</button>
            </div>
            {ids.length < 2 && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Pick one more person to start a group, or click a name to message them alone.</div>}
            {tooMany && <div style={{ fontSize: '11px', color: 'var(--state-danger)' }}>A group can have up to {MAX_GROUP_MEMBERS} people.</div>}
            {ready && (
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                        type="text"
                        value={name}
                        maxLength={80}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') start(); }}
                        placeholder="Group name (optional)"
                        aria-label="Group name"
                        style={{ flex: 1, minWidth: 0, padding: '7px 10px', background: 'var(--bg-input, var(--bg-hover))', border: '1px solid var(--border-default)', borderRadius: '2px', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}
                    />
                    <button
                        type="button"
                        onClick={start}
                        disabled={busy}
                        className="gl-btn gl-btn--primary"
                        style={{ padding: '7px 14px', fontSize: '12px', fontWeight: 600, cursor: busy ? 'default' : 'pointer', flexShrink: 0 }}
                    >
                        {busy ? 'Starting…' : `Start group (${ids.length + 1})`}
                    </button>
                </div>
            )}
            {error && <div role="alert" style={{ fontSize: '11px', color: 'var(--state-danger)' }}>{error}</div>}
        </div>
    );
}

/** The round tick on a person's row that adds them to a group. */
export function GroupPickToggle({ on, name, onToggle }) {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={on}
            aria-label={`Add ${name} to a group`}
            title={on ? 'Remove from group' : 'Add to a group'}
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            style={{
                width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border-default)'}`,
                background: on ? 'var(--accent)' : 'transparent', color: 'var(--bg-base)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, padding: 0,
            }}
        >
            {on ? '✓' : ''}
        </button>
    );
}
