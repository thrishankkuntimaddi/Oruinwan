import React from 'react';
import { Briefcase } from 'lucide-react';

const MyWorkspaces = ({ data }) => {
    const workspaces = data?.workspaces || [];

    return (
        <section>
            <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide">My Workspaces</h3>
                <p className="text-xs text-slate-500 dark:text-gray-500">Projects you manage</p>
            </div>

            <div className="space-y-4">
                {workspaces.length === 0 ? (
                    <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-xl border border-dashed border-slate-300 dark:border-gray-600">
                        <Briefcase className="w-10 h-10 text-slate-300 dark:text-gray-600 mx-auto mb-2" />
                        <p className="text-sm text-slate-500 dark:text-gray-400">You don't manage any workspaces yet</p>
                    </div>
                ) : (
                    workspaces.map((ws) => (
                        <div key={ws._id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-5 transition-colors">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex-1">
                                    <h4 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                                        <Briefcase size={18} className="text-indigo-600 dark:text-indigo-400" />
                                        {ws.name}
                                    </h4>
                                    <div className="flex items-center gap-4 mt-2 text-xs font-medium text-slate-500 dark:text-gray-400">
                                        <span>{ws.memberCount} Members</span>
                                        <span>•</span>
                                        <span className={ws.status === 'active' ? 'text-green-600 dark:text-green-400' : 'text-slate-500'}>
                                            {ws.status === 'active' ? 'Active' : 'Archived'}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    {/* Activity Stats for this workspace */}
                                    <div className="text-center">
                                        <div className="text-lg font-black text-slate-900 dark:text-white">{ws.activity?.messages || 0}</div>
                                        <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-gray-500">Messages</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-black text-slate-900 dark:text-white">{ws.activity?.tasksActive || 0}</div>
                                        <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-gray-500">Open Tasks</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-black text-slate-900 dark:text-white">{ws.activity?.tasksCompleted || 0}</div>
                                        <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-gray-500">Completed</div>
                                    </div>
                                </div>

                                <div>
                                    <button className="px-4 py-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
                                        Manage
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </section>
    );
};

export default MyWorkspaces;
