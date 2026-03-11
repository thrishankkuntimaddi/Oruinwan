import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { useCompany } from '../../contexts/CompanyContext';
import { RefreshCw, BarChart3, TrendingUp, TrendingDown, Users, MessageSquare, Activity, Calendar } from 'lucide-react';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getOwnerAnalytics } from '../../services/ownerDashboardService';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#10b981', '#f59e0b'];

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
        } catch (error) {
            console.error('Error fetching owner analytics data:', error);
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

    const handleTimeRangeChange = (range) => {
        if (range === timeRange) return;
        setTimeRange(range);
    };

    // Derived chart data with safe fallbacks
    const userGrowthData = analyticsData?.userGrowth || [];
    const messageVolumeData = analyticsData?.dailyMessages || [];
    const workspaceActivityData = analyticsData?.workspaceActivity || [];
    const departmentDistribution = analyticsData?.departmentDistribution || [];
    const summary = analyticsData?.summary || {};

    if (loading) {
        return (
            <div className="h-full animate-pulse p-6 space-y-6 bg-gray-50 dark:bg-gray-900">
                <div className="grid grid-cols-4 gap-4">
                    {[1,2,3,4].map(i => (
                        <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 space-y-3">
                            <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                            <div className="h-9 w-14 bg-gray-300 dark:bg-gray-600 rounded-lg" />
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-2 gap-6">
                    {[1,2].map(i => (
                        <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-52">
                            <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
                            <div className="flex items-end gap-2 h-32">
                                {[60,80,45,90,70,55,85].map((h,j) => (
                                    <div key={j} className="flex-1 bg-indigo-100 dark:bg-indigo-900/30 rounded-t" style={{height:`${h}%`}} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            {/* Header */}
            <header className="h-16 px-8 flex items-center justify-between z-10 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 shadow-sm shrink-0">
                <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <BarChart3 className="text-indigo-500" size={24} />
                        Analytics &amp; Insights
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-gray-400 font-medium ml-8">
                        Historical trends, growth metrics &amp; detailed performance analysis
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    {/* Time Range Selector */}
                    <div className="flex items-center gap-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg p-1">
                        {['7d', '30d', '90d'].map((range) => (
                            <button
                                key={range}
                                onClick={() => handleTimeRangeChange(range)}
                                className={`px-3 py-1 text-xs font-bold rounded transition-all ${timeRange === range
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-600'
                                    }`}
                            >
                                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="px-4 py-2 bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-600 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto w-full px-8 py-8 z-10 custom-scrollbar">
                <div className="space-y-8 max-w-7xl mx-auto">

                    {/* Growth Metrics Summary */}
                    <section>
                        <div className="mb-4">
                            <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide">Growth Metrics</h3>
                            <p className="text-xs text-slate-500 dark:text-gray-500">{timeRange === '7d' ? '7-day' : timeRange === '30d' ? '30-day' : '90-day'} performance overview</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <MetricCard
                                icon={Users}
                                label="New Users"
                                value={summary.newUsers ?? 0}
                                subtitle={`Joined in last ${timeRange}`}
                                trend={summary.newUsers > 0 ? Math.min(Math.round((summary.newUsers / Math.max(summary.totalUsers - summary.newUsers, 1)) * 100), 999) : 0}
                                color="indigo"
                            />
                            <MetricCard
                                icon={MessageSquare}
                                label="Message Volume"
                                value={(summary.totalMessages ?? 0).toLocaleString()}
                                subtitle={`Messages sent (${timeRange})`}
                                trend={summary.totalMessages > 0 ? 12 : 0}
                                color="blue"
                            />
                            <MetricCard
                                icon={Activity}
                                label="Engagement Rate"
                                value={`${summary.engagementRate ?? 0}%`}
                                subtitle="Active participation"
                                trend={summary.engagementRate > 50 ? 8 : summary.engagementRate > 0 ? -5 : 0}
                                color="green"
                            />
                            <MetricCard
                                icon={Calendar}
                                label="Workspace Activity"
                                value={`${summary.activeWorkspaces ?? 0}/${summary.totalWorkspaces ?? 0}`}
                                subtitle="Active workspaces"
                                trend={0}
                                color="purple"
                            />
                        </div>
                    </section>

                    {/* User Growth Trend */}
                    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
                        <div className="mb-6">
                            <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide">User Growth Trend</h3>
                            <p className="text-xs text-slate-500 dark:text-gray-500">Total users vs active users over time</p>
                        </div>
                        {userGrowthData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <AreaChart data={userGrowthData}>
                                    <defs>
                                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.1} />
                                    <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                                    <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#f3f4f6' }}
                                        itemStyle={{ color: '#f3f4f6' }}
                                    />
                                    <Area type="monotone" dataKey="users" stroke="#6366f1" fillOpacity={1} fill="url(#colorUsers)" strokeWidth={2} />
                                    <Area type="monotone" dataKey="active" stroke="#10b981" fillOpacity={1} fill="url(#colorActive)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-48 text-slate-400 dark:text-gray-500 text-sm">No user data available for this period</div>
                        )}
                        <div className="flex items-center justify-center gap-6 mt-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
                                <span className="text-xs font-medium text-slate-600 dark:text-gray-400">Total Users</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-green-600"></div>
                                <span className="text-xs font-medium text-slate-600 dark:text-gray-400">Active Users</span>
                            </div>
                        </div>
                    </section>

                    {/* Message Volume & Workspace Activity */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Message Volume */}
                        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
                            <div className="mb-6">
                                <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide">
                                    {timeRange === '7d' ? 'Weekly' : 'Monthly'} Message Volume
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-gray-500">Messages sent per day (last {timeRange === '7d' ? '7 days' : '30 days'})</p>
                            </div>
                            {messageVolumeData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={messageVolumeData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.1} />
                                        <XAxis dataKey="day" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                                        <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#f3f4f6' }}
                                            itemStyle={{ color: '#f3f4f6' }}
                                        />
                                        <Bar dataKey="messages" fill="#6366f1" radius={[8, 8, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-48 text-slate-400 dark:text-gray-500 text-sm">No messages in this period</div>
                            )}
                        </section>

                        {/* Workspace Activity */}
                        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
                            <div className="mb-6">
                                <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide">Top Active Workspaces</h3>
                                <p className="text-xs text-slate-500 dark:text-gray-500">Message count by workspace</p>
                            </div>
                            {workspaceActivityData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={workspaceActivityData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.1} horizontal={false} />
                                        <XAxis type="number" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                                        <YAxis dataKey="name" type="category" width={120} stroke="#9ca3af" style={{ fontSize: '11px' }} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#f3f4f6' }}
                                            itemStyle={{ color: '#f3f4f6' }}
                                        />
                                        <Bar dataKey="activity" fill="#10b981" radius={[0, 8, 8, 0]}>
                                            {workspaceActivityData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-48 text-slate-400 dark:text-gray-500 text-sm">No workspace activity in this period</div>
                            )}
                        </section>
                    </div>

                    {/* Department Distribution */}
                    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
                        <div className="mb-6">
                            <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide">Team Distribution</h3>
                            <p className="text-xs text-slate-500 dark:text-gray-500">Employees by department</p>
                        </div>
                        {departmentDistribution.length > 0 ? (
                            <div className="flex items-center justify-center">
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={departmentDistribution}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                            outerRadius={100}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {departmentDistribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#f3f4f6' }}
                                            itemStyle={{ color: '#f3f4f6' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-48 text-slate-400 dark:text-gray-500 text-sm">No departments configured</div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
};

// Metric Card Component
const MetricCard = ({ icon: Icon, label, value, subtitle, trend, color }) => {
    const colorClasses = {
        indigo: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20',
        blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
        green: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
        purple: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20'
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6 transition-all hover:shadow-md">
            <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
                    <Icon className={`w-5 h-5`} />
                </div>
                {trend !== 0 && (
                    <div className={`flex items-center gap-1 text-xs font-bold ${trend > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                        {trend > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {Math.abs(trend)}%
                    </div>
                )}
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{value}</div>
            <div className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider mt-1">{label}</div>
            <div className="text-xs text-slate-400 dark:text-gray-500 mt-2">{subtitle}</div>
        </div>
    );
};

export default OwnerAnalytics;
