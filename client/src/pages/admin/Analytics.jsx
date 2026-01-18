import React, { useState, useEffect, useCallback } from 'react';
import {
    Users, MessageSquare, CheckCircle2, TrendingUp,
    Activity, Calendar, Briefcase, RefreshCw, BarChart3
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import axios from 'axios';

const Analytics = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [analytics, setAnalytics] = useState({
        overview: {
            totalUsers: 0,
            activeUsers: 0,
            totalWorkspaces: 0,
            totalDepartments: 0,
            messagesCount: { today: 0, week: 0, month: 0 },
            tasksStats: { open: 0, completed: 0, overdue: 0 }
        },
        userGrowth: [],
        activityData: [],
        departmentStats: [],
        topUsers: []
    });

    const fetchAnalytics = useCallback(async () => {
        try {
            const companyId = typeof user.companyId === 'object'
                ? user.companyId?._id || user.companyId?.id
                : user.companyId;

            const response = await axios.get(
                `${process.env.REACT_APP_BACKEND_URL}/api/companies/${companyId}/analytics`,
                { withCredentials: true }
            );

            setAnalytics(response.data);
        } catch (error) {
            console.error('Error fetching analytics:', error);
            showToast('Failed to load analytics', 'error');
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
                            Real-time insights and metrics
                        </p>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 disabled:opacity  -50"
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            <div className="p-8 space-y-6">
                {/* Key Metrics */}
                <section>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Key Metrics</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <MetricCard
                            icon={Users}
                            label="Total Users"
                            value={analytics.overview.totalUsers}
                            change="+12%"
                            positive={true}
                            iconColor="text-blue-600"
                            bgColor="bg-blue-50 dark:bg-blue-900/20"
                        />
                        <MetricCard
                            icon={Activity}
                            label="Active Users (7d)"
                            value={analytics.overview.activeUsers}
                            change="+8%"
                            positive={true}
                            iconColor="text-green-600"
                            bgColor="bg-green-50 dark:bg-green-900/20"
                        />
                        <MetricCard
                            icon={Briefcase}
                            label="Workspaces"
                            value={analytics.overview.totalWorkspaces}
                            change="+3"
                            positive={true}
                            iconColor="text-purple-600"
                            bgColor="bg-purple-50 dark:bg-purple-900/20"
                        />
                        <MetricCard
                            icon={BarChart3}
                            label="Departments"
                            value={analytics.overview.totalDepartments}
                            change="0"
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
                            label="Messages"
                            today={analytics.overview.messagesCount.today}
                            week={analytics.overview.messagesCount.week}
                            month={analytics.overview.messagesCount.month}
                            color="blue"
                        />
                        <ActivityCard
                            icon={CheckCircle2}
                            label="Tasks Completed"
                            today={analytics.overview.tasksStats.completed}
                            week={analytics.overview.tasksStats.completed * 7}
                            month={analytics.overview.tasksStats.completed * 30}
                            color="green"
                        />
                        <ActivityCard
                            icon={Calendar}
                            label="Meetings"
                            today={0}
                            week={0}
                            month={0}
                            color="purple"
                        />
                    </div>
                </section>

                {/* Department Performance */}
                {analytics.departmentStats && analytics.departmentStats.length > 0 && (
                    <section>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Department Performance</h2>
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                                    <tr>
                                        <th className="text-left py-3 px-6 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Department</th>
                                        <th className="text-left py-3 px-6 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Members</th>
                                        <th className="text-left py-3 px-6 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Activity</th>
                                        <th className="text-right py-3 px-6 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Score</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {analytics.departmentStats.map((dept, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="py-4 px-6 font-bold text-gray-900 dark:text-white">{dept.name}</td>
                                            <td className="py-4 px-6 text-gray-600 dark:text-gray-300">{dept.memberCount}</td>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                                        <div
                                                            className="bg-indigo-600 h-2 rounded-full"
                                                            style={{ width: `${dept.activityScore || 0}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-sm text-gray-500 dark:text-gray-400">{dept.activityScore || 0}%</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-right font-bold text-gray-900 dark:text-white">{dept.score || 0}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {/* Top Contributors */}
                {analytics.topUsers && analytics.topUsers.length > 0 && (
                    <section>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Top Contributors</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {analytics.topUsers.slice(0, 6).map((user, idx) => (
                                <div key={idx} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400">
                                        {user.username?.[0]?.toUpperCase()}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-gray-900 dark:text-white">{user.username}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{user.activityCount || 0} activities</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">#{idx + 1}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Coming Soon Placeholder */}
                <section>
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border-2 border-dashed border-indigo-200 dark:border-indigo-800 p-8 text-center">
                        <TrendingUp className="w-16 h-16 text-indigo-400 dark:text-indigo-600 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">More Analytics Coming Soon</h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            User growth charts, activity heatmaps, and detailed reports will be available soon.
                        </p>
                    </div>
                </section>
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
const ActivityCard = ({ icon: Icon, label, today, week, month, color }) => {
    const colors = {
        blue: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
        green: 'text-green-600 bg-green-50 dark:bg-green-900/20',
        purple: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20'
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${colors[color]}`}>
                    <Icon size={20} />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white">{label}</h3>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                    <div className="text-2xl font-black text-gray-900 dark:text-white">{today}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Today</div>
                </div>
                <div>
                    <div className="text-2xl font-black text-gray-900 dark:text-white">{week}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Week</div>
                </div>
                <div>
                    <div className="text-2xl font-black text-gray-900 dark:text-white">{month}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Month</div>
                </div>
            </div>
        </div>
    );
};

export default Analytics;
