import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@services/api';
import { FolderKanban, ExternalLink, Users, Activity, CheckCircle, Clock } from 'lucide-react';
import { useCompany } from '../../contexts/CompanyContext';

const ManagerProjects = () => {
    const { selectedDepartment } = useCompany?.() || {};
    const navigate = useNavigate();
    const [workspaces, setWorkspaces] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchWorkspaces = async () => {
            try {
                const res = await api.get(`/api/manager-dashboard/my-workspaces`);
                setWorkspaces(res.data?.workspaces || []);
            } catch (err) {
                console.error('ManagerProjects fetch error:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchWorkspaces();
    }, []);

    const getStatusColor = (status) => {
        if (status === 'active') return { dot: 'bg-green-500', badge: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
        return { dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400' };
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <FolderKanban className="text-indigo-600 dark:text-indigo-400" size={24} />
                        Projects &amp; Workspaces
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
                        All workspaces and projects you are part of
                    </p>
                </div>
                <button
                    onClick={() => navigate('/workspaces')}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-md">
                    <ExternalLink size={16} /> Open Workspaces
                </button>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : workspaces.length === 0 ? (
                <div className="p-16 text-center bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-slate-300 dark:border-gray-600">
                    <FolderKanban className="w-14 h-14 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-slate-700 dark:text-gray-300 mb-1">No Projects Yet</h3>
                    <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">
                        You aren't part of any workspaces yet. Ask your admin to add you.
                    </p>
                    <button
                        onClick={() => navigate('/workspaces')}
                        className="px-5 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors">
                        Go to Workspaces
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {workspaces.map((ws) => {
                        const statusStyle = getStatusColor(ws.status);
                        const completionRate = ws.activity?.tasksTotal > 0
                            ? Math.round((ws.activity.tasksCompleted / ws.activity.tasksTotal) * 100)
                            : 0;

                        return (
                            <div
                                key={ws._id}
                                className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-5 flex flex-col gap-4 cursor-pointer"
                                onClick={() => navigate(`/workspace/${ws._id}/home`)}>

                                {/* Top row */}
                                <div className="flex items-start justify-between">
                                    <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                                        <FolderKanban className="text-indigo-600 dark:text-indigo-400" size={20} />
                                    </div>
                                    <span className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${statusStyle.badge}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                                        {ws.status === 'active' ? 'Active' : 'Archived'}
                                    </span>
                                </div>

                                {/* Name */}
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight">{ws.name}</h3>
                                </div>

                                {/* Stats row */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="text-center">
                                        <div className="flex items-center justify-center gap-1 text-slate-500 dark:text-gray-400 mb-0.5">
                                            <Users size={12} />
                                        </div>
                                        <div className="font-black text-slate-800 dark:text-white text-lg">{ws.memberCount || 0}</div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Members</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="flex items-center justify-center gap-1 text-slate-500 dark:text-gray-400 mb-0.5">
                                            <Activity size={12} />
                                        </div>
                                        <div className="font-black text-slate-800 dark:text-white text-lg">{ws.activity?.messages || 0}</div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Messages</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="flex items-center justify-center gap-1 text-slate-500 dark:text-gray-400 mb-0.5">
                                            <CheckCircle size={12} />
                                        </div>
                                        <div className="font-black text-slate-800 dark:text-white text-lg">{ws.activity?.tasksActive || 0}</div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Open Tasks</div>
                                    </div>
                                </div>

                                {/* Progress bar */}
                                {ws.activity?.tasksTotal > 0 && (
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[11px] font-bold text-slate-500 dark:text-gray-400 flex items-center gap-1">
                                                <Clock size={10} /> Task Completion
                                            </span>
                                            <span className="text-[11px] font-bold text-slate-700 dark:text-gray-300">{completionRate}%</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-indigo-500 rounded-full transition-all"
                                                style={{ width: `${completionRate}%` }} />
                                        </div>
                                    </div>
                                )}

                                {/* Open button */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); navigate(`/workspace/${ws._id}/home`); }}
                                    className="w-full py-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors flex items-center justify-center gap-1.5">
                                    <ExternalLink size={14} /> Open Workspace
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ManagerProjects;
