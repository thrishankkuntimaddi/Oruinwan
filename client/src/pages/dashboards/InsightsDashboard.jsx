// client/src/pages/dashboards/InsightsDashboard.jsx
/**
 * Productivity Insights & Analytics Dashboard
 * Premium, clean UI — Linear Insights + Slack Analytics style
 * Uses only vanilla CSS + inline SVG charts (no external chart deps)
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE } from '../../services/api';
import {
    Activity, Users, MessageSquare, CheckSquare, TrendingUp,
    AlertTriangle, Coffee, BarChart2, Zap, Clock, RefreshCw,
    ArrowUp, ArrowDown, Hash, Target, Layers
} from 'lucide-react';

// ─── AUTH HEADER ─────────────────────────────────────────────────────────────
const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
});

// ─── MICRO CHART COMPONENTS (pure SVG) ───────────────────────────────────────

/** Tiny sparkline bar chart */
function BarSparkline({ data = [], color = '#6366f1', height = 48 }) {
    if (!data.length) return <div style={{ height }} className="ins-chart-empty">No data</div>;
    const max = Math.max(...data.map(d => d.value || d.count || d), 1);
    const w = 100 / data.length;
    return (
        <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
            {data.map((d, i) => {
                const val = d.value ?? d.count ?? d ?? 0;
                const barH = (val / max) * (height - 4);
                return (
                    <rect
                        key={i}
                        x={i * w + 0.5}
                        y={height - barH - 2}
                        width={w - 1}
                        height={barH}
                        rx={2}
                        fill={color}
                        opacity={0.85}
                    />
                );
            })}
        </svg>
    );
}

/** Trend line chart */
function LineSparkline({ data = [], color = '#10b981', height = 60 }) {
    if (data.length < 2) return <div style={{ height }} className="ins-chart-empty">Not enough data</div>;
    const values = data.map(d => d.value ?? d ?? 0);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const w = 100 / (values.length - 1);
    const pts = values.map((v, i) => {
        const x = i * w;
        const y = height - ((v - min) / range) * (height - 8) - 4;
        return `${x},${y}`;
    }).join(' ');
    return (
        <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
            <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    );
}

/** Donut chart for task distribution */
function DonutChart({ data = [], size = 120 }) {
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444'];
    const total = data.reduce((s, d) => s + (d.value || 0), 0);
    if (!total) return <div style={{ width: size, height: size }} className="ins-chart-empty">No tasks</div>;

    let cumAngle = 0;
    const r = 40;
    const cx = 50;
    const cy = 50;

    const slices = data.filter(d => d.value > 0).map((d, i) => {
        const angle = (d.value / total) * 360;
        const startAngle = cumAngle;
        cumAngle += angle;
        const largeArc = angle > 180 ? 1 : 0;
        const toRad = a => (a * Math.PI) / 180;
        const x1 = cx + r * Math.cos(toRad(startAngle - 90));
        const y1 = cy + r * Math.sin(toRad(startAngle - 90));
        const x2 = cx + r * Math.cos(toRad(cumAngle - 90));
        const y2 = cy + r * Math.sin(toRad(cumAngle - 90));
        return { d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`, color: colors[i % colors.length], label: d.label, value: d.value };
    });

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <svg width={size} height={size} viewBox="0 0 100 100">
                {slices.map((s, i) => <path key={i} d={s.d} fill={s.color} opacity={0.9} />)}
                <circle cx={cx} cy={cy} r={22} fill="var(--ins-bg-card)" />
                <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="bold" fill="var(--ins-text-primary)">{total}</text>
                <text x={cx} y={cy + 12} textAnchor="middle" dominantBaseline="middle" fontSize="5.5" fill="var(--ins-text-muted)">tasks</text>
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {slices.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: s.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: 'var(--ins-text-secondary)' }}>{s.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ins-text-primary)', marginLeft: 'auto' }}>{s.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Horizontal bar for channel/user rankings */
function HBar({ label, value, max, color = '#6366f1', subtitle }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ins-text-primary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color }}>{value.toLocaleString()}</span>
            </div>
            {subtitle && <div style={{ fontSize: 11, color: 'var(--ins-text-muted)', marginBottom: 4 }}>{subtitle}</div>}
            <div style={{ height: 6, borderRadius: 4, background: 'var(--ins-bar-bg)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
            </div>
        </div>
    );
}

/** Status badge */
function Badge({ status }) {
    const cfg = {
        overloaded: { bg: '#fef2f2', text: '#dc2626', label: '🔴 Overloaded' },
        idle: { bg: '#fafafa', text: '#6b7280', label: '⚪ Idle' },
        balanced: { bg: '#f0fdf4', text: '#16a34a', label: '🟢 Balanced' }
    };
    const c = cfg[status] || cfg.balanced;
    return (
        <span style={{ background: c.bg, color: c.text, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>{c.label}</span>
    );
}

/** Stat card */
function StatCard({ label, value, icon: Icon, color, trend, sub }) {
    const colorMap = {
        indigo: { bg: '#eef2ff', iconBg: '#6366f1', text: '#6366f1' },
        green: { bg: '#f0fdf4', iconBg: '#10b981', text: '#10b981' },
        purple: { bg: '#faf5ff', iconBg: '#8b5cf6', text: '#8b5cf6' },
        orange: { bg: '#fff7ed', iconBg: '#f59e0b', text: '#f59e0b' },
        rose: { bg: '#fff1f2', iconBg: '#f43f5e', text: '#f43f5e' }
    };
    const c = colorMap[color] || colorMap.indigo;
    return (
        <div className="ins-stat-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {Icon && <Icon size={18} color={c.iconBg} />}
                </div>
                {trend !== undefined && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 12, fontWeight: 600, color: trend >= 0 ? '#10b981' : '#ef4444' }}>
                        {trend >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                        {Math.abs(trend)}%
                    </div>
                )}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--ins-text-primary)', marginBottom: 4 }}>{value}</div>
            <div style={{ fontSize: 13, color: 'var(--ins-text-muted)', fontWeight: 500 }}>{label}</div>
            {sub && <div style={{ fontSize: 11, color: 'var(--ins-text-muted)', marginTop: 2 }}>{sub}</div>}
        </div>
    );
}

// ─── SECTION COMPONENTS ───────────────────────────────────────────────────────

function Card({ title, icon: Icon, iconColor = '#6366f1', children, style }) {
    return (
        <div className="ins-card" style={style}>
            <div className="ins-card-header">
                {Icon && <Icon size={16} color={iconColor} />}
                <span className="ins-card-title">{title}</span>
            </div>
            {children}
        </div>
    );
}

// ─── MAIN DASHBOARD ──────────────────────────────────────────────────────────

const InsightsDashboard = () => {
    const [period, setPeriod] = useState(30);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [summary, setSummary] = useState(null);
    const [userActivity, setUserActivity] = useState(null);
    const [workspaces, setWorkspaces] = useState([]);
    const [channels, setChannels] = useState([]);
    const [tasks, setTasks] = useState(null);
    const [messages, setMessages] = useState(null);
    const [engagement, setEngagement] = useState(null);
    const [teamActivity, setTeamActivity] = useState([]);
    const [workload, setWorkload] = useState(null);
    const [commPatterns, setCommPatterns] = useState(null);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async (showLoader = true) => {
        try {
            if (showLoader) setLoading(true);
            else setRefreshing(true);
            setError(null);

            const p = `period=${period}`;
            const base = `${API_BASE}/api`;

            const [sum, ua, ws, ch, tk, msg, eng, ta, wl, cp] = await Promise.allSettled([
                axios.get(`${base}/dashboard/analytics/summary?${p}`, authHeader()),
                axios.get(`${base}/dashboard/analytics/users?${p}`, authHeader()),
                axios.get(`${base}/dashboard/analytics/workspaces?${p}`, authHeader()),
                axios.get(`${base}/dashboard/analytics/channels?${p}`, authHeader()),
                axios.get(`${base}/dashboard/analytics/tasks?${p}`, authHeader()),
                axios.get(`${base}/dashboard/analytics/messages?${p}`, authHeader()),
                axios.get(`${base}/dashboard/analytics/engagement?${p}`, authHeader()),
                axios.get(`${base}/analytics/insights/team?${p}`, authHeader()),
                axios.get(`${base}/analytics/insights/workload?${p}`, authHeader()),
                axios.get(`${base}/analytics/insights/communication?${p}`, authHeader()),
            ]);

            if (sum.status === 'fulfilled') setSummary(sum.value.data);
            if (ua.status === 'fulfilled') setUserActivity(ua.value.data);
            if (ws.status === 'fulfilled') setWorkspaces(ws.value.data.workspaces || []);
            if (ch.status === 'fulfilled') setChannels(ch.value.data.channels || []);
            if (tk.status === 'fulfilled') setTasks(tk.value.data);
            if (msg.status === 'fulfilled') setMessages(msg.value.data);
            if (eng.status === 'fulfilled') setEngagement(eng.value.data);
            if (ta.status === 'fulfilled') setTeamActivity(ta.value.data.teamActivity || []);
            if (wl.status === 'fulfilled') setWorkload(wl.value.data);
            if (cp.status === 'fulfilled') setCommPatterns(cp.value.data);
        } catch (err) {
            setError('Failed to load insights data. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [period]);

    useEffect(() => { fetchData(true); }, [fetchData]);

    if (loading) return <InsightsLoader />;

    const s = summary?.summary || {};
    const maxMsgContrib = Math.max(...(userActivity?.topContributors || []).map(u => u.messages), 1);
    const maxChannelMsg = Math.max(...channels.map(c => c.messageCount), 1);
    const maxWsMsg = Math.max(...workspaces.map(w => w.messageCount), 1);
    const maxWorkloadTasks = Math.max(...(workload?.workload || []).map(u => u.openTasks), 1);
    const maxTeamActivity = Math.max(...teamActivity.map(u => u.messages + u.tasksAssigned), 1);

    return (
        <>
            <style>{STYLES}</style>
            <div className="ins-root">
                {/* Header */}
                <div className="ins-header">
                    <div>
                        <h1 className="ins-title">
                            <BarChart2 size={24} style={{ color: '#6366f1' }} />
                            Productivity Insights
                        </h1>
                        <p className="ins-subtitle">Real-time analytics across messaging, tasks, meetings & engagement</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* Period filter */}
                        <div className="ins-period-tabs">
                            {[7, 30].map(d => (
                                <button key={d} className={`ins-period-btn${period === d ? ' active' : ''}`} onClick={() => setPeriod(d)}>
                                    {d === 7 ? '7 days' : '30 days'}
                                </button>
                            ))}
                        </div>
                        <button className={`ins-refresh-btn${refreshing ? ' spin' : ''}`} onClick={() => fetchData(false)} disabled={refreshing} title="Refresh">
                            <RefreshCw size={15} />
                        </button>
                    </div>
                </div>

                {error && <div className="ins-error">{error}</div>}

                {/* ── OVERVIEW STATS ── */}
                <div className="ins-stats-grid">
                    <StatCard label="Total Users" value={s.totalUsers || 0} icon={Users} color="indigo" trend={s.userGrowth} />
                    <StatCard label="Active Users" value={s.activeUsers || 0} icon={Activity} color="green" sub={`in last ${period} days`} />
                    <StatCard label="Messages Sent" value={(s.totalMessages || 0).toLocaleString()} icon={MessageSquare} color="purple" />
                    <StatCard label="Task Completion" value={`${s.taskCompletionRate || 0}%`} icon={CheckSquare} color="orange" />
                    <StatCard label="DAU" value={engagement?.dau || 0} icon={Zap} color="rose" sub="Daily active users" />
                    <StatCard label="WAU" value={engagement?.wau || 0} icon={TrendingUp} color="indigo" sub="Weekly active users" />
                    <StatCard label="MAU" value={engagement?.mau || 0} icon={Users} color="green" sub="Monthly active users" />
                    <StatCard label="Stickiness" value={`${engagement?.dauWauRatio || 0}%`} icon={Target} color="purple" sub="DAU / WAU ratio" />
                </div>

                {/* ── ROW 1: Team Activity + Communication Patterns ── */}
                <div className="ins-row-2">
                    <Card title="Team Activity" icon={Activity} iconColor="#6366f1" style={{ flex: 1 }}>
                        {teamActivity.length === 0 ? (
                            <EmptyState msg="No activity tracked in this period" />
                        ) : (
                            <div className="ins-scroll-list">
                                {teamActivity.slice(0, 8).map((u, i) => (
                                    <div key={u.userId} className="ins-user-row">
                                        <div className="ins-rank">{i + 1}</div>
                                        <div className="ins-avatar">{(u.name || '?')[0].toUpperCase()}</div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ins-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                                            <div style={{ fontSize: 11, color: 'var(--ins-text-muted)' }}>{u.messages} msgs · {u.tasksAssigned} tasks</div>
                                        </div>
                                        <div style={{ width: 80 }}>
                                            <div style={{ height: 4, background: 'var(--ins-bar-bg)', borderRadius: 2, overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${Math.round(((u.messages + u.tasksAssigned) / maxTeamActivity) * 100)}%`, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius: 2 }} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    <Card title="Communication Patterns" icon={MessageSquare} iconColor="#8b5cf6" style={{ flex: 1 }}>
                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ins-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hourly Activity</div>
                            <div style={{ height: 48 }}>
                                <BarSparkline
                                    data={(commPatterns?.hourlyPattern || []).map(h => ({ value: h.count }))}
                                    color="#8b5cf6"
                                    height={48}
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ins-text-muted)', marginTop: 4 }}>
                                <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ins-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top Channels</div>
                            {(commPatterns?.topChannels || []).slice(0, 4).map((c, i) => (
                                <HBar key={i} label={c.name} value={c.count} max={commPatterns?.topChannels[0]?.count || 1} color="#8b5cf6" />
                            ))}
                        </div>
                    </Card>
                </div>

                {/* ── ROW 2: Productivity + Workload ── */}
                <div className="ins-row-2">
                    <Card title="Productivity Metrics" icon={CheckSquare} iconColor="#10b981" style={{ flex: 1 }}>
                        <div className="ins-productivity-row">
                            <div className="ins-prod-stat">
                                <div className="ins-prod-value" style={{ color: '#10b981' }}>{tasks?.summary?.completionRate || 0}%</div>
                                <div className="ins-prod-label">Completion Rate</div>
                            </div>
                            <div className="ins-prod-stat">
                                <div className="ins-prod-value" style={{ color: '#6366f1' }}>{tasks?.summary?.total || 0}</div>
                                <div className="ins-prod-label">Total Tasks</div>
                            </div>
                            <div className="ins-prod-stat">
                                <div className="ins-prod-value" style={{ color: '#f59e0b' }}>{tasks?.summary?.avgDurationHours || 0}h</div>
                                <div className="ins-prod-label">Avg. Duration</div>
                            </div>
                        </div>

                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ins-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Created vs Completed</div>
                            <div style={{ height: 64 }}>
                                <svg width="100%" height={64} viewBox="0 0 100 64" preserveAspectRatio="none">
                                    {(tasks?.trendData || []).map((d, i, arr) => {
                                        const maxVal = Math.max(...arr.flatMap(x => [x.created, x.completed]), 1);
                                        const w = 100 / arr.length;
                                        const createdH = (d.created / maxVal) * 56;
                                        const completedH = (d.completed / maxVal) * 56;
                                        return (
                                            <g key={i}>
                                                <rect x={i * w + 0.5} y={64 - createdH - 4} width={w / 2 - 0.5} height={createdH} rx={1.5} fill="#6366f1" opacity={0.7} />
                                                <rect x={i * w + w / 2} y={64 - completedH - 4} width={w / 2 - 0.5} height={completedH} rx={1.5} fill="#10b981" opacity={0.85} />
                                            </g>
                                        );
                                    })}
                                </svg>
                            </div>
                            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: '#6366f1' }} /><span style={{ fontSize: 11, color: 'var(--ins-text-muted)' }}>Created</span></div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: '#10b981' }} /><span style={{ fontSize: 11, color: 'var(--ins-text-muted)' }}>Completed</span></div>
                            </div>
                        </div>

                        <DonutChart
                            size={110}
                            data={[
                                { label: 'Todo', value: tasks?.metrics?.todo || 0 },
                                { label: 'In Progress', value: tasks?.metrics?.inProgress || 0 },
                                { label: 'Review', value: tasks?.metrics?.review || 0 },
                                { label: 'Done', value: tasks?.metrics?.completed || 0 },
                                { label: 'Blocked', value: tasks?.metrics?.blocked || 0 },
                                { label: 'Cancelled', value: tasks?.metrics?.cancelled || 0 }
                            ].filter(d => d.value > 0)}
                        />
                    </Card>

                    <Card title="Workload Analysis" icon={Layers} iconColor="#f59e0b" style={{ flex: 1 }}>
                        {workload && (
                            <div className="ins-workload-stats">
                                <div className="ins-wl-stat" style={{ background: '#fef2f2' }}>
                                    <AlertTriangle size={14} color="#dc2626" />
                                    <span style={{ color: '#dc2626', fontWeight: 700, fontSize: 20 }}>{workload.stats.overloadedCount}</span>
                                    <span style={{ color: '#dc2626', fontSize: 12 }}>Overloaded</span>
                                </div>
                                <div className="ins-wl-stat" style={{ background: '#f0fdf4' }}>
                                    <TrendingUp size={14} color="#16a34a" />
                                    <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 20 }}>{workload.stats.balancedCount}</span>
                                    <span style={{ color: '#16a34a', fontSize: 12 }}>Balanced</span>
                                </div>
                                <div className="ins-wl-stat" style={{ background: '#fafafa' }}>
                                    <Coffee size={14} color="#6b7280" />
                                    <span style={{ color: '#6b7280', fontWeight: 700, fontSize: 20 }}>{workload.stats.idleCount}</span>
                                    <span style={{ color: '#6b7280', fontSize: 12 }}>Idle</span>
                                </div>
                            </div>
                        )}
                        <div className="ins-scroll-list">
                            {(workload?.workload || []).slice(0, 8).map((u, i) => (
                                <div key={u.userId} className="ins-user-row">
                                    <div className="ins-avatar">{(u.name || '?')[0].toUpperCase()}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                                            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ins-text-primary)' }}>{u.name}</span>
                                            <Badge status={u.status} />
                                        </div>
                                        <div style={{ height: 4, background: 'var(--ins-bar-bg)', borderRadius: 2, overflow: 'hidden' }}>
                                            <div style={{
                                                height: '100%',
                                                width: `${Math.round((u.openTasks / maxWorkloadTasks) * 100)}%`,
                                                background: u.status === 'overloaded' ? '#ef4444' : u.status === 'idle' ? '#9ca3af' : '#f59e0b',
                                                borderRadius: 2
                                            }} />
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--ins-text-muted)', marginTop: 2 }}>{u.openTasks} open tasks</div>
                                    </div>
                                </div>
                            ))}
                            {!(workload?.workload?.length) && <EmptyState msg="No workload data available" />}
                        </div>
                    </Card>
                </div>

                {/* ── ROW 3: Channel Engagement + Message Volume ── */}
                <div className="ins-row-2">
                    <Card title="Top Channels by Engagement" icon={Hash} iconColor="#6366f1" style={{ flex: 1 }}>
                        {channels.length === 0 ? <EmptyState msg="No channel data in this period" /> : (
                            channels.slice(0, 8).map((c, i) => (
                                <HBar key={c.channelId} label={`#${c.name}`} value={c.messageCount} max={maxChannelMsg} color="#6366f1"
                                    subtitle={`${c.memberCount} members · ${c.activeUsers} active`} />
                            ))
                        )}
                    </Card>

                    <Card title="Message Volume" icon={MessageSquare} iconColor="#10b981" style={{ flex: 1 }}>
                        <div className="ins-msg-stats">
                            <div className="ins-msg-stat">
                                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ins-text-primary)' }}>{(messages?.metrics?.total || 0).toLocaleString()}</div>
                                <div style={{ fontSize: 12, color: 'var(--ins-text-muted)' }}>Total</div>
                            </div>
                            <div className="ins-msg-stat">
                                <div style={{ fontSize: 22, fontWeight: 800, color: '#6366f1' }}>{(messages?.metrics?.byChannel || 0).toLocaleString()}</div>
                                <div style={{ fontSize: 12, color: 'var(--ins-text-muted)' }}>Channel</div>
                            </div>
                            <div className="ins-msg-stat">
                                <div style={{ fontSize: 22, fontWeight: 800, color: '#8b5cf6' }}>{(messages?.metrics?.byDM || 0).toLocaleString()}</div>
                                <div style={{ fontSize: 12, color: 'var(--ins-text-muted)' }}>Direct</div>
                            </div>
                        </div>
                        <div style={{ marginTop: 16 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ins-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trend</div>
                            <LineSparkline data={messages?.trendData || []} color="#10b981" height={72} />
                        </div>

                        <div style={{ marginTop: 16 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ins-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Workspaces by Activity</div>
                            {workspaces.slice(0, 5).map(ws => (
                                <HBar key={ws._id} label={ws.name} value={ws.messageCount} max={maxWsMsg} color="#6366f1"
                                    subtitle={`${ws.memberCount} members · ${ws.activeUsers} active`} />
                            ))}
                        </div>
                    </Card>
                </div>

                {/* ── ROW 4: Top Contributors ── */}
                <Card title="Top Contributors" icon={TrendingUp} iconColor="#f59e0b">
                    <div className="ins-contributors-grid">
                        {(userActivity?.topContributors || []).slice(0, 10).map((u, i) => (
                            <div key={u.userId} className="ins-contrib-card">
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <div className="ins-avatar-sm">{(u.name || '?')[0].toUpperCase()}</div>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', background: '#fef3c7', padding: '2px 8px', borderRadius: 20 }}>#{i + 1}</span>
                                </div>
                                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ins-text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                                <div style={{ fontSize: 24, fontWeight: 900, color: '#6366f1' }}>{u.messages.toLocaleString()}</div>
                                <div style={{ fontSize: 11, color: 'var(--ins-text-muted)' }}>messages sent</div>
                                <div style={{ height: 3, background: 'var(--ins-bar-bg)', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${Math.round((u.messages / maxMsgContrib) * 100)}%`, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius: 2 }} />
                                </div>
                            </div>
                        ))}
                        {!(userActivity?.topContributors?.length) && <EmptyState msg="No contribution data yet" />}
                    </div>
                </Card>
            </div>
        </>
    );
};

// ─── LOADER ──────────────────────────────────────────────────────────────────
function InsightsLoader() {
    return (
        <>
            <style>{STYLES}</style>
            <div className="ins-root">
                <div className="ins-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="ins-skeleton" style={{ width: 24, height: 24, borderRadius: 6 }} />
                        <div className="ins-skeleton" style={{ width: 200, height: 28, borderRadius: 6 }} />
                    </div>
                </div>
                <div className="ins-stats-grid">
                    {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="ins-stat-card ins-skeleton" style={{ height: 100 }} />)}
                </div>
                <div className="ins-row-2">
                    <div className="ins-card ins-skeleton" style={{ flex: 1, height: 280 }} />
                    <div className="ins-card ins-skeleton" style={{ flex: 1, height: 280 }} />
                </div>
            </div>
        </>
    );
}

function EmptyState({ msg }) {
    return <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ins-text-muted)', fontSize: 13 }}>{msg}</div>;
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const STYLES = `
  :root {
    --ins-bg: #f8f9fc;
    --ins-bg-card: #ffffff;
    --ins-text-primary: #0f172a;
    --ins-text-secondary: #374151;
    --ins-text-muted: #94a3b8;
    --ins-border: #e2e8f0;
    --ins-bar-bg: #e2e8f0;
    --ins-header-bg: #ffffff;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --ins-bg: #0f172a;
      --ins-bg-card: #1e293b;
      --ins-text-primary: #f1f5f9;
      --ins-text-secondary: #cbd5e1;
      --ins-text-muted: #64748b;
      --ins-border: #334155;
      --ins-bar-bg: #334155;
      --ins-header-bg: #1e293b;
    }
  }
  .ins-root {
    min-height: 100vh;
    background: var(--ins-bg);
    padding: 0 0 40px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  .ins-header {
    background: var(--ins-header-bg);
    border-bottom: 1px solid var(--ins-border);
    padding: 20px 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .ins-title {
    font-size: 22px;
    font-weight: 800;
    color: var(--ins-text-primary);
    margin: 0 0 4px;
    display: flex;
    align-items: center;
    gap: 10px;
    letter-spacing: -0.01em;
  }
  .ins-subtitle {
    font-size: 13px;
    color: var(--ins-text-muted);
    margin: 0;
  }
  .ins-period-tabs {
    display: flex;
    background: var(--ins-bar-bg);
    border-radius: 8px;
    padding: 3px;
    gap: 2px;
  }
  .ins-period-btn {
    padding: 5px 14px;
    font-size: 12px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    border-radius: 6px;
    background: transparent;
    color: var(--ins-text-muted);
    transition: all 0.15s;
  }
  .ins-period-btn.active {
    background: var(--ins-bg-card);
    color: #6366f1;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  .ins-refresh-btn {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    border: 1px solid var(--ins-border);
    background: var(--ins-bg-card);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ins-text-muted);
    transition: all 0.15s;
  }
  .ins-refresh-btn:hover { color: #6366f1; border-color: #6366f1; }
  .ins-refresh-btn.spin svg { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .ins-error {
    margin: 16px 32px;
    padding: 12px 16px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 10px;
    color: #dc2626;
    font-size: 13px;
    font-weight: 500;
  }
  .ins-stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    padding: 24px 32px 0;
  }
  @media (max-width: 1200px) { .ins-stats-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 640px) { .ins-stats-grid { grid-template-columns: 1fr; } }
  .ins-stat-card {
    background: var(--ins-bg-card);
    border: 1px solid var(--ins-border);
    border-radius: 14px;
    padding: 20px;
    transition: box-shadow 0.2s;
  }
  .ins-stat-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.07); }
  .ins-row-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    padding: 16px 32px 0;
  }
  @media (max-width: 900px) { .ins-row-2 { grid-template-columns: 1fr; } }
  .ins-card {
    background: var(--ins-bg-card);
    border: 1px solid var(--ins-border);
    border-radius: 14px;
    padding: 20px;
    margin: 16px 32px 0;
  }
  .ins-card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--ins-border);
  }
  .ins-card-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--ins-text-primary);
    letter-spacing: -0.01em;
  }
  .ins-scroll-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 280px;
    overflow-y: auto;
  }
  .ins-user-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
  }
  .ins-rank {
    width: 20px;
    height: 20px;
    background: #eef2ff;
    color: #6366f1;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .ins-avatar {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .ins-avatar-sm {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .ins-productivity-row {
    display: flex;
    gap: 0;
    margin-bottom: 16px;
    background: var(--ins-bg);
    border-radius: 10px;
    overflow: hidden;
  }
  .ins-prod-stat {
    flex: 1;
    padding: 12px 0;
    text-align: center;
  }
  .ins-prod-value { font-size: 24px; font-weight: 900; }
  .ins-prod-label { font-size: 11px; color: var(--ins-text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px; }
  .ins-workload-stats {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
  }
  .ins-wl-stat {
    flex: 1;
    border-radius: 10px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .ins-msg-stats {
    display: flex;
    gap: 0;
    background: var(--ins-bg);
    border-radius: 10px;
    overflow: hidden;
  }
  .ins-msg-stat {
    flex: 1;
    padding: 12px 0;
    text-align: center;
  }
  .ins-contributors-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 12px;
  }
  @media (max-width: 1200px) { .ins-contributors-grid { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 768px) { .ins-contributors-grid { grid-template-columns: repeat(2, 1fr); } }
  .ins-contrib-card {
    background: var(--ins-bg);
    border: 1px solid var(--ins-border);
    border-radius: 12px;
    padding: 14px;
    transition: all 0.2s;
  }
  .ins-contrib-card:hover { border-color: #6366f1; box-shadow: 0 4px 12px rgba(99,102,241,0.1); }
  .ins-chart-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ins-text-muted);
    font-size: 12px;
  }
  .ins-skeleton {
    background: linear-gradient(90deg, var(--ins-bar-bg) 25%, var(--ins-border) 50%, var(--ins-bar-bg) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 12px;
  }
  @keyframes shimmer { to { background-position: -200% 0; } }
`;

export default InsightsDashboard;
