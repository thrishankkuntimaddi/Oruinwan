// client/src/components/workspace-os/WorkspaceExportImport.jsx
// Export a workspace as JSON and import from JSON file.
import React, { useState, useRef } from 'react';
import api from '../../services/api';
import { Download, Upload, FileJson, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

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
            setExportError(err.response?.data?.message || 'Export failed');
        } finally {
            setExporting(false);
        }
    };

    const handleImportFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = ''; // Reset so same file can be re-selected

        setImporting(true);
        setImportError(null);
        setImportSuccess(null);

        try {
            const text = await file.text();
            const bundle = JSON.parse(text);

            const res = await api.post('/api/workspace-os/import', { bundle });
            setImportSuccess(`"${res.data.workspace?.name}" imported successfully`);
            if (onImported) onImported(res.data.workspace);
        } catch (err) {
            if (err instanceof SyntaxError) {
                setImportError('Invalid JSON file — please upload a valid workspace export bundle');
            } else {
                setImportError(err.response?.data?.message || 'Import failed');
            }
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Export Card */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                    <div className="flex items-start gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                            <Download size={18} className="text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Export Workspace</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Download a JSON bundle of this workspace's structure, channels, and settings</p>
                        </div>
                    </div>
                    {exportError && (
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm mb-3">
                            <AlertTriangle size={13} /> {exportError}
                        </div>
                    )}
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors"
                    >
                        {exporting ? <RefreshCw size={14} className="animate-spin" /> : <FileJson size={14} />}
                        {exporting ? 'Exporting…' : 'Export as JSON'}
                    </button>
                </div>

                {/* Import Card */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                    <div className="flex items-start gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                            <Upload size={18} className="text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Import Workspace</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Reconstruct a workspace from a previously exported JSON bundle</p>
                        </div>
                    </div>
                    {importError && (
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm mb-3">
                            <AlertTriangle size={13} /> {importError}
                        </div>
                    )}
                    {importSuccess && (
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm mb-3">
                            <CheckCircle2 size={13} /> {importSuccess}
                        </div>
                    )}
                    <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
                    <button
                        onClick={() => fileRef.current?.click()}
                        disabled={importing}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors"
                    >
                        {importing ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                        {importing ? 'Importing…' : 'Choose JSON File'}
                    </button>
                </div>
            </div>

            <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                Note: Exports include workspace structure and channel definitions only — not messages, files, or member data.
            </p>
        </div>
    );
}
