import React from 'react';
import { MessageSquare, Briefcase, Zap, Moon } from 'lucide-react';

const ActivityHealth = ({ data }) => {
    const stats = data || {
        messages: { last7days: 0, last30days: 0, trend: 'stable' },
        activeWorkspaces: 0,
        dormantWorkspaces: 0,
        engagementScore: 0
    };

    return (
        <section>
            <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide">Activity & Health</h3>
                <p className="text-xs text-slate-500 dark:text-gray-500">Platform engagement metrics</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Engagement Score */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6 transition-colors relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 dark:bg-indigo-900/20 rounded-bl-full -mr-4 -mt-4 transition-colors"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-4">
                            <Zap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            <span className="text-sm font-bold text-slate-600 dark:text-gray-300">Engagement Score</span>
                        </div>
                        <div className="flex items-end gap-2">
                            <div className="text-4xl font-black text-slate-900 dark:text-white">{stats.engagementScore}%</div>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-gray-700 h-2 rounded-full mt-4 overflow-hidden">
                            <div
                                className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full"
                                style={{ width: `${stats.engagementScore}%` }}
                            ></div>
                        </div>
                    </div>
                </div>

                {/* Message Volume */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6 transition-colors">
                    <div className="flex items-center gap-2 mb-4">
                        <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm font-bold text-slate-600 dark:text-gray-300">Message Volume</span>
                    </div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white">{stats.messages.last7days}</div>
                    <div className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                        Last 7 days vs {Math.round(stats.messages.last30days / 4)} avg
                    </div>
                    <div className={`text-xs font-bold mt-2 ${stats.messages.trend === 'up' ? 'text-green-600 dark:text-green-400' : 'text-slate-500'
                        }`}>
                        {stats.messages.trend === 'up' ? 'Trending Up ↗' : 'Stable'}
                    </div>
                </div>

                {/* Active Workspaces */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6 transition-colors">
                    <div className="flex items-center gap-2 mb-4">
                        <Briefcase className="w-5 h-5 text-green-600 dark:text-green-400" />
                        <span className="text-sm font-bold text-slate-600 dark:text-gray-300">Active Workspaces</span>
                    </div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white">{stats.activeWorkspaces}</div>
                    <div className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                        Workspaces with activity this week
                    </div>
                </div>

                {/* Dormant Workspaces */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6 transition-colors">
                    <div className="flex items-center gap-2 mb-4">
                        <Moon className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                        <span className="text-sm font-bold text-slate-600 dark:text-gray-300">Dormant</span>
                    </div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white">{stats.dormantWorkspaces}</div>
                    <div className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                        No activity &gt; 7 days
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ActivityHealth;
