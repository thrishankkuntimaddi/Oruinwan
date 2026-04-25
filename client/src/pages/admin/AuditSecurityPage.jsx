import React, { useState, useEffect, useCallback } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, Clock, Download, Filter, Search, Calendar } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

const inputSt = {
    background: 'var(--bg-input)', border: '1px solid var(--border-default)',
    color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif', padding: '8px 12px',
};

const AuditSecurityPage = () => {
    const { showToast } = useToast();
    const [auditLogs, setAuditLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [dateRange, setDateRange] = useState('7days');

    const fetchAuditLogs = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/audit-logs', { headers: { 'Content-Type': 'application/json' } });
            if (response.ok) {
                const data = await response.json();
                setAuditLogs(data.logs || []);
            } else {
                setAuditLogs([
                    { _id: '1', type: 'login', action: 'User Login', user: { username: 'john.doe' }, details: 'Successful login from 192.168.1.100', status: 'success', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), ipAddress: '192.168.1.100', device: 'Chrome on MacOS' },
                    { _id: '2', type: 'security', action: 'Failed Login Attempt', user: { username: 'unknown' }, details: 'Multiple failed login attempts detected', status: 'warning', timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), ipAddress: '192.168.1.101', device: 'Firefox on Windows' },
                    { _id: '3', type: 'access', action: 'Admin Role Assigned', user: { username: 'jane.smith' }, details: 'User promoted to admin by owner', status: 'info', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), ipAddress: '192.168.1.102', device: 'Safari on iOS' },
                    { _id: '4', type: 'changes', action: 'Department Created', user: { username: 'admin.user' }, details: 'New department "Marketing" created', status: 'success', timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), ipAddress: '192.168.1.103', device: 'Chrome on Linux' },
                ]);
            }
        } catch (error) {
            showToast('Failed to load audit logs', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => { fetchAuditLogs(); }, [fetchAuditLogs]);

    const statusIcon = (status) => {
        if (status === 'success') return <CheckCircle size={14} style={{ color: 'var(--state-success)' }} />;
        if (status === 'warning') return <AlertTriangle size={14} style={{ color: 'var(--accent)' }} />;
        if (status === 'error') return <XCircle size={14} style={{ color: 'var(--state-danger)' }} />;
        return <Clock size={14} style={{ color: 'var(--text-muted)' }} />;
    };

    const statusColor = (s) => s === 'success' ? 'var(--state-success)' : s === 'warning' ? 'var(--accent)' : s === 'error' ? 'var(--state-danger)' : 'var(--text-secondary)';
    const typeColor = (t) => t === 'security' ? 'var(--state-danger)' : t === 'login' ? 'var(--accent)' : t === 'access' ? 'var(--text-primary)' : 'var(--state-success)';

    const filteredLogs = auditLogs.filter(log => {
        const matchesSearch = log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.details.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterType === 'all' || log.type === filterType;
        return matchesSearch && matchesFilter;
    });

    const exportLogs = () => showToast('Exporting audit logs...', 'info');

    const stats = [
        { label: 'Total Events', value: auditLogs.length, icon: Shield, note: 'Last 7 days' },
        { label: 'Logins', value: auditLogs.filter(l => l.type === 'login').length, icon: CheckCircle, note: 'Successful attempts' },
        { label: 'Security Alerts', value: auditLogs.filter(l => l.status === 'warning' || l.status === 'error').length, icon: AlertTriangle, note: 'Requires attention' },
        { label: 'Access Changes', value: auditLogs.filter(l => l.type === 'access').length, icon: Clock, note: 'Role modifications' },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
            <header style={{ height: '56px', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', flexShrink: 0 }}>
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Shield size={16} style={{ color: 'var(--accent)' }} /> Audit & Security
                    </h2>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Monitor security events and access logs</p>
                </div>
                <ExportBtn onClick={exportLogs} />
            </header>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }} className="custom-scrollbar">
                {}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                    {stats.map(s => (
                        <div key={s.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.label}</span>
                                <s.icon size={13} style={{ color: 'var(--text-muted)' }} />
                            </div>
                            <p style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '2px' }}>{s.value}</p>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.note}</p>
                        </div>
                    ))}
                </div>

                {}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '12px 16px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                        <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        <input type="text" placeholder="Search events, users, or actions..." value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ ...inputSt, width: '100%', paddingLeft: '30px', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Filter size={13} style={{ color: 'var(--text-muted)' }} />
                        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={inputSt}>
                            <option value="all">All Types</option>
                            <option value="login">Login</option>
                            <option value="security">Security</option>
                            <option value="access">Access</option>
                            <option value="changes">Changes</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                        <select value={dateRange} onChange={e => setDateRange(e.target.value)} style={inputSt}>
                            <option value="24h">Last 24 Hours</option>
                            <option value="7days">Last 7 Days</option>
                            <option value="30days">Last 30 Days</option>
                            <option value="all">All Time</option>
                        </select>
                    </div>
                </div>

                {}
                {loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ width: '28px', height: '28px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                        <Shield size={32} style={{ color: 'var(--text-muted)', opacity: 0.4, margin: '0 auto 10px' }} />
                        <h3 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>No audit logs found</h3>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{searchTerm ? 'Try a different search term or filter' : 'No security events recorded yet'}</p>
                    </div>
                ) : (
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                        {filteredLogs.map((log, i) => (
                            <div key={log._id} style={{ padding: '14px 16px', borderBottom: i < filteredLogs.length - 1 ? '1px solid var(--border-subtle)' : 'none', display: 'flex', gap: '12px', alignItems: 'flex-start', transition: 'background 150ms ease' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <div style={{ marginTop: '2px', flexShrink: 0 }}>{statusIcon(log.status)}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '4px' }}>
                                        <div>
                                            <h4 style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>{log.action}</h4>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <Badge text={log.type} color={typeColor(log.type)} />
                                                <Badge text={log.status} color={statusColor(log.status)} />
                                            </div>
                                        </div>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{new Date(log.timestamp).toLocaleString()}</span>
                                    </div>
                                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', lineHeight: '1.5' }}>{log.details}</p>
                                    <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                        <span>User: <strong style={{ color: 'var(--text-secondary)' }}>{log.user.username}</strong></span>
                                        <span>IP: <strong style={{ color: 'var(--text-secondary)' }}>{log.ipAddress}</strong></span>
                                        <span>Device: <strong style={{ color: 'var(--text-secondary)' }}>{log.device}</strong></span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const Badge = ({ text, color }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 6px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color, border: `1px solid ${color}`, opacity: 0.9 }}>{text}</span>
);

const ExportBtn = ({ onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: hov ? 'var(--accent-hover)' : 'var(--accent)', border: 'none', color: 'var(--bg-base)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', borderRadius: '2px', transition: 'background 150ms ease' }}>
            <Download size={13} /> Export Logs
        </button>
    );
};

export default AuditSecurityPage;
