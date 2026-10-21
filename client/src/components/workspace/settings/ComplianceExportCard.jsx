import React, { useState } from 'react';
import { ShieldCheck, Download, AlertTriangle, CheckCircle2 } from 'lucide-react';
import api from '@services/api';
import { Btn } from '../../ui/page';
import '../../../pages/toolkit/toolkit.css';

/** The server's message from a failed blob download (it arrives as a Blob too). */
async function blobError(err, fallback) {
    const data = err?.response?.data;
    if (typeof Blob !== 'undefined' && data instanceof Blob) {
        try { return JSON.parse(await data.text())?.message || fallback; } catch { return fallback; }
    }
    return data?.message || fallback;
}

export const complianceFileName = (workspaceName, now = new Date()) =>
    `${(workspaceName || 'workspace').trim().replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'workspace'}-compliance-${now.toISOString().slice(0, 10)}.json`;

/**
 * Workspace admin → Data: the compliance export (GET /api/compliance/export?workspaceId=),
 * members with roles, channels, tasks and workspace notes as JSON. Admins only (the server
 * checks); the download is recorded in the audit log.
 */
export default function ComplianceExportCard({ workspaceId, workspaceName }) {
    const [status, setStatus] = useState({ state: 'idle', message: '' }); // idle | busy | done | error

    const download = async () => {
        setStatus({ state: 'busy', message: '' });
        try {
            const res = await api.get('/api/compliance/export', { params: { workspaceId }, responseType: 'blob' });
            const blob = res.data instanceof Blob ? res.data : new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = complianceFileName(workspaceName);
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setStatus({ state: 'done', message: 'Export downloaded. It is recorded in the audit log.' });
        } catch (err) {
            const fallback = err?.response?.status === 403
                ? 'Only workspace owners and admins can export workspace data.'
                : 'Could not prepare the export. Please try again.';
            setStatus({ state: 'error', message: await blobError(err, fallback) });
        }
    };

    return (
        <div className="gl-card tk-card" data-testid="compliance-export">
            <div className="tk-card-head">
                <span className="tk-mark"><ShieldCheck size={17} /></span>
                <div style={{ minWidth: 0 }}>
                    <h3 className="tk-card-title">Compliance export</h3>
                    <p className="tk-card-text" style={{ marginTop: 3 }}>
                        Everything an audit or legal request needs from this workspace: members and their roles, channels,
                        tasks and workspace notes, as one JSON file. Messages are end-to-end encrypted, so they are not included.
                    </p>
                </div>
            </div>
            {status.state === 'error' && <div className="tk-notice" data-tone="danger" role="alert"><AlertTriangle size={14} />{status.message}</div>}
            {status.state === 'done' && <div className="tk-notice" data-tone="success" role="status"><CheckCircle2 size={14} />{status.message}</div>}
            <div className="tk-card-foot">
                <Btn icon={Download} loading={status.state === 'busy'} onClick={download} disabled={!workspaceId || status.state === 'busy'}>
                    {status.state === 'busy' ? 'Preparing…' : 'Download compliance export'}
                </Btn>
            </div>
        </div>
    );
}
