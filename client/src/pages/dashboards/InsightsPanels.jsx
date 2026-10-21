import React, { useState } from 'react';
import { Activity, Users2 } from 'lucide-react';
import { ComposedChart, Bar, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Panel, FilterTabs, Chip, DataTable } from '../../components/company-dash/dashUi';

/*
 * Counts-only panels for the productivity insights page:
 *   ActiveMembersPanel  members active per day / per week (no names, no message data)
 *   TeamDeliveryPanel   tasks completed per week, cycle time and overdue trend per team
 */

const AXIS = { fontSize: 11, fill: 'var(--text-secondary)' };
const tooltipProps = {
    contentStyle: { background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 3, color: 'var(--text-primary)', fontSize: 12 },
    labelStyle: { color: 'var(--text-secondary)' },
    cursor: { fill: 'var(--bg-hover)' },
};

const shortDate = (iso) => {
    const d = new Date(`${iso}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
};

/** Hours → "5h" / "2.5d". */
export function formatCycle(hours) {
    if (hours == null) return '—';
    if (hours < 48) return `${Math.round(hours * 10) / 10}h`;
    return `${Math.round((hours / 24) * 10) / 10}d`;
}

function Empty({ children }) {
    return <div className="od-chart-empty" style={{ height: 120 }}>{children}</div>;
}

export function ActiveMembersPanel({ data, error, fallbackTrend = [] }) {
    const [view, setView] = useState('daily');
    const daily = (data?.daily || []).map((d) => ({ label: shortDate(d.date), value: d.active }));
    const weekly = (data?.weekly || []).map((w) => ({ label: `Wk of ${shortDate(w.weekStart)}`, value: w.active }));
    const hasNew = (data?.summary?.daysWithData || 0) > 0;
    // Until daily records exist (new installs), show the older last-activity trend.
    const rows = hasNew ? (view === 'daily' ? daily : weekly) : fallbackTrend;

    return (
        <Panel
            title="Active members"
            icon={Activity}
            action={hasNew ? <FilterTabs label="Granularity" value={view} onChange={setView} options={[{ value: 'daily', label: 'Per day' }, { value: 'weekly', label: 'Per week' }]} /> : null}
        >
            {error && !fallbackTrend.length ? <p className="cd-error-text" style={{ margin: 0 }}>Could not load: {error}</p>
                : !rows.some((d) => d.value > 0) ? <Empty>No activity in this period</Empty> : (
                    <>
                        {hasNew && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                                <Chip>Average {data.summary.avgDailyActive} a day</Chip>
                                <Chip tone="success">Peak {data.summary.peakDailyActive}</Chip>
                            </div>
                        )}
                        <div className="od-chart" style={{ height: 180 }} data-testid="active-members-chart">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={rows} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                                    <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} minTickGap={12} />
                                    <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <Tooltip {...tooltipProps} />
                                    <Area type="monotone" dataKey="value" name="Active members" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.15} strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="cd-muted" style={{ fontSize: 12, margin: '8px 0 0' }}>
                            Counts of people who opened the app — never who, and nothing about their messages.
                        </p>
                    </>
                )}
        </Panel>
    );
}

export function TeamDeliveryPanel({ data, error }) {
    if (error) {
        return <Panel title="Delivery by team" icon={Users2}><p className="cd-error-text" style={{ margin: 0 }}>Could not load: {error}</p></Panel>;
    }
    const weeks = data?.weeks || [];
    const total = data?.total;
    const teams = data?.teams || [];
    const trend = weeks.map((w, i) => ({
        label: shortDate(w),
        completed: total?.completedPerWeek?.[i] || 0,
        overdue: total?.overduePerWeek?.[i] || 0,
    }));
    const rows = [...teams];
    if (data?.unassigned && (data.unassigned.completed || data.unassigned.open)) {
        rows.push({ ...data.unassigned, teamId: '__none', name: 'No team', memberCount: null });
    }

    const columns = [
        { key: 'name', label: 'Team', render: (r) => <span className="cd-cell-title">{r.name}</span> },
        { key: 'completed', label: `Done (${weeks.length} wk)`, render: (r) => <WeekBars values={r.completedPerWeek} label={`${r.name} completed per week`} total={r.completed} /> },
        { key: 'cycle', label: 'Cycle time', render: (r) => <span title={`Median ${formatCycle(r.medianCycleHours)}`}>{formatCycle(r.avgCycleHours)}</span> },
        { key: 'open', label: 'Open', render: (r) => r.open },
        { key: 'overdue', label: 'Overdue', render: (r) => (r.openOverdue ? <Chip tone="danger">{r.openOverdue}</Chip> : <span className="cd-muted">0</span>) },
    ];

    return (
        <Panel title="Delivery by team" icon={Users2}>
            {!teams.length && !total?.completed && !total?.open ? (
                <Empty>No teams or tasks yet. Create teams under Teams to see delivery per team.</Empty>
            ) : (
                <>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                        <Chip tone="success">{total?.completed || 0} completed</Chip>
                        <Chip>Avg cycle {formatCycle(total?.avgCycleHours)}</Chip>
                        <Chip tone={total?.openOverdue ? 'danger' : undefined}>{total?.openOverdue || 0} overdue now</Chip>
                    </div>
                    {trend.some((t) => t.completed || t.overdue) && (
                        <div className="od-chart" style={{ height: 180, marginBottom: 12 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={trend} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                                    <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} minTickGap={12} />
                                    <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <Tooltip {...tooltipProps} />
                                    <Bar dataKey="completed" name="Completed" fill="var(--state-success)" radius={[2, 2, 0, 0]} />
                                    <Line type="monotone" dataKey="overdue" name="Overdue at week end" stroke="var(--state-danger)" strokeWidth={2} dot={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                    <DataTable columns={columns} rows={rows} rowKey={(r) => r.teamId} caption="Delivery by team" />
                </>
            )}
        </Panel>
    );
}

function WeekBars({ values = [], label, total }) {
    const max = Math.max(1, ...values);
    return (
        <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 18 }} role="img" aria-label={`${label}: ${values.join(', ')}`}>
            {values.map((v, i) => (
                <span key={i} style={{ width: 5, height: `${Math.max(8, (v / max) * 100)}%`, background: v ? 'var(--state-success)' : 'var(--border-default)', borderRadius: 1 }} />
            ))}
            <span style={{ marginLeft: 6, fontVariantNumeric: 'tabular-nums' }}>{total}</span>
        </span>
    );
}
