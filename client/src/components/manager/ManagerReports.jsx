import React, { useMemo } from 'react';
import { FileBarChart, CheckCircle2, AlertTriangle, ListTodo, Percent, RefreshCw, Eye, EyeOff, Users, Download } from 'lucide-react';
import api from '@services/api';
import {
    DashPage, PageHead, KpiGrid, Kpi, Grid, Panel, Meter, Btn, DataTable, Avatar, EmptyState, ErrorState, LoadingState, useAsync,
} from '../company-dash/dashUi';
import { useDepartment, DepartmentGate, pct } from './managerScope';

const PRIORITIES = ['highest', 'high', 'medium', 'low', 'lowest'];
const VISIBLE = ['Your department and its members', 'Tasks created by or assigned to the team', 'Workspaces you are a member of', 'Team activity counts (messages, tasks)'];
const HIDDEN = ['Other departments', 'Billing and plan', 'Company security settings', 'Audit and compliance logs'];

function toCsv(rows) {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return rows.map((r) => r.map(esc).join(',')).join('\n');
}

/** Department report computed from the real task list and team metrics. */
export default function ManagerReports() {
    const scope = useDepartment();
    const { departmentId, department } = scope;
    const tasks = useAsync(
        () => api.get(`/api/manager/tasks/${departmentId}`).then((r) => r.data),
        [departmentId],
        { enabled: !!departmentId },
    );
    const metrics = useAsync(
        () => api.get(`/api/manager/dashboard/metrics/${departmentId}`).then((r) => r.data),
        [departmentId],
        { enabled: !!departmentId },
    );

    const report = useMemo(() => {
        const g = tasks.data?.tasks;
        if (!g) return null;
        const all = [...g.open, ...g.inProgress, ...g.completed];
        const overdueIds = new Set(g.overdue.map((t) => t._id));
        const people = new Map();
        const bump = (u, key) => {
            const id = String(u?._id || 'none');
            const row = people.get(id) || { _id: id, user: u, open: 0, done: 0, overdue: 0 };
            row[key] += 1;
            people.set(id, row);
        };
        all.forEach((t) => {
            const assignees = (t.assignedTo || []).length ? t.assignedTo : [null];
            assignees.forEach((u) => {
                bump(u, t.status === 'done' ? 'done' : 'open');
                if (overdueIds.has(t._id)) bump(u, 'overdue');
            });
        });
        const byPriority = PRIORITIES.map((p) => [p, all.filter((t) => (t.priority || 'medium') === p).length]);
        return {
            total: all.length,
            done: g.completed.length,
            open: g.open.length + g.inProgress.length,
            overdue: g.overdue.length,
            completion: pct(g.completed.length, all.length),
            people: [...people.values()].sort((a, b) => (b.open + b.done) - (a.open + a.done)),
            byPriority,
        };
    }, [tasks.data]);

    const exportCsv = () => {
        if (!report) return;
        const rows = [['Member', 'Email', 'Open', 'Done', 'Overdue'], ...report.people.map((p) => [p.user?.username || 'Unassigned', p.user?.email || '', p.open, p.done, p.overdue])];
        const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${(department?.name || 'department').toLowerCase().replace(/\s+/g, '-')}-workload.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };

    const refresh = () => { tasks.reload(); metrics.reload(); };
    const columns = [
        {
            key: 'member', label: 'Member', render: (p) => p.user ? (
                <div className="cd-cell-user">
                    <Avatar user={p.user} size="sm" />
                    <div><div className="cd-cell-title">{p.user.username}</div><div className="cd-cell-sub">{p.user.email}</div></div>
                </div>
            ) : <span className="cd-muted">Unassigned</span>,
        },
        { key: 'open', label: 'Open', className: 'cd-num', render: (p) => p.open },
        { key: 'done', label: 'Done', className: 'cd-num', render: (p) => p.done },
        { key: 'overdue', label: 'Overdue', className: 'cd-num', render: (p) => (p.overdue ? <span style={{ color: 'var(--state-danger)', fontWeight: 700 }}>{p.overdue}</span> : 0) },
        {
            key: 'rate', label: 'Completion', className: 'cd-hide-sm', render: (p) => {
                const v = pct(p.done, p.open + p.done);
                return <div className="mg-load"><div className="mg-load-top"><span>{v ?? 0}%</span></div><Meter value={v ?? 0} tone="success" label="Completion" /></div>;
            },
        },
    ];

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Manager console"
                    title="Reports"
                    lead={`Task completion and workload${department?.name ? ` for ${department.name}` : ''}.`}
                    actions={departmentId && (
                        <>
                            <Btn icon={RefreshCw} loading={tasks.loading || metrics.loading} onClick={refresh}>Refresh</Btn>
                            <Btn icon={Download} onClick={exportCsv} disabled={!report || report.total === 0}>Export CSV</Btn>
                        </>
                    )}
                />
            )}
        >
            <DepartmentGate scope={scope}>
                {tasks.error && !report ? (
                    <ErrorState message={tasks.error} onRetry={tasks.reload} />
                ) : !report ? (
                    <LoadingState label="Building the report…" />
                ) : (
                    <>
                        <KpiGrid>
                            <Kpi label="Tasks" value={report.total} icon={ListTodo} />
                            <Kpi label="Completion" value={report.completion == null ? null : `${report.completion}%`} icon={Percent} tone="success" hint={report.total ? `${report.done} of ${report.total} done` : 'No tasks yet'} />
                            <Kpi label="Open" value={report.open} icon={CheckCircle2} hint="To do + in progress" />
                            <Kpi label="Overdue" value={report.overdue} icon={AlertTriangle} tone={report.overdue ? 'danger' : 'muted'} />
                        </KpiGrid>

                        <Grid cols="2">
                            <Panel title="By priority" icon={FileBarChart}>
                                {report.total === 0 ? <p className="cd-muted" style={{ margin: 0, fontSize: 13 }}>No tasks yet.</p> : report.byPriority.map(([p, n]) => (
                                    <div key={p} className="mg-bar-row">
                                        <span className="mg-bar-label" style={{ textTransform: 'capitalize' }}>{p}</span>
                                        <Meter value={pct(n, report.total) ?? 0} tone={p === 'highest' ? 'danger' : undefined} label={`${p} priority`} />
                                        <span className="cd-num">{n}</span>
                                    </div>
                                ))}
                            </Panel>
                            <Panel title="Team" icon={Users}>
                                {metrics.error && !metrics.data ? (
                                    <p className="cd-muted" style={{ margin: 0, fontSize: 13 }}>{metrics.error}</p>
                                ) : (
                                    <dl className="mg-kv">
                                        <dt>Members</dt><dd>{metrics.data?.team?.total ?? '—'}</dd>
                                        <dt>Active</dt><dd>{metrics.data?.team?.active ?? '—'}</dd>
                                        <dt>Pending</dt><dd>{metrics.data?.team?.pending ?? '—'}</dd>
                                        <dt>Messages / 7d</dt><dd>{metrics.data?.activity?.messagesThisWeek ?? '—'}</dd>
                                    </dl>
                                )}
                            </Panel>
                        </Grid>

                        <DataTable
                            columns={columns}
                            rows={report.people}
                            empty={<EmptyState icon={ListTodo} title="No workload yet" text="Workload appears once tasks are assigned." />}
                        />

                        <Grid cols="2">
                            <Panel title="What you can see" icon={Eye}>
                                <ul className="mg-scope-list">{VISIBLE.map((v) => <li key={v}><Eye size={13} style={{ color: 'var(--state-success)' }} />{v}</li>)}</ul>
                            </Panel>
                            <Panel title="Owner and admin only" icon={EyeOff}>
                                <ul className="mg-scope-list">{HIDDEN.map((v) => <li key={v}><EyeOff size={13} />{v}</li>)}</ul>
                            </Panel>
                        </Grid>
                    </>
                )}
            </DepartmentGate>
        </DashPage>
    );
}
