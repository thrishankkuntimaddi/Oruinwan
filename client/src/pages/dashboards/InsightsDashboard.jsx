import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
    Activity, Users, CheckSquare, TrendingUp, AlertTriangle, Coffee, BarChart2,
    Zap, RefreshCw, Hash, Target, Layers, Briefcase, Lock,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '@services/api';
import {
    DashPage, PageHead, KpiGrid, Kpi, Grid, Panel, FilterTabs, Btn, Chip, Meter, Avatar,
    EmptyState, LoadingState, errorMessage,
} from '../../components/company-dash/dashUi';
import { ActiveMembersPanel, TeamDeliveryPanel } from './InsightsPanels';
import '../OwnerDashboard/owner.css';

const AXIS = { fontSize: 11, fill: 'var(--text-secondary)' };
const tooltipProps = {
    contentStyle: { background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 3, color: 'var(--text-primary)', fontSize: 12 },
    labelStyle: { color: 'var(--text-secondary)' },
    cursor: { fill: 'var(--bg-hover)' },
};

const ENDPOINTS = {
    summary: '/api/dashboard/analytics/summary',
    users: '/api/dashboard/analytics/users',
    workspaces: '/api/dashboard/analytics/workspaces',
    channels: '/api/dashboard/analytics/channels',
    tasks: '/api/dashboard/analytics/tasks',
    engagement: '/api/dashboard/analytics/engagement',
    workload: '/api/analytics/insights/workload',
    activeMembers: '/api/dashboard/analytics/active-members',
    teams: '/api/dashboard/analytics/teams',
};
// Weeks of team delivery for each period choice.
const WEEKS = { 7: 4, 30: 8, 90: 13 };

const pct = (v) => (v == null ? null : `${v}%`);
const WL_TONE = { overloaded: 'danger', balanced: 'success', idle: undefined };

function PanelBody({ error, empty, emptyText, children }) {
    if (error) return <p className="cd-error-text" style={{ margin: 0 }}>Could not load: {error}</p>;
    if (empty) return <div className="od-chart-empty" style={{ height: 120 }}>{emptyText}</div>;
    return children;
}

function BarList({ rows, tone }) {
    const max = Math.max(1, ...rows.map((r) => r.value || 0));
    return (
        <div className="od-bars">
            {rows.map((r) => (
                <div key={r.key} className="od-bar-row">
                    <span title={r.sub ? `${r.label} · ${r.sub}` : r.label}>{r.label}</span>
                    <Meter value={((r.value || 0) / max) * 100} tone={tone} label={r.label} />
                    <span>{(r.value || 0).toLocaleString()}</span>
                </div>
            ))}
        </div>
    );
}

/**
 * Productivity insights for owners and admins: people, tasks, engagement, workload.
 * Messages are end-to-end encrypted, so nothing here counts or shows them.
 */
const InsightsDashboard = () => {
    const { pathname } = useLocation();
    const eyebrow = pathname.startsWith('/owner') ? 'Owner console' : 'Admin console';
    const [period, setPeriod] = useState('30');
    const [state, setState] = useState({ loading: true, data: {}, errors: {} });

    const load = useCallback(async () => {
        setState((s) => ({ ...s, loading: true }));
        const keys = Object.keys(ENDPOINTS);
        const results = await Promise.allSettled(keys.map((k) => api.get(ENDPOINTS[k], { params: k === 'teams' ? { weeks: WEEKS[period] || 8 } : { period } })));
        const data = {};
        const errors = {};
        results.forEach((r, i) => {
            if (r.status === 'fulfilled') data[keys[i]] = r.value.data;
            else errors[keys[i]] = errorMessage(r.reason, 'request failed');
        });
        setState({ loading: false, data, errors });
    }, [period]);

    useEffect(() => { load(); }, [load]);

    const { loading, data, errors } = state;
    const s = data.summary?.summary || {};
    const eng = data.engagement || {};
    const tasks = data.tasks || {};
    const workload = data.workload || {};
    const channels = data.channels?.channels || [];
    const workspaces = data.workspaces?.workspaces || [];
    const activeTrend = (data.users?.trendData || []).map((d, i) => ({ label: d.name || String(i + 1), value: d.value || 0 }));
    const allFailed = !loading && Object.keys(errors).length === Object.keys(ENDPOINTS).length;
    const taskTrend = tasks.trendData || [];

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow={eyebrow}
                    icon={BarChart2}
                    title="Productivity insights"
                    lead="People, tasks, engagement and workload across your company"
                    actions={(
                        <>
                            <FilterTabs label="Period" value={period} onChange={setPeriod} options={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }]} />
                            <Btn icon={RefreshCw} loading={loading} onClick={load}>Refresh</Btn>
                        </>
                    )}
                />
            )}
        >
            {loading && !Object.keys(data).length ? <LoadingState label="Crunching the numbers…" /> : allFailed ? (
                <EmptyState icon={AlertTriangle} title="Insights are unavailable" text={errors.summary} action={<Btn icon={RefreshCw} onClick={load}>Try again</Btn>} />
            ) : (
                <>
                    <KpiGrid>
                        <Kpi label="People" icon={Users} value={errors.summary ? null : s.totalUsers} hint={s.userGrowth ? `${s.userGrowth > 0 ? '+' : ''}${s.userGrowth}% vs previous period` : 'in your company'} />
                        <Kpi label="Active people" icon={Activity} tone="success" value={errors.summary ? null : s.activeUsers} hint={`in the last ${period} days`} />
                        <Kpi label="Channels" icon={Hash} value={errors.summary ? null : s.totalChannels} hint="open across workspaces" />
                        <Kpi label="Task completion" icon={CheckSquare} value={errors.summary ? null : pct(s.taskCompletionRate ?? 0)} hint="of tasks in the period" />
                        <Kpi label="Daily active" icon={Zap} value={errors.engagement ? null : eng.dau} hint="people active today" />
                        <Kpi label="Weekly active" icon={TrendingUp} value={errors.engagement ? null : eng.wau} hint="people active this week" />
                        <Kpi label="Monthly active" icon={Users} value={errors.engagement ? null : eng.mau} hint="people active this month" />
                        <Kpi label="Stickiness" icon={Target} value={errors.engagement ? null : pct(eng.dauWauRatio ?? 0)} hint="daily ÷ weekly active" />
                    </KpiGrid>

                    <Grid cols="1">
                        {/* No per-person rankings: insights stay company-wide (see docs → What admins can see). */}
                        <ActiveMembersPanel data={data.activeMembers} error={errors.activeMembers || errors.users} fallbackTrend={activeTrend} />
                    </Grid>

                    <Grid cols="1">
                        <TeamDeliveryPanel data={data.teams} error={errors.teams} />
                    </Grid>

                    <Grid cols="2">
                        <Panel title="Tasks" icon={CheckSquare}>
                            <PanelBody error={errors.tasks} empty={false}>
                                <div className="od-kv" style={{ marginBottom: 12 }}>
                                    <div className="od-kv-row"><span>Completion rate</span><span>{pct(tasks.summary?.completionRate ?? 0)}</span></div>
                                    <div className="od-kv-row"><span>Tasks</span><span>{(tasks.summary?.total ?? 0).toLocaleString()}</span></div>
                                    <div className="od-kv-row"><span>Average time to finish</span><span>{tasks.summary?.avgDurationHours ? `${tasks.summary.avgDurationHours}h` : '—'}</span></div>
                                </div>
                                {taskTrend.some((d) => d.created || d.completed) ? (
                                    <div className="od-chart" style={{ height: 180 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={taskTrend} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                                                <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} minTickGap={12} />
                                                <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                                                <Tooltip {...tooltipProps} />
                                                <Bar dataKey="created" name="Created" fill="var(--text-secondary)" radius={[2, 2, 0, 0]} />
                                                <Bar dataKey="completed" name="Completed" fill="var(--state-success)" radius={[2, 2, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : <div className="od-chart-empty" style={{ height: 120 }}>No tasks created or completed in this period</div>}
                                {tasks.metrics && (
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                                        {[['Todo', tasks.metrics.todo], ['In progress', tasks.metrics.inProgress], ['Review', tasks.metrics.review], ['Done', tasks.metrics.completed], ['Blocked', tasks.metrics.blocked], ['Cancelled', tasks.metrics.cancelled]]
                                            .filter(([, v]) => v > 0)
                                            .map(([label, v]) => <Chip key={label} tone={label === 'Done' ? 'success' : label === 'Blocked' ? 'danger' : undefined}>{label} {v}</Chip>)}
                                    </div>
                                )}
                            </PanelBody>
                        </Panel>
                        <Panel title="Workload" icon={Layers}>
                            <PanelBody error={errors.workload} empty={!(workload.workload || []).length} emptyText="No open tasks assigned">
                                {workload.stats && (
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                                        <Chip tone="danger"><AlertTriangle size={11} /> {workload.stats.overloadedCount} overloaded</Chip>
                                        <Chip tone="success"><TrendingUp size={11} /> {workload.stats.balancedCount} balanced</Chip>
                                        <Chip><Coffee size={11} /> {workload.stats.idleCount} idle</Chip>
                                    </div>
                                )}
                                <div className="cd-list">
                                    {(workload.workload || []).slice(0, 8).map((u, i) => (
                                        <div key={u.userId || i} className="cd-list-row" style={{ padding: '8px 0' }}>
                                            <Avatar name={u.name} size="sm" />
                                            <div className="cd-grow">
                                                <div className="cd-cell-title">{u.name}</div>
                                                <div className="cd-cell-sub">{u.openTasks} open tasks</div>
                                            </div>
                                            <Chip tone={WL_TONE[u.status]}>{u.status}</Chip>
                                        </div>
                                    ))}
                                </div>
                            </PanelBody>
                        </Panel>
                    </Grid>

                    <Grid cols="2">
                        <Panel title="Channels by members" icon={Hash}>
                            <PanelBody error={errors.channels} empty={!channels.length} emptyText="No public channels yet">
                                <BarList rows={channels.slice(0, 8).map((c) => ({ key: c.channelId, label: `#${c.name}`, value: c.memberCount }))} />
                            </PanelBody>
                        </Panel>
                        <Panel title="Workspaces" icon={Briefcase}>
                            <PanelBody error={errors.workspaces} empty={!workspaces.length} emptyText="No workspaces yet">
                                <BarList tone="success" rows={workspaces.slice(0, 6).map((w) => ({ key: w._id, label: w.name, sub: `${w.channelCount ?? 0} channels · ${w.taskCount ?? 0} tasks`, value: w.memberCount }))} />
                            </PanelBody>
                        </Panel>
                    </Grid>

                    <div className="cd-muted" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <Lock size={13} aria-hidden="true" />
                        Messages are end-to-end encrypted and never shown to admins, and they are not counted here.
                    </div>
                </>
            )}
        </DashPage>
    );
};

export default InsightsDashboard;
