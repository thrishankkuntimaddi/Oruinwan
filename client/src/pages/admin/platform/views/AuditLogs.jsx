import React, { useMemo, useState } from 'react';
import api from '@services/api';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList, Download, RefreshCcw, X } from 'lucide-react';
import {
    DashPage, PageHead, Toolbar, SearchBox, SelectBox, FilterTabs, DataTable, Btn, Chip,
    EmptyState, ErrorState, LoadingState, useAsync, timeAgo,
} from '../../../../components/company-dash/dashUi';

const SEVERITY_TONE = { info: undefined, warning: 'warning', critical: 'danger' };
const actionTone = (a = '') => (/delete|reject|fail|revoke|suspend/.test(a) ? 'danger' : /approve|create|register|enabled/.test(a) ? 'success' : undefined);

function save(name, type, content) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    a.click();
    URL.revokeObjectURL(url);
}

const AuditLogs = () => {
    const [params, setParams] = useSearchParams();
    const companyId = params.get('companyId') || '';
    const [q, setQ] = useState('');
    const [action, setAction] = useState('all');
    const [severity, setSeverity] = useState('all');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');

    // Server filters: company + severity + limit. Text/date/action filter the loaded page.
    const logs = useAsync(() => api.get('/api/admin/audit-logs', {
        params: { limit: 500, ...(companyId ? { companyId } : {}), ...(severity !== 'all' ? { severity } : {}) },
    }).then((r) => (Array.isArray(r.data) ? r.data : [])), [companyId, severity]);

    const all = useMemo(() => logs.data || [], [logs.data]);
    const actions = useMemo(() => [...new Set(all.map((l) => l.action).filter(Boolean))].sort(), [all]);
    const rows = useMemo(() => {
        const needle = q.trim().toLowerCase();
        const start = from ? new Date(from) : null;
        const end = to ? new Date(`${to}T23:59:59`) : null;
        return all.filter((l) => (action === 'all' || l.action === action)
            && (!needle || [l.description, l.action, l.userId?.username, l.userId?.email, l.companyId?.name, l.ipAddress].some((v) => String(v || '').toLowerCase().includes(needle)))
            && (!start || new Date(l.createdAt) >= start)
            && (!end || new Date(l.createdAt) <= end));
    }, [all, q, action, from, to]);

    const exportCsv = () => {
        const head = ['Time', 'User', 'Email', 'Company', 'Action', 'Severity', 'Description', 'IP'];
        const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const body = rows.map((l) => [new Date(l.createdAt).toISOString(), l.userId?.username, l.userId?.email, l.companyId?.name, l.action, l.severity, l.description, l.ipAddress].map(esc).join(','));
        save(`oruinwan-audit-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv', [head.join(','), ...body].join('\n'));
    };

    const columns = [
        { key: 'time', label: 'When', render: (l) => <span className="cd-muted" title={new Date(l.createdAt).toLocaleString()} style={{ whiteSpace: 'nowrap' }}>{timeAgo(l.createdAt)}</span> },
        { key: 'action', label: 'Event', render: (l) => (
            <div style={{ minWidth: 0 }}>
                <div className="cd-cell-title" style={{ fontWeight: 500, whiteSpace: 'normal' }}>{l.description || l.action}</div>
                <div style={{ display: 'flex', gap: 4, marginTop: l.description || (l.severity && l.severity !== 'info') ? 4 : 0, flexWrap: 'wrap' }}>
                    {l.description ? <Chip tone={actionTone(l.action)}>{l.action}</Chip> : null}
                    {l.severity && l.severity !== 'info' && <Chip tone={SEVERITY_TONE[l.severity]}>{l.severity}</Chip>}
                </div>
            </div>
        ) },
        { key: 'user', label: 'User', className: 'cd-hide-sm', render: (l) => <div><div className="cd-cell-title" style={{ fontWeight: 500 }}>{l.userId?.username || 'System'}</div><div className="cd-cell-sub">{l.userId?.email || ''}</div></div> },
        { key: 'company', label: 'Company', className: 'cd-hide-sm', render: (l) => (l.companyId?._id ? (
            <button type="button" className="gl-btn gl-btn--ghost gl-btn--sm" onClick={() => setParams({ companyId: l.companyId._id })}>{l.companyId.name}</button>
        ) : <span className="cd-muted">—</span>) },
        { key: 'ip', label: 'IP', className: 'cd-hide-sm', render: (l) => <span className="cd-muted" style={{ fontFamily: 'monospace', fontSize: 12 }}>{l.ipAddress || '—'}</span> },
    ];

    const filteredCompany = companyId && (all.find((l) => l.companyId?._id === companyId)?.companyId?.name || 'this company');

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="System"
                    title="Audit logs"
                    lead="Security and administrative events across the platform (latest 500)."
                    actions={(
                        <>
                            <Btn icon={Download} onClick={exportCsv} disabled={!rows.length}>CSV</Btn>
                            <Btn icon={Download} onClick={() => save(`oruinwan-audit-${new Date().toISOString().slice(0, 10)}.json`, 'application/json', JSON.stringify(rows, null, 2))} disabled={!rows.length}>JSON</Btn>
                            <Btn icon={RefreshCcw} onClick={logs.reload} loading={logs.loading && !!logs.data}>Refresh</Btn>
                        </>
                    )}
                />
            )}
        >
            <Toolbar>
                <SearchBox value={q} onChange={setQ} placeholder="Search description, user, company, IP…" />
                <SelectBox label="Action" value={action} onChange={setAction} style={{ maxWidth: 220 }}>
                    <option value="all">All actions</option>
                    {actions.map((a) => <option key={a} value={a}>{a}</option>)}
                </SelectBox>
                <input type="date" className="gl-input" aria-label="From date" style={{ width: 150, flex: "0 0 auto" }} value={from} onChange={(e) => setFrom(e.target.value)} />
                <input type="date" className="gl-input" aria-label="To date" style={{ width: 150, flex: "0 0 auto" }} value={to} onChange={(e) => setTo(e.target.value)} />
            </Toolbar>
            <Toolbar>
                <FilterTabs label="Severity" value={severity} onChange={setSeverity} options={['all', 'info', 'warning', 'critical'].map((s) => ({ value: s, label: s.replace(/^./, (m) => m.toUpperCase()) }))} />
                {companyId && (
                    <Btn size="sm" icon={X} onClick={() => setParams({})}>Company: {filteredCompany}</Btn>
                )}
                <span className="cd-muted" style={{ fontSize: 12, marginLeft: 'auto' }}>{logs.data ? `${rows.length} of ${all.length}` : ''}</span>
            </Toolbar>
            {logs.loading && !logs.data ? <LoadingState /> : logs.error ? (
                <ErrorState message={logs.error} onRetry={logs.reload} />
            ) : (
                <DataTable
                    caption="Audit log"
                    columns={columns}
                    rows={rows}
                    maxHeight="calc(100dvh - 330px)"
                    empty={<EmptyState icon={ClipboardList} title={all.length ? 'No event matches' : 'No events yet'} text={all.length ? 'Try other filters.' : 'Events are recorded as people sign in and administer companies.'} />}
                />
            )}
        </DashPage>
    );
};

export default AuditLogs;
