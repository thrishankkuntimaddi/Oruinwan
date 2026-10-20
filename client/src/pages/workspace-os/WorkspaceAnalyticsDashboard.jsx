import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useWorkspaceAnalytics } from '../../hooks/useWorkspaceAnalytics';
import { Users, CheckSquare, Hash, TrendingUp, ListTodo, FileText, FolderOpen, RefreshCw, ShieldCheck } from 'lucide-react';
import { Toolbar, FilterTabs, IconBtn, KpiGrid, Kpi, Panel, EmptyState, ErrorState, LoadingState } from '../../components/ui/page';
import '../toolkit/toolkit.css';

const RANGE_OPTIONS = [
    { label: '7 days', value: 7 },
    { label: '30 days', value: 30 },
    { label: '90 days', value: 90 }
];

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="gl-card" style={{ padding: '8px 10px', fontSize: 12, boxShadow: 'var(--gl-drop)' }}>
            <div style={{ fontWeight: 650, color: 'var(--text-primary)', marginBottom: 2 }}>{label}</div>
            {payload.map((p, i) => (
                <div key={i} style={{ color: 'var(--text-secondary)' }}>{p.name}: <b style={{ color: 'var(--text-primary)' }}>{p.value}</b></div>
            ))}
        </div>
    );
};

/**
 * Workspace settings → Analytics: how the workspace is set up and how work moves.
 * Nothing about conversations: they're private, so there are no message counts or per-person activity.
 */
// The settings page around it supplies the title; `workspaceName` is accepted for callers that pass it.
export default function WorkspaceAnalyticsDashboard({ workspaceId }) {
    const [range, setRange] = useState(30);
    const { data, loading, error, refetch } = useWorkspaceAnalytics(workspaceId, range);

    const summary = data?.summary || {};
    const daily = data?.charts?.dailyTasks || [];
    const anyTasks = daily.some((d) => d.created || d.completed);
    const first = loading && !data;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Toolbar>
                <FilterTabs value={range} onChange={setRange} options={RANGE_OPTIONS} label="Period" />
                <span className="cd-toolbar-spacer" />
                <IconBtn label="Refresh" onClick={refetch} disabled={loading}>
                    <RefreshCw size={14} className={loading ? 'cd-spin' : ''} />
                </IconBtn>
            </Toolbar>

            {error && <ErrorState message={error} onRetry={refetch} />}

            <KpiGrid min={150}>
                <Kpi label="Members" value={summary.memberCount} icon={Users} loading={first} />
                <Kpi label="Channels" value={summary.channelCount} icon={Hash} loading={first} />
                <Kpi label="Open tasks" value={summary.openTasks} icon={ListTodo} loading={first} />
                <Kpi label="Tasks done" value={summary.taskCompletionRate !== undefined ? `${summary.taskCompletionRate}%` : null} icon={TrendingUp} tone="success" loading={first} hint={`of ${summary.totalTasks ?? 0} tasks`} />
                <Kpi label="Docs & notes" value={summary.docCount} icon={FileText} loading={first} />
                <Kpi label="Files" value={summary.fileCount} icon={FolderOpen} loading={first} />
            </KpiGrid>

            <Panel title={`Tasks · last ${range} days`} icon={CheckSquare}>
                {loading ? (
                    <LoadingState label="Loading activity…" />
                ) : anyTasks ? (
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={daily} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                            <defs>
                                <linearGradient id="wsTaskGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={v => v.slice(5)} stroke="var(--border-default)" minTickGap={24} />
                            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} allowDecimals={false} stroke="var(--border-default)" />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border-default)' }} />
                            <Area type="monotone" dataKey="created" stroke="var(--accent)" strokeWidth={2} fill="url(#wsTaskGrad)" name="Created" />
                            <Area type="monotone" dataKey="completed" stroke="var(--state-success, var(--text-secondary))" strokeWidth={2} fill="none" name="Completed" />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <EmptyState icon={CheckSquare} title="No task activity in this period" text="Tasks created and completed show up here." />
                )}
            </Panel>

            <p style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>
                <ShieldCheck size={14} /> Conversations are private. Admins never see messages, message counts or who talks to whom.
            </p>
        </div>
    );
}
