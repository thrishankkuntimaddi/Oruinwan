// client/src/pages/settingsTabs/ComplianceTab.jsx
// GDPR & Compliance settings panel: data export, account deletion, audit logs,
// legal hold status, and message retention policy.

import React, { useState, useEffect, useCallback } from 'react';
import {
    Download, Trash2, FileText, Shield, AlertCircle, Clock,
    ChevronLeft, ChevronRight, Loader, Check, Lock
} from 'lucide-react';
import Card from './Card';
import api from '../../services/api';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d).toLocaleString() : '—';

const Badge = ({ color, children }) => {
    const styles = {
        green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-700',
        red: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-700',
        gray: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700',
        amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700',
    };
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${styles[color] || styles.gray}`}>
            {children}
        </span>
    );
};

// ── ComplianceTab ─────────────────────────────────────────────────────────────
const ComplianceTab = ({ user }) => {
    // Audit logs
    const [logs, setLogs] = useState([]);
    const [logPage, setLogPage] = useState(1);
    const [logTotal, setLogTotal] = useState(0);
    const [logPages, setLogPages] = useState(1);
    const [logsLoading, setLogsLoading] = useState(false);

    // Legal hold
    const [legalHold, setLegalHold] = useState(false);
    const [legalHoldReason, setLegalHoldReason] = useState('');

    // Retention policy
    const [retentionDays, setRetentionDays] = useState('');
    const [retentionLoading, setRetentionLoading] = useState(false);
    const [retentionSaved, setRetentionSaved] = useState(false);

    // Delete account modal
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Export
    const [exportLoading, setExportLoading] = useState(false);

    // Error / success
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const flashError = (msg) => { setError(msg); setTimeout(() => setError(''), 4000); };
    const flashSuccess = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 4000); };

    // ── Load audit logs ───────────────────────────────────────────────────────
    const loadLogs = useCallback(async (page = 1) => {
        setLogsLoading(true);
        try {
            const { data } = await api.get(`/api/compliance/audit-logs?page=${page}&limit=10`);
            setLogs(data.logs || []);
            setLogTotal(data.total || 0);
            setLogPages(data.pages || 1);
            setLogPage(page);
        } catch {
            setLogs([]);
        } finally {
            setLogsLoading(false);
        }
    }, []);

    // ── Load legal hold status ────────────────────────────────────────────────
    const loadLegalHold = useCallback(async () => {
        if (!user?._id) return;
        try {
            const { data } = await api.get(`/api/compliance/legal-hold/${user._id}`);
            setLegalHold(data.legalHold || false);
            setLegalHoldReason(data.reason || '');
        } catch { /* non-critical */ }
    }, [user]);

    // ── Load retention policy ─────────────────────────────────────────────────
    const loadRetention = useCallback(async () => {
        try {
            const { data } = await api.get('/api/compliance/retention-policy');
            setRetentionDays(data.retentionDays ?? '');
        } catch { /* non-critical */ }
    }, []);

    useEffect(() => {
        loadLogs(1);
        loadLegalHold();
        loadRetention();
    }, [loadLogs, loadLegalHold, loadRetention]);

    // ── Export personal data ──────────────────────────────────────────────────
    const handleExport = async () => {
        setExportLoading(true);
        try {
            const res = await api.get('/api/compliance/export-user', { responseType: 'blob' });
            const url = URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `chttrix-my-data-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            flashSuccess('Data export downloaded successfully');
        } catch (err) {
            flashError(err.response?.data?.message || 'Export failed');
        } finally {
            setExportLoading(false);
        }
    };

    // ── Delete account ────────────────────────────────────────────────────────
    const handleDeleteAccount = async () => {
        if (deleteConfirm !== 'DELETE') {
            flashError('Type DELETE to confirm');
            return;
        }
        setDeleteLoading(true);
        try {
            await api.delete('/api/compliance/delete-user');
            // Force logout after deletion
            window.location.href = '/login?deleted=true';
        } catch (err) {
            flashError(err.response?.data?.message || 'Deletion failed');
        } finally {
            setDeleteLoading(false);
            setShowDeleteModal(false);
        }
    };

    // ── Save retention policy ─────────────────────────────────────────────────
    const handleSaveRetention = async () => {
        const days = retentionDays === '' ? null : parseInt(retentionDays);
        if (days !== null && (isNaN(days) || days < 1)) {
            flashError('Retention days must be a positive number');
            return;
        }
        setRetentionLoading(true);
        try {
            await api.patch('/api/compliance/retention-policy', { retentionDays: days });
            setRetentionSaved(true);
            setTimeout(() => setRetentionSaved(false), 2000);
            flashSuccess('Retention policy saved');
        } catch (err) {
            flashError(err.response?.data?.message || 'Failed to save');
        } finally {
            setRetentionLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Global error / success */}
            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-[12.5px] text-red-700 dark:text-red-400">
                    <AlertCircle size={14} />{error}
                </div>
            )}
            {success && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg text-[12.5px] text-green-700 dark:text-green-400">
                    <Check size={14} />{success}
                </div>
            )}

            {/* ── GDPR Data Export ──────────────────────────────────────── */}
            <Card title="Export My Data" subtitle="GDPR Article 20 — Right to data portability">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <p className="text-[12.5px] text-gray-600 dark:text-gray-400 mb-2">
                            Download a complete JSON archive of your profile, tasks, notes, and activity history.
                        </p>
                        <p className="text-[11px] text-gray-400">Your data will be delivered as a downloadable file.</p>
                    </div>
                    <button
                        onClick={handleExport}
                        disabled={exportLoading}
                        className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[12.5px] font-semibold rounded-lg transition-colors disabled:opacity-60"
                    >
                        {exportLoading ? <Loader size={13} className="animate-spin" /> : <Download size={13} />}
                        {exportLoading ? 'Preparing…' : 'Download'}
                    </button>
                </div>
            </Card>

            {/* ── Legal Hold Status ─────────────────────────────────────── */}
            <Card title="Legal Hold" subtitle="Compliance status of this account">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <div className={`p-2 rounded-lg ${legalHold ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                        <Lock size={15} className={legalHold ? 'text-red-600 dark:text-red-400' : 'text-gray-400'} />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">Status</span>
                            <Badge color={legalHold ? 'red' : 'green'}>
                                {legalHold ? 'Under Legal Hold' : 'No Hold'}
                            </Badge>
                        </div>
                        {legalHold && legalHoldReason && (
                            <p className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-0.5">{legalHoldReason}</p>
                        )}
                        {!legalHold && (
                            <p className="text-[11.5px] text-gray-400 mt-0.5">
                                Your data can be exported or deleted freely.
                            </p>
                        )}
                    </div>
                </div>
                {legalHold && (
                    <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700 rounded-lg text-[12px] text-amber-700 dark:text-amber-400">
                        <AlertCircle size={13} className="inline mr-1" />
                        This account is under legal hold. Data deletion is blocked until the hold is removed by an administrator.
                    </div>
                )}
            </Card>

            {/* ── Message Retention Policy ──────────────────────────────── */}
            <Card title="Message Retention" subtitle="Automatically delete your sent messages after N days">
                <div className="flex items-end gap-3 max-w-sm">
                    <div className="flex-1">
                        <label className="block text-[10.5px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5">
                            Retention Period (days)
                        </label>
                        <input
                            type="number"
                            min="1"
                            value={retentionDays}
                            onChange={e => setRetentionDays(e.target.value)}
                            placeholder="No retention policy"
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[12.5px] text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        />
                    </div>
                    <button
                        onClick={handleSaveRetention}
                        disabled={retentionLoading}
                        className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[12.5px] font-semibold rounded-lg transition-colors disabled:opacity-60"
                    >
                        {retentionLoading ? <Loader size={13} className="animate-spin" /> : retentionSaved ? <Check size={13} /> : <Clock size={13} />}
                        Save
                    </button>
                </div>
                <p className="mt-2 text-[11px] text-gray-400">
                    Leave empty to disable. Messages are deleted in nightly batches.
                </p>
            </Card>

            {/* ── Audit Logs ────────────────────────────────────────────── */}
            <Card title="Audit Log" subtitle="Your recent account activity">
                {logsLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader size={18} className="animate-spin text-gray-400" />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-[13px]">
                        <FileText size={24} className="mx-auto mb-2 opacity-40" />
                        No activity recorded yet.
                    </div>
                ) : (
                    <div className="space-y-0">
                        {logs.map((log, i) => (
                            <div key={log._id || i} className={`flex items-start gap-3 py-2.5 ${i < logs.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}`}>
                                <div className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${log.severity === 'critical' ? 'bg-red-500' : log.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-400'}`} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[12px] font-semibold text-gray-800 dark:text-gray-100">{log.action}</span>
                                        <Badge color={log.status === 'success' ? 'green' : log.status === 'failure' ? 'red' : 'gray'}>
                                            {log.status}
                                        </Badge>
                                    </div>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">{log.description || log.resource}</p>
                                    <p className="text-[10.5px] text-gray-400 mt-0.5">{fmtDate(log.createdAt)}</p>
                                </div>
                                {log.ipAddress && (
                                    <span className="text-[10.5px] text-gray-400 flex-shrink-0 hidden sm:block">{log.ipAddress}</span>
                                )}
                            </div>
                        ))}

                        {/* Pagination */}
                        {logPages > 1 && (
                            <div className="flex items-center justify-between pt-3 mt-1 border-t border-gray-100 dark:border-gray-800">
                                <span className="text-[11.5px] text-gray-400">
                                    Page {logPage} of {logPages} ({logTotal} events)
                                </span>
                                <div className="flex gap-1">
                                    <button
                                        disabled={logPage <= 1}
                                        onClick={() => loadLogs(logPage - 1)}
                                        className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                    ><ChevronLeft size={14} /></button>
                                    <button
                                        disabled={logPage >= logPages}
                                        onClick={() => loadLogs(logPage + 1)}
                                        className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                    ><ChevronRight size={14} /></button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* ── Delete Account ────────────────────────────────────────── */}
            <Card title="Delete Account" subtitle="GDPR Article 17 — Right to erasure">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <p className="text-[12.5px] text-gray-600 dark:text-gray-400 mb-1">
                            Permanently erase your account data. This is irreversible.
                        </p>
                        {legalHold && (
                            <p className="text-[11.5px] text-red-500 flex items-center gap-1 mt-1">
                                <Lock size={11} /> Blocked — account is under legal hold.
                            </p>
                        )}
                    </div>
                    <button
                        onClick={() => setShowDeleteModal(true)}
                        disabled={legalHold}
                        className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700 text-[12.5px] font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Trash2 size={13} />
                        Delete Account
                    </button>
                </div>
            </Card>

            {/* ── Delete confirmation modal ─────────────────────────────── */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                                <AlertCircle size={18} className="text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-[14px] font-bold text-gray-900 dark:text-white">Confirm Account Deletion</h3>
                                <p className="text-[12px] text-gray-500">This action is permanent and cannot be undone.</p>
                            </div>
                        </div>
                        <p className="text-[12.5px] text-gray-700 dark:text-gray-300">
                            Your profile, messages, tasks, and all associated data will be anonymized in accordance with GDPR Article 17.
                        </p>
                        <div>
                            <label className="block text-[10.5px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5">
                                Type <span className="text-red-500">DELETE</span> to confirm
                            </label>
                            <input
                                type="text"
                                value={deleteConfirm}
                                onChange={e => setDeleteConfirm(e.target.value)}
                                placeholder="DELETE"
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[12.5px] text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
                            />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); }} className="px-4 py-2 text-[12.5px] font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteAccount}
                                disabled={deleteLoading || deleteConfirm !== 'DELETE'}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-[12.5px] font-semibold rounded-lg transition-colors disabled:opacity-50"
                            >
                                {deleteLoading ? <Loader size={13} className="animate-spin" /> : <Trash2 size={13} />}
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
