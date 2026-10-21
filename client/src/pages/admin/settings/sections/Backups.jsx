import React, { useId, useRef, useState } from 'react';
import { Archive, Download, Upload, ShieldCheck, RotateCcw, FileCheck2, AlertTriangle } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../../../contexts/ToastContext';
import { Panel, Grid, Btn, Chip, Field, Dialog, errorMessage } from '../../../../components/company-dash/dashUi';
import '../../../OwnerDashboard/owner.css';

/** Workspace collections a backup can restore (identity, audit logs and messages never are). */
export const RESTORABLE = [
    { key: 'channels', label: 'Channels' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'notes', label: 'Notes' },
    { key: 'knowledgePages', label: 'Knowledge pages' },
    { key: 'knowledgeCategories', label: 'Knowledge categories' },
    { key: 'files', label: 'File records' },
];

const VERIFY_ERRORS = {
    invalid_backup: 'This file is not a readable Oruinwan backup, or it was encrypted with another server key.',
    checksum_mismatch: 'The backup was changed or damaged after it was made (checksum mismatch).',
    unsupported_format: 'This backup format is not supported by this server.',
    wrong_company: 'This backup belongs to another company.',
};

/** What we save to disk: the server's answer as one JSON file. */
export function backupFileContent(res) {
    return JSON.stringify({ meta: res.meta, encryptedPayload: res.encryptedPayload }, null, 2);
}

export function backupFileName(meta, now = new Date()) {
    const d = new Date(meta?.createdAt || now);
    const stamp = Number.isNaN(d.getTime()) ? 'backup' : d.toISOString().slice(0, 16).replace(/[:T]/g, '-');
    return `oruinwan-backup-${stamp}.json`;
}

/** Parse a backup file the admin picked: { encryptedPayload, checksum, meta } or throws a readable Error. */
export function parseBackupFile(text) {
    let obj;
    try { obj = JSON.parse(text); } catch { throw new Error('That file is not JSON. Pick the .json file saved from “Create backup”.'); }
    const encryptedPayload = obj?.encryptedPayload;
    if (typeof encryptedPayload !== 'string' || !encryptedPayload) throw new Error('That file has no encrypted backup in it.');
    return { encryptedPayload, checksum: obj?.meta?.checksum || obj?.checksum || undefined, meta: obj?.meta || null };
}

/** Sum the per-collection dry-run numbers. */
export function restoreTotals(collections) {
    return Object.values(collections || {}).reduce((t, c) => ({
        inBackup: t.inBackup + (c?.inBackup || 0),
        toRestore: t.toRestore + (c?.toRestore || 0),
        restored: t.restored + (c?.restored || 0),
    }), { inBackup: 0, toRestore: 0, restored: 0 });
}

function verifyErrorText(err) {
    const code = err?.response?.data?.code;
    if (err?.response?.status === 503) return 'Backups are not available: the server has no encryption key (SERVER_KEK) configured.';
    return VERIFY_ERRORS[code] || errorMessage(err, 'Could not verify this backup');
}

function download(name, text) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function RecordCounts({ counts }) {
    const entries = Object.entries(counts || {});
    if (!entries.length) return null;
    return (
        <div className="od-kv">
            {entries.map(([k, v]) => (
                <div key={k} className="od-kv-row"><span>{k}</span><span className="od-mono">{v}</span></div>
            ))}
        </div>
    );
}

/**
 * Encrypted company backups (owner/admin): create and download, verify a saved file,
 * and restore missing workspace data — always a dry run first, then a confirmed restore.
 * Uses POST /api/security/backup, /backup/verify and /backup/restore.
 */
export default function Backups() {
    const { showToast } = useToast();
    const uid = useId();
    const fileRef = useRef(null);
    const [creating, setCreating] = useState(false);
    const [lastMeta, setLastMeta] = useState(null);
    const [loaded, setLoaded] = useState(null); // { name, encryptedPayload, checksum, meta }
    const [verify, setVerify] = useState(null); // { ok, result | message }
    const [busy, setBusy] = useState('');
    const [selected, setSelected] = useState(() => RESTORABLE.map(c => c.key));
    const [plan, setPlan] = useState(null); // dry-run response
    const [result, setResult] = useState(null); // real restore response
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmText, setConfirmText] = useState('');

    const create = async () => {
        setCreating(true);
        try {
            const { data } = await api.post('/api/security/backup', {});
            download(backupFileName(data.meta), backupFileContent(data));
            setLastMeta(data.meta);
            showToast('Encrypted backup created and downloaded', 'success');
        } catch (err) {
            showToast(err?.response?.status === 503 ? 'Backups are not available: the server has no encryption key configured.' : errorMessage(err, 'Could not create a backup'), 'error');
        } finally { setCreating(false); }
    };

    const pick = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setVerify(null); setPlan(null); setResult(null);
        try {
            const parsed = parseBackupFile(await file.text());
            setLoaded({ name: file.name, ...parsed });
            await runVerify(parsed);
        } catch (err) {
            setLoaded(null);
            setVerify({ ok: false, message: err.message });
        }
    };

    const runVerify = async (b = loaded) => {
        if (!b) return;
        setBusy('verify');
        try {
            const { data } = await api.post('/api/security/backup/verify', { encryptedPayload: b.encryptedPayload, checksum: b.checksum });
            setVerify({ ok: !!data.valid, result: data, message: data.valid ? null : data.message });
        } catch (err) {
            setVerify({ ok: false, message: verifyErrorText(err) });
        } finally { setBusy(''); }
    };

    const dryRun = async () => {
        if (!loaded || !selected.length) return;
        setBusy('dry'); setResult(null);
        try {
            const { data } = await api.post('/api/security/backup/restore', {
                encryptedPayload: loaded.encryptedPayload, checksum: loaded.checksum, collections: selected, dryRun: true,
            });
            setPlan(data);
        } catch (err) {
            showToast(verifyErrorText(err), 'error');
        } finally { setBusy(''); }
    };

    const restore = async () => {
        if (!loaded || confirmText !== 'RESTORE') return;
        setBusy('restore');
        try {
            const { data } = await api.post('/api/security/backup/restore', {
                encryptedPayload: loaded.encryptedPayload, checksum: loaded.checksum, collections: selected, dryRun: false, confirm: 'RESTORE',
            });
            setResult(data);
            setPlan(null);
            setConfirmOpen(false);
            setConfirmText('');
            showToast(`Restored ${restoreTotals(data.collections).restored} records`, 'success');
        } catch (err) {
            showToast(verifyErrorText(err), 'error');
        } finally { setBusy(''); }
    };

    const toggle = (key) => { setSelected(s => (s.includes(key) ? s.filter(k => k !== key) : [...s, key])); setPlan(null); };
    const report = result || plan;
    const totals = restoreTotals(report?.collections);

    return (
        <Grid cols="2">
            <Panel title="Create a backup" icon={Archive}>
                <div className="od-form">
                    <p className="cd-muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55 }}>
                        An AES-256 encrypted snapshot of your company: people, workspaces, departments, teams, audit logs, and workspace
                        channels, tasks, notes, knowledge and file records. <strong>Chat messages are never included</strong> — they are
                        end-to-end encrypted and the server cannot read them. Keep the downloaded file somewhere safe.
                    </p>
                    <Btn variant="primary" icon={Download} loading={creating} onClick={create} style={{ alignSelf: 'flex-start' }}>Create backup</Btn>
                    {lastMeta && (
                        <>
                            <span className="cd-hint">Created {new Date(lastMeta.createdAt).toLocaleString()} · checksum <code className="od-mono">{String(lastMeta.checksum || '').slice(0, 16)}…</code></span>
                            <RecordCounts counts={lastMeta.recordCount} />
                        </>
                    )}
                </div>
            </Panel>

            <Panel title="Verify & restore" icon={RotateCcw}
                action={verify ? <Chip tone={verify.ok ? 'success' : 'danger'}>{verify.ok ? 'Valid' : 'Invalid'}</Chip> : null}>
                <div className="od-form">
                    <input ref={fileRef} id={`${uid}-file`} type="file" accept="application/json,.json" onChange={pick} hidden />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Btn icon={Upload} onClick={() => fileRef.current?.click()}>{loaded ? 'Choose another file' : 'Choose backup file'}</Btn>
                        {loaded && <Btn variant="ghost" icon={ShieldCheck} loading={busy === 'verify'} onClick={() => runVerify()}>Verify again</Btn>}
                    </div>
                    {loaded && <span className="cd-hint">{loaded.name}</span>}

                    {verify && !verify.ok && (
                        <div role="alert" className="cd-muted" style={{ display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--state-danger)' }}>
                            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} /> {verify.message}
                        </div>
                    )}
                    {verify?.ok && verify.result && (
                        <>
                            <div className="od-kv">
                                <div className="od-kv-row"><span>Backed up</span><span>{new Date(verify.result.backedUpAt).toLocaleString()}</span></div>
                                <div className="od-kv-row"><span>Format</span><span className="od-mono">{verify.result.format}</span></div>
                            </div>
                            <RecordCounts counts={verify.result.recordCount} />

                            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                                <legend className="cd-label" style={{ marginBottom: 6 }}>Restore these (only records that no longer exist are re-created)</legend>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
                                    {RESTORABLE.map(c => (
                                        <label key={c.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                                            <input type="checkbox" checked={selected.includes(c.key)} onChange={() => toggle(c.key)} /> {c.label}
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <Btn icon={FileCheck2} loading={busy === 'dry'} disabled={!selected.length} onClick={dryRun}>Dry run</Btn>
                                <Btn variant="danger" icon={RotateCcw} disabled={!plan || totals.toRestore === 0} onClick={() => setConfirmOpen(true)}>Restore…</Btn>
                            </div>
                        </>
                    )}

                    {report && (
                        <div aria-live="polite">
                            <p className="cd-label" style={{ margin: '4px 0 6px' }}>
                                {result ? `Restored ${totals.restored} records` : `Dry run: ${totals.toRestore} of ${totals.inBackup} records would be re-created`}
                            </p>
                            <div className="od-kv">
                                {Object.entries(report.collections || {}).map(([k, c]) => (
                                    <div key={k} className="od-kv-row">
                                        <span>{RESTORABLE.find(r => r.key === k)?.label || k}</span>
                                        <span className="od-mono">
                                            {result ? `${c.restored} restored` : `${c.toRestore} to restore`} · {c.existing} exist
                                            {(c.skipped?.workspaceMissing || c.skipped?.foreignWorkspace) ? ` · ${(c.skipped.workspaceMissing || 0) + (c.skipped.foreignWorkspace || 0)} skipped` : ''}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            {Array.isArray(report.notRestored) && report.notRestored.length > 0 && (
                                <p className="cd-hint" style={{ marginTop: 6 }}>Never restored: {report.notRestored.join('; ')}.</p>
                            )}
                        </div>
                    )}
                </div>
            </Panel>

            <Dialog
                open={confirmOpen}
                title="Restore from backup?"
                lead={`${totals.toRestore} missing records will be re-created. Live data is never overwritten.`}
                size="sm"
                busy={busy === 'restore'}
                onClose={() => { setConfirmOpen(false); setConfirmText(''); }}
                footer={(
                    <>
                        <Btn variant="ghost" onClick={() => { setConfirmOpen(false); setConfirmText(''); }} disabled={busy === 'restore'}>Cancel</Btn>
                        <Btn variant="danger" loading={busy === 'restore'} disabled={confirmText !== 'RESTORE'} onClick={restore}>Restore</Btn>
                    </>
                )}
            >
                <Field label="Type RESTORE to confirm" htmlFor={`${uid}-confirm`}>
                    <input id={`${uid}-confirm`} className="gl-input od-mono" value={confirmText} onChange={e => setConfirmText(e.target.value)} autoComplete="off" />
                </Field>
            </Dialog>
        </Grid>
    );
}
