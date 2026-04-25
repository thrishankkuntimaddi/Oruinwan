import React from 'react';
import { Users, Edit, Trash2 } from 'lucide-react';

const DepartmentCard = ({
    department,
    onEdit,
    onDelete,
    onClick
}) => {
    return (
        <div
            onClick={onClick}
            className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all cursor-pointer group"
        >
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {department.name}
                    </h3>
                    {department.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{department.description}</p>
                    )}
                </div>

                <div className="flex gap-2">
                    {onEdit && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit(department);
                            }}
                            className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                            <Edit className="w-4 h-4" />
                        </button>
                    )}
                    {onDelete && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(department);
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Users className="w-4 h-4" />
                    <span>{department.memberCount || 0} members</span>
                </div>

                {department.workspaceCount > 0 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {department.workspaceCount} workspace{department.workspaceCount > 1 ? 's' : ''}
                    </span>
                )}
            </div>
        </div>
    );
};

export default DepartmentCard;
