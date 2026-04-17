import React, { useState, useEffect, useCallback } from 'react';
import {
    Users, MessageSquare, CheckCircle2, TrendingUp,
    Activity, Calendar, Briefcase, RefreshCw, BarChart3
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '@services/api';

const T = {
    bg: 'var(--bg-base)', surface: 'var(--bg-surface)', active: 'var(--bg-active)',
    border: 'var(--border-subtle)', borderDefault: 'var(--border-default)',
    primary: 'var(--text-primary)', secondary: 'var(--text-secondary)', muted: 'var(--text-muted)',
    accent: 'var(--accent)', success: 'var(--state-success)', danger: 'var(--state-danger)',
};

const Analytics = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [analytics, setAnalytics] = useState(null);
    const [activity, setActivity] = useState(null);

    const fetchAnalytics = useCallback(async () => {
        try {
            const [analyticsRes, activityRes] = await Promise.all([
                api.get('/api/company/analytics/overview?timeRange=30d'),
                api.get('/api/company/analytics/activity'),
            ]);
            setAnalytics(analyticsRes.data.analytics);
            setActivity(activityRes.data.activity);
        } catch {
            try {
                const companyId = typeof user.companyId === 'object'
                    ? user.companyId?._id || user.companyId?.id
                    : user.companyId;
                const response = await api.get(`/api/companies/${companyId}/analytics`);
                setAnalytics(response.data);
            } catch (fallbackErr) {
                showToast('Failed to load analytics', 'error');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user.companyId, showToast]);

    useEffect(() => { if (user?.companyId) fetchAnalytics(); }, [user?.companyId, fetchAnalytics]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (!loading && !refreshing) { setRefreshing(true); fetchAnalytics(); }
        }, 30000);
        return () => clearInterval(interval);
    }, [loading, refreshing, fetchAnalytics]);

    const handleRefresh = () => { setRefreshing(true); fetchAnalytics(); };

    const totalUsers   = analytics?.employees?.total    ?? analytics?.overview?.totalUsers    ?? 0;
    const activeUsers  = analytics?.employees?.active   ?? analytics?.overview?.activeUsers   ?? 0;
    const newHires     = analytics?.employees?.newHires ?? 0;
    const totalWs      = analytics?.workspaces?.total   ?? analytics?.overview?.totalWorkspaces   ?? 0;
    const totalDepts   = analytics?.orgStructure?.departments ?? analytics?.overview?.totalDepartments ?? 0;
    const msgRecent    = analytics?.messages?.recent    ?? analytics?.overview?.messagesCount?.month ?? 0;
    const msgTotal     = analytics?.messages?.total     ?? 0;
    const tasksOpen    = analytics?.tasks?.open         ?? analytics?.overview?.tasksStats?.open      ?? 0;
    const tasksDone    = analytics?.tasks?.completed    ?? analytics?.overview?.tasksStats?.completed  ?? 0;
    const tasksOverdue = analytics?.tasks?.overdue      ?? analytics?.overview?.tasksStats?.overdue    ?? 0;
    const engScore     = analytics?.engagement?.engagementScore ?? 0;
    const deptBreakdown = analytics?.orgStructure?.departmentBreakdown ?? analytics?.departmentStats ?? [];
    const topUsers      = analytics?.topUsers ?? [];
    const dailyActivity = activity?.dailyActivity ?? [];
    const wsActivity    = analytics?.workspaces?.workspaceActivity ?? [];
    const newHiresChange = totalUsers > newHires ? `+${Math.round((newHires / Math.max(totalUsers - newHires, 1)) * 100)}%` : newHires > 0 ? '+∞' : '0%';

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <div style={{ height: '56px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div><div className="sk" style={{ height: '13px', width: '180px', marginBottom: '5px' }} /><div className="sk" style={{ height: '9px', width: '280px' }} /></div>
                <div style={{ display: 'flex', gap: '8px' }}><div className="sk" style={{ height: '30px', width: '120px' }} /><div className="sk" style={{ height: '30px', width: '80px' }} /></div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border-subtle)', marginBottom: '16px' }}>
                    {[1,2,3,4].map(i => (
                        <div key={i} style={{ background: 'var(--bg-surface)', padding: '18px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}><div className="sk" style={{ width: '14px', height: '14px' }} /><div className="sk" style={{ height: '9px', width: '80px' }} /></div>
                            <div className="sk" style={{ height: '32px', width: '70px', marginBottom: '6px' }} />
                            <div className="sk" style={{ height: '9px', width: '100px' }} />
                        </div>
                    ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    {[1,2].map(i => (
                        <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '20px' }}>
                            <div className="sk" style={{ height: '12px', width: '140px', marginBottom: '16px' }} />
                            <div className="sk" style={{ height: '160px', width: '100%' }} />
                        </div>
                    ))}
                </div>
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}><div className="sk" style={{ height: '11px', width: '120px' }} /></div>
                    {[1,2,3,4,5].map(i => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '11px 20px', borderBottom: '1px solid var(--border-subtle)', gap: '16px', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div className="sk" style={{ width: '28px', height: '28px', flexShrink: 0 }} /><div className="sk" style={{ height: '10px', width: '130px' }} /></div>
                            <div className="sk" style={{ height: '10px', width: '50px' }} />
                            <div className="sk" style={{ height: '10px', width: '50px' }} />
                            <div className="sk" style={{ height: '18px', width: '60px' }} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <div style={{ flex: 1, background: T.bg, overflowY: 'auto', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }} className="custom-scrollbar">
            {/* Header */}
            <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h1 style={{ fontSize: '18px', fontWeight: 600, color: T.primary, letterSpacing: '-0.015em', marginBottom: '2px' }}>Analytics</h1>
                    <p style={{ fontSize: '12px', color: T.muted }}>Real-time insights and metrics · Last 30 days</p>
                </div>
                <RefreshBtn refreshing={refreshing} onClick={handleRefresh} />
            </div>

            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Key Metrics */}
                <section>
                    <SectionTitle text="Key Metrics" />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                        <MetricCard icon={Users} label="Total Users" value={totalUsers} change={newHires > 0 ? `+${newHires} new` : null} positive />
                        <MetricCard icon={Activity} label="Active Users (30d)" value={activeUsers} change={engScore > 0 ? `${engScore}% engaged` : null} positive />
                        <MetricCard icon={Briefcase} label="Workspaces" value={totalWs} />
                        <MetricCard icon={BarChart3} label="Departments" value={totalDepts} />
                    </div>
                </section>

                {/* Activity Overview */}
                <section>
                    <SectionTitle text="Activity Overview" />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                        <ActivityCard icon={MessageSquare} label="Messages (30d)" value={msgRecent} total={msgTotal} />
                        <ActivityCard icon={CheckCircle2} label="Tasks Completed" value={tasksDone} total={tasksDone + tasksOpen} />
                        <ActivityCard icon={Calendar} label="Overdue Tasks" value={tasksOverdue} total={tasksDone + tasksOpen + tasksOverdue} negative />
                    </div>
                </section>

                {/* Daily Activity Chart */}
                {dailyActivity.length > 0 && (
                    <section style={{ background: T.surface, border: `1px solid ${T.border}`, padding: '20px' }}>
                        <h2 style={{ fontSize: '14px', fontWeight: 600, color: T.primary, marginBottom: '2px' }}>Daily Message Activity</h2>
                        <p style={{ fontSize: '11px', color: T.muted, marginBottom: '16px' }}>Messages per day (last 7 days)</p>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={dailyActivity}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#222222" strokeOpacity={0.8} />
                                <XAxis dataKey="date" stroke="#404040" style={{ fontSize: '11px' }} tickFormatter={d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short' })} />
                                <YAxis stroke="#404040" style={{ fontSize: '11px' }} />
                                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid #222222', borderRadius: '2px', color: 'var(--text-primary)', fontSize: '12px' }} />
                                <Bar dataKey="messageCount" fill="#b8956a" radius={[2, 2, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </section>
                )}

                {/* Top Workspaces */}
                {wsActivity.length > 0 && (
                    <section style={{ background: T.surface, border: `1px solid ${T.border}`, padding: '20px' }}>
                        <h2 style={{ fontSize: '14px', fontWeight: 600, color: T.primary, marginBottom: '2px' }}>Most Active Workspaces</h2>
                        <p style={{ fontSize: '11px', color: T.muted, marginBottom: '16px' }}>Ranked by message volume (30d)</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {wsActivity.map((ws, i) => {
                                const max = wsActivity[0]?.messageCount || 1;
                                const pct = Math.round(((ws.messageCount || 0) / max) * 100);
                                return (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ fontSize: '11px', fontWeight: 700, color: T.muted, width: '20px', textAlign: 'right' }}>#{i + 1}</span>
                                        <span style={{ fontSize: '12px', fontWeight: 500, color: T.primary, width: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</span>
                                        <div style={{ flex: 1, background: 'var(--border-subtle)', height: '3px' }}>
                                            <div style={{ background: T.accent, height: '3px', width: `${pct}%`, transition: 'width 0.3s ease' }} />
                                        </div>
                                        <span style={{ fontSize: '11px', fontWeight: 700, color: T.secondary, width: '70px', textAlign: 'right' }}>{ws.messageCount?.toLocaleString()} msgs</span>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Department Overview */}
                {deptBreakdown.length > 0 && (
                    <section>
                        <SectionTitle text="Department Overview" />
                        <div style={{ background: T.surface, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: T.active, borderBottom: `1px solid ${T.border}` }}>
                                        {['Department', 'Members', 'Size'].map((h, i) => (
                                            <th key={h} style={{ padding: '10px 16px', textAlign: i === 2 ? 'right' : 'left', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.muted }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {deptBreakdown.map((dept, idx) => {
                                        const maxCount = deptBreakdown[0]?.memberCount || 1;
                                        const pct = Math.round(((dept.memberCount || 0) / maxCount) * 100);
                                        return (
                                            <tr key={idx} style={{ borderBottom: `1px solid ${T.border}` }}>
                                                <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500, color: T.primary }}>{dept.name}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <div style={{ flex: 1, background: T.active, height: '3px', width: '100px' }}>
                                                            <div style={{ background: T.accent, height: '3px', width: `${pct}%` }} />
                                                        </div>
                                                        <span style={{ fontSize: '12px', color: T.secondary }}>{dept.memberCount}</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: T.primary }}>{pct}%</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {/* Top Contributors */}
                {topUsers.length > 0 && (
                    <section>
                        <SectionTitle text="Top Contributors" />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                            {topUsers.slice(0, 6).map((u, idx) => (
                                <div key={idx} style={{ background: T.surface, border: `1px solid ${T.border}`, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '36px', height: '36px', background: T.active, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: T.accent, flexShrink: 0 }}>
                                        {u.username?.[0]?.toUpperCase()}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontSize: '13px', fontWeight: 500, color: T.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.username}</p>
                                        <p style={{ fontSize: '11px', color: T.muted }}>{u.activityCount || 0} activities</p>
                                    </div>
                                    <div style={{ fontSize: '16px', fontWeight: 700, color: T.muted }}>#{idx + 1}</div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {!analytics && (
                    <section style={{ background: T.surface, border: `1px solid ${T.border}`, padding: '48px 24px', textAlign: 'center' }}>
                        <TrendingUp size={40} style={{ color: T.muted, opacity: 0.4, margin: '0 auto 12px' }} />
                        <h3 style={{ fontSize: '16px', fontWeight: 600, color: T.primary, marginBottom: '6px' }}>No Data Available</h3>
                        <p style={{ fontSize: '13px', color: T.muted }}>Start adding employees and sending messages to see analytics here.</p>
                    </section>
                )}
            </div>
        </div>
    );
};

const SectionTitle = ({ text }) => (
    <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>{text}</h2>
);

const MetricCard = ({ icon: Icon, label, value, change, positive }) => (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <Icon size={16} style={{ color: 'var(--text-muted)' }} />
            {change && <span style={{ fontSize: '11px', fontWeight: 700, color: positive ? 'var(--state-success)' : 'var(--state-danger)' }}>{change}</span>}
        </div>
        <div style={{ fontSize: '26px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '2px' }}>{value}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>{label}</div>
    </div>
);

const ActivityCard = ({ icon: Icon, label, value, total, negative }) => {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Icon size={14} style={{ color: negative ? 'var(--state-danger)' : 'var(--accent)' }} />
                <h3 style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{label}</h3>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '10px' }}>{value.toLocaleString()}</div>
            {total > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, background: 'var(--border-subtle)', height: '3px' }}>
                        <div style={{ height: '3px', background: negative ? 'var(--state-danger)' : 'var(--accent)', width: `${pct}%` }} />
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{pct}%</span>
                </div>
            )}
        </div>
    );
};

const RefreshBtn = ({ refreshing, onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} disabled={refreshing} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: hov ? 'var(--bg-active)' : 'var(--bg-surface)', border: '1px solid var(--border-default)', color: hov ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '12px', fontWeight: 500, cursor: refreshing ? 'not-allowed' : 'pointer', borderRadius: '2px', opacity: refreshing ? 0.6 : 1, transition: 'all 150ms ease' }}>
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} /> Refresh
        </button>
    );
};

export default Analytics;
