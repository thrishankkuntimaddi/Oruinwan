import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Settings2, SquarePen, UserPlus, Settings, Edit3, LogOut, Rocket, Briefcase, Zap, Palette, Microscope, Globe, Shield, TrendingUp, Lightbulb, Flame, Target, Trophy } from 'lucide-react';
import { useWorkspace } from '../../../../contexts/WorkspaceContext';

/**
 * WorkspaceHeader Component
 * 
 * Shows workspace name + actions
 * 
 * 👉 PRIMARY ACTION: "Invite +" button
 *    - Only visible to admins/owners
 *    - Opens InvitePeopleModal
 *    - This is THE entry point for inviting
 */
const WorkspaceHeader = ({
    workspaceName,
    showWorkspaceMenu,
    setShowWorkspaceMenu,
    isSelectionMode,
    setIsSelectionMode,
    setShowNewDMModal,
    setShowInviteModal,
    setShowSettingsModal,
    setShowRenameModal,
    setNewName
}) => {
    const navigate = useNavigate();
    const { activeWorkspace } = useWorkspace();


    // 🔒 Check if current user is admin/owner (using role from activeWorkspace)
    // The role field comes from the user's workspaces array and indicates current user's role
    const userRole = activeWorkspace?.role?.toLowerCase() || '';
    const isAdmin = userRole === 'admin' || userRole === 'owner';


    return (
        <div className="h-12 flex items-center justify-between px-4 hover:bg-gray-100 transition-colors group relative select-none">
            <div
                className="flex items-center font-bold text-gray-900 cursor-pointer flex-1"
                onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
            >
                <span className="truncate max-w-[120px]">{workspaceName}</span>
                <span className={`ml-2 text-gray-500 transition-transform duration-200 ${showWorkspaceMenu ? "rotate-180" : ""}`}>
                    <ChevronDown size={14} />
                </span>
            </div>

            <div className="flex items-center gap-1">
                <button
                    className={`text-gray-500 hover:bg-gray-200 p-2 rounded-full transition-colors ${isSelectionMode ? "bg-blue-100 text-blue-600" : ""}`}
                    title="Manage Chats"
                    onClick={(e) => { e.stopPropagation(); setIsSelectionMode(!isSelectionMode); }}
                >
                    <Settings2 size={18} />
                </button>
                <button
                    className="text-gray-500 hover:bg-gray-200 p-2 rounded-full transition-colors"
                    title="New Message"
                    onClick={(e) => { e.stopPropagation(); setShowNewDMModal(true); }}
                >
                    <SquarePen size={18} />
                </button>
            </div>

            {/* Dropdown Menu */}
            {showWorkspaceMenu && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowWorkspaceMenu(false)}></div>
                    <div className="absolute top-10 left-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50 py-1 animate-fade-in origin-top-left">
                        <div className="px-4 py-3 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-xl text-white flex items-center justify-center font-bold text-lg"
                                    style={{ backgroundColor: activeWorkspace?.color || '#2563eb' }}
                                >
                                    {(() => {
                                        const iconMap = {
                                            'rocket': <Rocket size={20} />,
                                            'briefcase': <Briefcase size={20} />,
                                            'zap': <Zap size={20} />,
                                            'palette': <Palette size={20} />,
                                            'microscope': <Microscope size={20} />,
                                            'globe': <Globe size={20} />,
                                            'shield': <Shield size={20} />,
                                            'trend': <TrendingUp size={20} />,
                                            'bulb': <Lightbulb size={20} />,
                                            'flame': <Flame size={20} />,
                                            'target': <Target size={20} />,
                                            'trophy': <Trophy size={20} />
                                        };
                                        // Get the icon string and render the corresponding component
                                        const iconKey = activeWorkspace?.icon?.toLowerCase() || 'rocket';
                                        return iconMap[iconKey] || <Rocket size={20} />;
                                    })()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-gray-900 truncate">{workspaceName}</div>
                                </div>
                            </div>
                        </div>

                        <div className="py-1">
                            {isAdmin && (
                                <button
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                                    onClick={() => { setShowInviteModal(true); setShowWorkspaceMenu(false); }}
                                >
                                    <UserPlus size={16} /> Invite people to {workspaceName}
                                </button>
                            )}
                            <button
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                                onClick={() => { setShowSettingsModal(true); setShowWorkspaceMenu(false); }}
                            >
                                <Settings size={16} /> Workspace Settings
                            </button>
                            {isAdmin && (
                                <button
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                                    onClick={() => { setShowRenameModal(true); setShowWorkspaceMenu(false); setNewName(workspaceName); }}
                                >
                                    <Edit3 size={16} /> Rename Workspace
                                </button>
                            )}
                        </div>

                        <div className="border-t border-gray-100 py-1">
                            <button
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                onClick={() => navigate("/workspaces")}
                            >
                                <LogOut size={16} /> Sign out of {workspaceName}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default WorkspaceHeader;
