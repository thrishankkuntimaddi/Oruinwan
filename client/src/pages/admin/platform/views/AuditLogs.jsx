import React, { useState, useEffect, useCallback } from 'react';
import api from '@services/api';
import { Search, Download, User, Activity, AlertCircle, RefreshCw } from 'lucide-react';

const actionColor = (action) => {
    if (action.includes('create') || action.includes('register')) return { color: 'var(--state-success)', border: 'var(--state-success)' };
    if (action.includes('delete') || action.includes('reject')) return { color: 'var(--state-danger)', border: 'var(--state-danger)' };
    if (action.includes('update') || action.includes('edit')) return { color: 'var(--text-secondary)', border: 'var(--border-accent)' };
    if (action.includes('approve')) return { color: 'var(--accent)', border: 'var(--accent)' };
    return { color: 'var(--text-muted)', border: 'var(--border-default)' };
};

const AuditLogs = () => {
    const [logs, setLogs] = useState([]);
    const [filteredLogs, setFilteredLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ search: '', action: 'all', user: '', dateFrom: '', dateTo: '', resource: 'all' });

    const applyFilters = useCallback(() => {
        let f = [...logs];
        if (filters.search) f = f.filter(l => l.description?.toLowerCase().includes(filters.search.toLowerCase()) || l.action?.toLowerCase().includes(filters.search.toLowerCase()));
        if (filters.action !== 'all') f = f.filter(l => l.action === filters.action);
        if (filters.resource !== 'all') f = f.filter(l => l.resource === filters.resource);
        if (filters.user) f = f.filter(l => l.userId?.username?.toLowerCase().includes(filters.user.toLowerCase()));
        if (filters.dateFrom) f = f.filter(l => new Date(l.createdAt) >= new Date(filters.dateFrom));
        if (filters.dateTo) f = f.filter(l => new Date(l.createdAt) <= new Date(filters.dateTo + 'T23:59:59'));
        setFilteredLogs(f);
    }, [logs, filters]);

    useEffect(() => { fetchLogs(); const iv = setInterval(fetchLogs, 10000); return () => clearInterval(iv); }, []);
    useEffect(() => { applyFilters(); }, [applyFilters]);

    const fetchLogs = async () => {
        try {
            const res = await api.get('/api/admin/audit-logs');
            setLogs(res.data);
        } catch (err) { console.error('Failed to fetch audit logs:', err); }
        finally { setLoading(false); }
    };

    const exportToCSV = () => {
        const headers = ['Timestamp', 'User', 'Action', 'Resource', 'Description'];
        const csvData = filteredLogs.map(log => [new Date(log.createdAt).toLocaleString(), log.userId?.username || 'System', log.action, log.resource || 'N/A', log.description]);
        const content = [headers.join(','), ...csvData.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
        const url = URL.createObjectURL(new Blob([content], { type: 'text/csv' }));
        const a = Object.assign(document.createElement('a'), { href: url, download: `audit-logs-${new Date().toISOString().split('T')[0]}.csv` });
        a.click(); URL.revokeObjectURL(url);
    };

    const exportToJSON = () => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(filteredLogs, null, 2)], { type: 'application/json' }));
        const a = Object.assign(document.createElement('a'), { href: url, download: `audit-logs-${new Date().toISOString().split('T')[0]}.json` });
        a.click(); URL.revokeObjectURL(url);
    };

    const uniqueActions = [...new Set(logs.map(l => l.action))];
    const uniqueResources = [...new Set(logs.filter(l => l.resource).map(l => l.resource))];

    if (loading) return <Spinner />;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <Activity size={18} style={{ color: 'var(--accent)' }} />
                        Audit Logs
                    </h1>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Track all system activities and changes</p>
                </div>
                <RefreshBtn onClick={fetchLogs} />
            </div>

            {/* Filters */}
            <div style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', padding: '16px 20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '10px' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        <input type="text" placeholder="Search logs..." value={filters.search} onChange={e => setFilters(p => ({ ...p, search: e.target.value }))} style={inputSt} />
                    </div>
                    <FilterSelect value={filters.action} onChange={v => setFilters(p => ({ ...p, action: v }))} label="Action Type" options={[{ value: 'all', label: 'All Actions' }, ...uniqueActions.map(a => ({ value: a, label: a }))]} />
                    <FilterSelect value={filters.resource} onChange={v => setFilters(p => ({ ...p, resource: v }))} label="Resource" options={[{ value: 'all', label: 'All Resources' }, ...uniqueResources.map(r => ({ value: r, label: r }))]} />
                    <input type="date" value={filters.dateFrom} onChange={e => setFilters(p => ({ ...p, dateFrom: e.target.value }))} style={inputSt} />
                    <input type="date" value={filters.dateTo} onChange={e => setFilters(p => ({ ...p, dateTo: e.target.value }))} style={inputSt} />
                </div>

                {/* Stats and export */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        Showing <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{filteredLogs.length}</span> of {logs.length} logs
                    </p>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <ExportBtn label="CSV" onClick={exportToCSV} />
                        <ExportBtn label="JSON" onClick={exportToJSON} />
                    </div>
                </div>
            </div>

            {/* Timeline */}
            <div style={{ border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={14} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Activity Timeline</span>
                </div>
                <div style={{ maxHeight: '560px', overflowY: 'auto' }} className="custom-scrollbar">
                    {filteredLogs.length > 0 ? filteredLogs.map((log, i) => (
                        <LogRow key={i} log={log} />
                    )) : (
                        <div style={{ padding: '48px', textAlign: 'center' }}>
                            <AlertCircle size={40} style={{ color: 'var(--text-muted)', opacity: 0.3, margin: '0 auto 12px' }} />
                            <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}>No logs found</p>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Try adjusting your filters</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const inputSt = {
    width: '100%', padding: '8px 10px 8px 30px',
    background: 'var(--bg-input)', border: '1px solid var(--border-default)',
    color: 'var(--text-primary)', fontSize: '12px', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box'
};

const LogRow = ({ log }) => {
    const [hov, setHov] = React.useState(false);
    const ac = actionColor(log.action || '');
    return (
        <div
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', background: hov ? 'var(--bg-hover)' : 'transparent', transition: 'background 150ms ease' }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ width: '32px', height: '32px', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>
                    {log.action?.includes('create') || log.action?.includes('register') ? '✨' : log.action?.includes('delete') ? '🗑️' : log.action?.includes('update') ? '✏️' : log.action?.includes('approve') ? '✅' : log.action?.includes('reject') ? '❌' : '📝'}
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: ac.color, padding: '1px 6px', border: `1px solid ${ac.border}` }}>
                                    {log.action}
                                </span>
                                {log.resource && (
                                    <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', padding: '1px 6px', border: '1px solid var(--border-subtle)' }}>
                                        {log.resource}
                                    </span>
                                )}
                            </div>
                            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>{log.description}</p>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <User size={11} /> {log.userId?.username || 'System'}
                        </span>
                        {log.resourceId && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID: {log.resourceId.slice(-6)}</span>}
                    </div>
                </div>
            </div>
        </div>
    );
};

const FilterSelect = ({ value, onChange, options }) => (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ padding: '8px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', fontFamily: 'inherit', width: '100%' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
);

const ExportBtn = ({ label, onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: hov ? 'var(--bg-hover)' : 'var(--bg-active)', border: '1px solid var(--border-default)', color: hov ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', borderRadius: '2px', transition: 'all 150ms ease' }}>
            <Download size={13} /> Export {label}
        </button>
    );
};

const RefreshBtn = ({ onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: hov ? 'var(--bg-hover)' : 'var(--bg-active)', border: '1px solid var(--border-default)', color: hov ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', borderRadius: '2px', transition: 'all 150ms ease' }}>
            <RefreshCw size={14} /> Refresh
        </button>
    );
};

const Spinner = () => (
    <div style={{ padding: '20px', background: 'var(--bg-base)' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <div className="sk" style={{ height: '32px', flex: 1 }} />
            <div className="sk" style={{ height: '32px', width: '100px' }} />
            <div className="sk" style={{ height: '32px', width: '100px' }} />
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
            {[1,2,3,4,5,6].map(i => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 3fr 1.5fr 1fr 80px', padding: '11px 16px', borderBottom: '1px solid var(--border-subtle)', gap: '12px', alignItems: 'center' }}>
                    <div className="sk" style={{ width: '20px', height: '20px' }} />
                    <div><div className="sk" style={{ height: '10px', width: '80%', marginBottom: '4px' }} /><div className="sk" style={{ height: '8px', width: '60%' }} /></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}><div className="sk" style={{ width: '20px', height: '20px', borderRadius: '50%' }} /><div className="sk" style={{ height: '9px', width: '80px' }} /></div>
                    <div className="sk" style={{ height: '9px', width: '80px' }} />
                    <div className="sk" style={{ height: '18px', width: '60px' }} />
                </div>
            ))}
        </div>
    </div>
);

export default AuditLogs;
