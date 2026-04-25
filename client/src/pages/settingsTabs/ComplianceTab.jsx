import React, { useState, useEffect, useCallback } from 'react';
import { Download, Trash2, FileText, AlertCircle, Clock, ChevronLeft, ChevronRight, Loader2, Check, Lock } from 'lucide-react';
import Card from './Card';
import api from '@services/api';

const S = { font: { fontFamily: 'Inter, system-ui, -apple-system, sans-serif' } };
const fmtDate = (d) => d ? new Date(d).toLocaleString() : '—';

const Badge = ({ color, children }) => {
    const palette = {
        green: { color: 'var(--state-success)', bg: 'rgba(90,186,138,0.12)', border: 'rgba(90,186,138,0.3)' },
        red:   { color: 'var(--state-danger)',  bg: 'rgba(224,82,82,0.12)',  border: 'rgba(224,82,82,0.3)' },
        gray:  { color: 'var(--text-muted)',    bg: 'var(--bg-active)',      border: 'var(--border-default)' },
    };
    const p = palette[color] || palette.gray;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 2, fontSize: 11, fontWeight: 600,
            color: p.color, backgroundColor: p.bg, border: `1px solid ${p.border}`, ...S.font,
        }}>{children}</span>
    );
};

const ComplianceTab = ({ user }) => {
    const [logs, setLogs] = useState([]);
    const [logPage, setLogPage] = useState(1);
    const [logTotal, setLogTotal] = useState(0);
    const [logPages, setLogPages] = useState(1);
    const [logsLoading, setLogsLoading] = useState(false);
    const [legalHold, setLegalHold] = useState(false);
    const [legalHoldReason, setLegalHoldReason] = useState('');
    const [retentionDays, setRetentionDays] = useState('');
    const [retentionLoading, setRetentionLoading] = useState(false);
    const [retentionSaved, setRetentionSaved] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const flashError = (msg) => { setError(msg); setTimeout(() => setError(''), 4000); };
    const flashSuccess = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 4000); };

    const loadLogs = useCallback(async (page = 1) => {
        setLogsLoading(true);
        try {
            const { data } = await api.get(`/api/compliance/audit-logs?page=${page}&limit=10`);
            setLogs(data.logs || []); setLogTotal(data.total || 0);
            setLogPages(data.pages || 1); setLogPage(page);
        } catch { setLogs([]); } finally { setLogsLoading(false); }
    }, []);

    const loadLegalHold = useCallback(async () => {
        if (!user?._id) return;
        try {
            const { data } = await api.get(`/api/compliance/legal-hold/${user._id}`);
            setLegalHold(data.legalHold || false); setLegalHoldReason(data.reason || '');
        } catch { }
    }, [user]);

    const loadRetention = useCallback(async () => {
        try { const { data } = await api.get('/api/compliance/retention-policy'); setRetentionDays(data.retentionDays ?? ''); }
        catch { }
    }, []);

    useEffect(() => { loadLogs(1); loadLegalHold(); loadRetention(); }, [loadLogs, loadLegalHold, loadRetention]);

    const handleExport = async () => {
        setExportLoading(true);
        try {
            const res = await api.get('/api/compliance/export-user', { responseType: 'blob' });
            const url = URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a'); a.href = url; a.download = `chttrix-my-data-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url);
            flashSuccess('Data export downloaded successfully');
        } catch (err) { flashError(err.response?.data?.message || 'Export failed'); }
        finally { setExportLoading(false); }
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirm !== 'DELETE') { flashError('Type DELETE to confirm'); return; }
        setDeleteLoading(true);
        try { await api.delete('/api/compliance/delete-user'); window.location.href = '/login?deleted=true'; }
        catch (err) { flashError(err.response?.data?.message || 'Deletion failed'); }
        finally { setDeleteLoading(false); setShowDeleteModal(false); }
    };

    const handleSaveRetention = async () => {
        const days = retentionDays === '' ? null : parseInt(retentionDays);
        if (days !== null && (isNaN(days) || days < 1)) { flashError('Retention days must be a positive number'); return; }
        setRetentionLoading(true);
        try {
            await api.patch('/api/compliance/retention-policy', { retentionDays: days });
            setRetentionSaved(true); setTimeout(() => setRetentionSaved(false), 2000); flashSuccess('Retention policy saved');
        } catch (err) { flashError(err.response?.data?.message || 'Failed to save'); }
        finally { setRetentionLoading(false); }
    };

    const severityColor = (s) => s === 'critical' ? 'var(--state-danger)' : s === 'warning' ? 'var(--accent)' : 'var(--text-muted)';

    const inputBase = {
        padding: '8px 10px', backgroundColor: 'var(--bg-input)',
        border: '1px solid var(--border-default)', borderRadius: 2,
        fontSize: 13, color: 'var(--text-primary)', outline: 'none',
        boxSizing: 'border-box', transition: 'border-color 150ms ease', ...S.font,
    };

    const btnAccent = (disabled) => ({
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', fontSize: 13, fontWeight: 500,
        color: '#0c0c0c', backgroundColor: 'var(--accent)', border: 'none', borderRadius: 2,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
        transition: 'background-color 150ms ease', ...S.font,
    });

    const btnDanger = (disabled) => ({
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', fontSize: 13, fontWeight: 500,
        color: 'var(--state-danger)', backgroundColor: 'rgba(224,82,82,0.08)',
        border: '1px solid rgba(224,82,82,0.3)', borderRadius: 2,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
        transition: 'background-color 150ms ease', ...S.font,
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderRadius: 2, backgroundColor: 'rgba(224,82,82,0.08)', border: '1px solid rgba(224,82,82,0.3)', fontSize: 13, color: 'var(--state-danger)', ...S.font }}>
                    <AlertCircle size={14} />{error}
                </div>
            )}
            {success && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderRadius: 2, backgroundColor: 'rgba(90,186,138,0.08)', border: '1px solid rgba(90,186,138,0.3)', fontSize: 13, color: 'var(--state-success)', ...S.font }}>
                    <Check size={14} />{success}
                </div>
            )}

            {}
            <Card title="Export My Data" subtitle="GDPR Article 20 — Right to data portability">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
                    <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4, lineHeight: 1.6, ...S.font }}>
                            Download a complete JSON archive of your profile, tasks, notes, and activity history.
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', ...S.font }}>Your data will be delivered as a downloadable file.</p>
                    </div>
                    <button onClick={handleExport} disabled={exportLoading} style={btnAccent(exportLoading)}
                        onMouseEnter={e => { if (!exportLoading) e.currentTarget.style.backgroundColor = 'var(--accent-hover)'; }}
                        onMouseLeave={e => { if (!exportLoading) e.currentTarget.style.backgroundColor = 'var(--accent)'; }}>
                        {exportLoading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={13} />}
                        {exportLoading ? 'Preparing…' : 'Download'}
                    </button>
                </div>
            </Card>

            {}
            <Card title="Legal Hold" subtitle="Compliance status of this account">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, backgroundColor: 'var(--bg-active)', border: `1px solid ${legalHold ? 'rgba(224,82,82,0.3)' : 'var(--border-default)'}`, borderRadius: 2 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: legalHold ? 'rgba(224,82,82,0.12)' : 'var(--bg-hover)' }}>
                        <Lock size={15} style={{ color: legalHold ? 'var(--state-danger)' : 'var(--text-muted)' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', ...S.font }}>Status</span>
                            <Badge color={legalHold ? 'red' : 'green'}>{legalHold ? 'Under Legal Hold' : 'No Hold'}</Badge>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, ...S.font }}>
                            {legalHold ? (legalHoldReason || 'Contact your administrator.') : 'Your data can be exported or deleted freely.'}
                        </p>
                    </div>
                </div>
                {legalHold && (
                    <div style={{ marginTop: 12, padding: 12, borderRadius: 2, backgroundColor: 'rgba(184,149,106,0.08)', border: '1px solid rgba(184,149,106,0.25)', fontSize: 12, color: 'var(--accent)', ...S.font }}>
                        <AlertCircle size={12} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                        Data deletion is blocked until the hold is removed by an administrator.
                    </div>
                )}
            </Card>

            {}
            <Card title="Message Retention" subtitle="Automatically delete your sent messages after N days">
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, maxWidth: 360 }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 6, ...S.font }}>
                            Retention Period (days)
                        </label>
                        <input type="number" min="1" value={retentionDays} onChange={e => setRetentionDays(e.target.value)} placeholder="No retention policy"
                            style={{ ...inputBase, width: '100%' }}
                            onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border-default)'} />
                    </div>
                    <button onClick={handleSaveRetention} disabled={retentionLoading} style={{ ...btnAccent(retentionLoading), flexShrink: 0 }}
                        onMouseEnter={e => { if (!retentionLoading) e.currentTarget.style.backgroundColor = 'var(--accent-hover)'; }}
                        onMouseLeave={e => { if (!retentionLoading) e.currentTarget.style.backgroundColor = 'var(--accent)'; }}>
                        {retentionLoading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : retentionSaved ? <Check size={13} /> : <Clock size={13} />}
                        Save
                    </button>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, ...S.font }}>Leave empty to disable. Messages are deleted in nightly batches.</p>
            </Card>

            {}
            <Card title="Audit Log" subtitle="Your recent account activity">
                {logsLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
                        <Loader2 size={18} style={{ color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} />
                    </div>
                ) : logs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 0' }}>
                        <FileText size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 8px', opacity: 0.4 }} />
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, ...S.font }}>No activity recorded yet.</p>
                    </div>
                ) : (
                    <div>
                        {logs.map((log, i) => (
                            <div key={log._id || i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: i < logs.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: severityColor(log.severity), flexShrink: 0, marginTop: 5 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', ...S.font }}>{log.action}</span>
                                        <Badge color={log.status === 'success' ? 'green' : log.status === 'failure' ? 'red' : 'gray'}>{log.status}</Badge>
                                    </div>
                                    {(log.description || log.resource) && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...S.font }}>{log.description || log.resource}</p>}
                                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, ...S.font }}>{fmtDate(log.createdAt)}</p>
                                </div>
                                {log.ipAddress && <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, ...S.font }}>{log.ipAddress}</span>}
                            </div>
                        ))}
                        {logPages > 1 && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, marginTop: 4, borderTop: '1px solid var(--border-default)' }}>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)', ...S.font }}>Page {logPage} of {logPages} ({logTotal} events)</span>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    {[[ChevronLeft, logPage <= 1, () => loadLogs(logPage - 1)], [ChevronRight, logPage >= logPages, () => loadLogs(logPage + 1)]].map(([Icon, dis, fn], idx) => (
                                        <button key={idx} disabled={dis} onClick={fn} style={{ padding: 6, borderRadius: 2, background: 'none', border: '1px solid var(--border-default)', cursor: dis ? 'not-allowed' : 'pointer', color: dis ? 'var(--text-muted)' : 'var(--text-secondary)', opacity: dis ? 0.4 : 1, display: 'flex', alignItems: 'center' }}>
                                            <Icon size={14} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {}
            <Card title="Delete Account" subtitle="GDPR Article 17 — Right to erasure">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
                    <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4, lineHeight: 1.6, ...S.font }}>Permanently erase your account data. This is irreversible.</p>
                        {legalHold && <p style={{ fontSize: 12, color: 'var(--state-danger)', display: 'flex', alignItems: 'center', gap: 5, margin: 0, ...S.font }}><Lock size={11} /> Blocked — account is under legal hold.</p>}
                    </div>
                    <button onClick={() => setShowDeleteModal(true)} disabled={legalHold} style={btnDanger(legalHold)}
                        onMouseEnter={e => { if (!legalHold) e.currentTarget.style.backgroundColor = 'rgba(224,82,82,0.14)'; }}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(224,82,82,0.08)'}>
                        <Trash2 size={13} /> Delete Account
                    </button>
                </div>
            </Card>

            {}
            {showDeleteModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
                    <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid rgba(224,82,82,0.4)', borderRadius: 2, padding: 24, maxWidth: 400, width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(224,82,82,0.12)' }}>
                                <AlertCircle size={16} style={{ color: 'var(--state-danger)' }} />
                            </div>
                            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0, ...S.font }}>Confirm Account Deletion</h3>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6, ...S.font }}>
                            Your profile, messages, tasks, and all associated data will be anonymized in accordance with GDPR Article 17.
                        </p>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 6, ...S.font }}>
                                Type <span style={{ color: 'var(--state-danger)', fontFamily: 'monospace' }}>DELETE</span> to confirm
                            </label>
                            <input type="text" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="DELETE"
                                style={{ ...inputBase, width: '100%', fontFamily: 'monospace', letterSpacing: '0.05em', borderColor: deleteConfirm === 'DELETE' ? 'var(--state-danger)' : 'var(--border-default)' }} />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); }} style={{ flex: 1, padding: '8px 12px', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-default)', borderRadius: 2, cursor: 'pointer', ...S.font }}>Cancel</button>
                            <button onClick={handleDeleteAccount} disabled={deleteLoading || deleteConfirm !== 'DELETE'}
                                style={{ flex: 1, padding: '8px 12px', fontSize: 13, fontWeight: 500, color: '#fff', backgroundColor: 'var(--state-danger)', border: 'none', borderRadius: 2, cursor: deleteLoading || deleteConfirm !== 'DELETE' ? 'not-allowed' : 'pointer', opacity: deleteLoading || deleteConfirm !== 'DELETE' ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, ...S.font }}>
                                {deleteLoading && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
                                Delete My Account
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ComplianceTab;
