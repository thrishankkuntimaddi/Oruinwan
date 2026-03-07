// client/src/components/manager/ManagerOverview.jsx
// Overview tab for Manager Dashboard - Key metrics and department health

import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
    Users, Activity, CheckCircle2, Clock, TrendingUp,
    MessageSquare, Calendar, LayoutGrid, RefreshCw, Shield,
    Briefcase, AlertCircle
} from 'lucide-react';
import axios from 'axios';
import { useToast } from '../../contexts/ToastContext';

const ManagerOverview = () => {
    const { selectedDepartment } = useOutletContext();
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { showToast } = useToast();
    const navigate = useNavigate();

    const fetchMetrics = useCallback(async () => {
        if (!selectedDepartment?._id) return;

        try {
            setLoading(true);
            const response = await axios.get(
                `${import.meta.env.VITE_BACKEND_URL}/api/manager/dashboard/metrics/${selectedDepartment._id}`,
                { withCredentials: true }
            );
            setMetrics(response.data);
        } catch (error) {
            console.error('Error fetching metrics:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedDepartment]);

    useEffect(() => {
        if (selectedDepartment) {
            fetchMetrics();
        }
    }, [selectedDepartment, fetchMetrics]);

    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        await fetchMetrics();
        setRefreshing(false);
        showToast("Dashboard refreshed", "success");
    };

    if (loading && !metrics) {
        return (
            <div className="h-full bg-gray-50 dark:bg-gray-900 p-6 animate-pulse">
                <div className="grid grid-cols-3 gap-4 mb-6">
                    {[1,2,3].map(i => (
                        <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 space-y-3">
                            <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                            <div className="h-10 w-16 bg-gray-300 dark:bg-gray-600 rounded-xl" />
                            <div className="h-2 w-28 bg-gray-100 dark:bg-gray-700/50 rounded" />
                        </div>
                    ))}
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
                    {[70,50,85,55,75].map((w,i) => (
                        <div key={i} className="flex items-center gap-4">
                            <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                            <div className="flex-1 space-y-1.5">
                                <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded" style={{width:`${w}%`}} />
                                <div className="h-2 bg-gray-100 dark:bg-gray-700/50 rounded" style={{width:`${w-20}%`}} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Use demo data if metrics are null/empty
    const displayMetrics = metrics || {
        team: { total: 15, active: 12, pending: 2, managers: 1 },
        activity: { messagesThisWeek: 245, tasksThisWeek: 18, meetingsThisWeek: 5 },
        department: {
            name: selectedDepartment?.name || 'Loading...',
            description: 'Demo data - actual metrics will load from backend',
            head: { username: 'Department Manager', email: 'manager@example.com' },
            createdAt: new Date()
        }
    };

    // Reusable Rich Stat Card Component matches Owner Dashboard
    const StatCard = ({ icon: Icon, colorClass, bgClass, value, label, trend, trendLabel }) => (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6 transition-all hover:shadow-md group">
            <div className="flex items-center justify-between mb-4">
                <div className={`p-2.5 rounded-lg ${bgClass} group-hover:scale-110 transition-transform duration-200`}>
                    <Icon className={`w-5 h-5 ${colorClass}`} />
                </div>
                {trend && (
                    <div className="flex items-center gap-1 text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2.5 py-1 rounded-full border border-green-100 dark:border-green-900/50">
                        <TrendingUp size={12} strokeWidth={2.5} />
                        {trend}
                    </div>
                )}
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{value}</div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider mt-1">{label}</div>

            <div className="mt-4 pt-3 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                <span className="text-xs font-medium text-slate-400 dark:text-gray-500">{trendLabel || 'Updated just now'}</span>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            {/* Header - Matches Owner Dashboard Header */}
            <header className="h-16 px-8 flex items-center justify-between z-10 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 shadow-sm shrink-0">
                <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <LayoutGrid className="text-indigo-600 dark:text-indigo-400" size={24} strokeWidth={2.5} />
                        Manager Overview
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-gray-400 font-medium ml-8 flex items-center gap-2">
                        <span className="uppercase tracking-wider font-bold text-[10px] bg-slate-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-gray-300">Workspace Manager</span>
                        <span>•</span>
                        Team Performance & Workspace Health
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing || loading}
                        className="px-4 py-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-700 dark:text-gray-200 text-xs font-bold uppercase tracking-wide rounded-lg hover:bg-slate-50 dark:hover:bg-gray-600 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} strokeWidth={2.5} />
                        {refreshing ? 'REFRESHING...' : 'REFRESH'}
                    </button>
                    <div className="h-8 w-px bg-slate-200 dark:bg-gray-700 mx-1 hidden md:block"></div>
                </div>
            </header>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto w-full px-8 py-8 z-10 custom-scrollbar">
                <div className="space-y-8 max-w-7xl mx-auto">

                    {/* ORGANIZATION OVERVIEW */}
                    <section>
                        <div className="flex items-end justify-between mb-5">
                            <div>
                                <h3 className="text-sm font-black text-slate-700 dark:text-gray-200 uppercase tracking-widest">Team Snapshot</h3>
                                <p className="text-xs text-slate-500 dark:text-gray-500 font-medium mt-1">Member distribution & operational status</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard
                                icon={Users}
                                colorClass="text-blue-600 dark:text-blue-400"
                                bgClass="bg-blue-50 dark:bg-blue-900/30"
                                value={displayMetrics.team?.total || 0}
                                label="Total Members"
                                trend="+2"
                                trendLabel="New joiners this month"
                            />

                            <StatCard
                                icon={CheckCircle2}
                                colorClass="text-emerald-600 dark:text-emerald-400"
                                bgClass="bg-emerald-50 dark:bg-emerald-900/30"
                                value={displayMetrics.team?.active || 0}
                                label="Active Members"
                                trendLabel="Currently online & working"
                            />

                            <StatCard
                                icon={Clock}
                                colorClass="text-amber-500 dark:text-amber-400"
                                bgClass="bg-amber-50 dark:bg-amber-900/30"
                                value={displayMetrics.team?.pending || 0}
                                label="Pending Invites"
                                trendLabel="Waiting for acceptance"
                            />

                            <StatCard
                                icon={Shield}
                                colorClass="text-purple-600 dark:text-purple-400"
                                bgClass="bg-purple-50 dark:bg-purple-900/30"
                                value={displayMetrics.team?.managers || 0}
                                label="Managers"
                                trendLabel="Department leads"
                            />
                        </div>
                    </section>

                    {/* DEPARTMENT ACTIVITY */}
                    <section>
                        <div className="flex items-end justify-between mb-5">
                            <div>
                                <h3 className="text-sm font-black text-slate-700 dark:text-gray-200 uppercase tracking-widest">Department Activity</h3>
                                <p className="text-xs text-slate-500 dark:text-gray-500 font-medium mt-1">Weekly productivity & engagement metrics</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <StatCard
                                icon={MessageSquare}
                                colorClass="text-indigo-600 dark:text-indigo-400"
                                bgClass="bg-indigo-50 dark:bg-indigo-900/30"
                                value={displayMetrics.activity?.messagesThisWeek || 0}
                                label="Messages Sent"
                                trend="+12%"
                                trendLabel="Volume vs last week"
                            />

                            <StatCard
                                icon={Activity}
                                colorClass="text-cyan-600 dark:text-cyan-400"
                                bgClass="bg-cyan-50 dark:bg-cyan-900/30"
                                value={displayMetrics.activity?.tasksThisWeek || 0}
                                label="Tasks Completed"
                                trend="+5"
                                trendLabel="Productivity on track"
                            />

                            <StatCard
                                icon={Calendar}
                                colorClass="text-rose-500 dark:text-rose-400"
                                bgClass="bg-rose-50 dark:bg-rose-900/30"
                                value={displayMetrics.activity?.meetingsThisWeek || 0}
                                label="Meetings"
                                trendLabel="Scheduled for this week"
                            />
                        </div>
                    </section>

                    {/* Department Info & Quick Actions Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Department Details */}
                        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-slate-100 dark:bg-gray-700 rounded-lg">
                                    <Briefcase size={20} className="text-slate-600 dark:text-gray-300" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Department Details</h3>
                                    <p className="text-xs text-slate-500 dark:text-gray-500 font-medium">Core information</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest block mb-1.5">Department Name</label>
                                    <p className="text-lg font-bold text-slate-900 dark:text-white">{displayMetrics.department?.name}</p>
                                </div>

                                {displayMetrics.department?.description && (
                                    <div className="p-4 bg-slate-50 dark:bg-gray-750/50 rounded-xl border border-slate-100 dark:border-gray-700/50">
                                        <label className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest block mb-2">Description</label>
                                        <p className="text-sm text-slate-600 dark:text-gray-300 leading-relaxed font-medium">{displayMetrics.department.description}</p>
                                    </div>
                                )}

                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest block mb-3">Department Head</label>
                                    <div className="flex items-center gap-4 p-4 border border-slate-200 dark:border-gray-700 rounded-xl hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors cursor-default bg-white dark:bg-gray-800 shadow-sm">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/50 dark:to-violet-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-800/50 shadow-inner">
                                            {displayMetrics.department?.head?.username?.charAt(0)?.toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900 dark:text-white text-sm">{displayMetrics.department?.head?.username}</p>
                                            <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">{displayMetrics.department?.head?.email}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Quick Actions */}
                        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-slate-100 dark:bg-gray-700 rounded-lg">
                                    <Activity size={20} className="text-slate-600 dark:text-gray-300" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Quick Actions</h3>
                                    <p className="text-xs text-slate-500 dark:text-gray-500 font-medium">Frequent management tasks</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button
                                    onClick={() => navigate('/manager/dashboard/allocation')}
                                    className="p-4 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700/50 border border-slate-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-500 rounded-xl text-left transition-all group hover:shadow-md"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <Users className="w-5 h-5 text-slate-400 dark:text-gray-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-600 dark:text-indigo-400">
                                            <TrendingUp size={14} />
                                        </div>
                                    </div>
                                    <div className="text-sm font-bold text-slate-900 dark:text-white mb-0.5">View Team</div>
                                    <div className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wide">Manage workload</div>
                                </button>

                                <button
                                    onClick={() => navigate('/manager/dashboard/projects')}
                                    className="p-4 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700/50 border border-slate-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-500 rounded-xl text-left transition-all group hover:shadow-md"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <CheckCircle2 className="w-5 h-5 text-slate-400 dark:text-gray-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-emerald-600 dark:text-emerald-400">
                                            <TrendingUp size={14} />
                                        </div>
                                    </div>
                                    <div className="text-sm font-bold text-slate-900 dark:text-white mb-0.5">Projects</div>
                                    <div className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wide">Track progress</div>
                                </button>

                                <button
                                    onClick={() => navigate('/manager/dashboard/reports')}
                                    className="p-4 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700/50 border border-slate-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-500 rounded-xl text-left transition-all group hover:shadow-md"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <TrendingUp className="w-5 h-5 text-slate-400 dark:text-gray-500 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" />
                                    </div>
                                    <div className="text-sm font-bold text-slate-900 dark:text-white mb-0.5">Reports</div>
                                    <div className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wide">View insights</div>
                                </button>

                                <button className="p-4 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700/50 border border-slate-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-500 rounded-xl text-left transition-all group hover:shadow-md">
                                    <div className="flex justify-between items-start mb-2">
                                        <AlertCircle className="w-5 h-5 text-slate-400 dark:text-gray-500 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors" />
                                    </div>
                                    <div className="text-sm font-bold text-slate-900 dark:text-white mb-0.5">Contact</div>
                                    <div className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wide">Request access</div>
                                </button>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManagerOverview;
