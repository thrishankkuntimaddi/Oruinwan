import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Building, Users, Crown, MessageCircle, Pencil } from 'lucide-react';
import { useCompany } from '../../contexts/CompanyContext';
import { getDepartments } from '../../services/departmentService';
import DepartmentModal from '../../components/company/DepartmentModal';
import DepartmentDetailsModal from '../../components/company/DepartmentDetailsModal';
import {
    DashPage, PageHead, KpiGrid, Kpi, Toolbar, SearchBox, Btn, IconBtn, Chip, DataTable, LoadingState, ErrorState, EmptyState, Avatar, useAsync,
} from '../../components/company-dash/dashUi';
import { idOf } from '../../components/company-dash/dashNav';
import './admin.css';

const DepartmentManagement = () => {
    const { company, isCompanyAdmin } = useCompany();
    const navigate = useNavigate();
    const companyId = company?._id;
    const canEdit = isCompanyAdmin();
    const [query, setQuery] = useState('');
    const [editing, setEditing] = useState(undefined); // undefined closed, null new, object edit
    const [openId, setOpenId] = useState(null);

    const { data, loading, error, reload } = useAsync(
        () => getDepartments(companyId).then((r) => r.departments || []),
        [companyId],
        { enabled: !!companyId },
    );
    const departments = useMemo(() => data || [], [data]);
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return departments.filter((d) => !q || d.name?.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q));
    }, [departments, query]);

    const stats = useMemo(() => {
        const people = new Set(departments.flatMap((d) => (d.members || []).map(idOf)));
        return {
            count: departments.length,
            people: people.size,
            noHead: departments.filter((d) => !d.head).length,
            largest: departments.reduce((m, d) => Math.max(m, d.members?.length || 0), 0),
        };
    }, [departments]);

    const open = departments.find((d) => d._id === openId) || null;
    const dmWorkspace = company?.defaultWorkspace?._id || company?.defaultWorkspace;

    const columns = [
        { key: 'name', label: 'Department' },
        { key: 'head', label: 'Head' },
        { key: 'members', label: 'People', className: 'cd-num' },
        { key: 'ws', label: 'Workspaces', className: 'cd-num cd-hide-sm' },
        { key: 'created', label: 'Created', className: 'cd-hide-sm' },
        { key: 'actions', label: <span className="sr-only">Actions</span>, className: 'cd-num' },
    ];

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Organization"
                    title="Departments"
                    lead="Company structure: who belongs where, and who leads each group."
                    actions={canEdit && <Btn variant="primary" icon={Plus} onClick={() => setEditing(null)} disabled={!companyId}>New department</Btn>}
                />
            )}
        >
            <KpiGrid min={160}>
                <Kpi loading={loading} label="Departments" value={data ? stats.count : undefined} icon={Building} />
                <Kpi loading={loading} label="People assigned" value={data ? stats.people : undefined} icon={Users} tone="muted" />
                <Kpi loading={loading} label="Without a head" value={data ? stats.noHead : undefined} icon={Crown} tone={stats.noHead ? 'danger' : 'muted'} />
                <Kpi loading={loading} label="Largest" value={data ? stats.largest : undefined} icon={Users} tone="muted" hint="people in one department" />
            </KpiGrid>

            <Toolbar>
                <SearchBox value={query} onChange={setQuery} placeholder="Search departments…" />
            </Toolbar>

            {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <LoadingState label="Loading departments…" /> : (
                <DataTable columns={columns} caption="Departments">
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={columns.length} style={{ padding: 0 }}>
                                <EmptyState
                                    icon={Building}
                                    title={departments.length ? 'No department matches' : 'No departments yet'}
                                    text={departments.length ? 'Try another search.' : 'Create departments to organise people and give managers a scope.'}
                                    action={!departments.length && canEdit && <Btn size="sm" icon={Plus} onClick={() => setEditing(null)}>New department</Btn>}
                                />
                            </td></tr>
                        ) : filtered.map((d) => (
                            <tr key={d._id} data-clickable="true" onClick={() => setOpenId(d._id)}>
                                <td>
                                    <div className="cd-cell-title">{d.name}</div>
                                    {d.description && <div className="cd-cell-sub">{d.description}</div>}
                                </td>
                                <td>
                                    {d.head ? (
                                        <div className="cd-cell-user">
                                            <Avatar user={d.head} size="sm" />
                                            <span className="cd-cell-title" style={{ fontWeight: 500 }}>{d.head.username || 'Unknown'}</span>
                                            {dmWorkspace && idOf(d.head) && (
                                                <IconBtn label={`Message ${d.head.username}`} onClick={(e) => { e.stopPropagation(); navigate(`/workspace/${dmWorkspace}/dm/new/${idOf(d.head)}`); }}>
                                                    <MessageCircle size={14} />
                                                </IconBtn>
                                            )}
                                        </div>
                                    ) : <Chip tone="warning">No head</Chip>}
                                </td>
                                <td className="cd-num">{d.members?.length || 0}</td>
                                <td className="cd-num cd-hide-sm">{d.workspaces?.length || 0}</td>
                                <td className="cd-hide-sm cd-muted">{d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '—'}</td>
                                <td className="cd-num">
                                    {canEdit && (
                                        <IconBtn label={`Rename ${d.name}`} onClick={(e) => { e.stopPropagation(); setEditing(d); }}>
                                            <Pencil size={14} />
                                        </IconBtn>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </DataTable>
            )}

            <DepartmentModal isOpen={editing !== undefined} onClose={() => setEditing(undefined)} companyId={companyId} department={editing || null} onSuccess={reload} />
            <DepartmentDetailsModal isOpen={!!open} onClose={() => setOpenId(null)} department={open} companyId={companyId} onUpdate={reload} canEdit={canEdit} />
        </DashPage>
    );
};

export default DepartmentManagement;
