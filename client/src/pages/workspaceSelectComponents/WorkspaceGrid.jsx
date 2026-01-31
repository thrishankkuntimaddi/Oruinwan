import React from 'react';
import { User, ArrowRight, Plus, Shield } from 'lucide-react';

/**
 * WorkspaceGrid - Displays grid of existing workspaces + "Create New" card
 * Pure presentational component - all interactions delegated to parent via props
 * 
 * @param {Array} workspaces - Array of workspace objects
 * @param {function} onWorkspaceClick - Callback when clicking workspace (workspaceId)
 * @param {function} onCreateClick - Callback when clicking "Create New"
 * @param {function} getIconComponent - Helper to get icon component from icon name
 * @param {Object} user - User object for checking plan limits
 */
const WorkspaceGrid = ({
    workspaces,
    onWorkspaceClick,
    onCreateClick,
    getIconComponent,
    user
}) => {
    // Check limits: Personal users can only create 3 workspaces
    const ownedWorkspacesCount = workspaces.filter(ws => ws.isOwner).length;
    const isLimitReached = user?.userType === 'personal' && ownedWorkspacesCount >= 3;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Existing Workspaces */}
            {workspaces.map((ws) => {
                const IconComponent = getIconComponent(ws.icon);
                return (
                    <button
                        key={ws.id}
                        onClick={() => onWorkspaceClick(ws.id)}
                        className="group relative flex flex-col h-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 hover:shadow-xl hover:shadow-indigo-100/50 dark:hover:shadow-indigo-900/50 hover:border-indigo-200 dark:hover:border-indigo-700 hover:-translate-y-1 transition-all duration-300 text-left overflow-hidden"
                    >
                        {/* Decorative gradient blob */}
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-full blur-2xl group-hover:from-indigo-100 group-hover:to-purple-100 transition-colors"></div>

                        <div className="relative z-10 flex-1">
                            <div
                                className="w-14 h-14 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 mb-6"
                                style={{ backgroundColor: ws.color }}
                            >
                                <IconComponent size={28} />
                            </div>

                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2 truncate pr-4">{ws.name}</h3>

                            <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 font-medium">
                                <div className="flex items-center gap-1.5">
                                    <User size={14} className="text-slate-400" />
                                    {ws.role === 'owner' ? 'Owner' : 'Member'}
                                </div>
                                <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                                <div>{ws.members} member{ws.members !== 1 && 's'}</div>
                            </div>
                        </div>

                        <div className="relative z-10 mt-auto flex items-center text-indigo-600 font-bold text-sm opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
                            Launch Workspace <ArrowRight size={16} className="ml-2" />
                        </div>
                    </button>
                );
            })}

            {/* New Workspace Card */}
            <button
                onClick={() => {
                    if (!isLimitReached) onCreateClick();
                }}
                disabled={isLimitReached}
                className={`group relative flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-2xl transition-all duration-300 ${isLimitReached
                        ? 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 cursor-not-allowed opacity-70'
                        : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20'
                    }`}
            >
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${isLimitReached
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'
                    }`}>
                    {isLimitReached ? <Shield size={32} /> : <Plus size={32} />}
                </div>
                <span className={`font-bold text-lg ${isLimitReached
                        ? 'text-slate-400 dark:text-slate-500'
                        : 'text-slate-600 dark:text-slate-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-400'
                    }`}>
                    {isLimitReached ? 'Plan Limit Reached' : 'Create New Workspace'}
                </span>
                <span className={`text-sm mt-1 px-4 text-center ${isLimitReached
                        ? 'text-slate-400 dark:text-slate-600'
                        : 'text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400'
                    }`}>
                    {isLimitReached
                        ? 'You have reached the limit of 3 workspaces on the personal plan.'
                        : 'Start a new project or team'}
                </span>
            </button>
        </div>
    );
};

export default WorkspaceGrid;
