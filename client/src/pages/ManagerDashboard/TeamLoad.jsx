import React from 'react';
import { Users, AlertCircle } from 'lucide-react';

const TeamLoad = ({ data }) => {
    // Determine status color based on workload
    const getLoadStatus = (workload) => {
        switch (workload) {
            case 'high': return { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30', label: 'High Load' };
            case 'low': return { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/30', label: 'Available' };
            default: return { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30', label: 'Optimal' };
        }
    };

    const members = data?.teamMembers || [];
    const overloaded = data?.overloaded || [];

    return (
        <section>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide">Team Load</h3>
                    <p className="text-xs text-slate-500 dark:text-gray-500">Resource allocation & capacity</p>
                </div>
                {overloaded.length > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 dark:bg-red-900/30 rounded-full">
                        <AlertCircle size={14} className="text-red-600 dark:text-red-400" />
                        <span className="text-xs font-bold text-red-700 dark:text-red-300">{overloaded.length} Overloaded</span>
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden">
                {members.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 dark:text-gray-400">
                        <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No team members found</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-gray-700">
                        {members.map((member) => {
                            const status = getLoadStatus(member.workload);
                            return (
                                <div key={member._id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-gray-700 flex items-center justify-center font-bold text-slate-600 dark:text-gray-300">
                                            {member.username?.[0]?.toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900 dark:text-white text-sm">{member.username}</div>
                                            <div className="text-xs text-slate-500 dark:text-gray-400">
                                                In {member.workspaces?.length || 0} workspaces
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <div className="text-sm font-black text-slate-900 dark:text-white">{member.activeTasks}</div>
                                            <div className="text-[10px] uppercase text-slate-400">Tasks</div>
                                        </div>
                                        <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${status.bg} ${status.color}`}>
                                            {status.label}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
};

export default TeamLoad;
