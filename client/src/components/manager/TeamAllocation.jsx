import React, { useMemo, useState } from 'react';
import { Users, AlertTriangle, Coffee, RefreshCw, ListTodo } from 'lucide-react';
import api from '@services/api';
import {
    DashPage, PageHead, KpiGrid, Kpi, Toolbar, FilterTabs, SearchBox, DataTable, Chip, Meter, Btn, Avatar,
    ErrorState, EmptyState, LoadingState, useAsync,
} from '../company-dash/dashUi';
import { useDepartment, DepartmentGate } from './managerScope';

// Matches the server's buckets: >10 open tasks is high, >5 medium.
const LOAD = {
    high: { label: 'Overloaded', tone: 'danger' },
    medium: { label: 'Busy', tone: 'warning' },
    low: { label: 'Has capacity', tone: 'success' },
};
const CAPACITY = 12;

/** Team load: each department member's open tasks and workspaces, from real task counts. */
export default function TeamAllocation() {
    const scope = useDepartment();
    const { departmentId, department } = scope;
    const [filter, setFilter] = useState('all');
    const [q, setQ] = useState('');
    const { data, loading, error, reload } = useAsync(
        () => api.get(`/api/manager/dashboard/team-load/${departmentId}`).then((r) => r.data),
        [departmentId],
        { enabled: !!departmentId },
    );

    const members = data?.teamMembers || [];
    const idleIds = new Set((data?.idle || []).map((m) => String(m._id)));
    const rows = useMemo(() => {
        const s = q.trim().toLowerCase();
        return members
            .filter((m) => filter === 'all' || (filter === 'high' ? m.workload === 'high' : idleIds.has(String(m._id))))
            .filter((m) => !s || m.username?.toLowerCase().includes(s) || m.email?.toLowerCase().includes(s)
                || (m.workspaces || []).some((w) => String(w).toLowerCase().includes(s)))
            .sort((a, b) => (b.activeTasks || 0) - (a.activeTasks || 0));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [members, filter, q]);
    const totalOpen = members.reduce((n, m) => n + (m.activeTasks || 0), 0);

    const columns = [
        {
            key: 'member', label: 'Member', render: (m) => (
                <div className="cd-cell-user">
                    <Avatar user={m} size="sm" />
                    <div>
                        <div className="cd-cell-title">{m.username}</div>
                        <div className="cd-cell-sub">{m.email}</div>
                    </div>
                </div>
            ),
        },
        {
            key: 'ws', label: 'Workspaces', className: 'cd-hide-sm', render: (m) => (m.workspaces || []).length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {m.workspaces.slice(0, 3).map((w) => <Chip key={w}>{w}</Chip>)}
                    {m.workspaces.length > 3 && <Chip>+{m.workspaces.length - 3}</Chip>}
                </div>
            ) : <span className="cd-muted">None</span>,
        },
        { key: 'open', label: 'Open tasks', className: 'cd-num', render: (m) => m.activeTasks ?? 0 },
        {
            key: 'load', label: 'Load', render: (m) => {
                const meta = LOAD[m.workload] || LOAD.low;
                const v = Math.min(100, Math.round(((m.activeTasks || 0) / CAPACITY) * 100));
                return (
                    <div className="mg-load">
                        <Chip tone={meta.tone}>{idleIds.has(String(m._id)) ? 'Idle' : meta.label}</Chip>
                        <Meter value={v} tone={meta.tone === 'warning' ? undefined : meta.tone} label={`${m.username} load`} />
                    </div>
                );
            },
        },
    ];

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Manager console"
                    title="Team load"
                    lead={`Open tasks (to do, in progress, review) per member${department?.name ? ` of ${department.name}` : ''}.`}
                    actions={departmentId && <Btn icon={RefreshCw} loading={loading} onClick={reload}>Refresh</Btn>}
                />
            )}
        >
            <DepartmentGate scope={scope}>
                {error && !data ? (
                    <ErrorState message={error} onRetry={reload} />
                ) : !data ? (
                    <LoadingState label="Loading team load…" />
                ) : (
                    <>
                        <KpiGrid>
                            <Kpi label="Active members" icon={Users} value={members.length} />
                            <Kpi label="Open tasks" icon={ListTodo} value={totalOpen} hint="Across the team" />
                            <Kpi label="Overloaded" icon={AlertTriangle} tone={data.overloaded?.length ? 'danger' : 'muted'} value={data.overloaded?.length ?? 0} hint="More than 10 open tasks" />
                            <Kpi label="Idle" icon={Coffee} tone="muted" value={data.idle?.length ?? 0} hint="No open tasks" />
                        </KpiGrid>
                        {members.length === 0 ? (
                            <EmptyState icon={Users} title="No active members" text="This department has no active members yet." />
                        ) : (
                            <>
                                <Toolbar>
                                    <FilterTabs
                                        value={filter}
                                        onChange={setFilter}
                                        label="Load filter"
                                        options={[
                                            { value: 'all', label: 'All', count: members.length },
                                            { value: 'high', label: 'Overloaded', count: data.overloaded?.length ?? 0 },
                                            { value: 'idle', label: 'Idle', count: data.idle?.length ?? 0 },
                                        ]}
                                    />
                                    <SearchBox value={q} onChange={setQ} placeholder="Search by name, email or workspace…" />
                                </Toolbar>
                                <DataTable
                                    columns={columns}
                                    rows={rows}
                                    empty={<EmptyState title="Nobody here" text={q ? `No member matches “${q}”.` : 'No member in this group.'} />}
                                />
                            </>
                        )}
                    </>
                )}
            </DepartmentGate>
        </DashPage>
    );
}
