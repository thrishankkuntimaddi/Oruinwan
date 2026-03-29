// client/src/pages/workspace-os/AuditLogViewer.jsx
// Paginated, filterable audit log viewer for admins.
import React, { useState, useEffect, useCallback } from 'react';
import api from '@services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
    ClipboardList, Search, Filter, RefreshCw,
    ChevronLeft, ChevronRight, AlertTriangle, Info, Zap,
    CheckCircle, XCircle, Clock
} from 'lucide-react';

const SEVERITY_STYLES = {
    info: { icon: Info, color: 'text-sky-500', bg: 'bg-sky-50 dark:bg-sky-900/20', text: 'text-sky-700 dark:text-sky-400' },
    warning: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400' },
    critical: { icon: Zap, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400' }
};

const STATUS_STYLES = {
    success: { icon: CheckCircle, color: 'text-emerald-500' },
    failure: { icon: XCircle, color: 'text-red-500' },
    pending: { icon: Clock, color: 'text-amber-500' }
};

const CATEGORIES = ['workspace', 'org', 'permissions', 'security', 'auth', 'billing', 'messaging', 'system'];

function timeAgo(date) {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(date).toLocaleDateString();
}

const LogRow = ({ log }) => {
    const sev = SEVERITY_STYLES[log.severity] || SEVERITY_STYLES.info;
    const SevIcon = sev.icon;
    const status = STATUS_STYLES[log.status] || STATUS_STYLES.success;
    const StatusIcon = status.icon;
    const actor = log.userId;

    return (
        <tr className="border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
            <td className="px-4 py-3.5">
                <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold ${sev.bg} ${sev.text}`}>
                    <SevIcon size={11} />
                    {log.severity}
                </div>
            </td>
            <td className="px-4 py-3.5">
                <code className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 rounded-md">
                    {log.action}
                </code>
            </td>
            <td className="px-4 py-3.5">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {(actor?.username || '?').slice(0, 1).toUpperCase()}
                    </div>
                    <span className="text-sm text-slate-700 dark:text-slate-300">{actor?.username || actor?.email || 'Unknown'}</span>
                </div>
            </td>
            <td className="px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400">
                {log.category && (
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">{log.category}</span>
                )}
            </td>
            <td className="px-4 py-3.5">
                <StatusIcon size={15} className={status.color} />
            </td>
            <td className="px-4 py-3.5 text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap" title={new Date(log.createdAt).toLocaleString()}>
                {timeAgo(log.createdAt)}
            </td>
        </tr>
    );
};

export default function AuditLogViewer({ companyId: propCompanyId }) {
    const { user } = useAuth();
    const companyId = propCompanyId || user?.companyId;

    const [logs, setLogs] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 1 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [category, setCategory] = useState('');
    const [severity, setSeverity] = useState('');
    const [page, setPage] = useState(1);

    const load = useCallback(async () => {
        if (!companyId) return;
        setLoading(true);
        setError(null);
        try {
            const params = { companyId, page, limit: 50 };
            if (category) params.category = category;
            if (severity) params.severity = severity;
            const res = await api.get('/api/permissions/audit-logs', { params });
            setLogs(res.data.logs || []);
            setPagination(res.data.pagination || {});
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load audit logs');
        } finally {
            setLoading(false);
        }
    }, [companyId, page, category, severity]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { setPage(1); }, [category, severity]);

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <ClipboardList size={22} className="text-indigo-500" />
                    Audit Logs
                    {pagination.total > 0 && <span className="text-sm font-normal text-slate-500">({pagination.total})</span>}
                </h2>
                <button onClick={load} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-indigo-500 transition-colors">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
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
                                {['Severity', 'Action', 'Actor', 'Category', 'Status', 'When'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} className="py-16 text-center text-slate-400"><RefreshCw size={24} className="animate-spin mx-auto" /></td></tr>
                            ) : logs.length === 0 ? (
                                <tr><td colSpan={6} className="py-16 text-center text-slate-400">
                                    <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
                                    <p>No audit logs found</p>
                                </td></tr>
                            ) : logs.map(log => <LogRow key={log._id} log={log} />)}
                        </tbody>
                    </table>
                </div>
                {pagination.pages > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-700">
                        <span className="text-sm text-slate-500">Page {page} of {pagination.pages}</span>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed">
                                <ChevronLeft size={16} />
                            </button>
                            <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page >= pagination.pages}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
