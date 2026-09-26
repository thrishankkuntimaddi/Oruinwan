import React, { useEffect, useState } from 'react';
import api from '@services/api';

const FEATURES = [
    { key: 'tasks', label: 'Tasks', desc: 'Create and assign tasks' },
    { key: 'notes', label: 'Notes', desc: 'Collaborative notes' },
    { key: 'polls', label: 'Polls', desc: 'Polls in channels and DMs' },
    { key: 'huddles', label: 'Huddles', desc: 'Voice and video calls' },
    { key: 'fileUploads', label: 'File uploads', desc: 'Photos, files, voice notes and recordings' },
    { key: 'reactions', label: 'Reactions', desc: 'Emoji reactions on messages' },
    { key: 'threads', label: 'Threads', desc: 'Replies in threads' },
    { key: 'bookmarks', label: 'Bookmarks', desc: 'Save messages for later' },
    { key: 'reminders', label: 'Reminders', desc: '"Remind me" on messages' },
    { key: 'ai', label: 'Chttrix AI', desc: 'Assistant, summaries, smart replies, translation' },
];

/** Workspace owners/admins switch features on or off for everyone in the workspace. */
export default function FeaturesTab({ workspaceId, isAdmin }) {
    const [toggles, setToggles] = useState(null);
    const [savingKey, setSavingKey] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!workspaceId) return;
        api.get(`/api/workspaces/${workspaceId}/features`)
            .then(({ data }) => setToggles(data.featureToggles || {}))
            .catch(() => setError('Could not load feature settings.'));
    }, [workspaceId]);

    const toggle = async (key) => {
        if (!isAdmin || !toggles) return;
        const next = { ...toggles, [key]: toggles[key] === false };
        setToggles(next);
        setSavingKey(key);
        setError(null);
        try {
            await api.put(`/api/workspaces/${workspaceId}/features`, { featureToggles: next });
        } catch (err) {
            setToggles(toggles);
            setError(err.response?.data?.message || 'Could not save.');
        } finally {
            setSavingKey(null);
        }
    };

    if (!toggles) return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{error || 'Loading…'}</p>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px' }}>
                Turned-off features disappear for everyone in this workspace and are refused by the server.
            </p>
            {FEATURES.map(f => {
                const on = toggles[f.key] !== false;
                return (
                    <label key={f.key} data-testid={`feature-${f.key}`}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)', borderRadius: 2, cursor: isAdmin ? 'pointer' : 'default' }}>
                        <span>
                            <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{f.label}</span>
                            <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>{f.desc}</span>
                        </span>
                        <input type="checkbox" checked={on} disabled={!isAdmin || savingKey === f.key} onChange={() => toggle(f.key)} />
                    </label>
                );
            })}
            {error && <p style={{ fontSize: 12, color: 'var(--state-danger)' }}>{error}</p>}
        </div>
    );
}
