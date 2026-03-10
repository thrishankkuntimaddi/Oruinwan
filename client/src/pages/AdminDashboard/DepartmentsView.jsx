import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building, Users } from 'lucide-react';

const DepartmentsView = ({ data }) => {
    const navigate = useNavigate();
    const departments = data?.departments || [];

    return (
        <section>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide">Departments</h3>
                    <p className="text-xs text-slate-500 dark:text-gray-500">Organizational structure & headcount</p>
                </div>
                <button
                    onClick={() => navigate('/admin/departments')}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
                    Manage Departments
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {departments.length === 0 ? (
                    <div className="col-span-full p-8 text-center bg-white dark:bg-gray-800 rounded-xl border border-dashed border-slate-300 dark:border-gray-600">
                        <Building className="w-10 h-10 text-slate-300 dark:text-gray-600 mx-auto mb-2" />
                        <p className="text-sm text-slate-500 dark:text-gray-400">No departments defined</p>
                    </div>
                ) : (
                    departments.map((dept) => (
                        <div key={dept._id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-5 transition-colors">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-2 bg-slate-100 dark:bg-gray-700 rounded-lg">
                                    <Building className="w-5 h-5 text-slate-600 dark:text-gray-300" />
                                </div>
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 dark:bg-gray-700/50 rounded-lg">
                                    <Users size={14} className="text-slate-500 dark:text-gray-400" />
                                    <span className="text-xs font-bold text-slate-700 dark:text-gray-200">{dept.userCount}</span>
                                </div>
                            </div>

                            <h4 className="font-bold text-slate-900 dark:text-white mb-1">{dept.name}</h4>

                            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-gray-700">
                                <p className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wide mb-2">Managers</p>
                                <div className="flex items-center gap-2">
                                    {dept.managers.length === 0 ? (
                                        <span className="text-xs text-slate-400 italic">No managers assigned</span>
                                    ) : (
                                        <div className="flex -space-x-2">
                                            {dept.managers.map((manager, i) => (
                                                <div key={i} className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 border-2 border-white dark:border-gray-800 flex items-center justify-center text-[10px] font-bold text-indigo-700 dark:text-indigo-300" title={manager.username}>
                                                    {manager.username?.[0]?.toUpperCase()}
                                                </div>
                                            ))}
                                            {dept.managers.length === 1 && (
                                                <span className="text-xs text-slate-600 dark:text-gray-300 ml-3 truncate max-w-[120px]">
                                                    {dept.managers[0].username}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </section>
    );
};

export default DepartmentsView;
