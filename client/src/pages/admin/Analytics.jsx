import React, { useMemo, useState } from 'react';
import { Users, UserCheck, Briefcase, Building, MessageSquare, CheckCircle2, AlertTriangle, Activity, RefreshCw, UserPlus, BarChart3 } from 'lucide-react';
import api from '@services/api';
import {
    DashPage, PageHead, Section, KpiGrid, Kpi, Grid, Panel, Meter, FilterTabs, Btn, Chip, EmptyState, ErrorState, LoadingState, useAsync,
} from '../../components/company-dash/dashUi';
import './admin.css';

const RANGES = [{ value: '7d', label: '7 days' }, { value: '30d', label: '30 days' }, { value: '90d', label: '90 days' }];

/** Last 7 calendar days with a zero for days without messages. */
function lastWeek(daily) {
    const byDate = Object.fromEntries((daily || []).map((d) => [d.date, d.messageCount || 0]));
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(Date.now() - (6 - i) * 864e5);
        const key = d.toISOString().slice(0, 10);
        return { key, label: d.toLocaleDateString(undefined, { weekday: 'short' }), value: byDate[key] || 0 };
    });
}

const Bars = ({ rows, unit }) => {
    const max = Math.max(1, ...rows.map((r) => r.value));
    return (
        <div className="ad-bars" role="img" aria-label={rows.map((r) => `${r.label}: ${r.value} ${unit}`).join(', ')}>
            {rows.map((r) => (
                <div className="ad-bar" key={r.key} title={`${r.value} ${unit}`}>
                    <span className="ad-bar-val">{r.value || ''}</span>
                    <span className="ad-bar-fill" style={{ height: `${(r.value / max) * 100}%` }} />
                    <span className="ad-bar-label">{r.label}</span>
                </div>
            ))}
        </div>
    );
};

const RankList = ({ rows, empty }) => {
    if (!rows.length) return <EmptyState title={empty} />;
    const max = Math.max(1, ...rows.map((r) => r.value));
    return (
        <div className="cd-list">
            {rows.map((r) => (
                <div className="cd-list-row" key={r.key} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span className="cd-cell-title">{r.label}</span>
                        <span className="cd-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>{r.value}</span>
                    </div>
                    <Meter value={(r.value / max) * 100} label={r.label} />
                </div>
            ))}
        </div>
    );
};

const Analytics = () => {
    const [range, setRange] = useState('30d');
    const { data, loading, error, reload } = useAsync(async () => {
        const [a, b] = await Promise.all([
            api.get(`/api/company/analytics/overview?timeRange=${range}`),
            api.get('/api/company/analytics/activity'),
        ]);
        return { analytics: a.data.analytics, activity: b.data.activity };
    }, [range]);

    const a = data?.analytics;
    const act = data?.activity;
    const week = useMemo(() => lastWeek(act?.dailyActivity), [act]);
    const label = RANGES.find((r) => r.value === range)?.label;
    const tasksTotal = a ? (a.tasks?.open || 0) + (a.tasks?.completed || 0) : 0;
    const ready = !!a && !loading;

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Overview"
                    title="Analytics"
                    lead="How the company is growing and working — real counts from your workspaces."
                    actions={(
                        <>
                            <FilterTabs value={range} onChange={setRange} options={RANGES} label="Time range" />
                            <Btn icon={RefreshCw} loading={loading && !!data} onClick={reload}>Refresh</Btn>
                        </>
                    )}
                />
            )}
        >
            {error ? <ErrorState message={error} onRetry={reload} /> : (
                <>
                    <Section title="People & structure">
                        <KpiGrid min={170}>
                            <Kpi loading={!ready} label="People" value={a?.employees?.total} icon={Users} hint={a ? `${a.employees?.newHires || 0} joined in ${label}` : undefined} />
                            <Kpi loading={!ready} label="Active accounts" value={a?.employees?.active} icon={UserCheck} tone="success" hint={a?.employees?.suspended ? `${a.employees.suspended} suspended` : undefined} />
                            <Kpi loading={!ready} label="Invited" value={a?.employees?.invited} icon={UserPlus} tone="muted" hint="not signed in yet" />
                            <Kpi loading={!ready} label="Departments" value={a?.orgStructure?.departments} icon={Building} tone="muted" />
                            <Kpi loading={!ready} label="Workspaces" value={a?.workspaces?.total} icon={Briefcase} tone="muted" hint={a ? `${a.workspaces?.active ?? 0} active` : undefined} />
                        </KpiGrid>
                    </Section>

                    <Section title={`Activity · ${label}`}>
                        <KpiGrid min={170}>
                            <Kpi loading={!ready} label="Engaged people" value={a?.engagement?.activeUsers} icon={Activity} hint={a ? `${a.engagement?.engagementScore ?? 0}% of people` : undefined} />
                            <Kpi loading={!ready} label="Messages" value={a?.messages?.recent} icon={MessageSquare} tone="muted" hint={a ? `${a.messages?.channelMessages ?? 0} in channels · ${a.messages?.dmMessages ?? 0} DMs` : undefined} />
                            <Kpi loading={!ready} label="Tasks done" value={a?.tasks?.completed} icon={CheckCircle2} tone="success" hint={a ? `${a.tasks?.taskCompletionRate ?? 0}% of ${tasksTotal}` : undefined} />
                            <Kpi loading={!ready} label="Overdue tasks" value={a?.tasks?.overdue} icon={AlertTriangle} tone={a?.tasks?.overdue ? 'danger' : 'muted'} />
                            <Kpi loading={!ready} label="Updates posted" value={a?.updates?.recent} icon={BarChart3} tone="muted" />
                        </KpiGrid>
                    </Section>

                    <Grid cols="2">
                        <Panel title="Messages · last 7 days" icon={MessageSquare}>
                            {!ready ? <LoadingState /> : week.every((d) => !d.value)
                                ? <EmptyState icon={MessageSquare} title="No messages this week" text="Daily message volume appears here once people start talking." />
                                : <Bars rows={week} unit="messages" />}
                        </Panel>
                        <Panel title="This week" icon={Activity}>
                            {!ready ? <LoadingState /> : (
                                <dl className="ad-kv" style={{ margin: 0 }}>
                                    <dt>Messages</dt><dd>{act?.messagesLast7Days ?? 0}</dd>
                                    <dt>Tasks created</dt><dd>{act?.tasksCreatedLast7Days ?? 0}</dd>
                                    <dt>Active people</dt><dd>{act?.activeUsers ?? 0}</dd>
                                    <dt>New invites</dt><dd>{act?.newInvites ?? 0}</dd>
                                    <dt>Updates posted</dt><dd>{act?.updatesPosted ?? 0}</dd>
                                </dl>
                            )}
                        </Panel>
                        <Panel title="Departments by size" icon={Building} flush>
                            {!ready ? <LoadingState /> : (
                                <RankList
                                    empty="No departments yet"
                                    rows={(a?.orgStructure?.departmentBreakdown || []).map((d) => ({ key: d._id || d.name, label: d.name, value: d.memberCount || 0 }))}
                                />
                            )}
                        </Panel>
                        <Panel title={`Most active workspaces · ${label}`} icon={Briefcase} flush>
                            {!ready ? <LoadingState /> : (
                                <RankList
                                    empty="No workspace messages in this period"
                                    rows={(a?.workspaces?.workspaceActivity || []).map((w) => ({ key: w.workspaceId || w.name, label: w.name, value: w.messageCount || 0 }))}
                                />
                            )}
                        </Panel>
                    </Grid>

                    {ready && a?.employees?.roleDistribution?.length > 0 && (
                        <Panel title="Roles" icon={Users}>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {a.employees.roleDistribution.map((r) => (
                                    <Chip key={r.role || 'none'} tone={['owner', 'admin'].includes(r.role) ? 'accent' : undefined}>
                                        <span style={{ textTransform: 'capitalize' }}>{r.role || 'unset'}</span> · {r.count}
                                    </Chip>
                                ))}
                            </div>
                        </Panel>
                    )}
                </>
            )}
        </DashPage>
    );
};

export default Analytics;
