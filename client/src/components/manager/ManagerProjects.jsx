import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, RefreshCw, ArrowUpRight, Globe } from 'lucide-react';
import api from '@services/api';
import {
    DashPage, PageHead, Btn, IconBtn, Toolbar, FilterTabs, SearchBox, DataTable, Meter, Chip,
    ErrorState, EmptyState, LoadingState, KpiGrid, Kpi, useAsync,
} from '../company-dash/dashUi';
import { useDepartment, pct } from './managerScope';

const idOf = (v) => String(v?._id || v || '');

/**
 * Project progress across the manager's workspaces: task totals, open work and
 * completion. "This department" narrows to workspaces linked to the selected department.
 */
export default function ManagerProjects() {
    const navigate = useNavigate();
    const { departmentId, department } = useDepartment();
    const [filter, setFilter] = useState('all');
    const [q, setQ] = useState('');
    const { data, loading, error, reload } = useAsync(
        () => api.get('/api/manager-dashboard/my-workspaces').then((r) => r.data?.workspaces || []),
    );

    const inDept = (ws) => departmentId && (idOf(ws.department) === departmentId || (department?.workspaces || []).map(idOf).includes(idOf(ws._id)));
    const deptCount = (data || []).filter(inDept).length;
    const rows = useMemo(() => {
        const s = q.trim().toLowerCase();
        return (data || [])
            .filter((w) => filter === 'all' || inDept(w))
            .filter((w) => !s || w.name?.toLowerCase().includes(s));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, filter, q, departmentId]);

    const totals = (data || []).reduce((a, w) => ({
        total: a.total + (w.activity?.tasksTotal || 0),
        active: a.active + (w.activity?.tasksActive || 0),
        msgs: a.msgs + (w.activity?.messages || 0),
    }), { total: 0, active: 0, msgs: 0 });

    const columns = [
        {
            key: 'name', label: 'Workspace', render: (ws) => (
                <div className="cd-cell-user">
                    <span className="cd-kpi-icon"><FolderKanban size={13} /></span>
                    <div>
                        <div className="cd-cell-title">{ws.name}</div>
                        <div className="cd-cell-sub">{ws.memberCount ?? 0} members{inDept(ws) ? ` · ${department?.name}` : ''}</div>
                    </div>
                </div>
            ),
        },
        { key: 'status', label: 'Status', className: 'cd-hide-sm', render: (ws) => <Chip tone={ws.status === 'active' ? 'success' : undefined}>{ws.status || 'active'}</Chip> },
        { key: 'tasks', label: 'Tasks', className: 'cd-num', render: (ws) => ws.activity?.tasksTotal ?? 0 },
        { key: 'open', label: 'Open', className: 'cd-num', render: (ws) => ws.activity?.tasksActive ?? 0 },
        {
            key: 'progress', label: 'Completion', render: (ws) => {
                const p = pct(ws.activity?.tasksCompleted || 0, ws.activity?.tasksTotal || 0);
                return p == null ? <span className="cd-muted">No tasks</span> : (
                    <div className="mg-load">
                        <div className="mg-load-top"><span>{p}%</span></div>
                        <Meter value={p} tone="success" label={`${ws.name} task completion`} />
                    </div>
                );
            },
        },
        { key: 'msgs', label: 'Msgs / 7d', className: 'cd-num cd-hide-sm', render: (ws) => ws.activity?.messages ?? 0 },
        {
            key: 'open-btn', label: '', render: (ws) => (
                <IconBtn label={`Open ${ws.name}`} onClick={(e) => { e.stopPropagation(); navigate(`/workspace/${ws._id}/home`); }}>
                    <ArrowUpRight size={15} />
                </IconBtn>
            ),
        },
    ];

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Manager console"
                    title="Projects"
                    lead="Task progress across the workspaces you're part of."
                    actions={<Btn icon={RefreshCw} loading={loading} onClick={reload}>Refresh</Btn>}
                />
            )}
        >
            {error && !data ? (
                <ErrorState message={error} onRetry={reload} />
            ) : !data ? (
                <LoadingState label="Loading projects…" />
            ) : data.length === 0 ? (
                <EmptyState
                    icon={FolderKanban}
                    title="No projects yet"
                    text="Projects are tracked per workspace. You aren't in any workspace yet."
                    action={<Btn icon={Globe} onClick={() => navigate('/workspaces')}>Browse workspaces</Btn>}
                />
            ) : (
                <>
                    <KpiGrid>
                        <Kpi label="Workspaces" value={data.length} icon={Globe} />
                        <Kpi label="Tasks" value={totals.total} icon={FolderKanban} hint="All tasks in these workspaces" />
                        <Kpi label="Open" value={totals.active} hint="To do, in progress or review" />
                        <Kpi label="Messages / 7d" value={totals.msgs} />
                    </KpiGrid>
                    <Toolbar>
                        <FilterTabs
                            value={filter}
                            onChange={setFilter}
                            label="Workspace filter"
                            options={[
                                { value: 'all', label: 'All', count: data.length },
                                ...(departmentId ? [{ value: 'dept', label: department?.name || 'This department', count: deptCount }] : []),
                            ]}
                        />
                        <SearchBox value={q} onChange={setQ} placeholder="Search projects…" />
                    </Toolbar>
                    <DataTable
                        columns={columns}
                        rows={rows}
                        onRowClick={(ws) => navigate(`/workspace/${ws._id}/home`)}
                        empty={<EmptyState title="No projects here" text={filter === 'dept' ? 'No workspace is linked to this department yet.' : 'Nothing matches your search.'} />}
                    />
                </>
            )}
        </DashPage>
    );
}
