import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
    Building2, Users, Ticket, DollarSign, TrendingUp, TrendingDown,
    Activity, CheckCircle, Clock, AlertCircle, Megaphone, ArrowRight,
    BarChart3, Calendar
} from 'lucide-react';

const Overview = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalCompanies: 0,
        activeUsers: 0,
        openTickets: 0,
        monthlyRevenue: 0,
        pendingRequests: 0,
        growthRate: 0
    });
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOverviewData();
    }, []);

    const fetchOverviewData = async () => {
        try {
            // Fetch stats
            const statsRes = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/admin/overview/stats`, {
                withCredentials: true
            });
            setStats(statsRes.data);

            // Fetch recent activities
            const activitiesRes = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/admin/overview/activities`, {
                withCredentials: true
            });
            setActivities(activitiesRes.data);

            setLoading(false);
        } catch (err) {
            console.error('Failed to fetch overview data:', err);
            setLoading(false);
        }
    };

    const StatCard = ({ icon: Icon, label, value, change, trend, color, onClick }) => (
        <div
            onClick={onClick}
            className={`bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 transition-all hover:shadow-lg hover:scale-105 ${onClick ? 'cursor-pointer' : ''}`}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                        {label}
                    </p>
                    <p className="text-3xl font-black text-gray-900 dark:text-white mb-3">
                        {value}
                    </p>
                    {change !== undefined && (
                        <div className="flex items-center gap-1 text-sm">
                            {trend === 'up' ? (
                                <TrendingUp className="text-green-500" size={16} />
                            ) : (
                                <TrendingDown className="text-red-500" size={16} />
                            )}
                            <span className={trend === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                {change}%
                            </span>
                            <span className="text-gray-400 text-xs ml-1">vs last month</span>
                        </div>
                    )}
                </div>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="text-white" size={24} />
                </div>
            </div>
        </div>
    );

    const ActivityItem = ({ activity }) => {
        const getActivityIcon = (type) => {
            switch (type) {
                case 'company_registered': return <Building2 size={16} className="text-blue-500" />;
                case 'company_approved': return <CheckCircle size={16} className="text-green-500" />;
                case 'ticket_created': return <Ticket size={16} className="text-orange-500" />;
                case 'broadcast_sent': return <Megaphone size={16} className="text-purple-500" />;
                default: return <Activity size={16} className="text-gray-500" />;
            }
        };

        return (
            <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                    {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {activity.description}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {new Date(activity.timestamp).toLocaleString()}
                    </p>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">
                    Platform Overview
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                    Monitor your platform's health and activity
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    icon={Building2}
                    label="Total Companies"
                    value={stats.totalCompanies}
                    change={stats.companiesGrowth}
                    trend={stats.companiesGrowth >= 0 ? 'up' : 'down'}
                    color="from-blue-500 to-blue-600"
                    onClick={() => navigate('/chttrix-admin/companies')}
                />
                <StatCard
                    icon={Users}
                    label="Active Users"
                    value={stats.activeUsers}
                    change={stats.usersGrowth}
                    trend={stats.usersGrowth >= 0 ? 'up' : 'down'}
                    color="from-green-500 to-green-600"
                />
                <StatCard
                    icon={Ticket}
                    label="Open Tickets"
                    value={stats.openTickets}
                    color="from-orange-500 to-orange-600"
                    onClick={() => navigate('/chttrix-admin/tickets')}
                />
                <StatCard
                    icon={DollarSign}
                    label="Monthly Revenue"
                    value={`$${stats.monthlyRevenue.toLocaleString()}`}
                    change={stats.revenueGrowth}
                    trend={stats.revenueGrowth >= 0 ? 'up' : 'down'}
                    color="from-purple-500 to-purple-600"
                    onClick={() => navigate('/chttrix-admin/billing')}
                />
            </div>

            {/* Pending Requests Alert */}
            {stats.pendingRequests > 0 && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center">
                                <AlertCircle className="text-white" size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                                    {stats.pendingRequests} Pending Company Registration{stats.pendingRequests > 1 ? 's' : ''}
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    Companies waiting for verification
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/chttrix-admin/pending')}
                            className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold hover:bg-black dark:hover:bg-gray-100 transition-all flex items-center gap-2 shadow-lg"
                        >
                            Review Now
                            <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Activity Feed */}
                <div className="lg:col-span-2">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Activity size={20} />
                                    Recent Activity
                                </h2>
                                <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full font-bold">
                                    Live
                                </span>
                            </div>
                        </div>
                        <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
                            {activities.length > 0 ? (
                                activities.map((activity, index) => (
                                    <ActivityItem key={index} activity={activity} />
                                ))
                            ) : (
                                <div className="text-center py-8 text-gray-400">
                                    No recent activity
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                            Quick Actions
                        </h2>
                        <div className="space-y-3">
                            <button
                                onClick={() => navigate('/chttrix-admin/pending')}
                                className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-between group"
                            >
                                <span>Review Requests</span>
                                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button
                                onClick={() => navigate('/chttrix-admin/broadcast')}
                                className="w-full px-4 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-all flex items-center justify-between group"
                            >
                                <span>Send Broadcast</span>
                                <Megaphone size={18} className="group-hover:scale-110 transition-transform" />
                            </button>
                            <button
                                onClick={() => navigate('/chttrix-admin/tickets')}
                                className="w-full px-4 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all flex items-center justify-between group"
                            >
                                <span>View Tickets</span>
                                <Ticket size={18} className="group-hover:scale-110 transition-transform" />
                            </button>
                            <button
                                onClick={() => navigate('/chttrix-admin/health')}
                                className="w-full px-4 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all flex items-center justify-between group"
                            >
                                <span>System Health</span>
                                <Activity size={18} className="group-hover:pulse transition-transform" />
                            </button>
                        </div>
                    </div>

                    {/* Platform Status */}
                    <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                            <h3 className="font-bold text-lg">All Systems Operational</h3>
                        </div>
                        <p className="text-sm text-green-50 mb-4">
                            All services are running smoothly
                        </p>
                        <button
                            onClick={() => navigate('/chttrix-admin/health')}
                            className="text-sm font-bold text-white underline hover:no-underline"
                        >
                            View Details →
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Overview;
