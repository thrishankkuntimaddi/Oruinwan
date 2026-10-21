import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, CloudUpload, HardDriveDownload, LogOut, RefreshCcw, UserRoundCog } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';
import {
    Badge, Button, ConfirmDialog, ErrorState, LoadingState, Notice, PageIntro, Row, Section, SwitchRow, errorMessage,
} from './settingsUi';
import {
    BACKUP_API, INCLUDED, NOT_INCLUDED, RESTORE_RULES, connectResultMessage, formatBytes, restoreRows, restoreSummary, statusSummary,
} from './backupInfo';

/**
 * Settings → Backup: an encrypted copy of your data in your own Google Drive (hidden app
 * folder, one file that each backup overwrites). Connect / change account, automatic on/off,
 * back up now, preview + restore, disconnect (optionally deleting the file). API: docs/api/backup.md.
 */

const when = (d) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—');

/** Which flow the server finishes with: the web page itself, or a "close this window" page for apps. */
function connectClient() {
    if (typeof window === 'undefined') return 'web';
    if (window.oruinwanDesktop || window.Capacitor?.isNativePlatform?.()) return 'desktop';
    return 'web';
}

function openGoogle(url) {
    if (window.oruinwanDesktop?.openExternal) {
        window.oruinwanDesktop.openExternal(url);
        return;
    }
    if (connectClient() === 'desktop') {
        window.open(url, '_blank', 'noopener');
        return;
    }
    window.location.assign(url);
}

export default function BackupTab() {
    const { showToast } = useToast();
    const [params, setParams] = useSearchParams();
    const [status, setStatus] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [busy, setBusy] = useState(null); // 'connect' | 'run' | 'auto' | 'disconnect' | 'restore'
    const [waiting, setWaiting] = useState(false); // Google opened in another window
    const [restore, setRestore] = useState(null); // null | { loading } | { plan } | { error }
    const [disconnectOpen, setDisconnectOpen] = useState(false);
    const [deleteFromDrive, setDeleteFromDrive] = useState(false);
    const pollRef = useRef(null);

    const load = useCallback(async () => {
        try {
            const { data } = await api.get(`${BACKUP_API}/status`);
            setStatus(data);
            setLoadError(null);
            return data;
        } catch (err) {
            setLoadError(errorMessage(err, 'Could not load your backup settings.'));
            return null;
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Back from Google (web): say how it went, once.
    useEffect(() => {
        const result = params.get('backup');
        const wantsRestore = params.get('restore') === '1';
        if (!result && !wantsRestore) return;
        if (result) {
            const [msg, tone] = connectResultMessage(result);
            showToast(msg, tone, 6000);
        }
        const next = new URLSearchParams(params);
        next.delete('backup');
        next.delete('restore');
        setParams(next, { replace: true });
        if (wantsRestore) openRestore();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // While Google is open in the browser (desktop/app): refresh until connected, and on focus.
    useEffect(() => {
        if (!waiting) return undefined;
        const started = Date.now();
        const tick = async () => {
            const s = await load();
            if (s?.connected && s.connectedAt && new Date(s.connectedAt).getTime() >= started - 60_000) {
                setWaiting(false);
                showToast(`Google Drive is connected (${s.googleEmail || 'Google account'}).`, 'success');
            } else if (Date.now() - started > 5 * 60_000) {
                setWaiting(false);
            }
        };
        pollRef.current = setInterval(tick, 3000);
        window.addEventListener('focus', tick);
        return () => { clearInterval(pollRef.current); window.removeEventListener('focus', tick); };
    }, [waiting, load, showToast]);

    // A running backup: refresh until it finishes.
    useEffect(() => {
        if (status?.status !== 'running') return undefined;
        const t = setTimeout(load, 4000);
        return () => clearTimeout(t);
    }, [status, load]);

    const connect = async () => {
        setBusy('connect');
        try {
            const { data } = await api.post(`${BACKUP_API}/google/connect`, { client: connectClient() });
            openGoogle(data.url);
            if (connectClient() !== 'web') setWaiting(true);
        } catch (err) {
            showToast(errorMessage(err, 'Could not start connecting Google Drive.'), 'error');
        } finally {
            setBusy(null);
        }
    };

    const runNow = async () => {
        setBusy('run');
        try {
            const { data } = await api.post(`${BACKUP_API}/run`);
            setStatus(data);
            showToast('Backed up to Google Drive', 'success');
        } catch (err) {
            showToast(errorMessage(err, 'The backup failed. Try again.'), 'error');
            load();
        } finally {
            setBusy(null);
        }
    };

    const setAuto = async (on) => {
        setBusy('auto');
        setStatus((s) => ({ ...s, autoBackup: on }));
        try {
            const { data } = await api.patch(`${BACKUP_API}/settings`, { autoBackup: on });
            setStatus(data);
        } catch (err) {
            setStatus((s) => ({ ...s, autoBackup: !on }));
            showToast(errorMessage(err, 'Could not save that.'), 'error');
        } finally {
            setBusy(null);
        }
    };

    async function openRestore() {
        setRestore({ loading: true });
        try {
            const { data } = await api.get(`${BACKUP_API}/restore/preview`);
            setRestore({ plan: data });
        } catch (err) {
            setRestore({ error: errorMessage(err, 'Could not read the backup from Google Drive.') });
        }
    }

    const applyRestore = async () => {
        setBusy('restore');
        try {
            const { data } = await api.post(`${BACKUP_API}/restore`, { confirm: true });
            setRestore(null);
            showToast(data.total ? `Restored ${data.total} item${data.total === 1 ? '' : 's'} from Google Drive` : 'Nothing needed restoring', 'success');
            load();
        } catch (err) {
            showToast(errorMessage(err, 'The restore failed. Nothing was changed.'), 'error');
        } finally {
            setBusy(null);
        }
    };

    const disconnect = async () => {
        setBusy('disconnect');
        try {
            const { data } = await api.post(`${BACKUP_API}/disconnect`, { deleteBackup: deleteFromDrive });
            setStatus(data);
            setDisconnectOpen(false);
            showToast(data.deleted ? 'Disconnected, and the backup was deleted from Google Drive' : 'Google Drive disconnected', 'success');
        } catch (err) {
            showToast(errorMessage(err, 'Could not disconnect.'), 'error');
        } finally {
            setBusy(null);
        }
    };

    const intro = (
        <PageIntro
            title="Backup"
            description="Keep an encrypted copy of your Oruinwan data in your own Google Drive. It lives in a hidden app folder, so it never clutters your Drive."
        />
    );

    if (!status && !loadError) return <>{intro}<LoadingState /></>;
    if (!status) return <>{intro}<ErrorState message={loadError} onRetry={load} /></>;

    if (!status.configured) {
        return (
            <>
                {intro}
                <Notice tone="info">
                    Backup isn&apos;t configured on this server. Ask whoever runs your Oruinwan server to set up Google Drive backup.
                </Notice>
            </>
        );
    }

    const summary = statusSummary(status);
    const plan = restore?.plan;

    return (
        <>
            {intro}

            {!status.connected ? (
                <Section title="Google Drive" description="Connect a Google account to start backing up. Oruinwan can only see its own backup file, nothing else in your Drive.">
                    <Row label="Not connected" description={waiting ? 'Finish connecting in your browser, then come back here.' : 'Your first backup starts as soon as you connect.'}>
                        <Button variant="primary" icon={CloudUpload} loading={busy === 'connect'} onClick={connect}>
                            {waiting ? 'Open Google again' : 'Connect Google Drive'}
                        </Button>
                    </Row>
                </Section>
            ) : (
                <>
                    <Section title="Google Drive" description={`Backed up to one encrypted file, ${status.fileName}, that each backup replaces.`}>
                        <Row label="Google account" description={status.googleEmail || 'Connected'}>
                            <Button icon={UserRoundCog} loading={busy === 'connect'} onClick={connect}>Change account</Button>
                        </Row>
                        <Row
                            label="Last backup"
                            description={status.lastBackupAt ? `${when(status.lastBackupAt)} · ${formatBytes(status.lastBackupSize)}` : 'Not yet'}
                        >
                            {status.status === 'ok' && <Badge tone="success"><Check size={11} /> Up to date</Badge>}
                            {status.status === 'running' && <Badge tone="accent">Backing up…</Badge>}
                            {(status.status === 'error' || status.status === 'reauth') && <Badge tone="danger">Needs attention</Badge>}
                        </Row>
                        <SwitchRow
                            label="Back up automatically"
                            description="Every day, and about an hour after you change notes, tasks, pages or meetings."
                            checked={status.autoBackup}
                            disabled={busy === 'auto'}
                            onChange={setAuto}
                        />
                        <Row label="Back up now" description="Replaces the backup in Google Drive with your data as it is now.">
                            <Button variant="primary" icon={RefreshCcw} loading={busy === 'run' || status.status === 'running'} onClick={runNow}>Back up now</Button>
                        </Row>
                        <Row label="Restore from Google Drive" description="See what would come back before anything changes.">
                            <Button icon={HardDriveDownload} loading={restore?.loading} onClick={openRestore}>Restore…</Button>
                        </Row>
                    </Section>
                    {summary && (
                        <div style={{ marginTop: 12 }}>
                            <Notice tone={summary.tone}>{summary.text}</Notice>
                        </div>
                    )}
                    {status.status === 'reauth' && (
                        <div style={{ marginTop: 8 }}>
                            <Button variant="primary" icon={CloudUpload} loading={busy === 'connect'} onClick={connect}>Connect Google Drive again</Button>
                        </div>
                    )}
                </>
            )}

            <Section title="What's in the backup" description={RESTORE_RULES}>
                <ul className="stg-list" style={{ padding: '0 16px' }}>
                    {INCLUDED.map(([label, detail]) => (
                        <li key={label} className="stg-list-item">
                            <div>
                                <div className="stg-row-label">{label}</div>
                                <div className="stg-row-desc">{detail}</div>
                            </div>
                        </li>
                    ))}
                    <li className="stg-list-item">
                        <div>
                            <div className="stg-row-label">Not included</div>
                            <div className="stg-row-desc">{NOT_INCLUDED}</div>
                        </div>
                    </li>
                </ul>
            </Section>

            {status.connected && (
                <Section title="Disconnect" tone="danger">
                    <Row label="Stop backing up to this Google account" description="Oruinwan's access to your Drive is revoked. You can keep the backup there or delete it.">
                        <Button variant="danger-soft" icon={LogOut} onClick={() => { setDeleteFromDrive(false); setDisconnectOpen(true); }}>Disconnect</Button>
                    </Row>
                </Section>
            )}

            <ConfirmDialog
                open={disconnectOpen}
                title="Disconnect Google Drive?"
                confirmLabel={deleteFromDrive ? 'Disconnect and delete' : 'Disconnect'}
                tone="danger"
                loading={busy === 'disconnect'}
                onConfirm={disconnect}
                onCancel={() => setDisconnectOpen(false)}
            >
                <p>Automatic backups stop and Oruinwan loses access to {status.googleEmail || 'this Google account'}.</p>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
                    <input type="checkbox" checked={deleteFromDrive} onChange={(e) => setDeleteFromDrive(e.target.checked)} />
                    Also delete the backup from Google Drive
                </label>
            </ConfirmDialog>

            <ConfirmDialog
                open={Boolean(restore) && !restore.loading}
                title="Restore from Google Drive"
                confirmLabel={plan?.total ? `Restore ${plan.total} item${plan.total === 1 ? '' : 's'}` : 'Nothing to restore'}
                confirmDisabled={!plan?.total}
                loading={busy === 'restore'}
                onConfirm={applyRestore}
                onCancel={() => setRestore(null)}
                size="lg"
            >
                {restore?.error ? (
                    <Notice tone="danger">{restore.error}</Notice>
                ) : plan ? (
                    <>
                        <p>
                            Backup from <strong>{when(plan.backup?.createdAt)}</strong> · {formatBytes(plan.backup?.size)}. {restoreSummary(plan)}
                        </p>
                        <ul className="stg-list" aria-label="What will be restored">
                            {restoreRows(plan).map((r) => (
                                <li key={r.key} className="stg-list-item" style={{ justifyContent: 'space-between' }}>
                                    <span>{r.label}</span>
                                    <span className="stg-row-desc">
                                        {r.restore ? <Badge tone="accent">{r.restore} to restore</Badge> : null}
                                        {' '}{r.present ? `${r.present} already here` : ''}
                                        {r.skipped ? `${r.present ? ' · ' : ''}${r.skipped} not restored` : ''}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <p className="stg-row-desc" style={{ marginTop: 12 }}>{RESTORE_RULES}</p>
                    </>
                ) : null}
            </ConfirmDialog>
        </>
    );
}
