import React, { useMemo, useState } from 'react';
import { GitBranch, RefreshCw, ChevronDown, ChevronRight, Building2, Users, UserX } from 'lucide-react';
import api from '@services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
    DashPage, PageHead, Panel, KpiGrid, Kpi, FilterTabs, Btn, Avatar, RoleChip, SearchBox, Toolbar,
    ErrorState, EmptyState, LoadingState, useAsync, errorMessage,
} from '../../components/company-dash/dashUi';
import { companyIdOf } from '../workspace-os/wosShared';
import { isAdminUser } from '../../components/company-dash/dashNav';

function Toggle({ open, disabled, onClick, label }) {
    return (
        <button type="button" className="wo-node-toggle" disabled={disabled} onClick={onClick} aria-expanded={disabled ? undefined : open} aria-label={label}>
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
    );
}

/** A department with its head, managers and teams (and each team's members). */
function DeptNode({ dept }) {
    const [open, setOpen] = useState(true);
    const teams = dept.teams || [];
    return (
        <div>
            <div className="wo-node" data-kind="department">
                <Toggle open={open} disabled={!teams.length} onClick={() => setOpen((o) => !o)} label={`${dept.name} teams`} />
                <Building2 size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <div className="wo-node-main">
                    <div className="wo-node-title">{dept.name}</div>
                    <div className="wo-node-sub">
                        {dept.memberCount} member{dept.memberCount === 1 ? '' : 's'}
                        {dept.head ? ` · Head: ${dept.head.username}` : ' · No head'}
                        {teams.length ? ` · ${teams.length} team${teams.length === 1 ? '' : 's'}` : ''}
                    </div>
                </div>
                {(dept.managers || []).length > 0 && (
                    <span className="wo-node-side wo-avatars" title={`Managers: ${dept.managers.map((m) => m.username).join(', ')}`}>
                        {dept.managers.slice(0, 4).map((m) => <Avatar key={m._id} user={m} size="sm" />)}
                    </span>
                )}
            </div>
            {open && teams.length > 0 && (
                <div className="wo-tree">
                    {teams.map((t) => <TeamNode key={t.id} team={t} />)}
                </div>
            )}
        </div>
    );
}

function TeamNode({ team }) {
    const [open, setOpen] = useState(false);
    const members = team.members || [];
    return (
        <div>
            <div className="wo-node" data-kind="team">
                <Toggle open={open} disabled={!members.length} onClick={() => setOpen((o) => !o)} label={`${team.name} members`} />
                <Users size={14} style={{ color: 'var(--state-success)', flexShrink: 0 }} />
                <div className="wo-node-main">
                    <div className="wo-node-title">{team.name}</div>
                    <div className="wo-node-sub">{team.memberCount} member{team.memberCount === 1 ? '' : 's'}{team.lead ? ` · Lead: ${team.lead.username}` : ''}</div>
                </div>
            </div>
            {open && members.length > 0 && (
                <div className="wo-tree">
                    {members.map((m) => (
                        <div key={m.id || m.username} className="wo-node" data-kind="person">
                            <span className="wo-node-toggle" aria-hidden="true" />
                            <Avatar user={m} size="sm" />
                            <div className="wo-node-main">
                                <div className="wo-node-title">{m.username}</div>
                                <div className="wo-node-sub">{m.role}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/** People nested under their manager; admins can change who someone reports to. */
function ReportingNode({ node, people, canEdit, onSetManager, savingId }) {
    const [open, setOpen] = useState(true);
    const reports = node.reports || [];
    return (
        <div data-testid={`report-${node.username}`}>
            <div className="wo-node" data-kind="person">
                <Toggle open={open} disabled={!reports.length} onClick={() => setOpen((o) => !o)} label={`${node.username} reports`} />
                <Avatar user={node} size="sm" />
                <div className="wo-node-main">
                    <div className="wo-node-title">{node.username}</div>
                    <div className="wo-node-sub">
                        <RoleChip role={node.companyRole} />
                        {reports.length ? ` ${reports.length} direct report${reports.length === 1 ? '' : 's'}` : ''}
                    </div>
                </div>
                {canEdit && (
                    <label className="wo-node-side">
                        Reports to
                        <select
                            className="gl-input cd-select"
                            aria-label={`Manager of ${node.username}`}
                            value={node.reportsTo ? String(node.reportsTo) : ''}
                            disabled={savingId === String(node.id)}
                            onChange={(e) => onSetManager(node.id, e.target.value || null)}
                        >
                            <option value="">No one</option>
                            {people.filter((p) => String(p.id) !== String(node.id)).map((p) => <option key={p.id} value={p.id}>{p.username}</option>)}
                        </select>
                    </label>
                )}
            </div>
            {open && reports.length > 0 && (
                <div className="wo-tree">
                    {reports.map((r) => <ReportingNode key={r.id} node={r} people={people} canEdit={canEdit} onSetManager={onSetManager} savingId={savingId} />)}
                </div>
            )}
        </div>
    );
}

const flattenPeople = (nodes) => nodes.flatMap((n) => [n, ...flattenPeople(n.reports || [])]);

/** Company structure: departments → teams → people, and reporting lines. */
export default function OrgChartPage() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const companyId = companyIdOf(user);
    const canEdit = isAdminUser(user);
    const [view, setView] = useState('departments');
    const [q, setQ] = useState('');
    const [savingId, setSavingId] = useState(null);

    const { data, loading, error, reload } = useAsync(
        () => api.get(`/api/companies/${companyId}/org-chart`).then((r) => r.data),
        [companyId],
        { enabled: !!companyId },
    );
    const people = useMemo(() => flattenPeople(data?.reportingLines || []), [data]);
    const depts = useMemo(() => {
        const s = q.trim().toLowerCase();
        return (data?.departments || []).filter((d) => !s || d.name?.toLowerCase().includes(s)
            || (d.teams || []).some((t) => t.name?.toLowerCase().includes(s)));
    }, [data, q]);

    const setManager = async (employeeId, managerId) => {
        setSavingId(String(employeeId));
        try {
            await api.put(`/api/companies/${companyId}/employees/${employeeId}/manager`, { managerId });
            showToast('Reporting line updated', 'success');
            await reload();
        } catch (err) {
            showToast(errorMessage(err, 'Could not update the reporting line'), 'error');
        } finally {
            setSavingId(null);
        }
    };

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Collaboration"
                    title="Org chart"
                    lead={data ? `${data.company?.name} · ${data.totalEmployees} people · ${data.departments?.length || 0} departments` : 'How the company is organised.'}
                    actions={<Btn icon={RefreshCw} loading={loading} onClick={reload}>Refresh</Btn>}
                />
            )}
        >
            {!companyId ? (
                <EmptyState icon={GitBranch} title="No company" text="The org chart is available for company accounts." />
            ) : error && !data ? (
                <ErrorState message={error} onRetry={reload} />
            ) : !data ? (
                <LoadingState label="Loading the org chart…" />
            ) : (
                <>
                    <KpiGrid>
                        <Kpi label="People" value={data.totalEmployees} icon={Users} />
                        <Kpi label="Departments" value={data.departments?.length || 0} icon={Building2} />
                        <Kpi label="Teams" value={(data.departments || []).reduce((n, d) => n + (d.teams?.length || 0), 0)} icon={GitBranch} />
                        <Kpi label="Without a department" value={data.unassignedCount || 0} icon={UserX} tone={data.unassignedCount ? 'danger' : 'muted'} />
                    </KpiGrid>
                    <Toolbar>
                        <FilterTabs
                            value={view}
                            onChange={setView}
                            label="Org chart view"
                            options={[{ value: 'departments', label: 'Departments & teams' }, { value: 'reporting', label: 'Reporting lines' }]}
                        />
                        {view === 'departments' && <SearchBox value={q} onChange={setQ} placeholder="Find a department or team…" />}
                    </Toolbar>

                    {view === 'departments' ? (
                        <Panel>
                            <div className="wo-org">
                                <div className="wo-org-root">
                                    <Building2 size={18} />
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 700 }}>{data.company?.name}</div>
                                        <div className="cd-muted" style={{ fontSize: 12 }}>{data.company?.industry || 'Company'}</div>
                                    </div>
                                </div>
                                {depts.length === 0 ? (
                                    <EmptyState
                                        icon={Building2}
                                        title={(data.departments || []).length ? 'No matches' : 'No departments yet'}
                                        text={(data.departments || []).length ? 'Nothing matches your search.' : 'Add departments from the Departments page.'}
                                    />
                                ) : (
                                    <div className="wo-tree" style={{ marginLeft: 14, paddingLeft: 14, borderLeft: '1px dashed var(--border-accent)' }}>
                                        {depts.map((d) => <DeptNode key={d.id} dept={d} />)}
                                    </div>
                                )}
                            </div>
                        </Panel>
                    ) : (
                        <Panel>
                            {(data.reportingLines || []).length === 0 ? (
                                <EmptyState icon={Users} title="No people yet" />
                            ) : (
                                <div className="wo-tree">
                                    {!canEdit && <p className="cd-muted" style={{ margin: 0, fontSize: 12 }}>Only owners and admins can change reporting lines.</p>}
                                    {data.reportingLines.map((root) => (
                                        <ReportingNode key={root.id} node={root} people={people} canEdit={canEdit} onSetManager={setManager} savingId={savingId} />
                                    ))}
                                </div>
                            )}
                        </Panel>
                    )}
                </>
            )}
        </DashPage>
    );
}
