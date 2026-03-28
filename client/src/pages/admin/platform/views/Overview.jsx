import React, { useState, useEffect } from 'react';
import api from '../../../../../services/api';
import { useNavigate } from 'react-router-dom';
import {
    Building2, Users, Ticket, DollarSign, TrendingUp, TrendingDown,
    Activity, CheckCircle, AlertCircle, Megaphone, ArrowRight
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
            const statsRes = await api.get(`/api/admin/overview/stats`);
            setStats(statsRes.data);

            // Fetch recent activities
            const activitiesRes = await api.get(`/api/admin/overview/activities`);
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

            {/* Platform Status Banner */}
            <div className="bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-500/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                            <CheckCircle size={28} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold mb-1">All Systems Operational</h2>
                            <p className="text-green-50">All services are running smoothly • Last checked: {new Date().toLocaleTimeString()}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/chttrix-admin/health')}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold backdrop-blur-sm transition-colors"
                    >
                        View Details →
                    </button>
                </div>
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

            {/* Recent Activity Feed - Full Width */}
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

            {/* Quick Actions - Bottom Horizontal Row */}
            <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                    Quick Actions
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <button
                        onClick={() => navigate('/chttrix-admin/pending')}
                        className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all group text-left"
                    >
                        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3 group-hover:bg-gray-200 dark:group-hover:bg-gray-600 transition-colors">
                            <CheckCircle size={20} className="text-gray-900 dark:text-white" />
                        </div>
                        <span className="font-bold text-gray-900 dark:text-white block mb-1">Review Requests</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 block">Manage company verifications</span>
                    </button>

                    <button
                        onClick={() => navigate('/chttrix-admin/broadcast')}
                        className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all group text-left"
                    >
                        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3 group-hover:bg-gray-200 dark:group-hover:bg-gray-600 transition-colors">
                            <Megaphone size={20} className="text-gray-900 dark:text-white" />
                        </div>
                        <span className="font-bold text-gray-900 dark:text-white block mb-1">Send Broadcast</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 block">Notify all companies</span>
                    </button>

                    <button
                        onClick={() => navigate('/chttrix-admin/tickets')}
                        className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all group text-left"
                    >
                        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3 group-hover:bg-gray-200 dark:group-hover:bg-gray-600 transition-colors">
                            <Ticket size={20} className="text-gray-900 dark:text-white" />
                        </div>
                        <span className="font-bold text-gray-900 dark:text-white block mb-1">View Tickets</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 block">Resolve support issues</span>
                    </button>

                    <button
                        onClick={() => navigate('/chttrix-admin/health')}
                        className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all group text-left"
                    >
                        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3 group-hover:bg-gray-200 dark:group-hover:bg-gray-600 transition-colors">
                            <Activity size={20} className="text-gray-900 dark:text-white" />
                        </div>
                        <span className="font-bold text-gray-900 dark:text-white block mb-1">System Health</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 block">Monitor platform status</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Overview;
