import React, { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '../../../../contexts/WorkspaceContext';
import { useToast } from '../../../../contexts/ToastContext';
import api from '../../../../services/api';
import { Crown, Shield, UserCheck, Users, Hash, MessageSquare, Rocket, Briefcase, Zap, Palette, FlaskConical, Globe, ShieldCheck, TrendingUp, Lightbulb, Flame, Target, Trophy, Mail, Clock, CheckCircle, XCircle, RotateCw, Search, MoreVertical, Pause, Play, Trash2 } from 'lucide-react';

// Invitations Tab Component
const InvitationsTab = ({ activeWorkspace, isAdmin }) => {
    const { showToast } = useToast();
    const [invitations, setInvitations] = useState({ pending: [], accepted: [], revoked: [], expired: [] });
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [actionLoading, setActionLoading] = useState({});

    const fetchInvitations = useCallback(async () => {
        if (!activeWorkspace?.id) return;

        setLoading(true);
        try {
            const response = await api.get(`/api/workspaces/${activeWorkspace.id}/invites`);
            setInvitations(response.data);
        } catch (error) {
            console.error('Error fetching invitations:', error);
            showToast(error.response?.data?.message || 'Failed to load invitations', 'error');
        } finally {
            setLoading(false);
        }
    }, [activeWorkspace?.id, showToast]);

    useEffect(() => {
        fetchInvitations();
    }, [fetchInvitations]);

    const handleRevoke = async (inviteId) => {
        setActionLoading(prev => ({ ...prev, [inviteId]: 'revoking' }));
        try {
            await api.post(`/api/workspaces/${activeWorkspace.id}/invites/${inviteId}/revoke`);
            showToast('✅ Invitation revoked successfully', 'success');
            fetchInvitations();
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to revoke invitation', 'error');
        } finally {
            setActionLoading(prev => ({ ...prev, [inviteId]: null }));
        }
    };

    const handleResend = async (inviteId) => {
        setActionLoading(prev => ({ ...prev, [inviteId]: 'resending' }));
        try {
            await api.post(`/api/workspaces/${activeWorkspace.id}/invites/${inviteId}/resend`);
            showToast('✅ Invitation resent successfully', 'success');
            fetchInvitations();
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to resend invitation', 'error');
        } finally {
            setActionLoading(prev => ({ ...prev, [inviteId]: null }));
        }
    };

    // Filter and search invitations
    const allInvites = [
        ...invitations.pending.map(inv => ({ ...inv, filterStatus: 'pending' })),
        ...invitations.accepted.map(inv => ({ ...inv, filterStatus: 'accepted' })),
        ...invitations.expired.map(inv => ({ ...inv, filterStatus: 'expired' })),
        ...invitations.revoked.map(inv => ({ ...inv, filterStatus: 'revoked' }))
    ];

    const filteredInvites = allInvites.filter(invite => {
        const matchesFilter = filter === 'all' || invite.filterStatus === filter;
        const matchesSearch = !searchQuery ||
            invite.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            invite.invitedBy?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const getStatusBadge = (status) => {
        const badges = {
            pending: { text: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
            accepted: { text: 'Accepted', color: 'bg-green-100 text-green-700', icon: CheckCircle },
            expired: { text: 'Expired', color: 'bg-gray-100 text-gray-700', icon: XCircle },
            revoked: { text: 'Revoked', color: 'bg-red-100 text-red-700', icon: XCircle }
        };
        const badge = badges[status] || badges.pending;
        const Icon = badge.icon;
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
                <Icon className="w-3 h-3" />
                {badge.text}
            </span>
        );
    };

    const getTimeAgo = (date) => {
        const now = new Date();
        const past = new Date(date);
        const diffInMs = now - past;
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

        if (diffInDays === 0) return 'Today';
        if (diffInDays === 1) return 'Yesterday';
        if (diffInDays < 7) return `${diffInDays} days ago`;
        return past.toLocaleDateString();
    };

    const getExpiresIn = (date) => {
        const now = new Date();
        const future = new Date(date);
        const diffInMs = future - now;
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

        if (diffInMs < 0) return 'Expired';
        if (diffInDays === 0) return 'Today';
        if (diffInDays === 1) return '1 day';
        return `${diffInDays} days`;
    };

    if (!isAdmin) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Admin Access Required</h3>
                    <p className="text-gray-600">Only workspace admins can manage invitations</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-8 py-6 border-b border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Workspace Invitations</h2>
                <p className="text-gray-600">Manage pending, accepted, and revoked invitations</p>
            </div>

            {/* Filters and Search */}
            <div className="px-8 py-4 border-b border-gray-100 flex items-center gap-4">
                {/* Status Filter */}
                <div className="flex gap-2">
                    {[
                        { value: 'all', label: 'All', count: allInvites.length },
                        { value: 'pending', label: 'Pending', count: invitations.pending.length },
                        { value: 'accepted', label: 'Accepted', count: invitations.accepted.length },
                        { value: 'expired', label: 'Expired', count: invitations.expired.length },
                        { value: 'revoked', label: 'Revoked', count: invitations.revoked.length }
                    ].map(({ value, label, count }) => (
                        <button
                            key={value}
                            onClick={() => setFilter(value)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filter === value
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {label} ({count})
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="flex-1 max-w-sm ml-auto">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                    </div>
                </div>
            </div>

            {/* Invitations Table */}
            <div className="flex-1 overflow-auto px-8 py-4">
                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading invitations...</p>
                    </div>
                ) : filteredInvites.length === 0 ? (
                    <div className="text-center py-12">
                        <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-600">No invitations found</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                        <table className="w-full min-w-[800px]">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Email</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Role</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Invited By</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Sent</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Expires</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredInvites.map((invite) => (
                                    <tr key={invite.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm text-gray-900">{invite.email}</td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded capitalize">
                                                {invite.role}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{invite.invitedBy || 'System'}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{getTimeAgo(invite.createdAt)}</td>
                                        <td className="px-4 py-3">{getStatusBadge(invite.filterStatus)}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{getExpiresIn(invite.expiresAt)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-2">
                                                {(invite.filterStatus === 'pending' || invite.filterStatus === 'expired') && (
                                                    <>
                                                        <button
                                                            onClick={() => handleResend(invite.id)}
                                                            disabled={actionLoading[invite.id]}
                                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                                                            title="Resend invitation"
                                                        >
                                                            <RotateCw className={`w-4 h-4 ${actionLoading[invite.id] === 'resending' ? 'animate-spin' : ''}`} />
                                                        </button>
                                                        {invite.filterStatus === 'pending' && (
                                                            <button
                                                                onClick={() => handleRevoke(invite.id)}
                                                                disabled={actionLoading[invite.id]}
                                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                                title="Revoke invitation"
                                                            >
                                                                <XCircle className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

const WorkspaceSettingsModal = ({
    showSettingsModal,
    setShowSettingsModal,
    activeSettingsTab,
    setActiveSettingsTab,
    workspaceName,
    setWorkspaceName,
    setShowDeleteConfirm
}) => {
    const { activeWorkspace, refreshWorkspace } = useWorkspace();
    const { showToast } = useToast();
    const [members, setMembers] = useState([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [stats, setStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(false);
    const [permissions, setPermissions] = useState({
        allowMemberInvite: true,
        allowMemberChannelCreation: true,
        requireAdminApproval: false,
        isDiscoverable: false
    });
    const [savingPermissions, setSavingPermissions] = useState(false);
    const [newWorkspaceName, setNewWorkspaceName] = useState(workspaceName);
    const [savingName, setSavingName] = useState(false);
    const [editingIcon, setEditingIcon] = useState(false);
    const [selectedIcon, setSelectedIcon] = useState(activeWorkspace?.icon || 'rocket');
    const [selectedColor, setSelectedColor] = useState(activeWorkspace?.color || '#2563eb');
    const [savingIcon, setSavingIcon] = useState(false);
    const [memberActionLoading, setMemberActionLoading] = useState({});
    const [openMemberDropdown, setOpenMemberDropdown] = useState(null);


    // Check if current user is admin/owner (case-insensitive)
    const userRole = activeWorkspace?.role?.toLowerCase() || '';
    const isAdmin = userRole === 'admin' || userRole === 'owner';

    // Icon options with matching colors
    const iconOptions = [
        { id: 'rocket', Icon: Rocket, name: 'Rocket' },
        { id: 'briefcase', Icon: Briefcase, name: 'Briefcase' },
        { id: 'zap', Icon: Zap, name: 'Lightning' },
        { id: 'palette', Icon: Palette, name: 'Palette' },
        { id: 'microscope', Icon: FlaskConical, name: 'Science' },
        { id: 'globe', Icon: Globe, name: 'Globe' },
        { id: 'shield', Icon: ShieldCheck, name: 'Shield' },
        { id: 'trend', Icon: TrendingUp, name: 'Trending' },
        { id: 'bulb', Icon: Lightbulb, name: 'Ideas' },
        { id: 'flame', Icon: Flame, name: 'Flame' },
        { id: 'target', Icon: Target, name: 'Target' },
        { id: 'trophy', Icon: Trophy, name: 'Trophy' }
    ];

    // Fetch members function wrapped in useCallback
    const fetchMembers = useCallback(async () => {
        if (!activeWorkspace?.id) return;

        try {
            setLoadingMembers(true);
            const response = await api.get(`/api/workspaces/${activeWorkspace.id}/all-members`);
            setMembers(response.data.members || []);
        } catch (error) {
            console.error('Error fetching members:', error);
        } finally {
            setLoadingMembers(false);
        }
    }, [activeWorkspace?.id]);

    // Fetch workspace stats
    const fetchStats = useCallback(async () => {
        if (!activeWorkspace?.id) return;

        try {
            setLoadingStats(true);
            const response = await api.get(`/api/workspaces/${activeWorkspace.id}/stats`);
            setStats(response.data);
            // Update permissions from stats
            if (response.data.settings) {
                setPermissions({
                    allowMemberInvite: response.data.settings.allowMemberInvite ?? true,
                    allowMemberChannelCreation: response.data.settings.allowMemberChannelCreation ?? true,
                    requireAdminApproval: response.data.settings.requireAdminApproval ?? false,
                    isDiscoverable: response.data.settings.isDiscoverable ?? false
                });
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setLoadingStats(false);
        }
    }, [activeWorkspace?.id]);

    // Fetch members when Members tab is active
    useEffect(() => {
        if (activeSettingsTab === 'Members' && showSettingsModal) {
            fetchMembers();
        }
    }, [activeSettingsTab, showSettingsModal, fetchMembers]);

    // Fetch stats when General or Billing tab is active
    useEffect(() => {
        if ((activeSettingsTab === 'General' || activeSettingsTab === 'Billing' || activeSettingsTab === 'Permissions') && showSettingsModal) {
            fetchStats();
        }
    }, [activeSettingsTab, showSettingsModal, fetchStats]);

    const handlePermissionChange = async (key, value) => {
        setPermissions(prev => ({ ...prev, [key]: value }));

        try {
            setSavingPermissions(true);
            await api.put(`/api/workspaces/${activeWorkspace.id}`, {
                settings: { [key]: value }
            });
            showToast('Permission updated successfully');
        } catch (error) {
            console.error('Error updating permission:', error);
            showToast(error.response?.data?.message || 'Failed to update permission', 'error');
            // Revert on error
            setPermissions(prev => ({ ...prev, [key]: !value }));
        } finally {
            setSavingPermissions(false);
        }
    };



    const handleSuspendMember = async (userId) => {
        if (!window.confirm('Are you sure you want to suspend this member? They will lose access to the workspace.')) {
            return;
        }

        setMemberActionLoading(prev => ({ ...prev, [userId]: 'suspending' }));
        try {
            await api.post(`/api/workspaces/${activeWorkspace.id}/members/${userId}/suspend`);
            showToast('✅ Member suspended successfully', 'success');
            fetchMembers();
            setOpenMemberDropdown(null);
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to suspend member', 'error');
        } finally {
            setMemberActionLoading(prev => ({ ...prev, [userId]: null }));
        }
    };

    const handleRestoreMember = async (userId) => {
        setMemberActionLoading(prev => ({ ...prev, [userId]: 'restoring' }));
        try {
            await api.post(`/api/workspaces/${activeWorkspace.id}/members/${userId}/restore`);
            showToast('✅ Member restored successfully', 'success');
            fetchMembers();
            setOpenMemberDropdown(null);
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to restore member', 'error');
        } finally {
            setMemberActionLoading(prev => ({ ...prev, [userId]: null }));
        }
    };

    const handleRemoveMember = async (userId) => {
        if (!window.confirm('Are you sure you want to remove this member? This action cannot be undone.')) {
            return;
        }

        setMemberActionLoading(prev => ({ ...prev, [userId]: 'removing' }));
        try {
            await api.post(`/api/workspaces/${activeWorkspace.id}/remove-member`, { userId });
            showToast('✅ Member removed successfully', 'success');
            fetchMembers();
            setOpenMemberDropdown(null);
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to remove member', 'error');
        } finally {
            setMemberActionLoading(prev => ({ ...prev, [userId]: null }));
        }
    };

    const handleChangeRole = async (userId, currentRole) => {
        const newRole = currentRole === 'admin' ? 'member' : 'admin';
        const action = newRole === 'admin' ? 'promote to Admin' : 'demote to Member';

        if (!window.confirm(`Are you sure you want to ${action}?`)) {
            return;
        }

        setMemberActionLoading(prev => ({ ...prev, [userId]: 'changing' }));
        try {
            await api.post(`/api/workspaces/${activeWorkspace.id}/members/${userId}/change-role`, { newRole });
            showToast(`✅ Member ${newRole === 'admin' ? 'promoted to Admin' : 'demoted to Member'} successfully`, 'success');
            fetchMembers();
            // Refresh workspace context to update role in real-time
            await refreshWorkspace();
            setOpenMemberDropdown(null);
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to change role', 'error');
        } finally {
            setMemberActionLoading(prev => ({ ...prev, [userId]: null }));
        }
    };

    if (!showSettingsModal) return null;

    return (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center animate-fade-in backdrop-blur-md">
            <div className="bg-white rounded-2xl shadow-2xl w-[800px] h-[600px] flex overflow-hidden transform transition-all scale-100 border border-gray-100">
                {/* Sidebar */}
                <div className="w-56 bg-gray-50/80 backdrop-blur-sm border-r border-gray-200 p-6">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6 px-2">Settings</h3>
                    <nav className="space-y-1">
                        {["General", "Permissions", "Members", "Invitations", "Billing", "Advanced"].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveSettingsTab(tab)}
                                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${activeSettingsTab === tab
                                    ? "bg-white text-blue-600 shadow-sm ring-1 ring-gray-200"
                                    : "text-gray-600 hover:bg-gray-200/50 hover:text-gray-900"}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Content */}
                <div className="flex-1 p-10 overflow-y-auto bg-white">
                    <h2 className="text-2xl font-bold text-gray-900 mb-8">{activeSettingsTab}</h2>

                    {activeSettingsTab === "General" && (
                        <div className="space-y-6">
                            {editingIcon ? (
                                /* EDIT MODE */
                                <div className="space-y-8 bg-blue-50/30 rounded-2xl p-6 border border-blue-100">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-bold text-gray-900">Edit Workspace Settings</h3>
                                        <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold">Editing</span>
                                    </div>

                                    {/* Workspace Name */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-3">Workspace Name</label>
                                        <input
                                            type="text"
                                            value={newWorkspaceName}
                                            onChange={(e) => setNewWorkspaceName(e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Enter workspace name"
                                        />
                                    </div>

                                    {/* Icon Selection */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-3">Choose Icon</label>
                                        <div className="grid grid-cols-6 gap-3">
                                            {iconOptions.map((option) => {
                                                const IconComponent = option.Icon;
                                                const isSelected = selectedIcon === option.id;
                                                return (
                                                    <button
                                                        key={option.id}
                                                        onClick={() => setSelectedIcon(option.id)}
                                                        className={`relative p-4 rounded-xl flex items-center justify-center transition-all bg-white hover:bg-gray-50 border-2 ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                                                            }`}
                                                        title={option.name}
                                                    >
                                                        <IconComponent size={24} className="text-gray-700" />
                                                        {isSelected && (
                                                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center shadow-sm">
                                                                <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                </svg>
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Color Selection */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-3">Choose Color</label>
                                        <div className="grid grid-cols-8 gap-3">
                                            {[
                                                { name: 'Blue', color: '#3b82f6' },
                                                { name: 'Red', color: '#ef4444' },
                                                { name: 'Orange', color: '#ea580c' },
                                                { name: 'Yellow', color: '#eab308' },
                                                { name: 'Green', color: '#16a34a' },
                                                { name: 'Emerald', color: '#10b981' },
                                                { name: 'Cyan', color: '#0891b2' },
                                                { name: 'Sky', color: '#0ea5e9' },
                                                { name: 'Purple', color: '#8b5cf6' },
                                                { name: 'Violet', color: '#9333ea' },
                                                { name: 'Pink', color: '#ec4899' },
                                                { name: 'Amber', color: '#f59e0b' },
                                                { name: 'Lime', color: '#84cc16' },
                                                { name: 'Teal', color: '#14b8a6' },
                                                { name: 'Indigo', color: '#6366f1' },
                                                { name: 'Rose', color: '#f43f5e' }
                                            ].map((colorOption) => {
                                                const isSelected = selectedColor === colorOption.color;
                                                return (
                                                    <button
                                                        key={colorOption.color}
                                                        onClick={() => setSelectedColor(colorOption.color)}
                                                        className={`relative w-12 h-12 rounded-xl transition-all hover:scale-110 border-2 ${isSelected ? 'border-blue-500 scale-105 shadow-lg' : 'border-transparent'
                                                            }`}
                                                        style={{ backgroundColor: colorOption.color }}
                                                        title={colorOption.name}
                                                    >
                                                        {isSelected && (
                                                            <div className="absolute inset-0 flex items-center justify-center">
                                                                <svg className="w-6 h-6 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                </svg>
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Preview */}
                                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                                        <h4 className="text-sm font-semibold text-gray-700 mb-4">Preview</h4>
                                        <div className="flex items-center gap-4">
                                            <div
                                                className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg"
                                                style={{ backgroundColor: selectedColor }}
                                            >
                                                {(() => {
                                                    const option = iconOptions.find(opt => opt.id === selectedIcon);
                                                    const IconComponent = option?.Icon || Rocket;
                                                    return <IconComponent size={40} className="text-white" />;
                                                })()}
                                            </div>
                                            <div>
                                                <p className="text-lg font-bold text-gray-900 mb-1">
                                                    {newWorkspaceName || 'Workspace Name'}
                                                </p>
                                                <p className="text-sm text-gray-600">
                                                    {iconOptions.find(opt => opt.id === selectedIcon)?.name || 'Rocket'} · {selectedColor}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex justify-end gap-3 pt-2">
                                        <button
                                            onClick={() => {
                                                setEditingIcon(false);
                                                setSelectedIcon(activeWorkspace?.icon || 'rocket');
                                                setSelectedColor(activeWorkspace?.color || '#2563eb');
                                                setNewWorkspaceName(workspaceName);
                                            }}
                                            className="px-6 py-2.5 border border-gray-300 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={async () => {
                                                try {
                                                    setSavingIcon(true);
                                                    setSavingName(true);

                                                    // Update everything in one call
                                                    await api.put(`/api/workspaces/${activeWorkspace.id}`, {
                                                        icon: selectedIcon,
                                                        color: selectedColor
                                                    });

                                                    // Update name separately
                                                    if (newWorkspaceName.trim() !== workspaceName) {
                                                        await api.put(`/api/workspaces/${activeWorkspace.id}/rename`, {
                                                            name: newWorkspaceName.trim()
                                                        });
                                                        setWorkspaceName(newWorkspaceName.trim());
                                                    }

                                                    setEditingIcon(false);
                                                    showToast('Workspace updated successfully');

                                                    // Refresh to update everywhere
                                                    window.location.reload();
                                                } catch (error) {
                                                    console.error('Error updating workspace:', error);
                                                    showToast(error.response?.data?.message || 'Failed to update workspace', 'error');
                                                } finally {
                                                    setSavingIcon(false);
                                                    setSavingName(false);
                                                }
                                            }}
                                            disabled={savingIcon || savingName || !newWorkspaceName.trim()}
                                            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
                                        >
                                            {(savingIcon || savingName) ? 'Saving...' : 'Save All Changes'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* VIEW MODE */
                                <>
                                    {/* Current Settings Display */}
                                    <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-200">
                                        <div className="flex items-start justify-between mb-4">
                                            <h3 className="text-lg font-bold text-gray-900">Workspace Details</h3>
                                            {isAdmin && (
                                                <button
                                                    onClick={() => {
                                                        setEditingIcon(true);
                                                        setSelectedIcon(activeWorkspace?.icon || 'rocket');
                                                        setSelectedColor(activeWorkspace?.color || '#2563eb');
                                                        setNewWorkspaceName(workspaceName);
                                                    }}
                                                    className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                                >
                                                    Edit Workspace
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-6">
                                            <div
                                                className="w-24 h-24 rounded-2xl flex items-center justify-center shadow-lg"
                                                style={{ backgroundColor: activeWorkspace?.color || '#2563eb' }}
                                            >
                                                {(() => {
                                                    const currentOption = iconOptions.find(opt => opt.id === (activeWorkspace?.icon || 'rocket'));
                                                    const IconComponent = currentOption?.Icon || Rocket;
                                                    return <IconComponent size={48} className="text-white" />;
                                                })()}
                                            </div>

                                            <div className="flex-1">
                                                <h3 className="text-2xl font-bold text-gray-900 mb-2">{workspaceName}</h3>
                                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                                    <span className="flex items-center gap-1">
                                                        <span className="font-semibold">Icon:</span>
                                                        {iconOptions.find(opt => opt.id === (activeWorkspace?.icon || 'rocket'))?.name || 'Rocket'}
                                                    </span>
                                                    <span className="text-gray-400">•</span>
                                                    <span className="flex items-center gap-1">
                                                        <span className="font-semibold">Color:</span>
                                                        {activeWorkspace?.color || '#2563eb'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Workspace Information */}
                                    {loadingStats ? (
                                        <div className="text-sm text-gray-500">Loading workspace info...</div>
                                    ) : stats && (
                                        <div className="bg-white rounded-xl p-6 border border-gray-200">
                                            <h4 className="text-sm font-bold text-gray-900 mb-4">Workspace Information</h4>
                                            <div className="space-y-3 text-sm">
                                                <div className="flex justify-between py-2 border-b border-gray-100">
                                                    <span className="text-gray-600">Created by</span>
                                                    <span className="font-semibold text-gray-900">{stats.creator?.username || 'Unknown'}</span>
                                                </div>
                                                <div className="flex justify-between py-2 border-b border-gray-100">
                                                    <span className="text-gray-600">Created on</span>
                                                    <span className="font-semibold text-gray-900">
                                                        {new Date(stats.createdAt).toLocaleDateString('en-US', {
                                                            year: 'numeric',
                                                            month: 'long',
                                                            day: 'numeric'
                                                        })}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between py-2">
                                                    <span className="text-gray-600">Total members</span>
                                                    <span className="font-semibold text-gray-900">{stats.memberCount}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {activeSettingsTab === "Permissions" && (
                        <div className="space-y-6">
                            <p className="text-sm text-gray-500 mb-4">Control what members can do in this workspace.</p>

                            <div className="flex items-center justify-between py-4 border-b border-gray-100">
                                <div>
                                    <h4 className="text-sm font-bold text-gray-900">Channel Creation</h4>
                                    <p className="text-sm text-gray-500 mt-1">Allow members to create new channels</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={permissions.allowMemberChannelCreation}
                                        onChange={(e) => handlePermissionChange('allowMemberChannelCreation', e.target.checked)}
                                        disabled={savingPermissions || !isAdmin}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
                                </label>
                            </div>

                            <div className="flex items-center justify-between py-4 border-b border-gray-100">
                                <div>
                                    <h4 className="text-sm font-bold text-gray-900">Invite Members</h4>
                                    <p className="text-sm text-gray-500 mt-1">Allow members to invite new people</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={permissions.allowMemberInvite}
                                        onChange={(e) => handlePermissionChange('allowMemberInvite', e.target.checked)}
                                        disabled={savingPermissions || !isAdmin}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
                                </label>
                            </div>

                            <div className="flex items-center justify-between py-4 border-b border-gray-100">
                                <div>
                                    <h4 className="text-sm font-bold text-gray-900">Admin Approval Required</h4>
                                    <p className="text-sm text-gray-500 mt-1">Require admin approval for new members</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={permissions.requireAdminApproval}
                                        onChange={(e) => handlePermissionChange('requireAdminApproval', e.target.checked)}
                                        disabled={savingPermissions || !isAdmin}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
                                </label>
                            </div>

                            <div className="flex items-center justify-between py-4">
                                <div>
                                    <h4 className="text-sm font-bold text-gray-900">Workspace Discoverable</h4>
                                    <p className="text-sm text-gray-500 mt-1">Make workspace visible in search</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={permissions.isDiscoverable}
                                        onChange={(e) => handlePermissionChange('isDiscoverable', e.target.checked)}
                                        disabled={savingPermissions || !isAdmin}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
                                </label>
                            </div>

                            {!isAdmin && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mt-4">
                                    <p className="text-sm text-yellow-800"><strong>Note:</strong> Only workspace administrators can change permissions.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeSettingsTab === "Members" && (
                        <div>
                            <p className="text-sm text-gray-500 mb-6">Manage who has access to this workspace.</p>

                            {loadingMembers ? (
                                <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-200">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                                    <p className="text-gray-500 text-sm mt-4">Loading members...</p>
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
                                                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                                                        Owner{owners.length > 1 ? 's' : ''} ({owners.length})
                                                    </h3>
                                                </div>
                                                <div className="space-y-2">
                                                    {owners.map((member) => (
                                                        <div
                                                            key={member.id}
                                                            className="flex items-center justify-between p-3 rounded-xl hover:bg-yellow-50 transition-colors border border-yellow-100 bg-yellow-50/30"
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
                                                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold">
                                                                            {member.name.charAt(0).toUpperCase()}
                                                                        </div>
                                                                    )}
                                                                    {member.status === 'online' && (
                                                                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="font-semibold text-gray-900 truncate">{member.name}</div>
                                                                        {member.isCurrentUser && (
                                                                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded">You</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500 truncate">{member.email}</div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold border bg-yellow-100 text-yellow-800 border-yellow-200">
                                                                    Owner
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
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
                                                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                                                        Admin{admins.length > 1 ? 's' : ''} ({admins.length})
                                                    </h3>
                                                </div>
                                                <div className="space-y-2">
                                                    {admins.map((member) => (
                                                        <div
                                                            key={member.id}
                                                            className="flex items-center justify-between p-3 rounded-xl hover:bg-blue-50 transition-colors border border-blue-100 bg-blue-50/30"
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
                                                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                                                                            {member.name.charAt(0).toUpperCase()}
                                                                        </div>
                                                                    )}
                                                                    {member.status === 'online' && (
                                                                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="font-semibold text-gray-900 truncate">{member.name}</div>
                                                                        {member.isCurrentUser && (
                                                                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded">You</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500 truncate">{member.email}</div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {member.memberStatus === 'suspended' && (
                                                                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full flex items-center gap-1">
                                                                        <Pause className="w-3 h-3" />
                                                                        Suspended
                                                                    </span>
                                                                )}
                                                                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold border bg-blue-100 text-blue-800 border-blue-200">
                                                                    Admin
                                                                </span>
                                                                {isAdmin && !member.isCurrentUser && (
                                                                    <div className="relative">
                                                                        <button
                                                                            onClick={() => setOpenMemberDropdown(openMemberDropdown === member.id ? null : member.id)}
                                                                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                                                            disabled={memberActionLoading[member.id]}
                                                                        >
                                                                            <MoreVertical className="w-4 h-4 text-gray-600" />
                                                                        </button>
                                                                        {openMemberDropdown === member.id && (
                                                                            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px] z-10">
                                                                                {member.memberStatus === 'suspended' ? (
                                                                                    <button
                                                                                        onClick={() => handleRestoreMember(member.id)}
                                                                                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-green-600"
                                                                                    >
                                                                                        <Play className="w-4 h-4" />
                                                                                        Restore Access
                                                                                    </button>
                                                                                ) : (
                                                                                    <>
                                                                                        <button
                                                                                            onClick={() => handleChangeRole(member.id, 'admin')}
                                                                                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-blue-600"
                                                                                        >
                                                                                            <UserCheck className="w-4 h-4" />
                                                                                            Demote to Member
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={() => handleSuspendMember(member.id)}
                                                                                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-yellow-700"
                                                                                        >
                                                                                            <Pause className="w-4 h-4" />
                                                                                            Suspend Member
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={() => handleRemoveMember(member.id)}
                                                                                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
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
                                                    ))}
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
                                                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                                                        Member{regularMembers.length > 1 ? 's' : ''} ({regularMembers.length})
                                                    </h3>
                                                </div>
                                                <div className="space-y-2">
                                                    {regularMembers.map((member) => (
                                                        <div
                                                            key={member.id}
                                                            className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100"
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
                                                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white font-bold">
                                                                            {member.name.charAt(0).toUpperCase()}
                                                                        </div>
                                                                    )}
                                                                    {member.status === 'online' && (
                                                                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="font-semibold text-gray-900 truncate">{member.name}</div>
                                                                        {member.isCurrentUser && (
                                                                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded">You</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500 truncate">{member.email}</div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {member.memberStatus === 'suspended' && (
                                                                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full flex items-center gap-1">
                                                                        <Pause className="w-3 h-3" />
                                                                        Suspended
                                                                    </span>
                                                                )}
                                                                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold border bg-gray-100 text-gray-800 border-gray-200">
                                                                    Member
                                                                </span>
                                                                {isAdmin && !member.isCurrentUser && (
                                                                    <div className="relative">
                                                                        <button
                                                                            onClick={() => setOpenMemberDropdown(openMemberDropdown === member.id ? null : member.id)}
                                                                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                                                            disabled={memberActionLoading[member.id]}
                                                                        >
                                                                            <MoreVertical className="w-4 h-4 text-gray-600" />
                                                                        </button>
                                                                        {openMemberDropdown === member.id && (
                                                                            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px] z-10">
                                                                                {member.memberStatus === 'suspended' ? (
                                                                                    <button
                                                                                        onClick={() => handleRestoreMember(member.id)}
                                                                                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-green-600"
                                                                                    >
                                                                                        <Play className="w-4 h-4" />
                                                                                        Restore Access
                                                                                    </button>
                                                                                ) : (
                                                                                    <>
                                                                                        <button
                                                                                            onClick={() => handleChangeRole(member.id, 'member')}
                                                                                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-blue-600"
                                                                                        >
                                                                                            <Shield className="w-4 h-4" />
                                                                                            Promote to Admin
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={() => handleSuspendMember(member.id)}
                                                                                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-yellow-700"
                                                                                        >
                                                                                            <Pause className="w-4 h-4" />
                                                                                            Suspend Member
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={() => handleRemoveMember(member.id)}
                                                                                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
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
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-200 border-dashed">
                                    <div className="text-gray-400 mb-2">👥</div>
                                    <p className="text-gray-500 text-sm">No members found</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeSettingsTab === "Invitations" && (
                        <InvitationsTab
                            activeWorkspace={activeWorkspace}
                            isAdmin={isAdmin}
                        />
                    )}

                    {activeSettingsTab === "Billing" && (
                        <div>
                            {loadingStats ? (
                                <div className="text-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                                    <p className="text-gray-500">Loading workspace statistics...</p>
                                </div>
                            ) : (
                                <>
                                    <div className="text-center py-8 mb-8 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
                                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                                            ✨
                                        </div>
                                        <h3 className="text-lg font-bold text-green-900 mb-2">FREE Plan</h3>
                                        <p className="text-green-700">Currently using the free tier</p>
                                    </div>

                                    {stats && (
                                        <div className="space-y-4">
                                            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Workspace Usage</h3>

                                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                                        <Users size={20} className="text-blue-600" />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-semibold text-gray-900">Members</div>
                                                        <div className="text-xs text-gray-500">Total workspace members</div>
                                                    </div>
                                                </div>
                                                <div className="text-2xl font-bold text-gray-900">{stats.memberCount}</div>
                                            </div>

                                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                                        <Hash size={20} className="text-purple-600" />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-semibold text-gray-900">Channels</div>
                                                        <div className="text-xs text-gray-500">Active channels</div>
                                                    </div>
                                                </div>
                                                <div className="text-2xl font-bold text-gray-900">{stats.channelCount}</div>
                                            </div>

                                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                                        <MessageSquare size={20} className="text-green-600" />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-semibold text-gray-900">Messages</div>
                                                        <div className="text-xs text-gray-500">Total messages sent</div>
                                                    </div>
                                                </div>
                                                <div className="text-2xl font-bold text-gray-900">{stats.messageCount}</div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {activeSettingsTab === "Advanced" && (
                        <div>
                            {isAdmin ? (
                                <div className="bg-red-50/50 border border-red-100 rounded-2xl p-8">
                                    <h3 className="text-lg font-bold text-red-900 mb-2">Danger Zone</h3>
                                    <p className="text-sm text-red-700/80 mb-8 leading-relaxed">
                                        Deleting a workspace is permanent and cannot be undone. All messages, files, and data will be lost forever.
                                        <br />
                                        <strong>Only administrators can perform this action.</strong>
                                    </p>
                                    <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-red-100 shadow-sm">
                                        <div>
                                            <h4 className="text-sm font-bold text-gray-900">Delete this workspace</h4>
                                            <p className="text-xs text-gray-500 mt-1">Once deleted, it's gone for good.</p>
                                        </div>
                                        <button
                                            onClick={() => setShowDeleteConfirm(true)}
                                            className="px-5 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 shadow-md hover:shadow-lg transition-all"
                                        >
                                            Delete Workspace
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-200">
                                    <div className="text-gray-400 mb-2 text-4xl">🔒</div>
                                    <p className="text-gray-500 font-semibold">Admin Access Required</p>
                                    <p className="text-sm text-gray-400 mt-2">Only workspace administrators can access advanced settings.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Close Button */}
                <button
                    onClick={() => setShowSettingsModal(false)}
                    className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 bg-white rounded-full p-1 hover:bg-gray-100 transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        </div >
    );
};

export default WorkspaceSettingsModal;
