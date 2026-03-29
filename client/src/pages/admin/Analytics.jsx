import React, { useState, useEffect, useCallback } from 'react';
import {
    Users, MessageSquare, CheckCircle2, TrendingUp,
    Activity, Calendar, Briefcase, RefreshCw, BarChart3
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
// refactor(consistency): use canonical api.js client (handles auth tokens + 401 refresh)
import api from '@services/api';

const Analytics = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [analytics, setAnalytics] = useState(null);
    const [activity, setActivity] = useState(null);

    const fetchAnalytics = useCallback(async () => {
        try {
            const companyId = typeof user.companyId === 'object'
                ? user.companyId?._id || user.companyId?.id
                : user.companyId;

            const [analyticsRes, activityRes] = await Promise.all([
                api.get('/api/company/analytics/overview?timeRange=30d'),
                api.get('/api/company/analytics/activity'),
            ]);

            setAnalytics(analyticsRes.data.analytics);
            setActivity(activityRes.data.activity);
        } catch (error) {
            // Fallback: try the old endpoint
            try {
                const companyId = typeof user.companyId === 'object'
                    ? user.companyId?._id || user.companyId?.id
                    : user.companyId;
                const response = await api.get(`/api/companies/${companyId}/analytics`);
                setAnalytics(response.data);
            } catch (fallbackErr) {
                console.error('Error fetching analytics:', fallbackErr);
                showToast('Failed to load analytics', 'error');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user.companyId, showToast]);

    useEffect(() => {
        if (user?.companyId) {
            fetchAnalytics();
        }
    }, [user?.companyId, fetchAnalytics]);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            if (!loading && !refreshing) {
                setRefreshing(true);
                fetchAnalytics();
            }
        }, 30000);
        return () => clearInterval(interval);
    }, [loading, refreshing, fetchAnalytics]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchAnalytics();
    };

    // Derive values safely — support both the new company-analytics shape and legacy
    const totalUsers    = analytics?.employees?.total    ?? analytics?.overview?.totalUsers    ?? 0;
    const activeUsers   = analytics?.employees?.active   ?? analytics?.overview?.activeUsers   ?? 0;
    const newHires      = analytics?.employees?.newHires ?? 0;
    const totalWs       = analytics?.workspaces?.total   ?? analytics?.overview?.totalWorkspaces   ?? 0;
    const totalDepts    = analytics?.orgStructure?.departments ?? analytics?.overview?.totalDepartments ?? 0;
    const msgRecent     = analytics?.messages?.recent    ?? analytics?.overview?.messagesCount?.month ?? 0;
    const msgTotal      = analytics?.messages?.total     ?? 0;
    const tasksOpen     = analytics?.tasks?.open         ?? analytics?.overview?.tasksStats?.open      ?? 0;
    const tasksDone     = analytics?.tasks?.completed    ?? analytics?.overview?.tasksStats?.completed  ?? 0;
    const tasksOverdue  = analytics?.tasks?.overdue      ?? analytics?.overview?.tasksStats?.overdue    ?? 0;
    const engScore      = analytics?.engagement?.engagementScore ?? 0;

    const deptBreakdown = analytics?.orgStructure?.departmentBreakdown ?? analytics?.departmentStats ?? [];
    const topUsers      = analytics?.topUsers ?? [];
    const dailyActivity = activity?.dailyActivity ?? [];
    const wsActivity    = analytics?.workspaces?.workspaceActivity ?? [];

    // Compute change % for new hires vs existing
    const newHiresChange = totalUsers > newHires
        ? `+${Math.round((newHires / Math.max(totalUsers - newHires, 1)) * 100)}%`
        : newHires > 0 ? '+∞' : '0%';

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex-1 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white">Analytics</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Real-time insights and metrics · Last 30 days
                        </p>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            <div className="p-8 space-y-8">
                {/* Key Metrics */}
                <section>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Key Metrics</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <MetricCard
                            icon={Users}
                            label="Total Users"
                            value={totalUsers}
                            change={newHires > 0 ? `+${newHires} new` : null}
                            positive={true}
                            iconColor="text-blue-600"
                            bgColor="bg-blue-50 dark:bg-blue-900/20"
                        />
                        <MetricCard
                            icon={Activity}
                            label="Active Users (30d)"
                            value={activeUsers}
                            change={engScore > 0 ? `${engScore}% engaged` : null}
                            positive={true}
                            iconColor="text-green-600"
                            bgColor="bg-green-50 dark:bg-green-900/20"
                        />
                        <MetricCard
                            icon={Briefcase}
                            label="Workspaces"
                            value={totalWs}
                            change={null}
                            positive={true}
                            iconColor="text-purple-600"
                            bgColor="bg-purple-50 dark:bg-purple-900/20"
                        />
                        <MetricCard
                            icon={BarChart3}
                            label="Departments"
                            value={totalDepts}
                            change={null}
                            positive={true}
                            iconColor="text-orange-600"
                            bgColor="bg-orange-50 dark:bg-orange-900/20"
                        />
                    </div>
                </section>

                {/* Activity Overview */}
                <section>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Activity Overview</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <ActivityCard
                            icon={MessageSquare}
                            label="Messages (30d)"
                            value={msgRecent}
                            total={msgTotal}
                            color="blue"
                        />
                        <ActivityCard
                            icon={CheckCircle2}
                            label="Tasks Completed"
                            value={tasksDone}
                            total={tasksDone + tasksOpen}
                            color="green"
                        />
                        <ActivityCard
                            icon={Calendar}
                            label="Overdue Tasks"
                            value={tasksOverdue}
                            total={tasksDone + tasksOpen + tasksOverdue}
                            color="red"
                            negative={true}
                        />
                    </div>
                </section>

                {/* Daily Activity Chart */}
                {dailyActivity.length > 0 && (
                    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Daily Message Activity</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Messages per day (last 7 days)</p>
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={dailyActivity}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.1} />
                                <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: '12px' }} tickFormatter={d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short' })} />
                                <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#f3f4f6' }}
                                    itemStyle={{ color: '#f3f4f6' }}
                                    labelFormatter={d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                />
                                <Bar dataKey="messageCount" fill="#6366f1" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </section>
                )}

                {/* Top Workspaces Activity */}
                {wsActivity.length > 0 && (
                    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Most Active Workspaces</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Ranked by message volume (30d)</p>
                        <div className="space-y-3">
                            {wsActivity.map((ws, i) => {
                                const max = wsActivity[0]?.messageCount || 1;
                                const pct = Math.round(((ws.messageCount || 0) / max) * 100);
                                return (
                                    <div key={i} className="flex items-center gap-4">
                                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 w-6 text-right">#{i+1}</span>
                                        <span className="text-sm font-medium text-gray-900 dark:text-white w-40 truncate">{ws.name}</span>
                                        <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                                            <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 w-16 text-right">{ws.messageCount?.toLocaleString()} msgs</span>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Department Performance */}
                {deptBreakdown.length > 0 && (
                    <section>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Department Overview</h2>
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                                    <tr>
                                        <th className="text-left py-3 px-6 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Department</th>
                                        <th className="text-left py-3 px-6 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Members</th>
                                        <th className="text-right py-3 px-6 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Size</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {deptBreakdown.map((dept, idx) => {
                                        const maxCount = deptBreakdown[0]?.memberCount || 1;
                                        const pct = Math.round(((dept.memberCount || 0) / maxCount) * 100);
                                        return (
                                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="py-4 px-6 font-bold text-gray-900 dark:text-white">{dept.name}</td>
                                                <td className="py-4 px-6 text-gray-600 dark:text-gray-300">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2 w-32">
                                                            <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${pct}%` }} />
                                                        </div>
                                                        <span>{dept.memberCount}</span>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6 text-right font-bold text-gray-900 dark:text-white">{pct}%</td>
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
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Top Contributors</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {topUsers.slice(0, 6).map((u, idx) => (
                                <div key={idx} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400">
                                        {u.username?.[0]?.toUpperCase()}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-gray-900 dark:text-white">{u.username}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{u.activityCount || 0} activities</p>
                                    </div>
                                    <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">#{idx + 1}</div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {!analytics && (
                    <section>
                        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border-2 border-dashed border-indigo-200 dark:border-indigo-800 p-8 text-center">
                            <TrendingUp className="w-16 h-16 text-indigo-400 dark:text-indigo-600 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Data Available</h3>
                            <p className="text-gray-600 dark:text-gray-400">
                                Start adding employees and sending messages to see analytics here.
                            </p>
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
};

// MetricCard Component
const MetricCard = ({ icon: Icon, label, value, change, positive, iconColor, bgColor }) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-xl ${bgColor}`}>
                <Icon className={iconColor} size={24} />
            </div>
            {change && (
                <span className={`text-sm font-bold ${positive ? 'text-green-600' : 'text-red-600'}`}>
                    {change}
                </span>
            )}
        </div>
        <div className="text-3xl font-black text-gray-900 dark:text-white mb-1">{value}</div>
        <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</div>
    </div>
);

// ActivityCard Component
const ActivityCard = ({ icon: Icon, label, value, total, color, negative }) => {
    const colors = {
        blue: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
        green: 'text-green-600 bg-green-50 dark:bg-green-900/20',
        red: 'text-red-600 bg-red-50 dark:bg-red-900/20',
        purple: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20'
    };
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${colors[color]}`}>
                    <Icon size={20} />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white">{label}</h3>
            </div>
            <div className="text-3xl font-black text-gray-900 dark:text-white mb-3">{value.toLocaleString()}</div>
            {total > 0 && (
                <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                        <div
                            className={`h-1.5 rounded-full ${negative ? 'bg-red-500' : 'bg-indigo-500'}`}
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{pct}%</span>
                </div>
            )}
        </div>
    );
};

export default Analytics;
