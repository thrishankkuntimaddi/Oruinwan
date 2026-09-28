import React, { useEffect, useState } from 'react';
import { Contact, RefreshCw, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import api from '@services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
    DashPage, PageHead, Toolbar, SearchBox, SelectBox, DataTable, Btn, IconBtn, Avatar, RoleChip, Dot, Chip,
    ErrorState, EmptyState, useAsync, timeAgo, errorMessage,
} from '../../components/company-dash/dashUi';
import { companyIdOf, downloadCsv } from './wosShared';

const ROLES = ['owner', 'admin', 'manager', 'member', 'guest'];
const STATUS_TONE = { active: 'success', invited: 'accent', pending: 'accent', suspended: 'danger', removed: 'danger' };
const LIMIT = 25;

/** Company directory: everyone with role, departments, status and last sign-in. */
export default function EmployeeDirectoryPage({ companyId: propCompanyId }) {
    const { user } = useAuth();
    const { showToast } = useToast();
    const companyId = propCompanyId || companyIdOf(user);
    const [search, setSearch] = useState('');
    const [debounced, setDebounced] = useState('');
    const [dept, setDept] = useState('');
    const [role, setRole] = useState('');
    const [status, setStatus] = useState('active');
    const [page, setPage] = useState(1);
    const [exporting, setExporting] = useState(false);

    useEffect(() => { const t = setTimeout(() => setDebounced(search.trim()), 300); return () => clearTimeout(t); }, [search]);
    useEffect(() => { setPage(1); }, [debounced, dept, role, status]);

    const departments = useAsync(() => api.get('/api/departments').then((r) => r.data?.departments || []));
    const params = { page, limit: LIMIT, status, ...(debounced && { search: debounced }), ...(dept && { dept }), ...(role && { role }) };
    const { data, loading, error, reload } = useAsync(
        () => api.get(`/api/companies/${companyId}/employees`, { params }).then((r) => r.data),
        [companyId, page, debounced, dept, role, status],
        { enabled: !!companyId },
    );
    const rows = data?.employees || [];
    const pg = data?.pagination || { page: 1, pages: 1, total: rows.length, limit: LIMIT };

    const exportCsv = async () => {
        setExporting(true);
        try {
            const all = [];
            for (let p = 1; p <= 20; p += 1) {
                const r = await api.get(`/api/companies/${companyId}/employees`, { params: { ...params, page: p, limit: 100 } });
                all.push(...(r.data?.employees || []));
                if (p >= (r.data?.pagination?.pages || 1)) break;
            }
            downloadCsv('employee-directory.csv', [
                ['Name', 'Email', 'Role', 'Departments', 'Status', 'Last sign-in'],
                ...all.map((e) => [[e.firstName, e.lastName].filter(Boolean).join(' ') || e.username, e.email, e.companyRole, (e.departmentNames || []).join('; '), e.accountStatus, e.lastLoginAt || '']),
            ]);
        } catch (err) {
            showToast(errorMessage(err, 'Could not export the directory'), 'error');
        } finally {
            setExporting(false);
        }
    };

    const columns = [
        {
            key: 'emp', label: 'Person', render: (e) => (
                <div className="cd-cell-user">
                    <span style={{ position: 'relative', display: 'inline-flex' }}>
                        <Avatar user={e} size="sm" />
                    </span>
                    <div>
                        <div className="cd-cell-title">{[e.firstName, e.lastName].filter(Boolean).join(' ') || e.username}</div>
                        <div className="cd-cell-sub">{e.email}</div>
                    </div>
                </div>
            ),
        },
        { key: 'role', label: 'Role', render: (e) => <RoleChip role={e.companyRole} /> },
        {
            key: 'dept', label: 'Departments', className: 'cd-hide-sm', render: (e) => (e.departmentNames || []).length
                ? <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{e.departmentNames.map((n) => <Chip key={n}>{n}</Chip>)}</div>
                : <span className="cd-muted">None</span>,
        },
        {
            key: 'status', label: 'Status', render: (e) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <Dot tone={e.isOnline ? 'success' : undefined} />
                    <span style={{ color: STATUS_TONE[e.accountStatus] === 'danger' ? 'var(--state-danger)' : 'var(--text-primary)' }}>{e.isOnline ? 'Online' : (e.accountStatus || 'unknown')}</span>
                </span>
            ),
        },
        { key: 'seen', label: 'Last sign-in', className: 'cd-hide-sm', render: (e) => <span className="cd-muted">{e.lastLoginAt ? timeAgo(e.lastLoginAt) : 'Never'}</span> },
    ];

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Collaboration"
                    title="Directory"
                    lead={pg.total ? `${pg.total} people in the company` : 'Everyone in the company, with role and status.'}
                    actions={(
                        <>
                            <Btn icon={RefreshCw} loading={loading} onClick={reload}>Refresh</Btn>
                            <Btn icon={Download} loading={exporting} disabled={!rows.length} onClick={exportCsv}>Export CSV</Btn>
                        </>
                    )}
                />
            )}
        >
            {!companyId ? (
                <EmptyState icon={Contact} title="No company" text="The directory is available for company accounts." />
            ) : (
                <>
                    <Toolbar>
                        <SearchBox value={search} onChange={setSearch} placeholder="Search by name or email…" />
                        <SelectBox value={dept} onChange={setDept} label="Department" style={{ maxWidth: 200 }}>
                            <option value="">All departments</option>
                            {(departments.data || []).map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                        </SelectBox>
                        <SelectBox value={role} onChange={setRole} label="Role" style={{ maxWidth: 160 }}>
                            <option value="">All roles</option>
                            {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                        </SelectBox>
                        <SelectBox value={status} onChange={setStatus} label="Status" style={{ maxWidth: 160 }}>
                            <option value="active">Active</option>
                            <option value="invited">Invited</option>
                            <option value="pending">Pending</option>
                            <option value="suspended">Suspended</option>
                            <option value="all">Any status</option>
                        </SelectBox>
                    </Toolbar>
                    {error && !data ? (
                        <ErrorState message={error} onRetry={reload} />
                    ) : (
                        <>
                            <DataTable
                                columns={columns}
                                rows={rows}
                                maxHeight="calc(100dvh - 330px)"
                                empty={loading ? <p className="cd-muted" style={{ padding: 24, textAlign: 'center', margin: 0, fontSize: 13 }}>Loading…</p>
                                    : <EmptyState icon={Contact} title="No one found" text="Try a different search or filter." />}
                            />
                            {pg.pages > 1 && (
                                <div className="wo-pager">
                                    <span>{(page - 1) * pg.limit + 1}–{Math.min(page * pg.limit, pg.total)} of {pg.total}</span>
                                    <div>
                                        <IconBtn label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft size={15} /></IconBtn>
                                        <span>{page} / {pg.pages}</span>
                                        <IconBtn label="Next page" disabled={page >= pg.pages} onClick={() => setPage((p) => Math.min(pg.pages, p + 1))}><ChevronRight size={15} /></IconBtn>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </>
            )}
        </DashPage>
    );
}
