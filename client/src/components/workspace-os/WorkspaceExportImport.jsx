import React, { useState, useRef } from 'react';
import api from '@services/api';
import { Download, Upload, FileJson, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { Btn, Grid } from '../ui/page';
import '../../pages/toolkit/toolkit.css';

/** Workspace settings → Data: download a structure bundle, or rebuild a workspace from one. */
export default function WorkspaceExportImport({ workspaceId, workspaceName, onImported }) {
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);
    const [exportError, setExportError] = useState(null);
    const [importError, setImportError] = useState(null);
    const [importSuccess, setImportSuccess] = useState(null);
    const fileRef = useRef();

    const handleExport = async () => {
        setExporting(true);
        setExportError(null);
        try {
            const res = await api.get(`/api/workspace-os/${workspaceId}/export`);
            const bundle = res.data.bundle;
            const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(workspaceName || 'workspace').replace(/\s+/g, '-').toLowerCase()}-export.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            setExportError(err.response?.data?.message || 'Could not export the workspace');
        } finally {
            setExporting(false);
        }
    };

    const handleImportFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        setImporting(true);
        setImportError(null);
        setImportSuccess(null);

        try {
            const text = await file.text();
            const bundle = JSON.parse(text);

            const res = await api.post('/api/workspace-os/import', { bundle });
            setImportSuccess(`Created “${res.data.workspace?.name}” from the file`);
            if (onImported) onImported(res.data.workspace);
        } catch (err) {
            if (err instanceof SyntaxError) {
                setImportError('That file isn’t valid JSON. Choose a file exported from Oruinwan.');
            } else {
                setImportError(err.response?.data?.message || 'Could not import the file');
            }
        } finally {
            setImporting(false);
        }
    };

    const card = (Icon, title, text, body) => (
        <div className="gl-card tk-card">
            <div className="tk-card-head">
                <span className="tk-mark"><Icon size={17} /></span>
                <div style={{ minWidth: 0 }}>
                    <h3 className="tk-card-title">{title}</h3>
                    <p className="tk-card-text" style={{ marginTop: 3 }}>{text}</p>
                </div>
            </div>
            {body}
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Grid min={240}>
                {card(Download, 'Export', `Download ${workspaceName ? `${workspaceName}’s` : 'this workspace’s'} structure, channels and settings as a JSON file.`, (
                    <>
                        {exportError && <div className="tk-notice" data-tone="danger" role="alert"><AlertTriangle size={14} />{exportError}</div>}
                        <div className="tk-card-foot">
                            <Btn icon={FileJson} loading={exporting} onClick={handleExport}>{exporting ? 'Exporting…' : 'Download JSON'}</Btn>
                        </div>
                    </>
                ))}
                {card(Upload, 'Import', 'Create a new workspace from a file you exported earlier.', (
                    <>
                        {importError && <div className="tk-notice" data-tone="danger" role="alert"><AlertTriangle size={14} />{importError}</div>}
                        {importSuccess && <div className="tk-notice" data-tone="success" role="status"><CheckCircle2 size={14} />{importSuccess}</div>}
                        <input ref={fileRef} type="file" accept=".json" hidden onChange={handleImportFile} />
                        <div className="tk-card-foot">
                            <Btn icon={Upload} loading={importing} onClick={() => fileRef.current?.click()}>{importing ? 'Importing…' : 'Choose a file'}</Btn>
                        </div>
                    </>
                ))}
            </Grid>
            <p className="cd-hint" style={{ margin: 0, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                Exports hold the workspace structure and channel definitions only, not messages, files or members.
            </p>
        </div>
    );
}
