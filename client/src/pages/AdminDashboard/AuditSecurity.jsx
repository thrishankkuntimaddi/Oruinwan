import React from 'react';
import { Shield, FileText, Lock } from 'lucide-react';

const AuditSecurity = ({ data }) => {
    const recentActions = data?.recentActions || [];
    const stats = {
        roleChanges: data?.roleChanges || 0,
        permissionChanges: data?.permissionChanges || 0
    };

    return (
        <section>
            <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide">Audit & Security</h3>
                <p className="text-xs text-slate-500 dark:text-gray-500">System governance logs</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Security Stats */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-6">
                        <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        <h4 className="font-bold text-slate-900 dark:text-white">Security Snapshot</h4>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="text-sm font-medium text-slate-600 dark:text-gray-300">Role Changes</span>
                                <span className="text-sm font-bold text-slate-900 dark:text-white">{stats.roleChanges}</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 w-1/4 rounded-full"></div> {/* Placeholder width */}
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="text-sm font-medium text-slate-600 dark:text-gray-300">Permission Updates</span>
                                <span className="text-sm font-bold text-slate-900 dark:text-white">{stats.permissionChanges}</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                                <div className="h-full bg-purple-500 w-1/4 rounded-full"></div> {/* Placeholder width */}
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 dark:border-gray-700">
                            <button className="w-full py-2 flex items-center justify-center gap-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                                <Lock size={14} />
                                Security Settings
                            </button>
                        </div>
                    </div>
                </div>

                {/* Audit Log Feed */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-slate-500 dark:text-gray-400" />
                            <h4 className="font-bold text-slate-900 dark:text-white">Recent Audit Logs</h4>
                        </div>
                        <button className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">
                            View Full Log
                        </button>
                    </div>

                    <div className="space-y-4">
                        {recentActions.length === 0 ? (
                            <p className="text-sm text-slate-500 dark:text-gray-400 italic">No recent audit logs found.</p>
                        ) : (
                            recentActions.map((log, index) => (
                                <div key={index} className="flex gap-3 pb-3 border-b border-slate-50 dark:border-gray-700/50 last:border-0 last:pb-0">
                                    <div className="mt-1">
                                        <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-gray-600"></div>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <span className="text-sm font-medium text-slate-800 dark:text-gray-200">
                                                {log.action?.replace(/_/g, ' ') || 'Unknown Action'}
                                            </span>
                                            <span className="text-[10px] text-slate-400 dark:text-gray-500">
                                                {new Date(log.timestamp).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                                            {log.description}
                                        </p>
                                        <div className="mt-1 flex items-center gap-1.5">
                                            <div className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-[8px] font-bold text-indigo-700 dark:text-indigo-300">
                                                {log.actor?.[0]?.toUpperCase()}
                                            </div>
                                            <span className="text-[10px] text-slate-400 dark:text-gray-500">
                                                By {log.actor}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default AuditSecurity;
