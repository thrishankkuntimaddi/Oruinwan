import React, { useMemo, useState } from 'react';
import api from '@services/api';
import { CreditCard, Calendar, TrendingUp, Download, Layers, Receipt } from 'lucide-react';
import {
    DashPage, PageHead, KpiGrid, Kpi, Toolbar, SearchBox, FilterTabs, DataTable, Btn, Chip, Avatar,
    Panel, Meter, EmptyState, ErrorState, LoadingState, useAsync,
} from '../../../../components/company-dash/dashUi';

const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const STATUS_TONE = { active: 'success', pending: 'warning', overdue: 'danger', cancelled: undefined };
const PLANS = ['free', 'starter', 'professional', 'enterprise'];

function downloadCsv(rows) {
    const head = ['Company', 'Domain', 'Plan', 'Amount', 'Cycle', 'Status', 'Next payment'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const body = rows.map((r) => [r.companyName, r.companyDomain, r.plan, r.amount, r.billingCycle, r.status, r.nextPaymentDate ? new Date(r.nextPaymentDate).toISOString().slice(0, 10) : ''].map(esc).join(','));
    const url = URL.createObjectURL(new Blob([[head.join(','), ...body].join('\n')], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `oruinwan-billing-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
}

const Billing = () => {
    const overview = useAsync(() => api.get('/api/admin/billing/overview').then((r) => r.data));
    const records = useAsync(() => api.get('/api/admin/billing/companies').then((r) => (Array.isArray(r.data) ? r.data : [])));
    const companies = useAsync(() => api.get('/api/admin/active-companies').then((r) => (Array.isArray(r.data) ? r.data : [])));
    const [q, setQ] = useState('');
    const [status, setStatus] = useState('all');

    const o = overview.data || {};
    const all = useMemo(() => records.data || [], [records.data]);
    const rows = useMemo(() => all.filter((r) => (status === 'all' || r.status === status)
        && (!q.trim() || `${r.companyName} ${r.companyDomain}`.toLowerCase().includes(q.trim().toLowerCase()))), [all, q, status]);
    const planMix = useMemo(() => {
        const list = companies.data || [];
        return PLANS.map((p) => ({ plan: p, count: list.filter((c) => (c.plan || 'free') === p).length, total: list.length }));
    }, [companies.data]);
    const activeCount = all.filter((r) => r.status === 'active').length;

    const columns = [
        {
            key: 'company', label: 'Company', render: (r) => (
                <div className="cd-cell-user">
                    <Avatar name={r.companyName} size="sm" />
                    <div><div className="cd-cell-title">{r.companyName}</div><div className="cd-cell-sub">{r.companyDomain}</div></div>
                </div>
            ),
        },
        { key: 'plan', label: 'Plan', render: (r) => <Chip tone="accent">{r.plan}</Chip> },
        { key: 'amount', label: 'Amount', className: 'cd-num', render: (r) => money(r.amount) },
        { key: 'cycle', label: 'Cycle', className: 'cd-hide-sm', render: (r) => <span className="cd-muted">{r.billingCycle || '—'}</span> },
        { key: 'next', label: 'Next payment', className: 'cd-hide-sm', render: (r) => <span className="cd-muted">{r.nextPaymentDate ? new Date(r.nextPaymentDate).toLocaleDateString() : '—'}</span> },
        { key: 'status', label: 'Status', render: (r) => <Chip tone={STATUS_TONE[r.status]}>{r.status}</Chip> },
    ];

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="System"
                    title="Revenue & billing"
                    lead="Billing records and plans across companies."
                    actions={<Btn icon={Download} onClick={() => downloadCsv(rows)} disabled={!rows.length}>Export CSV</Btn>}
                />
            )}
        >
            {overview.error ? <ErrorState message={overview.error} onRetry={overview.reload} /> : (
                <KpiGrid>
                    <Kpi label="Monthly recurring" icon={Calendar} loading={overview.loading && !overview.data} value={overview.data ? money(o.monthlyRevenue) : undefined} hint="Active monthly contracts" />
                    <Kpi label="Active contract value" icon={CreditCard} loading={overview.loading && !overview.data} value={overview.data ? money(o.totalRevenue) : undefined} hint="Sum of active billing records" />
                    <Kpi label="Average per company" icon={TrendingUp} loading={overview.loading && !overview.data} value={overview.data ? money(o.avgPerCompany) : undefined} hint="Across active records" />
                    <Kpi label="Paying companies" icon={Receipt} loading={records.loading && !records.data} value={records.data ? activeCount : undefined} hint={records.data ? `${all.length} billing record${all.length === 1 ? '' : 's'} in total` : undefined} />
                </KpiGrid>
            )}

            <Panel title="Companies by plan" icon={Layers}>
                {companies.loading && !companies.data ? <LoadingState /> : companies.error ? <ErrorState message={companies.error} onRetry={companies.reload} /> : (
                    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                        {planMix.map((p) => (
                            <div key={p.plan} className="pf-bar-row">
                                <div className="pf-bar-top"><span style={{ textTransform: 'capitalize' }}>{p.plan}</span><strong>{p.count}</strong></div>
                                <Meter value={p.total ? (p.count / p.total) * 100 : 0} label={`${p.plan} companies`} />
                            </div>
                        ))}
                    </div>
                )}
            </Panel>

            <Toolbar>
                <SearchBox value={q} onChange={setQ} placeholder="Search companies…" />
                <FilterTabs
                    label="Status"
                    value={status}
                    onChange={setStatus}
                    options={['all', 'active', 'pending', 'overdue', 'cancelled'].map((s) => ({ value: s, label: s.replace(/^./, (m) => m.toUpperCase()), count: s === 'all' ? all.length : all.filter((r) => r.status === s).length }))}
                />
            </Toolbar>
            {records.loading && !records.data ? <LoadingState /> : records.error ? (
                <ErrorState message={records.error} onRetry={records.reload} />
            ) : (
                <DataTable
                    caption="Billing records"
                    columns={columns}
                    rows={rows}
                    empty={<EmptyState icon={Receipt} title={all.length ? 'No record matches' : 'No billing records yet'} text={all.length ? 'Try another search or status.' : 'Companies on a paid plan get a billing record here. Everyone is on the free tier so far.'} />}
                />
            )}
        </DashPage>
    );
};

export default Billing;
