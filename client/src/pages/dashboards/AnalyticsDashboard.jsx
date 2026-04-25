import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
    ArrowLeft, Users, Briefcase, MessageSquare, CheckSquare,
    TrendingUp, Download, RefreshCw, Calendar, BarChart3,
    Activity, Hash
} from 'lucide-react';
import { LineChart, BarChart, PieChart, AreaChart, StatCard } from '../../components/company/ChartComponents';
import {
    getAnalyticsSummary,
    getUserActivityAnalytics,
    getWorkspaceAnalytics,
    getChannelEngagementAnalytics,
    getTaskAnalytics,
    getMessageVolumeAnalytics,
    getEngagementTrends
} from '../../services/analyticsService';

const AnalyticsDashboard = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [period, setPeriod] = useState(30); 

    
    const [summary, setSummary] = useState(null);
    const [userActivity, setUserActivity] = useState(null);
    const [workspaces, setWorkspaces] = useState([]);
    const [channels, setChannels] = useState([]);
    const [tasks, setTasks] = useState(null);
    const [messages, setMessages] = useState(null);
    const [engagement, setEngagement] = useState(null);

    
    const fetchAnalytics = async (showLoadingState = true) => {
        try {
            if (showLoadingState) setLoading(true);
            else setRefreshing(true);

            const [
                summaryData,
                userActivityData,
                workspacesData,
                channelsData,
                tasksData,
                messagesData,
                engagementData
            ] = await Promise.all([
                getAnalyticsSummary(period),
                getUserActivityAnalytics(period),
                getWorkspaceAnalytics(),
                getChannelEngagementAnalytics(),
                getTaskAnalytics(period),
                getMessageVolumeAnalytics(period),
                getEngagementTrends(period)
            ]);

            setSummary(summaryData);
            setUserActivity(userActivityData);
            setWorkspaces(workspacesData.workspaces || []);
            setChannels(channelsData.channels || []);
            setTasks(tasksData);
            setMessages(messagesData);
            setEngagement(engagementData);

        } catch (error) {
            console.error('Error fetching analytics:', error);
            showToast(error.response?.data?.message || 'Failed to load analytics', 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, [period]);

    
    const handlePeriodChange = (newPeriod) => {
        setPeriod(newPeriod);
    };

    
    const handleExport = () => {
        showToast('Export functionality coming soon!', 'info');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8 animate-pulse">
                {}
                <div className="flex items-center justify-between mb-8">
                    <div className="space-y-2">
                        <div className="h-7 w-48 bg-gray-200 dark:bg-gray-700 rounded-xl" />
                        <div className="h-4 w-64 bg-gray-100 dark:bg-gray-800 rounded" />
                    </div>
                    <div className="h-9 w-28 bg-blue-100 dark:bg-blue-900/30 rounded-xl" />
                </div>
                {}
                <div className="grid grid-cols-4 gap-4 mb-8">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                            <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
                            <div className="h-10 w-16 bg-gray-300 dark:bg-gray-600 rounded-lg mb-2" />
                            <div className="h-2.5 w-24 bg-gray-100 dark:bg-gray-700/50 rounded" />
                        </div>
                    ))}
                </div>
                {}
                <div className="grid grid-cols-3 gap-6">
                    <div className="col-span-2 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-64">
                        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-6" />
                        <div className="flex items-end gap-3 h-36">
                            {[60, 80, 45, 90, 70, 55, 85, 65, 75, 50].map((h, i) => (
                                <div key={i} className="flex-1 bg-blue-100 dark:bg-blue-900/30 rounded-t-lg" style={{ height: `${h}%` }} />
                            ))}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-64">
                        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-6" />
                        <div className="w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-700 mx-auto" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/admin/dashboard')}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                    <BarChart3 className="w-6 h-6 text-blue-600" />
                                    Analytics Dashboard
                                </h1>
                                <p className="text-sm text-gray-500">Insights and usage statistics</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {}
                            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                                {[7, 30, 90, 365].map((days) => (
                                    <button
                                        key={days}
                                        onClick={() => handlePeriodChange(days)}
                                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${period === days
                                            ? 'bg-white text-blue-600 shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900'
                                            }`}
                                    >
                                        {days === 365 ? '1Y' : `${days}D`}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={() => fetchAnalytics(false)}
                                disabled={refreshing}
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Refresh data"
                            >
                                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                            </button>

                            <button
                                onClick={handleExport}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                            >
                                <Download className="w-4 h-4" />
                                Export
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="space-y-8">
                    {}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard
                            label="Total Users"
                            value={summary?.summary?.totalUsers || 0}
                            trend={summary?.summary?.userGrowth}
                            icon={Users}
                            color="blue"
                        />
                        <StatCard
                            label="Active Users"
                            value={summary?.summary?.activeUsers || 0}
                            icon={Activity}
                            color="green"
                        />
                        <StatCard
                            label="Total Messages"
                            value={summary?.summary?.totalMessages || 0}
                            icon={MessageSquare}
                            color="purple"
                        />
                        <StatCard
                            label="Task Completion"
                            value={`${summary?.summary?.taskCompletionRate || 0}%`}
                            icon={CheckSquare}
                            color="orange"
                        />
                    </div>

                    {}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-blue-600" />
                            Engagement Metrics
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="text-center">
                                <p className="text-sm text-gray-600 mb-1">Daily Active Users</p>
                                <p className="text-3xl font-bold text-blue-600">{engagement?.dau || 0}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-gray-600 mb-1">Weekly Active Users</p>
                                <p className="text-3xl font-bold text-purple-600">{engagement?.wau || 0}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-gray-600 mb-1">Monthly Active Users</p>
                                <p className="text-3xl font-bold text-green-600">{engagement?.mau || 0}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-gray-600 mb-1">DAU/WAU Ratio</p>
                                <p className="text-3xl font-bold text-orange-600">{engagement?.dauWauRatio || 0}%</p>
                                <p className="text-xs text-gray-500 mt-1">Stickiness</p>
                            </div>
                        </div>
                    </div>

                    {}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Users className="w-5 h-5 text-blue-600" />
                            User Activity Trend
                        </h2>
                        <LineChart
                            data={userActivity?.trendData || []}
                            height={250}
                            color="#3b82f6"
                        />
                    </div>

                    {}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {}
                        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <Briefcase className="w-5 h-5 text-purple-600" />
                                Workspace Activity
                            </h2>
                            <BarChart
                                data={workspaces.map(ws => ({
                                    label: ws.name.length > 10 ? ws.name.substring(0, 10) + '...' : ws.name,
                                    value: ws.messageCount || 0
                                }))}
                                height={250}
                                color="#8b5cf6"
                            />
                        </div>

                        {}
                        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <CheckSquare className="w-5 h-5 text-orange-600" />
                                Task Distribution
                            </h2>
                            <div className="flex justify-center">
                                <PieChart
                                    data={[
                                        { label: 'To Do', value: tasks?.metrics?.todo || 0 },
                                        { label: 'In Progress', value: tasks?.metrics?.inProgress || 0 },
                                        { label: 'Review', value: tasks?.metrics?.review || 0 },
                                        { label: 'Done', value: tasks?.metrics?.completed || 0 },
                                        { label: 'Cancelled', value: tasks?.metrics?.cancelled || 0 }
                                    ].filter(item => item.value > 0)}
                                    size={200}
                                />
                            </div>
                        </div>
                    </div>

                    {}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-green-600" />
                            Message Volume Over Time
                        </h2>
                        <AreaChart
                            data={messages?.trendData || []}
                            height={250}
                            color="#10b981"
                        />
                        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-200">
                            <div className="text-center">
                                <p className="text-sm text-gray-600 mb-1">Total Messages</p>
                                <p className="text-2xl font-bold text-gray-900">{messages?.metrics?.total || 0}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-gray-600 mb-1">Channel Messages</p>
                                <p className="text-2xl font-bold text-blue-600">{messages?.metrics?.byChannel || 0}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-gray-600 mb-1">Direct Messages</p>
                                <p className="text-2xl font-bold text-purple-600">{messages?.metrics?.byDM || 0}</p>
                            </div>
                        </div>
                    </div>

                    {}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Hash className="w-5 h-5 text-blue-600" />
                            Top Channels by Engagement
                        </h2>
                        <div className="space-y-3">
                            {channels.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">No channel data available</p>
                            ) : (
                                channels.slice(0, 10).map((channel, index) => (
                                    <div
                                        key={channel.channelId}
                                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold text-sm">
                                                {index + 1}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900">{channel.name}</p>
                                                <p className="text-sm text-gray-500">
                                                    {channel.memberCount} members • {channel.activeUsers} active
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-bold text-gray-900">{channel.messageCount}</p>
                                            <p className="text-xs text-gray-500">messages</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
