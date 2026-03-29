// client/src/components/manager/ManagerWorkspacePage.jsx
// My Workspace tab for the Manager Dashboard — lists all workspaces the manager belongs to.

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Briefcase, Users, CheckCircle2, MessageSquare,
    LayoutGrid, ArrowRight, Globe, RefreshCw, AlertCircle
} from 'lucide-react';
import api from '@services/api';

const ManagerWorkspacePage = () => {
    const navigate = useNavigate();
    const [workspaces, setWorkspaces] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const fetchWorkspaces = async () => {
        try {
            setError(null);
            const res = await api.get(`/api/manager-dashboard/my-workspaces`);
            setWorkspaces(res.data?.workspaces || []);
        } catch (err) {
            console.error('ManagerWorkspacePage: fetch error', err);
            setError('Failed to load workspaces. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchWorkspaces();
    }, []);

    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        setLoading(true);
        await fetchWorkspaces();
    };

    const statusBadge = (status) =>
        status === 'active'
            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
            : 'bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400 border border-slate-200 dark:border-gray-600';

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            {/* Header */}
            <header className="h-16 px-8 flex items-center justify-between z-10 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 shadow-sm shrink-0">
                <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <Globe className="text-indigo-600 dark:text-indigo-400" size={24} strokeWidth={2.5} />
                        My Workspaces
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-gray-400 font-medium ml-8 flex items-center gap-2">
                        <span className="uppercase tracking-wider font-bold text-[10px] bg-slate-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-gray-300">
                            Workspace Manager
                        </span>
                        <span>•</span>
                        All workspaces you're a member of
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing || loading}
                    className="px-4 py-2 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-slate-700 dark:text-gray-200 text-xs font-bold uppercase tracking-wide rounded-lg hover:bg-slate-50 dark:hover:bg-gray-600 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                    <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} strokeWidth={2.5} />
                    {refreshing ? 'REFRESHING...' : 'REFRESH'}
                </button>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar">
                <div className="max-w-5xl mx-auto space-y-4">

                    {/* Loading skeleton */}
                    {loading && (
                        <div className="space-y-4 animate-pulse">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-6 space-y-3">
                                    <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
                                    <div className="h-3 w-72 bg-gray-100 dark:bg-gray-700/60 rounded" />
                                    <div className="flex gap-6 mt-4">
                                        {[1, 2, 3].map(j => (
                                            <div key={j} className="h-8 w-20 bg-gray-100 dark:bg-gray-700/60 rounded" />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Error state */}
                    {!loading && error && (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                                <AlertCircle className="text-red-400" size={24} />
                            </div>
                            <p className="text-sm font-semibold text-slate-600 dark:text-gray-400">{error}</p>
                            <button
                                onClick={handleRefresh}
                                className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    )}

                    {/* Empty state */}
                    {!loading && !error && workspaces.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                            <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                                <Briefcase className="text-indigo-400 dark:text-indigo-500" size={28} />
                            </div>
                            <h3 className="text-base font-bold text-slate-700 dark:text-white">No Workspaces Found</h3>
                            <p className="text-sm text-slate-500 dark:text-gray-400 text-center max-w-sm">
                                You haven't been added to any workspaces yet. Ask your admin to add you to a workspace.
                            </p>
                            <button
                                onClick={() => navigate('/workspaces')}
                                className="mt-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2"
                            >
                                <Globe size={16} />
                                Browse Workspaces
                            </button>
                        </div>
                    )}

                    {/* Workspace cards */}
                    {!loading && !error && workspaces.map(ws => (
                        <div
                            key={ws._id}
                            className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-200 group"
                        >
                            <div className="p-6">
                                <div className="flex items-start justify-between gap-4">
                                    {/* Left: info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1">
                                            <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                                                <LayoutGrid size={18} className="text-indigo-600 dark:text-indigo-400" />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-900 dark:text-white text-base leading-tight">
                                                    {ws.name}
                                                </h3>
                                                <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-0.5 ${statusBadge(ws.status)}`}>
                                                    {ws.status}
                                                </span>
                                            </div>
                                        </div>
                                        {ws.description && (
                                            <p className="text-sm text-slate-500 dark:text-gray-400 mt-2 ml-12 line-clamp-2">
                                                {ws.description}
                                            </p>
                                        )}
                                    </div>

                                    {/* Right: Open button */}
                                    <button
                                        onClick={() => navigate(`/workspace/${ws._id}/home`)}
                                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold text-sm rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800/50 transition-all group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 shrink-0"
                                    >
                                        Open
                                        <ArrowRight size={14} />
                                    </button>
                                </div>

                                {/* Stats row */}
                                <div className="mt-5 pt-5 border-t border-slate-100 dark:border-gray-700 grid grid-cols-3 gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                                            <Users size={13} className="text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-slate-900 dark:text-white">{ws.memberCount ?? 0}</p>
                                            <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wide">Members</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                                            <CheckCircle2 size={13} className="text-amber-600 dark:text-amber-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-slate-900 dark:text-white">{ws.activity?.tasksActive ?? 0}</p>
                                            <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wide">Active Tasks</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                                            <MessageSquare size={13} className="text-indigo-600 dark:text-indigo-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-slate-900 dark:text-white">{ws.activity?.messages ?? 0}</p>
                                            <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wide">Messages / wk</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ManagerWorkspacePage;
