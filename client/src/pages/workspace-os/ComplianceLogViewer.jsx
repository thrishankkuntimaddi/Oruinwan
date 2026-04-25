import React, { useState, useEffect, useCallback } from 'react';
import api from '@services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Lock, RefreshCw, ChevronLeft, ChevronRight, ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';

const SEVERITY_META = {
    info:     { color: 'var(--text-secondary)', bg: 'var(--bg-active)', border: 'var(--border-accent)' },
    warning:  { color: 'var(--accent)',         bg: 'rgba(184,149,106,0.1)', border: 'var(--accent)' },
    critical: { color: 'var(--state-danger)',   bg: 'rgba(224,82,82,0.1)', border: 'var(--state-danger)' },
};
const CATEGORIES = ['workspace','org','permissions','security','auth','billing','data-export','data-import'];

function timeAgo(date) {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(date).toLocaleString();
}

const inputBase = {
    background: 'var(--bg-input)', border: '1px solid var(--border-default)',
    color: 'var(--text-primary)', fontSize: '12px', outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif', padding: '7px 12px',
    transition: 'border-color 150ms ease', cursor: 'pointer',
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
        setLoading(true); setError(null);
        try {
            const params = { companyId, page, limit: 50, verify: verifyHashes };
            if (category) params.category = category;
            if (severity) params.severity = severity;
            const res = await api.get('/api/compliance-logs', { params });
            setLogs(res.data.logs || []);
            setPagination(res.data.pagination || {});
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load compliance logs');
        } finally { setLoading(false); }
    }, [companyId, page, category, severity, verifyHashes]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { setPage(1); }, [category, severity, verifyHashes]);

    const cols = verifyHashes ? 6 : 5;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {}
            <header style={{ height: '56px', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, zIndex: 5 }}>
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <Lock size={16} style={{ color: 'var(--state-success)' }} />
                        Compliance Logs
                        {pagination.total > 0 && <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>({pagination.total})</span>}
                    </h2>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', marginLeft: '24px' }}>Immutable audit trail — records cannot be modified or deleted</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={verifyHashes} onChange={e => setVerifyHashes(e.target.checked)}
                            style={{ width: '13px', height: '13px', accentColor: 'var(--accent)' }} />
                        Verify integrity
                    </label>
                    <button onClick={load}
                        style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-active)', border: '1px solid var(--border-default)', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: '2px', transition: 'all 150ms ease' }}>
                        <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                    </button>
                </div>
            </header>

            {}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '20px 28px' }}>
                {}
                <div style={{ padding: '10px 14px', background: 'rgba(90,186,138,0.08)', border: '1px solid var(--state-success)', color: 'var(--state-success)', fontSize: '12px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={13} style={{ flexShrink: 0 }} />
                    All records are signed with SHA-256 hashes at write time. Enable "Verify integrity" to detect any tampered records.
                </div>

                {}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                    <select value={category} onChange={e => setCategory(e.target.value)} style={inputBase}>
                        <option value="">All Categories</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                    </select>
                    <select value={severity} onChange={e => setSeverity(e.target.value)} style={inputBase}>
                        <option value="">All Severities</option>
                        <option value="info">Info</option>
                        <option value="warning">Warning</option>
                        <option value="critical">Critical</option>
                    </select>
                </div>

                {error && <div style={{ padding: '10px 14px', background: 'rgba(224,82,82,0.08)', border: '1px solid var(--state-danger)', color: 'var(--state-danger)', fontSize: '12px', marginBottom: '12px' }}>{error}</div>}

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', overflow: 'hidden', flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-active)' }}>
                                {['Severity','Action','Actor','Category','When',...(verifyHashes ? ['Integrity'] : [])].map(h => (
                                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={cols} style={{ padding: '48px', textAlign: 'center' }}>
                                    <RefreshCw size={20} style={{ color: 'var(--text-muted)', margin: '0 auto', animation: 'spin 1s linear infinite' }} />
                                </td></tr>
                            ) : logs.length === 0 ? (
                                <tr><td colSpan={cols} style={{ padding: '48px', textAlign: 'center' }}>
                                    <Lock size={28} style={{ color: 'var(--text-muted)', margin: '0 auto 8px', opacity: 0.4 }} />
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No compliance logs found</p>
                                </td></tr>
                            ) : logs.map(log => <CLogRow key={log._id} log={log} verify={verifyHashes} />)}
                        </tbody>
                    </table>
                    {pagination.pages > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Page {page} of {pagination.pages}</span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <PagBtn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} icon={<ChevronLeft size={13} />} />
                                <PagBtn onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page >= pagination.pages} icon={<ChevronRight size={13} />} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

const CLogRow = ({ log, verify }) => {
    const [hov, setHov] = React.useState(false);
    const sev = SEVERITY_META[log.severity] || SEVERITY_META.info;
    const actor = log.actorId;
    return (
        <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: hov ? 'var(--bg-hover)' : 'transparent', transition: 'background 150ms ease' }}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
            <td style={{ padding: '10px 14px' }}>
                <span style={{ display: 'inline-block', padding: '3px 8px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', background: sev.bg, border: `1px solid ${sev.border}`, color: sev.color }}>{log.severity}</span>
            </td>
            <td style={{ padding: '10px 14px' }}>
                <code style={{ fontSize: '11px', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '2px 6px' }}>{log.action}</code>
            </td>
            <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                {actor?.username || log.actorEmail || 'Unknown'}
                {log.actorRole && <span style={{ marginLeft: '5px', fontSize: '10px', color: 'var(--text-muted)' }}>({log.actorRole})</span>}
            </td>
            <td style={{ padding: '10px 14px' }}>
                {log.category && <span style={{ fontSize: '10px', padding: '2px 7px', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>{log.category}</span>}
            </td>
            <td style={{ padding: '10px 14px', fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }} title={new Date(log.createdAt).toLocaleString()}>
                {timeAgo(log.createdAt)}
            </td>
            {verify && (
                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    {log._hashValid === true
                        ? <ShieldCheck size={14} style={{ color: 'var(--state-success)', margin: '0 auto' }} title="Hash valid" />
                        : log._hashValid === false
                        ? <ShieldAlert size={14} style={{ color: 'var(--state-danger)', margin: '0 auto' }} title="INVALID — possible tampering!" />
                        : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>}
                </td>
            )}
        </tr>
    );
};

const PagBtn = ({ onClick, disabled, icon }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} disabled={disabled} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: hov && !disabled ? 'var(--bg-hover)' : 'var(--bg-active)', border: '1px solid var(--border-default)', color: disabled ? 'var(--text-muted)' : 'var(--text-secondary)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1, transition: 'all 150ms ease', borderRadius: '2px' }}>
            {icon}
        </button>
    );
};
