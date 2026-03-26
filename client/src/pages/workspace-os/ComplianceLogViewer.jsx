// client/src/pages/workspace-os/ComplianceLogViewer.jsx
// Read-only immutable compliance log viewer for admins.
// Shows SHA-256 hash integrity verification.
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
    Lock, RefreshCw, ChevronLeft, ChevronRight,
    ShieldCheck, ShieldAlert, AlertTriangle, Info, Zap
} from 'lucide-react';

const SEVERITY_STYLES = {
    info: { color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-900/20' },
    warning: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    critical: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' }
};

const CATEGORIES = ['workspace', 'org', 'permissions', 'security', 'auth', 'billing', 'data-export', 'data-import'];

function timeAgo(date) {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(date).toLocaleString();
}

const LogRow = ({ log, verify }) => {
    const sev = SEVERITY_STYLES[log.severity] || SEVERITY_STYLES.info;
    const actor = log.actorId;

    return (
        <tr className="border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
            <td className="px-4 py-3.5">
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md ${sev.bg} ${sev.color}`}>
                    {log.severity}
                </span>
            </td>
            <td className="px-4 py-3.5">
                <code className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 rounded">{log.action}</code>
            </td>
            <td className="px-4 py-3.5 text-sm text-slate-700 dark:text-slate-300">
                {actor?.username || log.actorEmail || 'Unknown'}
                {log.actorRole && <span className="ml-1 text-xs text-slate-400">({log.actorRole})</span>}
            </td>
            <td className="px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400">
                {log.category && <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">{log.category}</span>}
            </td>
            <td className="px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap" title={new Date(log.createdAt).toLocaleString()}>
                {timeAgo(log.createdAt)}
            </td>
            {verify && (
                <td className="px-4 py-3.5 text-center">
                    {log._hashValid === true
                        ? <ShieldCheck size={16} className="text-emerald-500 mx-auto" title="Hash valid" />
                        : log._hashValid === false
                        ? <ShieldAlert size={16} className="text-red-500 mx-auto" title="Hash INVALID — possible tampering!" />
                        : <span className="text-slate-300">—</span>
                    }
                </td>
            )}
        </tr>
    );
};

export default function ComplianceLogViewer({ companyId: propCompanyId }) {
    const { user } = useAuth();
    const companyId = propCompanyId || user?.companyId;

    const [logs, setLogs] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 1 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [category, setCategory] = useState('');
    const [severity, setSeverity] = useState('');
    const [page, setPage] = useState(1);
    const [verifyHashes, setVerifyHashes] = useState(false);

    const load = useCallback(async () => {
        if (!companyId) return;
        setLoading(true);
        setError(null);
        try {
            const params = { companyId, page, limit: 50, verify: verifyHashes };
            if (category) params.category = category;
            if (severity) params.severity = severity;
            const res = await api.get('/api/compliance-logs', { params });
            setLogs(res.data.logs || []);
            setPagination(res.data.pagination || {});
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load compliance logs');
        } finally {
            setLoading(false);
        }
    }, [companyId, page, category, severity, verifyHashes]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { setPage(1); }, [category, severity, verifyHashes]);

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <Lock size={22} className="text-emerald-500" />
                        Compliance Logs
                        {pagination.total > 0 && <span className="text-sm font-normal text-slate-500">({pagination.total})</span>}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Immutable audit trail — records cannot be modified or deleted</p>
                </div>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                        <input type="checkbox" checked={verifyHashes} onChange={e => setVerifyHashes(e.target.checked)}
                            className="w-4 h-4 rounded text-indigo-600" />
                        Verify integrity
                    </label>
                    <button onClick={load} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-indigo-500 transition-colors">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Immutability notice */}
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3 text-emerald-700 dark:text-emerald-400 text-sm flex items-center gap-2">
                <ShieldCheck size={14} />
                All records are signed with SHA-256 hashes at write time. Enable "Verify integrity" to detect any tampered records.
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <select value={category} onChange={e => setCategory(e.target.value)}
                    className="px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">All Categories</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={severity} onChange={e => setSeverity(e.target.value)}
                    className="px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">All Severities</option>
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                </select>
            </div>

            {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400 text-sm">{error}</div>}

            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                                {['Severity', 'Action', 'Actor', 'Category', 'Time', ...(verifyHashes ? ['Integrity'] : [])].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading
                                ? <tr><td colSpan={verifyHashes ? 6 : 5} className="py-16 text-center text-slate-400"><RefreshCw size={24} className="animate-spin mx-auto" /></td></tr>
                                : logs.length === 0
                                ? <tr><td colSpan={verifyHashes ? 6 : 5} className="py-16 text-center text-slate-400">
                                    <Lock size={40} className="mx-auto mb-3 opacity-30" />
                                    <p>No compliance logs found</p>
                                </td></tr>
                                : logs.map(log => <LogRow key={log._id} log={log} verify={verifyHashes} />)
                            }
                        </tbody>
                    </table>
                </div>
                {pagination.pages > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-700">
                        <span className="text-sm text-slate-500">Page {page} of {pagination.pages}</span>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40">
                                <ChevronLeft size={16} />
                            </button>
                            <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page >= pagination.pages}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
