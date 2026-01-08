import React from 'react';
import { UserPlus, CheckCircle2 } from 'lucide-react';

const UnassignedEmployees = ({ data }) => {
    const unassigned = data?.unassigned || [];

    return (
        <section>
            <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide">Unassigned Employees</h3>
                <p className="text-xs text-slate-500 dark:text-gray-500">Dept members needing workspace access</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden">
                {unassigned.length === 0 ? (
                    <div className="p-8 text-center bg-gray-50/50 dark:bg-gray-800/50">
                        <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                            <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                        <h4 className="font-bold text-slate-900 dark:text-white mb-1">All Clear!</h4>
                        <p className="text-sm text-slate-500 dark:text-gray-400">All department members are assigned to workspaces.</p>
                    </div>
                ) : (
                    <div>
                        <div className="p-3 border-b border-slate-100 dark:border-gray-700 bg-yellow-50 dark:bg-yellow-900/10">
                            <p className="text-xs text-yellow-800 dark:text-yellow-200 font-medium">
                                ⚠️ Found {unassigned.length} employees in your departments not assigned to your workspaces.
                            </p>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-gray-700 max-h-[300px] overflow-y-auto custom-scrollbar">
                            {unassigned.map((user) => (
                                <div key={user._id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-gray-700 flex items-center justify-center font-bold text-slate-600 dark:text-gray-300 text-sm">
                                            {user.username?.[0]?.toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900 dark:text-white text-sm">{user.username}</div>
                                            <div className="text-xs text-slate-500 dark:text-gray-400">
                                                {user.departments?.map(d => d.name).join(', ') || 'No Dept'}
                                            </div>
                                        </div>
                                    </div>
                                    <button className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-xs font-bold shadow-sm">
                                        <UserPlus size={14} /> Assign
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
};

export default UnassignedEmployees;
