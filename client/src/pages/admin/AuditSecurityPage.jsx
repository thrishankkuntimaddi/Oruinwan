import React, { useMemo, useState } from 'react';
import { Shield, AlertTriangle, LogIn, KeyRound, Download, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '@services/api';
import {
    DashPage, PageHead, KpiGrid, Kpi, Toolbar, SearchBox, FilterTabs, SelectBox, Btn, Chip, DataTable, LoadingState, ErrorState, EmptyState, useAsync, timeAgo,
} from '../../components/company-dash/dashUi';
import './admin.css';

// AuditLog documents -> the rows this page shows.
function toRow(log) {
    const category = String(log.category || '').toLowerCase();
    const action = String(log.action || '');
    const type = category === 'security' || /fail|suspicious|blocked/i.test(action) ? 'security'
        : /login|logout|session|auth/i.test(action) || category === 'auth' ? 'login'
            : /role|permission|admin|access/i.test(action) || category === 'permissions' ? 'access'
                : 'changes';
    const severity = String(log.severity || '').toLowerCase();
    const status = log.status === 'failure' || severity === 'critical' || severity === 'error' ? 'error'
        : severity === 'warning' ? 'warning' : log.status === 'success' ? 'success' : 'info';
    return {
        _id: log._id,
        type,
        action: action.replace(/[._]/g, ' '),
        user: { username: log.userId?.username || log.user?.username || 'system' },
        details: log.description || (log.details ? JSON.stringify(log.details) : ''),
        status,
        timestamp: log.createdAt || log.timestamp,
        ipAddress: log.ipAddress || '',
        device: log.userAgent || '',
    };
}

const RANGES = { '24hours': 1, '7days': 7, '30days': 30, '90days': 90 };
const TYPE_TONE = { security: 'danger', login: 'accent', access: 'warning', changes: undefined };
const STATUS_TONE = { success: 'success', warning: 'warning', error: 'danger', info: undefined };

const AuditSecurityPage = () => {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [type, setType] = useState('all');
    const [range, setRange] = useState('7days');

    // Real entries from this company's audit log (company-scoped on the server).
    const { data, loading, error, reload } = useAsync(async () => {
        const from = new Date(Date.now() - (RANGES[range] || 7) * 86400000).toISOString();
        const res = await api.get('/api/permissions/audit-logs', { params: { from, limit: 200 } });
        return (res.data.logs || []).map(toRow);
    }, [range]);
    const logs = useMemo(() => data || [], [data]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return logs.filter((l) => (type === 'all' || l.type === type)
            && (!q || l.action.toLowerCase().includes(q) || l.user.username.toLowerCase().includes(q) || l.details.toLowerCase().includes(q)));
    }, [logs, type, query]);

    const count = (fn) => logs.filter(fn).length;

    const exportLogs = () => {
        const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const lines = [['time', 'type', 'action', 'user', 'status', 'details', 'ip'].join(',')]
            .concat(filtered.map((l) => [l.timestamp, l.type, l.action, l.user.username, l.status, l.details, l.ipAddress].map(esc).join(',')));
        const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
        Object.assign(document.createElement('a'), { href: url, download: `audit-log-${new Date().toISOString().slice(0, 10)}.csv` }).click();
        URL.revokeObjectURL(url);
    };

    const columns = [
        { key: 'when', label: 'When' },
        { key: 'action', label: 'Event' },
        { key: 'user', label: 'By', className: 'cd-hide-sm' },
        { key: 'status', label: 'Status' },
        { key: 'ip', label: 'IP', className: 'cd-hide-sm' },
    ];

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Governance"
                    title="Audit & security"
                    lead="Sign-ins, access changes and security events for your company."
                    actions={(
                        <>
                            <Btn icon={ClipboardList} onClick={() => navigate('/admin/audit-logs')}>Full audit log</Btn>
                            <Btn icon={Download} onClick={exportLogs} disabled={!filtered.length}>Export CSV</Btn>
                        </>
                    )}
                />
            )}
        >
            <KpiGrid min={170}>
                <Kpi loading={loading && !data} label="Events" value={data ? logs.length : undefined} icon={Shield} hint={logs.length >= 200 ? 'Showing the latest 200' : 'In the selected range'} />
                <Kpi loading={loading && !data} label="Sign-ins" value={data ? count((l) => l.type === 'login') : undefined} icon={LogIn} tone="muted" />
                <Kpi loading={loading && !data} label="Alerts" value={data ? count((l) => l.status === 'warning' || l.status === 'error') : undefined} icon={AlertTriangle} tone="danger" hint="Warnings and failures" />
                <Kpi loading={loading && !data} label="Access changes" value={data ? count((l) => l.type === 'access') : undefined} icon={KeyRound} tone="muted" hint="Roles and permissions" />
            </KpiGrid>

            <Toolbar>
                <FilterTabs
                    value={type}
                    onChange={setType}
                    label="Event type"
                    options={[
                        { value: 'all', label: 'All' },
                        { value: 'login', label: 'Sign-ins' },
                        { value: 'access', label: 'Access' },
                        { value: 'security', label: 'Security' },
                        { value: 'changes', label: 'Changes' },
                    ]}
                />
                <SearchBox value={query} onChange={setQuery} placeholder="Search events, people…" />
                <SelectBox value={range} onChange={setRange} label="Time range">
                    <option value="24hours">Last 24 hours</option>
                    <option value="7days">Last 7 days</option>
                    <option value="30days">Last 30 days</option>
                    <option value="90days">Last 90 days</option>
                </SelectBox>
            </Toolbar>

            {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <LoadingState label="Loading events…" /> : (
                <DataTable columns={columns} caption="Audit events" maxHeight="calc(100dvh - 360px)">
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={columns.length} style={{ padding: 0 }}>
                                <EmptyState icon={Shield} title={logs.length ? 'No event matches' : 'No events in this range'} text={logs.length ? 'Try another type or search.' : 'Audited actions (sign-ins, role changes, settings) appear here.'} />
                            </td></tr>
                        ) : filtered.map((l) => (
                            <tr key={l._id}>
                                <td className="cd-muted" style={{ whiteSpace: 'nowrap' }} title={l.timestamp ? new Date(l.timestamp).toLocaleString() : undefined}>{timeAgo(l.timestamp)}</td>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <Chip tone={TYPE_TONE[l.type]}>{l.type}</Chip>
                                        <span className="cd-cell-title" style={{ textTransform: 'capitalize', whiteSpace: 'normal' }}>{l.action}</span>
                                    </div>
                                    {l.details && <div className="cd-cell-sub" style={{ whiteSpace: 'normal', maxWidth: 520 }}>{l.details}</div>}
                                </td>
                                <td className="cd-hide-sm">{l.user.username}</td>
                                <td><Chip tone={STATUS_TONE[l.status]}>{l.status}</Chip></td>
                                <td className="cd-hide-sm cd-muted" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{l.ipAddress || '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </DataTable>
            )}
        </DashPage>
    );
};

export default AuditSecurityPage;
