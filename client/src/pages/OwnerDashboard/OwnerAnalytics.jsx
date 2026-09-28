import React, { useState } from 'react';
import { RefreshCw, Activity, Users, MessageSquare, Briefcase, TrendingUp, Building } from 'lucide-react';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getOwnerAnalytics } from '../../services/ownerDashboardService';
import {
    DashPage, PageHead, KpiGrid, Kpi, Grid, Panel, FilterTabs, Btn, Meter, ErrorState, useAsync,
} from '../../components/company-dash/dashUi';
import './owner.css';

const RANGES = [{ value: '7d', label: '7 days' }, { value: '30d', label: '30 days' }, { value: '90d', label: '90 days' }];

// Token colours only, so charts follow the light/dark theme.
const AXIS = { fontSize: 11, fill: 'var(--text-secondary)' };
const tooltipProps = {
    contentStyle: { background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 3, color: 'var(--text-primary)', fontSize: 12 },
    labelStyle: { color: 'var(--text-secondary)' },
    cursor: { fill: 'var(--bg-hover)' },
};

const hasData = (rows, key) => Array.isArray(rows) && rows.some((r) => Number(r[key]) > 0);

/** Owner analytics from GET /api/owner-dashboard/analytics?timeRange=. */
const OwnerAnalytics = () => {
    const [range, setRange] = useState('30d');
    const { data, loading, error, reload } = useAsync(() => getOwnerAnalytics(range), [range]);

    const s = data?.summary || {};
    const growth = data?.userGrowth || [];
    const daily = data?.dailyMessages || [];
    const workspaces = data?.workspaceActivity || [];
    const depts = data?.departmentDistribution || [];
    const maxWs = Math.max(1, ...workspaces.map((w) => w.activity || 0));
    const maxDept = Math.max(1, ...depts.map((d) => d.value || 0));
    const rangeLabel = RANGES.find((r) => r.value === range)?.label;

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Owner console"
                    icon={Activity}
                    title="Activity health"
                    lead="Growth, messaging and where the work happens"
                    actions={(
                        <>
                            <FilterTabs label="Time range" value={range} onChange={setRange} options={RANGES} />
                            <Btn icon={RefreshCw} loading={loading && !!data} onClick={reload}>Refresh</Btn>
                        </>
                    )}
                />
            )}
        >
            {error ? <ErrorState message={error} onRetry={reload} /> : (
                <>
                    <KpiGrid>
                        <Kpi label="New people" icon={Users} value={s.newUsers} loading={loading} hint={`joined in the last ${rangeLabel}`} />
                        <Kpi label="Messages" icon={MessageSquare} value={s.totalMessages} loading={loading} hint={`sent in the last ${rangeLabel}`} />
                        <Kpi
                            label="Engagement"
                            icon={TrendingUp}
                            tone="success"
                            value={loading ? undefined : s.engagementRate == null ? null : `${s.engagementRate}%`}
                            loading={loading}
                            hint="of people sent at least one message"
                        />
                        <Kpi
                            label="Active workspaces"
                            icon={Briefcase}
                            value={loading ? undefined : s.totalWorkspaces == null ? null : `${s.activeWorkspaces ?? 0} / ${s.totalWorkspaces}`}
                            loading={loading}
                            hint="not archived"
                        />
                    </KpiGrid>

                    <Grid cols="2">
                        <Panel title="Headcount over time" icon={Users}>
                            {loading ? <div className="od-chart cd-skel" /> : !hasData(growth, 'users') ? (
                                <div className="od-chart-empty">No people yet</div>
                            ) : (
                                <div className="od-chart">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={growth} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                                            <XAxis dataKey="date" tick={AXIS} axisLine={false} tickLine={false} />
                                            <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                                            <Tooltip {...tooltipProps} />
                                            <Area type="monotone" dataKey="users" name="People" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.15} strokeWidth={2} />
                                            <Area type="monotone" dataKey="active" name="Active accounts" stroke="var(--state-success)" fill="var(--state-success)" fillOpacity={0.08} strokeWidth={2} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </Panel>
                        <Panel title={`Messages per day · ${range === '7d' ? '7' : '30'} days`} icon={MessageSquare}>
                            {loading ? <div className="od-chart cd-skel" /> : !hasData(daily, 'messages') ? (
                                <div className="od-chart-empty">No messages in this period</div>
                            ) : (
                                <div className="od-chart">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={daily} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                                            <XAxis dataKey={range === '7d' ? 'day' : 'date'} tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => (range === '7d' ? v : String(v).slice(5))} minTickGap={12} />
                                            <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                                            <Tooltip {...tooltipProps} />
                                            <Bar dataKey="messages" name="Messages" fill="var(--accent)" radius={[2, 2, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </Panel>
                    </Grid>

                    <Grid cols="2">
                        <Panel title="Busiest workspaces" icon={Briefcase}>
                            {loading ? <div className="cd-skel" style={{ height: 120 }} /> : workspaces.length === 0 ? (
                                <div className="od-chart-empty" style={{ height: 120 }}>No workspace messages in this period</div>
                            ) : (
                                <div className="od-bars">
                                    {workspaces.map((w) => (
                                        <div key={w.name} className="od-bar-row">
                                            <span title={w.name}>{w.name}</span>
                                            <Meter value={(w.activity / maxWs) * 100} label={`${w.name} messages`} />
                                            <span>{w.activity.toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Panel>
                        <Panel title="People by department" icon={Building}>
                            {loading ? <div className="cd-skel" style={{ height: 120 }} /> : depts.length === 0 ? (
                                <div className="od-chart-empty" style={{ height: 120 }}>No departments yet</div>
                            ) : (
                                <div className="od-bars">
                                    {depts.map((d) => (
                                        <div key={d.name} className="od-bar-row">
                                            <span title={d.name}>{d.name}</span>
                                            <Meter value={(d.value / maxDept) * 100} tone="success" label={`${d.name} people`} />
                                            <span>{d.value}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Panel>
                    </Grid>
                </>
            )}
        </DashPage>
    );
};

export default OwnerAnalytics;
