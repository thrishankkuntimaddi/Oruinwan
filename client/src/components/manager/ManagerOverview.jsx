// client/src/components/manager/ManagerOverview.jsx
// Overview tab for Manager Dashboard - Key metrics and department health

import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    Users, Activity, CheckCircle2, Clock, TrendingUp,
    MessageSquare, Calendar
} from 'lucide-react';
import axios from 'axios';

const ManagerOverview = () => {
    const { selectedDepartment } = useOutletContext();
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMetrics = async () => {
            if (!selectedDepartment?._id) return;

            try {
                setLoading(true);
                const response = await axios.get(
                    `${process.env.REACT_APP_BACKEND_URL}/api/manager/dashboard/metrics/${selectedDepartment._id}`,
                    { withCredentials: true }
                );
                setMetrics(response.data);
            } catch (error) {
                console.error('Error fetching metrics:', error);
            } finally {
                setLoading(false);
            }
        };

        if (selectedDepartment) {
            fetchMetrics();
        }
    }, [selectedDepartment]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!metrics) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
                <p className="text-gray-500 dark:text-gray-400">No metrics available</p>
            </div>
        );
    }

    return (
        <div className="h-full bg-gray-50 dark:bg-gray-900 overflow-y-auto transition-colors duration-200">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Department Overview</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {selectedDepartment?.name} •
                    Last updated {new Date().toLocaleDateString()}
                </p>
            </div>

            <div className="p-8 space-y-6">
                {/* Team Metrics */}
                <section>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Team Snapshot</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                            <div className="flex items-center justify-between mb-2">
                                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                    <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-gray-900 dark:text-white">{metrics.team?.total || 0}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">Total Members</div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                            <div className="flex items-center justify-between mb-2">
                                <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                    <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-gray-900 dark:text-white">{metrics.team?.active || 0}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">Active Members</div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                            <div className="flex items-center justify-between mb-2">
                                <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                    <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-gray-900 dark:text-white">{metrics.team?.pending || 0}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">Pending</div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                            <div className="flex items-center justify-between mb-2">
                                <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                    <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-gray-900 dark:text-white">{metrics.team?.managers || 0}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">Managers</div>
                        </div>
                    </div>
                </section>

                {/* Activity Metrics */}
                <section>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Department Activity</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                    <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {metrics.activity?.messagesThisWeek || 0}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Messages This Week</div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                    <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {metrics.activity?.tasksThisWeek || 0}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Tasks Completed</div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                    <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {metrics.activity?.meetingsThisWeek || 0}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Meetings Scheduled</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Department Info */}
                <section>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Department Details</h2>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
                        <div>
                            <label className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase">Department Name</label>
                            <p className="text-lg font-medium text-gray-900 dark:text-white mt-1">{metrics.department?.name}</p>
                        </div>

                        {metrics.department?.description && (
                            <div>
                                <label className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase">Description</label>
                                <p className="text-gray-700 dark:text-gray-300 mt-1">{metrics.department.description}</p>
                            </div>
                        )}

                        <div>
                            <label className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase">Department Head</label>
                            <div className="flex items-center gap-3 mt-2">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                                    {metrics.department?.head?.username?.charAt(0)?.toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white">{metrics.department?.head?.username}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{metrics.department?.head?.email}</p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase">Created</label>
                            <p className="text-gray-700 dark:text-gray-300 mt-1">
                                {new Date(metrics.department?.createdAt).toLocaleDateString('en-US', {
                                    month: 'long',
                                    day: 'numeric',
                                    year: 'numeric'
                                })}
                            </p>
                        </div>
                    </div>
                </section>

                {/* Quick Actions */}
                <section>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <button className="bg-white dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-gray-700/50 border-2 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-500 rounded-xl p-4 text-left transition-all group">
                            <Users className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 mb-2" />
                            <div className="text-sm font-bold text-gray-900 dark:text-white">View Team</div>
                        </button>
                        <button className="bg-white dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-gray-700/50 border-2 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-500 rounded-xl p-4 text-left transition-all group">
                            <CheckCircle2 className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 mb-2" />
                            <div className="text-sm font-bold text-gray-900 dark:text-white">Manage Tasks</div>
                        </button>
                        <button className="bg-white dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-gray-700/50 border-2 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-500 rounded-xl p-4 text-left transition-all group">
                            <MessageSquare className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 mb-2" />
                            <div className="text-sm font-bold text-gray-900 dark:text-white">Contact Admin</div>
                        </button>
                        <button className="bg-white dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-gray-700/50 border-2 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-500 rounded-xl p-4 text-left transition-all group">
                            <TrendingUp className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 mb-2" />
                            <div className="text-sm font-bold text-gray-900 dark:text-white">View Reports</div>
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default ManagerOverview;
