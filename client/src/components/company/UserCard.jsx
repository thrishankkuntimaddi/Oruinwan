import React from 'react';
import { Mail } from 'lucide-react';
import RoleBadge from './RoleBadge';

const UserCard = ({
    user,
    showDepartment = true,
    showEmail = true,
    actions = null,
    onClick
}) => {
    
    const getAvatarColor = (name) => {
        const colors = [
            'bg-gradient-to-br from-blue-500 to-blue-600',
            'bg-gradient-to-br from-purple-500 to-purple-600',
            'bg-gradient-to-br from-green-500 to-green-600',
            'bg-gradient-to-br from-orange-500 to-orange-600',
            'bg-gradient-to-br from-pink-500 to-pink-600',
            'bg-gradient-to-br from-indigo-500 to-indigo-600'
        ];
        const index = name?.charCodeAt(0) % colors.length || 0;
        return colors[index];
    };

    return (
        <div
            onClick={onClick}
            className={`flex items-center justify-between p-4 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all ${onClick ? 'cursor-pointer' : ''}`}
        >
            <div className="flex items-center gap-3 flex-1 min-w-0">
                {}
                <div className={`w-10 h-10 rounded-full ${getAvatarColor(user.username)} flex items-center justify-center text-white font-bold shrink-0`}>
                    {user.username?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || '?'}
                </div>

                {}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">{user.username || 'Unknown'}</p>
                        {user.companyRole && <RoleBadge role={user.companyRole} size="sm" />}
                    </div>

                    {showEmail && user.email && (
                        <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            <Mail className="w-3 h-3" />
                            <span className="truncate">{user.email}</span>
                        </div>
                    )}

                    {showDepartment && user.departmentName && (
                        <span className="inline-block text-xs text-gray-600 dark:text-gray-300 mt-1 px-2 py-0.5 bg-gray-100 dark:bg-slate-700 rounded">
                            {user.departmentName}
                        </span>
                    )}
                </div>
            </div>

            {}
            {actions && (
                <div className="flex items-center gap-2 ml-3">
                    {actions}
                </div>
            )}
        </div>
    );
};

export default UserCard;
