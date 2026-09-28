import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, History, PauseCircle, Trash2 } from 'lucide-react';
import api from '@services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
    Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, IconButton, Input, LoadingState, Notice, PageIntro, Row, SaveBar, Section, Select,
    errorMessage, useSettingsForm,
} from './settingsUi';
import './stg-ws.css';

/* ── Helpers ───────────────────────────────────────────────────────────── */

/** Error message from a request made with responseType 'blob' (the body is a Blob, not JSON). */
async function blobErrorMessage(err, fallback) {
    const data = err?.response?.data;
    if (data instanceof Blob) {
        try {
            const parsed = JSON.parse(await data.text());
            return parsed?.message || fallback;
        } catch {
            return fallback;
        }
    }
    return errorMessage(err, fallback);
}

const ACTION_LABELS = {
    'auth.login': 'Signed in',
    'user.login': 'Signed in',
    'auth.sso_login': 'Signed in with single sign-on',
    'auth.login_failed': 'Failed sign-in attempt',
    'user.login.failed': 'Failed sign-in attempt',
    'auth.logout': 'Signed out',
    'user.logout': 'Signed out',
    'auth.2fa_enabled': 'Turned on two-factor authentication',
    'auth.2fa_disabled': 'Turned off two-factor authentication',
    'auth.password_changed': 'Changed password',
    'user.password_changed': 'Changed password',
    'auth.password_reset': 'Reset password',
    'auth.email_changed': 'Changed email address',
    'auth.session_revoked': 'Signed out a device',
    'auth.account_deactivated': 'Deactivated account',
    'compliance.export_user': 'Downloaded your data',
    'compliance.delete_user': 'Asked to delete account',
    'compliance.export_workspace': 'Exported workspace data',
    'compliance.retention_policy_updated': 'Changed message retention',
    'compliance.legal_hold_set': 'Legal hold placed',
    'compliance.legal_hold_removed': 'Legal hold lifted',
    'security.backup_created': 'Created a backup',
    'task.create': 'Created a task',
    'task.complete': 'Completed a task',
    'workspace.exported': 'Exported a workspace',
    'workspace.imported': 'Imported a workspace',
    'workspace.cloned': 'Copied a workspace',
};

/** "workspace.member_role_changed" → "Workspace: member role changed". */
function actionLabel(action) {
    if (!action) return 'Account activity';
    if (ACTION_LABELS[action]) return ACTION_LABELS[action];
    const parts = String(action).split('.');
    const text = (s) => s.replace(/[_-]+/g, ' ').trim();
    const sentence = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
    if (parts.length === 1) return sentence(text(parts[0]));
    return `${sentence(text(parts[0]))}: ${parts.slice(1).map(text).join(' ')}`;
}

function relativeTime(date) {
    const d = new Date(date);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (Number.isNaN(diff)) return '';
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
    if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} d ago`;
    return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

const absoluteTime = (date) => new Date(date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const STATUS_TONE = { success: 'success', failure: 'danger' };

/* ── Download ──────────────────────────────────────────────────────────── */

function DownloadSection() {
    const { showToast } = useToast();
    const [busy, setBusy] = useState(false);

    const download = async () => {
        setBusy(true);
        try {
            const res = await api.get('/api/compliance/export-user', { responseType: 'blob' });
            const blob = res.data instanceof Blob ? res.data : new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `oruinwan-data-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            showToast('Your data is downloading', 'success');
        } catch (err) {
            showToast(await blobErrorMessage(err, 'Could not prepare your data. Please try again.'), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Section
            title="Download your data"
            description="Get a copy of your account data as a JSON file."
            action={<Button variant="primary" size="sm" icon={Download} loading={busy} onClick={download}>{busy ? 'Preparing…' : 'Download'}</Button>}
        >
            <div style={{ padding: '12px 0 16px' }}>
                <div className="stg-row-desc" style={{ marginTop: 0 }}>The file includes:</div>
                <ul className="stg-ws-bullets">
                    <li>Your profile and preferences</li>
                    <li>Workspace memberships</li>
                    <li>Tasks and notes</li>
                    <li>What Oruinwan AI remembers about you</li>
                    <li>Notification settings</li>
                    <li>Recent account activity</li>
                </ul>
                <div className="stg-row-desc">Messages are end-to-end encrypted, so they aren’t in this file.</div>
            </div>
        </Section>
    );
}

/* ── Activity ──────────────────────────────────────────────────────────── */

function ActivitySection() {
    const [page, setPage] = useState(1);
    const [state, setState] = useState({ loading: true, error: null, logs: [], pages: 1, total: 0 });

    const load = useCallback(async (p) => {
        setState((s) => ({ ...s, loading: true, error: null }));
        try {
            const { data } = await api.get('/api/compliance/audit-logs', { params: { page: p, limit: 10 } });
            setState({ loading: false, error: null, logs: data.logs || [], pages: Math.max(1, data.pages || 1), total: data.total || 0 });
        } catch (err) {
            setState((s) => ({ ...s, loading: false, error: errorMessage(err, 'Could not load your activity') }));
        }
    }, []);

    useEffect(() => { load(page); }, [load, page]);

    const { loading, error, logs, pages, total } = state;

    return (
        <Section title="Account activity" description="Sign-ins, security changes and data requests on your account.">
            {loading && !logs.length ? (
                <LoadingState label="Loading activity…" inline />
            ) : error ? (
                <ErrorState message={error} onRetry={() => load(page)} />
            ) : logs.length === 0 ? (
                <EmptyState icon={History}>No activity recorded yet.</EmptyState>
            ) : (
                <>
                    <ul className="stg-list" aria-busy={loading ? 'true' : undefined}>
                        {logs.map((log) => (
                            <li key={log._id} className="stg-list-item">
                                <div className="stg-ws-item-main">
                                    <div className="stg-ws-item-title">{actionLabel(log.action)}</div>
                                    <div className="stg-ws-item-meta">
                                        <time dateTime={log.createdAt} title={absoluteTime(log.createdAt)}>{relativeTime(log.createdAt)}</time>
                                        {log.ipAddress && <span>· IP <span className="stg-mono">{log.ipAddress}</span></span>}
                                    </div>
                                </div>
                                {log.status && log.status !== 'success' && (
                                    <Badge tone={STATUS_TONE[log.status]}>{log.status === 'failure' ? 'Failed' : 'Pending'}</Badge>
                                )}
                            </li>
                        ))}
                    </ul>
                    {pages > 1 && (
                        <div className="stg-ws-pager">
                            <span>Page {page} of {pages} · {total} events</span>
                            <div className="stg-ws-actions">
                                <IconButton label="Previous page" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}><ChevronLeft size={15} /></IconButton>
                                <IconButton label="Next page" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages || loading}><ChevronRight size={15} /></IconButton>
                            </div>
                        </div>
                    )}
                </>
            )}
        </Section>
    );
}

/* ── Retention ─────────────────────────────────────────────────────────── */

const PRESETS = ['30', '90', '180', '365'];

const toForm = (days) => {
    if (!days) return { preset: 'off', custom: '' };
    const s = String(days);
    return PRESETS.includes(s) ? { preset: s, custom: '' } : { preset: 'custom', custom: s };
};

const toDays = ({ preset, custom }) => {
    if (preset === 'off') return null;
    if (preset === 'custom') return Number(custom);
    return Number(preset);
};

const customError = (values) => {
    if (values.preset !== 'custom') return null;
    const n = Number(values.custom);
    if (!values.custom || !Number.isInteger(n) || n < 1 || n > 3650) return 'Enter a whole number of days from 1 to 3650.';
    return null;
};

function RetentionSection({ legalHold }) {
    const { showToast } = useToast();
    const form = useSettingsForm({
        initial: { preset: 'off', custom: '' },
        load: async () => toForm((await api.get('/api/compliance/retention-policy')).data?.retentionDays),
        save: async (values) => {
            const { data } = await api.patch('/api/compliance/retention-policy', { retentionDays: toDays(values) });
            return toForm(data?.retentionDays);
        },
        onSaved: () => showToast('Message retention saved', 'success'),
        onError: (msg) => showToast(msg, 'error'),
    });
    const invalid = customError(form.values);

    return (
        <>
            <Section
                title="Message retention"
                description="Automatically delete messages you sent once they are older than the period you choose. Runs every night."
            >
                {form.loading ? (
                    <LoadingState label="Loading…" inline />
                ) : form.loadError ? (
                    <ErrorState message={form.loadError} onRetry={form.reload} />
                ) : (
                <>
                        <Row label="Delete my messages after" htmlFor="stg-ws-retention" description="Only messages you sent. Other people’s messages aren’t affected." stack>
                            <Select id="stg-ws-retention" value={form.values.preset} onChange={(e) => form.set('preset', e.target.value)}>
                                <option value="off">Never (off)</option>
                                <option value="30">30 days</option>
                                <option value="90">90 days</option>
                                <option value="180">180 days</option>
                                <option value="365">1 year</option>
                                <option value="custom">Custom…</option>
                            </Select>
                        </Row>
                        {form.values.preset === 'custom' && (
                            <div style={{ padding: '4px 0 14px' }}>
                                <Field label="Number of days" id="stg-ws-retention-days" error={form.values.custom ? invalid : null} hint="From 1 to 3650 days.">
                                    <Input
                                        id="stg-ws-retention-days"
                                        className="stg-ws-custom"
                                        type="number"
                                        inputMode="numeric"
                                        min={1}
                                        max={3650}
                                        step={1}
                                        value={form.values.custom}
                                        invalid={!!(form.values.custom && invalid)}
                                        onChange={(e) => form.set('custom', e.target.value)}
                                    />
                                </Field>
                            </div>
                        )}
                        {legalHold && (
                            <div style={{ paddingBottom: 14 }}>
                                <Notice tone="warning">Paused while your account is under legal hold. Nothing is deleted until the hold is lifted.</Notice>
                            </div>
                        )}
                </>
                )}
            </Section>
            <SaveBar visible={form.dirty} saving={form.saving} onSave={form.save} onDiscard={form.discard} disabled={!!invalid} message="Unsaved retention change" />
        </>
    );
}

/* ── Tab ───────────────────────────────────────────────────────────────── */

/** Settings → Your data: download, activity, retention, and deactivate / delete account. */
export default function DataTab({ user }) {
    const { logout } = useAuth();
    const [hold, setHold] = useState(null); // { legalHold, reason }
    const [dialog, setDialog] = useState(null); // 'deactivate' | 'delete'
    const [busy, setBusy] = useState(false);
    const [dialogError, setDialogError] = useState(null);
    const [deleteBlocked, setDeleteBlocked] = useState(null);
    const userId = user?._id || user?.id;

    useEffect(() => {
        let alive = true;
        (async () => {
            let data = null;
            try {
                data = (await api.get('/api/compliance/legal-hold/me')).data;
            } catch {
                if (userId) {
                    try { data = (await api.get(`/api/compliance/legal-hold/${userId}`)).data; } catch { /* treat as no hold */ }
                }
            }
            if (alive && data) setHold({ legalHold: !!data.legalHold, reason: data.reason || null });
        })();
        return () => { alive = false; };
    }, [userId]);

    const underHold = !!hold?.legalHold;

    const closeDialog = () => { if (!busy) { setDialog(null); setDialogError(null); } };

    const signOutAndGo = async (to) => {
        try { await logout(); } catch { /* the account is already gone or signed out */ }
        window.location.href = to;
    };

    const deactivate = async () => {
        setBusy(true);
        setDialogError(null);
        try {
            await api.post('/api/auth/me/deactivate', {});
            await signOutAndGo('/login?deactivated=true');
        } catch (err) {
            setDialogError(errorMessage(err, 'Could not deactivate your account'));
            setBusy(false);
        }
    };

    const remove = async () => {
        setBusy(true);
        setDialogError(null);
        try {
            await api.delete('/api/compliance/delete-user');
            await signOutAndGo('/login?deleted=true');
        } catch (err) {
            const msg = errorMessage(err, 'Could not delete your account');
            if (err?.response?.status === 403) {
                setDeleteBlocked(err.response.data?.reason ? `${msg} ${err.response.data.reason}` : msg);
                setDialog(null);
            } else {
                setDialogError(msg);
            }
            setBusy(false);
        }
    };

    const deleteDisabledReason = underHold
        ? 'Your account is under legal hold, so it can’t be deleted right now.'
        : deleteBlocked;

    return (
        <>
            <PageIntro
                title="Your data"
                description="Download a copy of your data, see recent account activity, choose how long your messages are kept, or close your account."
            />

            {underHold && (
                <Notice tone="danger">
                    <strong>Your account is under legal hold.</strong> Your data must be kept, so message retention is paused and the account can’t be deleted.
                    {hold.reason ? ` Reason: ${hold.reason}` : ''}
                </Notice>
            )}

            <DownloadSection />
            <ActivitySection />
            <RetentionSection legalHold={underHold} />

            <Section title="Danger zone" tone="danger">
                <Row
                    label="Deactivate account"
                    description="Signs you out everywhere and hides your account. To come back, sign in and confirm the code we email you."
                    stack
                >
                    <Button variant="danger-soft" icon={PauseCircle} onClick={() => setDialog('deactivate')}>Deactivate</Button>
                </Row>
                <Row
                    label="Delete account"
                    description={deleteDisabledReason || 'Permanently erases your profile and sign-in. This can’t be undone.'}
                    stack
                >
                    <Button variant="danger" icon={Trash2} disabled={!!deleteDisabledReason} onClick={() => setDialog('delete')}>Delete account</Button>
                </Row>
            </Section>

            <ConfirmDialog
                open={dialog === 'deactivate'}
                title="Deactivate your account?"
                tone="danger"
                confirmLabel="Deactivate"
                loading={busy}
                onConfirm={deactivate}
                onCancel={closeDialog}
            >
                You’ll be signed out on every device. Your data stays as it is. To come back, sign in and confirm the code we email you.
                {dialogError && <div className="stg-error-text" role="alert" style={{ marginTop: 10 }}>{dialogError}</div>}
            </ConfirmDialog>

            <ConfirmDialog
                open={dialog === 'delete'}
                title="Delete your account?"
                tone="danger"
                confirmLabel="Delete account"
                confirmWord="DELETE"
                loading={busy}
                onConfirm={remove}
                onCancel={closeDialog}
            >
                <p style={{ margin: 0 }}>This can’t be undone. When you delete your account:</p>
                <ul className="stg-ws-bullets">
                    <li>Your profile, photo and sign-in details are erased.</li>
                    <li>Messages you sent stay in their conversations, shown as “[Deleted User]”.</li>
                    <li>What Oruinwan AI remembers about you is deleted.</li>
                </ul>
                <p style={{ margin: '8px 0 0' }}>Want a copy first? Use Download your data before you continue.</p>
                {dialogError && <div className="stg-error-text" role="alert" style={{ marginTop: 10 }}>{dialogError}</div>}
            </ConfirmDialog>
        </>
    );
}
