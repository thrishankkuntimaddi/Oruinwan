import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@services/api';
import WorkspaceExportImport from '../../workspace-os/WorkspaceExportImport';

/** Export/import a workspace bundle, or clone it. Admins only (the server checks too). */
export default function DataTab({ workspaceId, workspaceName }) {
    const navigate = useNavigate();
    const [name, setName] = useState(`${workspaceName || 'Workspace'} (copy)`);
    const [includeMembers, setIncludeMembers] = useState(false);
    const [status, setStatus] = useState(null);

    const clone = async () => {
        setStatus('cloning');
        try {
            const { data } = await api.post(`/api/workspace-os/${workspaceId}/clone`, { name: name.trim(), includeMembers });
            setStatus({ ok: `Created “${data.workspace.name}”.`, id: data.workspace.id });
        } catch (err) {
            setStatus({ error: err.response?.data?.message || 'Could not clone the workspace.' });
        }
    };

    const box = { padding: 14, background: 'var(--bg-active)', border: '1px solid var(--border-subtle)', borderRadius: 2 };
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <WorkspaceExportImport workspaceId={workspaceId} workspaceName={workspaceName} />
            <div style={box} data-testid="clone-workspace">
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Clone workspace</div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px' }}>Copies the channels (not their messages) into a new workspace you own.</p>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="New workspace name"
                    style={{ width: '100%', padding: '7px 10px', fontSize: 13, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 2, boxSizing: 'border-box' }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', margin: '8px 0' }}>
                    <input type="checkbox" checked={includeMembers} onChange={e => setIncludeMembers(e.target.checked)} /> Include current members
                </label>
                <button onClick={clone} disabled={!name.trim() || status === 'cloning'}
                    style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: '#0c0c0c', border: 'none', borderRadius: 2, cursor: 'pointer' }}>
                    {status === 'cloning' ? 'Cloning…' : 'Clone workspace'}
                </button>
                {status?.ok && (
                    <p style={{ fontSize: 12, color: 'var(--state-success)', marginTop: 8 }}>
                        {status.ok}{' '}
                        <button onClick={() => navigate(`/workspace/${status.id}/home`)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', fontSize: 12 }}>Open it</button>
                    </p>
                )}
                {status?.error && <p style={{ fontSize: 12, color: 'var(--state-danger)', marginTop: 8 }}>{status.error}</p>}
            </div>
        </div>
    );
}
