import React from 'react';
import { Crown, Shield, UserCheck, Pause, Play, Trash2, MoreVertical, Search } from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';

/**
 * MembersTab Component
 * Displays and manages workspace members with role-based actions
 */
const MembersTab = ({
    activeWorkspace,
    isAdmin,
    members,
    loadingMembers,
    memberActionLoading,
    openMemberDropdown,
    setOpenMemberDropdown,
    fetchMembers,
    refreshWorkspace
}) => {
    const { showToast } = useToast();

    const handleSuspendMember = async (userId) => {
        if (!window.confirm('Are you sure you want to suspend this member? They will lose access to the workspace.')) {
            return;
        }

        try {
            await api.post(`/api/workspaces/${activeWorkspace.id}/members/${userId}/suspend`);
            showToast('✅ Member suspended successfully', 'success');
            fetchMembers();
            setOpenMemberDropdown(null);
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to suspend member', 'error');
        }
    };

    const handleRestoreMember = async (userId) => {
        try {
            await api.post(`/api/workspaces/${activeWorkspace.id}/members/${userId}/restore`);
            showToast('✅ Member restored successfully', 'success');
            fetchMembers();
            setOpenMemberDropdown(null);
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to restore member', 'error');
        }
    };

    const handleRemoveMember = async (userId) => {
        if (!window.confirm('Are you sure you want to remove this member? This action cannot be undone.')) {
            return;
        }

        try {
            await api.post(`/api/workspaces/${activeWorkspace.id}/remove-member`, { userId });
            showToast('✅ Member removed successfully', 'success');
            fetchMembers();
            setOpenMemberDropdown(null);
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to remove member', 'error');
        }
    };

    const handleChangeRole = async (userId, currentRole) => {
        const newRole = currentRole === 'admin' ? 'member' : 'admin';
        const action = newRole === 'admin' ? 'promote to Admin' : 'demote to Member';

        if (!window.confirm(`Are you sure you want to ${action}?`)) {
            return;
        }

        try {
            await api.post(`/api/workspaces/${activeWorkspace.id}/members/${userId}/change-role`, { newRole });
            showToast(`✅ Member ${newRole === 'admin' ? 'promoted to Admin' : 'demoted to Member'} successfully`, 'success');
            fetchMembers();
            await refreshWorkspace();
            setOpenMemberDropdown(null);
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to change role', 'error');
        }
    };

    const renderMemberCard = (member, roleColor, roleLabel, roleIcon) => {
        const Icon = roleIcon;
        return (
            <div
                key={member.id}
                className={`flex items-center justify-between p-3 rounded-xl hover:bg-${roleColor}-50 dark:hover:bg-${roleColor}-900/20 transition-colors border border-${roleColor}-100 dark:border-${roleColor}-900/30 bg-${roleColor}-50/30 dark:bg-${roleColor}-900/10`}
            >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="relative">
                        {member.avatar ? (
                            <img
                                src={member.avatar}
                                alt={member.name}
                                className="w-10 h-10 rounded-full object-cover"
                            />
                        ) : (
                            <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-${roleColor}-${roleColor === 'yellow' ? '400' : '500'} to-${roleColor === 'yellow' ? 'orange' : roleColor === 'blue' ? 'indigo' : roleColor}-${roleColor === 'yellow' ? '500' : '600'} flex items-center justify-center text-white font-bold`}>
                                {member.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                        {member.status === 'online' && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <div className="font-semibold text-gray-900 dark:text-white truncate">{member.name}</div>
                            {member.isCurrentUser && (
                                <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded">You</span>
                            )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{member.email}</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {member.memberStatus === 'suspended' && (
                        <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-medium rounded-full flex items-center gap-1">
                            <Pause className="w-3 h-3" />
                            Suspended
                        </span>
                    )}
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border bg-${roleColor}-100 dark:bg-${roleColor}-900/30 text-${roleColor}-800 dark:text-${roleColor}-${roleColor === 'yellow' ? '400' : '300'} border-${roleColor}-200 dark:border-${roleColor}-800`}>
                        {roleLabel}
                    </span>
                    {isAdmin && !member.isCurrentUser && (
                        <div className="relative">
                            <button
                                onClick={() => setOpenMemberDropdown(openMemberDropdown === member.id ? null : member.id)}
                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                disabled={memberActionLoading[member.id]}
                            >
                                <MoreVertical className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                            </button>
                            {openMemberDropdown === member.id && (
                                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[160px] z-10">
                                    {member.memberStatus === 'suspended' ? (
                                        <button
                                            onClick={() => handleRestoreMember(member.id)}
                                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-green-600 dark:text-green-400"
                                        >
                                            <Play className="w-4 h-4" />
                                            Restore Access
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => handleChangeRole(member.id, member.role)}
                                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-blue-600 dark:text-blue-400"
                                            >
                                                {member.role === 'admin' ? (
                                                    <>
                                                        <UserCheck className="w-4 h-4" />
                                                        Demote to Member
                                                    </>
                                                ) : (
                                                    <>
                                                        <Shield className="w-4 h-4" />
                                                        Promote to Admin
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleSuspendMember(member.id)}
                                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-yellow-700 dark:text-yellow-400"
                                            >
                                                <Pause className="w-4 h-4" />
                                                Suspend Member
                                            </button>
                                            <button
                                                onClick={() => handleRemoveMember(member.id)}
                                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600 dark:text-red-400"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Remove Member
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Manage who has access to this workspace.</p>

            <div className="relative mb-6">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search members..."
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:bg-white dark:focus:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 dark:text-white placeholder-gray-400"
                />
            </div>

            {loadingMembers ? (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-8 text-center border border-gray-200 dark:border-gray-700">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-4">Loading members...</p>
                </div>
            ) : members.length > 0 ? (
                <div className="space-y-6">
                    {/* Owners Section */}
                    {(() => {
                        const owners = members.filter(m => m.role === 'owner');
                        if (owners.length === 0) return null;
                        return (
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <Crown size={16} className="text-yellow-500" />
                                    <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                        Owner{owners.length > 1 ? 's' : ''} ({owners.length})
                                    </h3>
                                </div>
                                <div className="space-y-2">
                                    {owners.map((member) => renderMemberCard(member, 'yellow', 'Owner', Crown))}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Admins Section */}
                    {(() => {
                        const admins = members.filter(m => m.role === 'admin');
                        if (admins.length === 0) return null;
                        return (
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <Shield size={16} className="text-blue-500" />
                                    <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                        Admin{admins.length > 1 ? 's' : ''} ({admins.length})
                                    </h3>
                                </div>
                                <div className="space-y-2">
                                    {admins.map((member) => renderMemberCard(member, 'blue', 'Admin', Shield))}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Members Section */}
                    {(() => {
                        const regularMembers = members.filter(m => m.role === 'member');
                        if (regularMembers.length === 0) return null;
                        return (
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <UserCheck size={16} className="text-gray-400" />
                                    <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                        Member{regularMembers.length > 1 ? 's' : ''} ({regularMembers.length})
                                    </h3>
                                </div>
                                <div className="space-y-2">
                                    {regularMembers.map((member) => renderMemberCard(member, 'gray', 'Member', UserCheck))}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            ) : (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-8 text-center border border-gray-200 dark:border-gray-700 border-dashed">
                    <div className="text-gray-400 mb-2">👥</div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No members found</p>
                </div>
            )}
        </div>
    );
};

export default MembersTab;
