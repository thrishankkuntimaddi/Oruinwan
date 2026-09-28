import React, { useMemo, useState } from 'react';
import { Mail, Users, UserCheck, Wifi, Clock, Building } from 'lucide-react';
import { useCompany } from '../../contexts/CompanyContext';
import { useToast } from '../../contexts/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { getCompanyMembers } from '../../services/companyService';
import { getDepartments, assignUserToDepartment } from '../../services/departmentService';
import { InviteUserModal } from '../../components/company';
import EmployeeActionsMenu from '../../components/company/EmployeeActionsMenu';
import {
    DashPage, PageHead, KpiGrid, Kpi, Toolbar, SearchBox, FilterTabs, SelectBox, Btn, Chip, Dot,
    RoleChip, DataTable, LoadingState, ErrorState, EmptyState, Dialog, Field, Avatar, useAsync, errorMessage,
} from '../../components/company-dash/dashUi';
import './admin.css';

const TABS = [
    { value: 'all', label: 'All', test: () => true },
    { value: 'admins', label: 'Admins', test: (m) => ['owner', 'admin'].includes(m.companyRole) },
    { value: 'managers', label: 'Managers', test: (m) => m.companyRole === 'manager' },
    { value: 'members', label: 'Members', test: (m) => m.companyRole === 'member' },
    { value: 'guests', label: 'Guests', test: (m) => m.companyRole === 'guest' },
];

const STATUS_TONE = { active: 'success', suspended: 'danger', blocked: 'danger', pending: 'warning', pending_company: 'warning', invited: 'warning' };

const UserManagement = () => {
    const { company } = useCompany();
    const { showToast } = useToast();
    const { canInviteUsers, canSuspendUsers, companyRole } = usePermissions();
    const companyId = company?._id;

    const [tab, setTab] = useState('all');
    const [query, setQuery] = useState('');
    const [dept, setDept] = useState('all');
    const [selected, setSelected] = useState([]);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkDept, setBulkDept] = useState('');
    const [bulkBusy, setBulkBusy] = useState(false);

    const { data, loading, error, reload } = useAsync(async () => {
        if (!companyId) return { members: [], departments: [] };
        const [m, d] = await Promise.all([getCompanyMembers(companyId), getDepartments(companyId).catch(() => ({ departments: [] }))]);
        return { members: m.members || [], departments: d.departments || [] };
    }, [companyId], { enabled: !!companyId });

    const members = useMemo(() => data?.members || [], [data]);
    const departments = data?.departments || [];

    const filtered = useMemo(() => {
        const t = TABS.find((x) => x.value === tab) || TABS[0];
        const q = query.trim().toLowerCase();
        return members.filter((m) => t.test(m)
            && (!q || [m.username, m.email, m.companyEmail, m.jobTitle].some((v) => v?.toLowerCase().includes(q)))
            && (dept === 'all' || (dept === 'none' ? !(m.departments?.length) : m.departments?.some((d) => String(d._id || d) === dept))));
    }, [members, tab, query, dept]);

    const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.value, members.filter(t.test).length])), [members]);
    const stats = useMemo(() => ({
        total: members.length,
        active: members.filter((m) => (m.accountStatus || 'active') === 'active').length,
        online: members.filter((m) => m.isOnline).length,
        pending: members.filter((m) => /pending|invited/.test(m.accountStatus || '')).length,
        noDept: members.filter((m) => !m.departments?.length).length,
    }), [members]);

    const allChecked = filtered.length > 0 && filtered.every((m) => selected.includes(m._id));
    const toggleAll = () => setSelected(allChecked ? [] : filtered.map((m) => m._id));
    const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

    const bulkAssign = async () => {
        setBulkBusy(true);
        try {
            const results = await Promise.allSettled(selected.map((uid) => assignUserToDepartment(uid, bulkDept)));
            const failed = results.filter((r) => r.status === 'rejected');
            if (failed.length) showToast(`${results.length - failed.length} added, ${failed.length} failed: ${errorMessage(failed[0].reason)}`, 'error');
            else showToast(`Added ${results.length} ${results.length === 1 ? 'person' : 'people'} to the department`, 'success');
            setBulkOpen(false);
            setSelected([]);
            reload();
        } finally {
            setBulkBusy(false);
        }
    };

    const columns = [
        ...(canSuspendUsers ? [{ key: 'sel', className: 'ad-col-sel', label: <input type="checkbox" className="ad-box" aria-label="Select all" checked={allChecked} onChange={toggleAll} /> }] : []),
        { key: 'user', label: 'Person' },
        { key: 'role', label: 'Role' },
        { key: 'dept', label: 'Departments', className: 'cd-hide-sm' },
        { key: 'status', label: 'Status', className: 'cd-hide-sm' },
        { key: 'actions', label: <span className="sr-only">Actions</span>, className: 'cd-num' },
    ];

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Organization"
                    title="People"
                    lead="Everyone in the company — roles, departments and access."
                    actions={canInviteUsers && <Btn variant="primary" icon={Mail} onClick={() => setInviteOpen(true)} disabled={!companyId}>Invite people</Btn>}
                />
            )}
        >
            <KpiGrid min={150}>
                <Kpi loading={loading} label="People" value={data ? stats.total : undefined} icon={Users} />
                <Kpi loading={loading} label="Active" value={data ? stats.active : undefined} icon={UserCheck} tone="success" />
                <Kpi loading={loading} label="Online now" value={data ? stats.online : undefined} icon={Wifi} tone="muted" />
                <Kpi loading={loading} label="Pending" value={data ? stats.pending : undefined} icon={Clock} tone="muted" />
                <Kpi loading={loading} label="No department" value={data ? stats.noDept : undefined} icon={Building} tone="muted" onClick={() => setDept('none')} hint="Click to filter" />
            </KpiGrid>

            <Toolbar>
                <FilterTabs value={tab} onChange={setTab} label="Role" options={TABS.map((t) => ({ value: t.value, label: t.label, count: data ? counts[t.value] : undefined }))} />
                <SearchBox value={query} onChange={setQuery} placeholder="Search name, email, title…" />
                <SelectBox value={dept} onChange={setDept} label="Department">
                    <option value="all">All departments</option>
                    <option value="none">No department</option>
                    {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                </SelectBox>
            </Toolbar>

            {selected.length > 0 && canSuspendUsers && (
                <div className="ad-bulk" role="region" aria-label="Bulk actions">
                    <strong>{selected.length} selected</strong>
                    <Btn size="sm" variant="primary" icon={Building} onClick={() => { setBulkDept(''); setBulkOpen(true); }} disabled={!departments.length}>Add to department</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => setSelected([])}>Clear</Btn>
                </div>
            )}

            {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <LoadingState label="Loading people…" /> : (
                <DataTable columns={columns} caption="Company people" maxHeight="calc(100dvh - 330px)">
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={columns.length} style={{ padding: 0 }}>
                                <EmptyState icon={Users} title={members.length ? 'No one matches these filters' : 'No people yet'} text={members.length ? 'Try another search, role or department.' : 'Invite people or onboard them in bulk.'} />
                            </td></tr>
                        ) : filtered.map((m) => (
                            <tr key={m._id} style={selected.includes(m._id) ? { background: 'var(--highlight-bg-weak)' } : undefined}>
                                {canSuspendUsers && (
                                    <td style={{ width: 36 }}>
                                        <input type="checkbox" className="ad-box" aria-label={`Select ${m.username}`} checked={selected.includes(m._id)} onChange={() => toggle(m._id)} />
                                    </td>
                                )}
                                <td>
                                    <div className="cd-cell-user">
                                        <Avatar user={m} />
                                        <div>
                                            <div className="cd-cell-title">{m.username || m.email}</div>
                                            <div className="cd-cell-sub">{[m.jobTitle, m.companyEmail || m.email].filter(Boolean).join(' · ')}</div>
                                        </div>
                                    </div>
                                </td>
                                <td><RoleChip role={m.companyRole} /></td>
                                <td className="cd-hide-sm">
                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                        {m.departments?.length ? m.departments.map((d) => <Chip key={d._id || d}>{d.name || 'Department'}</Chip>) : <span className="cd-muted">—</span>}
                                    </div>
                                </td>
                                <td className="cd-hide-sm">
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                                        {(m.accountStatus || 'active') === 'active'
                                            ? <><Dot tone={m.isOnline ? 'success' : undefined} /><span className="cd-muted">{m.isOnline ? 'Online' : 'Offline'}</span></>
                                            : <Chip tone={STATUS_TONE[m.accountStatus]}>{String(m.accountStatus).replace('_', ' ')}</Chip>}
                                    </span>
                                </td>
                                <td className="cd-num">
                                    {canSuspendUsers && <EmployeeActionsMenu employee={m} departments={departments} onUpdate={reload} viewerRole={companyRole} />}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </DataTable>
            )}

            <InviteUserModal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} companyId={companyId} departments={departments} onInvited={reload} />

            <Dialog
                open={bulkOpen}
                title="Add to department"
                lead={`Add ${selected.length} selected ${selected.length === 1 ? 'person' : 'people'} to a department.`}
                onClose={() => setBulkOpen(false)}
                busy={bulkBusy}
                size="sm"
                footer={(
                    <>
                        <Btn variant="ghost" onClick={() => setBulkOpen(false)} disabled={bulkBusy}>Cancel</Btn>
                        <Btn variant="primary" loading={bulkBusy} disabled={!bulkDept} onClick={bulkAssign}>Add</Btn>
                    </>
                )}
            >
                <Field label="Department" htmlFor="ad-bulk-dept">
                    <select id="ad-bulk-dept" className="gl-input cd-select" value={bulkDept} onChange={(e) => setBulkDept(e.target.value)}>
                        <option value="">Choose…</option>
                        {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                    </select>
                </Field>
            </Dialog>
        </DashPage>
    );
};

export default UserManagement;
