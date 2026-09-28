import React, { useMemo, useState } from 'react';
import api from '@services/api';
import { useNavigate } from 'react-router-dom';
import { Building2, MessageSquare, RefreshCcw } from 'lucide-react';
import {
    DashPage, PageHead, Toolbar, SearchBox, FilterTabs, DataTable, Btn, IconBtn, Chip, Avatar,
    EmptyState, ErrorState, LoadingState, useAsync,
} from '../../../../components/company-dash/dashUi';
import CompanyDetail from './CompanyDetail';

const PLAN_TONE = { enterprise: 'accent', professional: 'success', starter: undefined, free: undefined };
const ownerOf = (c) => (c?.admins || []).find((a) => a.role === 'owner')?.user || c?.admins?.[0]?.user || null;

const ActiveCompanies = () => {
    const navigate = useNavigate();
    const list = useAsync(() => api.get('/api/admin/active-companies').then((r) => (Array.isArray(r.data) ? r.data : [])));
    const [q, setQ] = useState('');
    const [plan, setPlan] = useState('all');
    const [selected, setSelected] = useState(null);

    const companies = useMemo(() => list.data || [], [list.data]);
    const counts = useMemo(() => companies.reduce((acc, c) => { const p = c.plan || 'free'; acc[p] = (acc[p] || 0) + 1; return acc; }, {}), [companies]);
    const rows = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return companies.filter((c) => (plan === 'all' || (c.plan || 'free') === plan)
            && (!needle || [c.name, c.domain, ownerOf(c)?.username, ownerOf(c)?.email].some((v) => String(v || '').toLowerCase().includes(needle))));
    }, [companies, q, plan]);

    const columns = [
        {
            key: 'company', label: 'Company', render: (c) => (
                <div className="cd-cell-user">
                    <Avatar name={c.name} src={c.logo} />
                    <div>
                        <div className="cd-cell-title">{c.displayName || c.name}</div>
                        <div className="cd-cell-sub">{c.domain || 'No domain'}</div>
                    </div>
                </div>
            ),
        },
        { key: 'plan', label: 'Plan', render: (c) => <Chip tone={PLAN_TONE[c.plan]}>{(c.plan || 'free').replace(/^./, (m) => m.toUpperCase())}</Chip> },
        {
            key: 'owner', label: 'Owner', className: 'cd-hide-sm', render: (c) => {
                const o = ownerOf(c);
                return o ? <div><div className="cd-cell-title" style={{ fontWeight: 500 }}>{o.username || o.name}</div><div className="cd-cell-sub">{o.email}</div></div> : <span className="cd-muted">—</span>;
            },
        },
        { key: 'status', label: 'Status', className: 'cd-hide-sm', render: (c) => (c.isActive === false ? <Chip tone="danger">Suspended</Chip> : c.isSetupComplete ? <Chip tone="success">Live</Chip> : <Chip tone="warning">In setup</Chip>) },
        { key: 'joined', label: 'Joined', className: 'cd-hide-sm', render: (c) => <span className="cd-muted">{new Date(c.createdAt).toLocaleDateString()}</span> },
        {
            key: 'actions', label: '', className: 'cd-num', render: (c) => {
                const o = ownerOf(c);
                return (
                    <div style={{ display: 'inline-flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                        {o?._id && (
                            <IconBtn className="cd-hide-sm" label={`Message ${o.username || 'owner'}`} onClick={() => navigate(`/platform-admin/dm/user/${o._id}`)}>
                                <MessageSquare size={15} />
                            </IconBtn>
                        )}
                        <Btn size="sm" onClick={() => setSelected(c)}>Details</Btn>
                    </div>
                );
            },
        },
    ];

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Platform"
                    title="Companies"
                    lead={list.data ? `${companies.length} verified compan${companies.length === 1 ? 'y' : 'ies'} on Oruinwan.` : 'Verified companies on Oruinwan.'}
                    actions={<Btn icon={RefreshCcw} onClick={list.reload}>Refresh</Btn>}
                />
            )}
        >
            <Toolbar>
                <SearchBox value={q} onChange={setQ} placeholder="Search name, domain or owner…" />
                <FilterTabs
                    label="Plan"
                    value={plan}
                    onChange={setPlan}
                    options={[
                        { value: 'all', label: 'All', count: companies.length },
                        ...['free', 'starter', 'professional', 'enterprise'].filter((p) => counts[p]).map((p) => ({ value: p, label: p.replace(/^./, (m) => m.toUpperCase()), count: counts[p] })),
                    ]}
                />
            </Toolbar>
            {list.loading && !list.data ? <LoadingState /> : list.error ? (
                <ErrorState message={list.error} onRetry={list.reload} />
            ) : (
                <DataTable
                    caption="Verified companies"
                    columns={columns}
                    rows={rows}
                    onRowClick={setSelected}
                    empty={<EmptyState icon={Building2} title={companies.length ? 'No company matches' : 'No verified companies yet'} text={companies.length ? 'Try another search or plan.' : 'Approved registrations appear here.'} />}
                />
            )}
            <CompanyDetail company={selected} onClose={() => setSelected(null)} />
        </DashPage>
    );
};

export default ActiveCompanies;
