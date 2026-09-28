import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
    Activity, Users, MessageSquare, CheckSquare, TrendingUp, AlertTriangle, Coffee, BarChart2,
    Zap, RefreshCw, Hash, Target, Layers, Clock,
} from 'lucide-react';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '@services/api';
import {
    DashPage, PageHead, KpiGrid, Kpi, Grid, Panel, FilterTabs, Btn, Chip, Meter, Avatar,
    EmptyState, LoadingState, errorMessage,
} from '../../components/company-dash/dashUi';
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
    messages: '/api/dashboard/analytics/messages',
    engagement: '/api/dashboard/analytics/engagement',
    team: '/api/analytics/insights/team',
    workload: '/api/analytics/insights/workload',
    communication: '/api/analytics/insights/communication',
};

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

/** Productivity insights for owners and admins: messaging, tasks, engagement, workload. */
const InsightsDashboard = () => {
    const { pathname } = useLocation();
    const eyebrow = pathname.startsWith('/owner') ? 'Owner console' : 'Admin console';
    const [period, setPeriod] = useState('30');
    const [state, setState] = useState({ loading: true, data: {}, errors: {} });

    const load = useCallback(async () => {
        setState((s) => ({ ...s, loading: true }));
        const keys = Object.keys(ENDPOINTS);
        const results = await Promise.allSettled(keys.map((k) => api.get(ENDPOINTS[k], { params: { period } })));
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
    const msgs = data.messages || {};
    const team = data.team?.teamActivity || [];
    const workload = data.workload || {};
    const comm = data.communication || {};
    const channels = data.channels?.channels || [];
    const workspaces = data.workspaces?.workspaces || [];
    const contributors = data.users?.topContributors || [];
    const allFailed = !loading && Object.keys(errors).length === Object.keys(ENDPOINTS).length;
    const hourly = (comm.hourlyPattern || []).map((h, i) => ({ hour: h.hour ?? i, count: h.count || 0 }));
    const taskTrend = tasks.trendData || [];
    const msgTrend = (msgs.trendData || []).map((d, i) => ({ label: d.name || d.date || d.label || String(i + 1), value: d.count ?? d.value ?? d.messages ?? 0 }));

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow={eyebrow}
                    icon={BarChart2}
                    title="Productivity insights"
                    lead="Messaging, tasks, engagement and workload across your company"
                    actions={(
                        <>
                            <FilterTabs label="Period" value={period} onChange={setPeriod} options={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }]} />
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
                        <Kpi label="Messages" icon={MessageSquare} value={errors.summary ? null : s.totalMessages} hint={`sent in the last ${period} days`} />
                        <Kpi label="Task completion" icon={CheckSquare} value={errors.summary ? null : pct(s.taskCompletionRate ?? 0)} hint="of tasks in the period" />
                        <Kpi label="Daily active" icon={Zap} value={errors.engagement ? null : eng.dau} hint="people active today" />
                        <Kpi label="Weekly active" icon={TrendingUp} value={errors.engagement ? null : eng.wau} hint="people active this week" />
                        <Kpi label="Monthly active" icon={Users} value={errors.engagement ? null : eng.mau} hint="people active this month" />
                        <Kpi label="Stickiness" icon={Target} value={errors.engagement ? null : pct(eng.dauWauRatio ?? 0)} hint="daily ÷ weekly active" />
                    </KpiGrid>

                    <Grid cols="2">
                        <Panel title="Most active people" icon={Activity}>
                            <PanelBody error={errors.team} empty={!team.length} emptyText="No activity in this period">
                                <div className="cd-list">
                                    {team.slice(0, 8).map((u, i) => (
                                        <div key={u.userId || i} className="cd-list-row" style={{ padding: '8px 0' }}>
                                            <span className="cd-muted" style={{ width: 18, fontSize: 12 }}>{i + 1}</span>
                                            <Avatar name={u.name} size="sm" />
                                            <div className="cd-grow">
                                                <div className="cd-cell-title">{u.name}</div>
                                                <div className="cd-cell-sub">{u.messages} messages · {u.tasksAssigned} tasks</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </PanelBody>
                        </Panel>
                        <Panel title="When people talk" icon={Clock}>
                            <PanelBody error={errors.communication} empty={!hourly.some((h) => h.count > 0)} emptyText="No messages in this period">
                                <div className="od-chart" style={{ height: 180 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={hourly} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                                            <XAxis dataKey="hour" tick={AXIS} axisLine={false} tickLine={false} interval={5} tickFormatter={(h) => `${h}:00`} />
                                            <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                                            <Tooltip {...tooltipProps} labelFormatter={(h) => `${h}:00`} />
                                            <Bar dataKey="count" name="Messages" fill="var(--accent)" radius={[2, 2, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                {(comm.topChannels || []).length > 0 && (
                                    <div style={{ marginTop: 12 }}>
                                        <div className="cd-kpi-label" style={{ marginBottom: 8 }}>Top channels</div>
                                        <BarList rows={comm.topChannels.slice(0, 4).map((c, i) => ({ key: c.name || i, label: `#${c.name}`, value: c.count }))} />
                                    </div>
                                )}
                            </PanelBody>
                        </Panel>
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
                        <Panel title="Channels by messages" icon={Hash}>
                            <PanelBody error={errors.channels} empty={!channels.length} emptyText="No channel messages in this period">
                                <BarList rows={channels.slice(0, 8).map((c) => ({ key: c.channelId, label: `#${c.name}`, sub: `${c.memberCount} members · ${c.activeUsers} active`, value: c.messageCount }))} />
                            </PanelBody>
                        </Panel>
                        <Panel title="Message volume" icon={MessageSquare}>
                            <PanelBody error={errors.messages} empty={false}>
                                <div className="od-kv" style={{ marginBottom: 12 }}>
                                    <div className="od-kv-row"><span>Total</span><span>{(msgs.metrics?.total ?? 0).toLocaleString()}</span></div>
                                    <div className="od-kv-row"><span>In channels</span><span>{(msgs.metrics?.byChannel ?? 0).toLocaleString()}</span></div>
                                    <div className="od-kv-row"><span>Direct messages</span><span>{(msgs.metrics?.byDM ?? 0).toLocaleString()}</span></div>
                                </div>
                                {msgTrend.some((d) => d.value > 0) ? (
                                    <div className="od-chart" style={{ height: 150 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={msgTrend} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                                                <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} minTickGap={12} />
                                                <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                                                <Tooltip {...tooltipProps} />
                                                <Area type="monotone" dataKey="value" name="Messages" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.15} strokeWidth={2} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : null}
                                {!errors.workspaces && workspaces.length > 0 && (
                                    <div style={{ marginTop: 12 }}>
                                        <div className="cd-kpi-label" style={{ marginBottom: 8 }}>Workspaces</div>
                                        <BarList tone="success" rows={workspaces.slice(0, 5).map((w) => ({ key: w._id, label: w.name, sub: `${w.memberCount} members`, value: w.messageCount }))} />
                                    </div>
                                )}
                            </PanelBody>
                        </Panel>
                    </Grid>

                    <Panel title="Top contributors" icon={TrendingUp}>
                        <PanelBody error={errors.users} empty={!contributors.length} emptyText="No messages sent in this period">
                            <BarList rows={contributors.slice(0, 10).map((u, i) => ({ key: u.userId || i, label: u.name, value: u.messages }))} />
                        </PanelBody>
                    </Panel>
                </>
            )}
        </DashPage>
    );
};

export default InsightsDashboard;
