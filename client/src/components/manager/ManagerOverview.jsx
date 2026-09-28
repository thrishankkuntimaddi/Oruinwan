import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, UserCheck, Clock, ShieldCheck, MessageSquare, CheckCircle2, AlertTriangle, ListTodo,
    RefreshCw, Gauge, FolderKanban, FileBarChart, CheckSquare,
} from 'lucide-react';
import api from '@services/api';
import {
    DashPage, PageHead, Section, Panel, KpiGrid, Kpi, Grid, Btn, Avatar, ErrorState, LoadingState, Meter, useAsync,
} from '../company-dash/dashUi';
import { useDepartment, DepartmentGate, pct } from './managerScope';

const WEEK = 7 * 24 * 60 * 60 * 1000;

/** Manager dashboard: department headcount, this week's activity and task health. */
export default function ManagerOverview() {
    const scope = useDepartment();
    const { departmentId, department } = scope;
    const navigate = useNavigate();

    const metrics = useAsync(
        () => api.get(`/api/manager/dashboard/metrics/${departmentId}`).then((r) => r.data),
        [departmentId],
        { enabled: !!departmentId },
    );
    const tasks = useAsync(
        () => api.get(`/api/manager/tasks/${departmentId}`).then((r) => r.data),
        [departmentId],
        { enabled: !!departmentId },
    );

    const m = metrics.data;
    const t = tasks.data?.tasks;
    const open = t?.open?.length ?? null;
    const inProgress = t?.inProgress?.length ?? null;
    const done = t?.completed?.length ?? null;
    const overdue = t?.overdue?.length ?? null;
    const total = tasks.data?.total ?? null;
    const doneThisWeek = t ? t.completed.filter((x) => {
        const when = x.completedAt || x.updatedAt;
        return when && Date.now() - new Date(when).getTime() < WEEK;
    }).length : null;
    const completion = total != null ? pct(done, total) : null;

    const refresh = () => { metrics.reload(); tasks.reload(); };
    const busy = metrics.loading || tasks.loading;

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Manager console"
                    title={department?.name ? `${department.name} overview` : 'Overview'}
                    lead="Team headcount, this week's activity and task health for this department."
                    actions={departmentId && <Btn icon={RefreshCw} loading={busy} onClick={refresh}>Refresh</Btn>}
                />
            )}
        >
            <DepartmentGate scope={scope}>
                {metrics.error && !m ? (
                    <ErrorState message={metrics.error} onRetry={metrics.reload} />
                ) : (
                    <>
                        <Section title="Team" lead="People in this department">
                            <KpiGrid>
                                <Kpi label="Members" icon={Users} value={m?.team?.total} loading={metrics.loading && !m} hint="In the department" />
                                <Kpi label="Active" icon={UserCheck} tone="success" value={m?.team?.active} loading={metrics.loading && !m} hint="Active accounts" />
                                <Kpi label="Pending" icon={Clock} tone="muted" value={m?.team?.pending} loading={metrics.loading && !m} hint="Not yet activated" />
                                <Kpi label="Managers" icon={ShieldCheck} value={m?.team?.managers} loading={metrics.loading && !m} hint="With the manager role" />
                            </KpiGrid>
                        </Section>

                        <Section title="This week" lead="Last 7 days">
                            <KpiGrid>
                                <Kpi label="Messages sent" icon={MessageSquare} value={m?.activity?.messagesThisWeek} loading={metrics.loading && !m} hint="By department members" />
                                <Kpi label="Tasks completed" icon={CheckCircle2} tone="success" value={doneThisWeek} loading={tasks.loading && !t} hint="Marked done this week" />
                                <Kpi label="Overdue" icon={AlertTriangle} tone={overdue ? 'danger' : 'muted'} value={overdue} loading={tasks.loading && !t} hint="Past due, not done" onClick={() => navigate('/manager/dashboard/tasks')} />
                                <Kpi label="Open tasks" icon={ListTodo} value={open != null && inProgress != null ? open + inProgress : null} loading={tasks.loading && !t} hint="To do + in progress" />
                            </KpiGrid>
                        </Section>

                        <Grid cols="2">
                            <Panel title="Department" icon={Gauge}>
                                <dl className="mg-kv">
                                    <dt>Name</dt>
                                    <dd>{m?.department?.name || department?.name || '—'}</dd>
                                    <dt>Description</dt>
                                    <dd className={m?.department?.description ? '' : 'cd-muted'}>{m?.department?.description || 'No description'}</dd>
                                    <dt>Head</dt>
                                    <dd>
                                        {m?.department?.head ? (
                                            <span className="cd-cell-user">
                                                <Avatar user={m.department.head} size="sm" />
                                                <span>
                                                    <span className="cd-cell-title" style={{ display: 'block' }}>{m.department.head.username}</span>
                                                    <span className="cd-cell-sub" style={{ display: 'block' }}>{m.department.head.email}</span>
                                                </span>
                                            </span>
                                        ) : <span className="cd-muted">Not set</span>}
                                    </dd>
                                    {m?.department?.createdAt && (<><dt>Created</dt><dd>{new Date(m.department.createdAt).toLocaleDateString()}</dd></>)}
                                </dl>
                            </Panel>

                            <Panel title="Task health" icon={CheckSquare}>
                                {tasks.error && !t ? (
                                    <ErrorState message={tasks.error} onRetry={tasks.reload} />
                                ) : !t ? (
                                    <LoadingState />
                                ) : total === 0 ? (
                                    <p className="cd-muted" style={{ margin: 0, fontSize: 13 }}>No tasks for this department yet. Create one from Tasks.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        <div className="mg-load-top"><span>Completion</span><span>{completion ?? 0}%</span></div>
                                        <Meter value={completion ?? 0} tone="success" label="Task completion" />
                                        {[['To do', open], ['In progress', inProgress], ['Done', done], ['Overdue', overdue]].map(([label, v]) => (
                                            <div key={label} className="mg-bar-row">
                                                <span className="mg-bar-label">{label}</span>
                                                <Meter value={pct(v, total) ?? 0} tone={label === 'Overdue' ? 'danger' : label === 'Done' ? 'success' : undefined} label={label} />
                                                <span className="cd-num">{v}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Panel>
                        </Grid>

                        <Section title="Go to">
                            <div className="mg-links">
                                {[
                                    { label: 'Team load', sub: 'Who has capacity', icon: Users, to: '/manager/dashboard/allocation' },
                                    { label: 'Tasks', sub: 'Assign and track work', icon: CheckSquare, to: '/manager/dashboard/tasks' },
                                    { label: 'Projects', sub: 'Workspace progress', icon: FolderKanban, to: '/manager/dashboard/projects' },
                                    { label: 'Reports', sub: 'Completion and workload', icon: FileBarChart, to: '/manager/dashboard/reports' },
                                ].map((a) => (
                                    <button key={a.to} type="button" className="gl-card gl-card--interactive mg-link" onClick={() => navigate(a.to)}>
                                        <a.icon size={15} />
                                        <strong>{a.label}</strong>
                                        <span>{a.sub}</span>
                                    </button>
                                ))}
                            </div>
                        </Section>
                    </>
                )}
            </DepartmentGate>
        </DashPage>
    );
}
