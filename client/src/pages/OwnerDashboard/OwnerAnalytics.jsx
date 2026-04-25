import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { useCompany } from '../../contexts/CompanyContext';
import { RefreshCw, BarChart3, TrendingUp, TrendingDown, Users, MessageSquare, Activity, Calendar } from 'lucide-react';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getOwnerAnalytics } from '../../services/ownerDashboardService';

const COLORS = ['#b8956a', '#c9a87c', '#5aba8a', '#e05252', '#7a7a7a', '#404040'];

const OwnerAnalytics = () => {
    const { isCompanyOwner } = useCompany();
    const { showToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [timeRange, setTimeRange] = useState('30d');
    const [analyticsData, setAnalyticsData] = useState(null);

    const fetchData = useCallback(async (range) => {
        try {
            const data = await getOwnerAnalytics(range);
            setAnalyticsData(data);
        } catch {
            showToast('Failed to load analytics data', 'error');
        }
    }, [showToast]);

    useEffect(() => {
        if (!isCompanyOwner()) return;
        const load = async () => {
            setLoading(true);
            await fetchData(timeRange);
            setLoading(false);
        };
        load();
    }, [isCompanyOwner, fetchData, timeRange]);

    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        await fetchData(timeRange);
        setRefreshing(false);
        showToast('Analytics refreshed', 'success');
    };

    const userGrowthData = analyticsData?.userGrowth || [];
    const messageVolumeData = analyticsData?.dailyMessages || [];
    const workspaceActivityData = analyticsData?.workspaceActivity || [];
    const departmentDistribution = analyticsData?.departmentDistribution || [];
    const summary = analyticsData?.summary || {};

    const tooltipStyle = { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '0px', color: 'var(--text-primary)', fontSize: '12px' };

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <div style={{ height: '56px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div><div className="sk" style={{ height: '13px', width: '200px', marginBottom: '5px' }} /><div className="sk" style={{ height: '9px', width: '300px' }} /></div>
                <div style={{ display: 'flex', gap: '8px' }}><div className="sk" style={{ height: '30px', width: '120px' }} /><div className="sk" style={{ height: '30px', width: '80px' }} /></div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
                {}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border-subtle)', marginBottom: '16px' }}>
                    {[1,2,3,4].map(i => (
                        <div key={i} style={{ background: 'var(--bg-surface)', padding: '18px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}><div className="sk" style={{ width: '14px', height: '14px' }} /><div className="sk" style={{ height: '9px', width: '80px' }} /></div>
                            <div className="sk" style={{ height: '32px', width: '70px', marginBottom: '6px' }} />
                            <div className="sk" style={{ height: '9px', width: '100px' }} />
                        </div>
                    ))}
                </div>
                {}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    {[1,2].map(i => (
                        <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <div><div className="sk" style={{ height: '12px', width: '140px', marginBottom: '4px' }} /><div className="sk" style={{ height: '9px', width: '100px' }} /></div>
                            </div>
                            <div className="sk" style={{ height: '160px', width: '100%' }} />
                        </div>
                    ))}
                </div>
                {}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '20px' }}>
                        <div className="sk" style={{ height: '12px', width: '160px', marginBottom: '16px' }} />
                        <div className="sk" style={{ height: '160px', width: '100%' }} />
                    </div>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '20px' }}>
                        <div className="sk" style={{ height: '12px', width: '140px', marginBottom: '16px' }} />
                        {[1,2,3,4,5].map(i => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}><div className="sk" style={{ height: '10px', width: '80px' }} /><div className="sk" style={{ height: '10px', width: '30px' }} /></div>)}
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', height: '100%',
            background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif',
        }}>
            {}
            <header style={{
                height: '56px', padding: '0 28px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)',
                flexShrink: 0, zIndex: 5,
            }}>
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <BarChart3 size={16} style={{ color: 'var(--accent)' }} />
                        Analytics &amp; Insights
                    </h2>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', marginLeft: '24px' }}>
                        Historical trends, growth metrics &amp; detailed performance
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {}
                    <div style={{ display: 'flex', background: 'var(--bg-active)', border: '1px solid var(--border-default)' }}>
                        {['7d', '30d', '90d'].map(range => (
                            <button key={range} onClick={() => { if (range !== timeRange) setTimeRange(range); }}
                                style={{
                                    padding: '5px 12px', border: 'none', cursor: 'pointer',
                                    background: timeRange === range ? 'var(--accent)' : 'transparent',
                                    color: timeRange === range ? 'var(--bg-base)' : 'var(--text-secondary)',
                                    fontSize: '11px', fontWeight: timeRange === range ? 700 : 400,
                                    transition: 'all 150ms ease', borderRadius: '0',
                                }}>
                                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
                            </button>
                        ))}
                    </div>
                    <RBtn onClick={handleRefresh} disabled={refreshing} label={refreshing ? 'Refreshing...' : 'Refresh'} icon={<RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />} />
                </div>
            </header>

            {}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }} className="custom-scrollbar">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1280px', margin: '0 auto' }}>

                    {}
                    <section>
                        <SectionLabel label="Growth Metrics" sub={`${timeRange === '7d' ? '7-day' : timeRange === '30d' ? '30-day' : '90-day'} performance overview`} />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border-subtle)' }}>
                            <MetricCard icon={Users} label="New Users" value={summary.newUsers ?? 0}
                                sub={`Joined in last ${timeRange}`} trend={summary.newUsers > 0 ? Math.min(Math.round((summary.newUsers / Math.max(summary.totalUsers - summary.newUsers, 1)) * 100), 999) : 0} />
                            <MetricCard icon={MessageSquare} label="Message Volume" value={(summary.totalMessages ?? 0).toLocaleString()}
                                sub={`Messages sent (${timeRange})`} trend={summary.totalMessages > 0 ? 12 : 0} />
                            <MetricCard icon={Activity} label="Engagement Rate" value={`${summary.engagementRate ?? 0}%`}
                                sub="Active participation" trend={summary.engagementRate > 50 ? 8 : summary.engagementRate > 0 ? -5 : 0} />
                            <MetricCard icon={Calendar} label="Workspace Activity" value={`${summary.activeWorkspaces ?? 0}/${summary.totalWorkspaces ?? 0}`}
                                sub="Active workspaces" trend={0} />
                        </div>
                    </section>

                    {}
                    <ChartCard title="User Growth Trend" sub="Total users vs active users over time">
                        {userGrowthData.length > 0 ? (
                            <>
                                <ResponsiveContainer width="100%" height={260}>
                                    <AreaChart data={userGrowthData}>
                                        <defs>
                                            <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#b8956a" stopOpacity={0.25} />
                                                <stop offset="95%" stopColor="#b8956a" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#5aba8a" stopOpacity={0.25} />
                                                <stop offset="95%" stopColor="#5aba8a" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#222222" strokeOpacity={0.5} />
                                        <XAxis dataKey="date" stroke="#404040" style={{ fontSize: '11px' }} />
                                        <YAxis stroke="#404040" style={{ fontSize: '11px' }} />
                                        <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'var(--text-secondary)' }} />
                                        <Area type="monotone" dataKey="users" stroke="#b8956a" fillOpacity={1} fill="url(#colorUsers)" strokeWidth={1.5} />
                                        <Area type="monotone" dataKey="active" stroke="#5aba8a" fillOpacity={1} fill="url(#colorActive)" strokeWidth={1.5} />
                                    </AreaChart>
                                </ResponsiveContainer>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '8px' }}>
                                    <Legend color="#b8956a" label="Total Users" />
                                    <Legend color="#5aba8a" label="Active Users" />
                                </div>
                            </>
                        ) : <EmptyState msg="No user data available for this period" />}
                    </ChartCard>

                    {}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border-subtle)' }}>
                        <ChartCard title={`${timeRange === '7d' ? 'Weekly' : 'Monthly'} Message Volume`} sub={`Messages sent per day (last ${timeRange === '7d' ? '7' : '30'} days)`}>
                            {messageVolumeData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={messageVolumeData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#222222" strokeOpacity={0.5} />
                                        <XAxis dataKey="day" stroke="#404040" style={{ fontSize: '11px' }} />
                                        <YAxis stroke="#404040" style={{ fontSize: '11px' }} />
                                        <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'var(--text-secondary)' }} />
                                        <Bar dataKey="messages" fill="#b8956a" radius={[1, 1, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <EmptyState msg="No messages in this period" />}
                        </ChartCard>

                        <ChartCard title="Top Active Workspaces" sub="Message count by workspace">
                            {workspaceActivityData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={workspaceActivityData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#222222" strokeOpacity={0.5} horizontal={false} />
                                        <XAxis type="number" stroke="#404040" style={{ fontSize: '11px' }} />
                                        <YAxis dataKey="name" type="category" width={110} stroke="#404040" style={{ fontSize: '10px' }} />
                                        <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'var(--text-secondary)' }} />
                                        <Bar dataKey="activity" radius={[0, 1, 1, 0]}>
                                            {workspaceActivityData.map((_, idx) => (
                                                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <EmptyState msg="No workspace activity in this period" />}
                        </ChartCard>
                    </div>

                    {}
                    <ChartCard title="Team Distribution" sub="Employees by department">
                        {departmentDistribution.length > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie data={departmentDistribution} cx="50%" cy="50%"
                                        labelLine={false} outerRadius={100} dataKey="value"
                                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                        style={{ fontSize: '11px' }}>
                                        {departmentDistribution.map((_, idx) => (
                                            <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'var(--text-secondary)' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : <EmptyState msg="No departments configured" />}
                    </ChartCard>
                </div>
            </div>
        </div>
    );
};

const SectionLabel = ({ label, sub }) => (
    <div style={{ marginBottom: '12px' }}>
        <h3 style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.13em', textTransform: 'uppercase', marginBottom: '2px' }}>{label}</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sub}</p>
    </div>
);

const MetricCard = ({ icon: Icon, label, value, sub, trend }) => (
    <div style={{ background: 'var(--bg-surface)', padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <Icon size={16} style={{ color: 'var(--text-muted)' }} />
            {trend !== 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 700, color: trend > 0 ? 'var(--state-success)' : 'var(--state-danger)' }}>
                    {trend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {Math.abs(trend)}%
                </div>
            )}
        </div>
        <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{value}</div>
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '2px' }}>{label}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{sub}</div>
    </div>
);

const ChartCard = ({ title, sub, children }) => (
    <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '20px 22px' }}>
        <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>{title}</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sub}</p>
        </div>
        {children}
    </section>
);

const EmptyState = ({ msg }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '160px', fontSize: '12px', color: 'var(--text-muted)' }}>{msg}</div>
);

const Legend = ({ color, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ width: '10px', height: '10px', background: color, borderRadius: '1px', flexShrink: 0 }} />
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{label}</span>
    </div>
);

const RBtn = ({ onClick, disabled, label, icon }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} disabled={disabled}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '5px',
                background: hov && !disabled ? 'var(--bg-hover)' : 'var(--bg-active)',
                border: '1px solid var(--border-default)',
                color: disabled ? 'var(--text-muted)' : hov ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '12px', fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1, transition: 'all 150ms ease', borderRadius: '0',
            }}>
            {icon}{label}
        </button>
    );
};

export default OwnerAnalytics;
