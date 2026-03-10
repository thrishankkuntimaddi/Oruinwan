import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Lock, Globe, ArrowRight } from 'lucide-react';

const WorkspacesAccess = ({ data }) => {
    const navigate = useNavigate();
    const workspaces = data?.workspaces || [];

    return (
        <section>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide">Workspaces Access</h3>
                    <p className="text-xs text-slate-500 dark:text-gray-500">Environment visibility & management</p>
                </div>
                <button
                    onClick={() => navigate('\/admin\/workspaces')}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors flex items-center gap-1">
                    <ArrowRight size={14} /> Manage
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden">
                {workspaces.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 dark:text-gray-400">
                        <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No workspaces found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-gray-700/50 border-b border-slate-200 dark:border-gray-700 text-xs uppercase text-slate-500 dark:text-gray-400 font-bold">
                                    <th className="px-6 py-4">Workspace</th>
                                    <th className="px-6 py-4">Owners/Managers</th>
                                    <th className="px-6 py-4">Access</th>
                                    <th className="px-6 py-4 text-center">Activity Level</th>
                                    <th className="px-6 py-4 text-right">Members</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
                                {workspaces.slice(0, 5).map((ws) => (
                                    <tr
                                        key={ws._id}
                                        onClick={() => navigate('/admin/workspaces')}
                                        className="hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors group cursor-pointer">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                <Briefcase size={16} className="text-slate-400" />
                                                {ws.name}
                                            </div>
                                            {ws.department && (
                                                <div className="text-xs text-slate-500 dark:text-gray-400 mt-1 pl-6">
                                                    Dep: {ws.department.name}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                {ws.owners && ws.owners.length > 0 && (
                                                    <div className="text-xs text-slate-900 dark:text-white font-medium">
                                                        <span className="text-slate-500 font-normal">Owner: </span>
                                                        {ws.owners[0].username}
                                                    </div>
                                                )}
                                                {ws.managers && ws.managers.length > 0 && (
                                                    <div className="text-xs text-slate-600 dark:text-gray-300">
                                                        {ws.managers.length} Manager{ws.managers.length !== 1 ? 's' : ''}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {ws.settings?.isPrivate === false ? (
                                                    <><Globe size={14} className="text-green-500" /><span className="text-xs text-slate-600 dark:text-gray-300">Public</span></>
                                                ) : (
                                                    <><Lock size={14} className="text-slate-400" /><span className="text-xs text-slate-600 dark:text-gray-300">Private</span></>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${ws.activity === 'high' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                ws.activity === 'medium' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                    'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                                                }`}>
                                                {ws.activity}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-slate-700 dark:text-gray-300">
                                            {ws.memberCount}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {workspaces.length > 5 && (
                    <div className="px-6 py-3 bg-slate-50 dark:bg-gray-700/30 border-t border-slate-200 dark:border-gray-700 text-xs font-bold text-center text-slate-500">
                        +{workspaces.length - 5} more workspaces
                    </div>
                )}
            </div>
        </section>
    );
};

export default WorkspacesAccess;
