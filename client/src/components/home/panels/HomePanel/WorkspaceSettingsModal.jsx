import React, { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '../../../../contexts/WorkspaceContext';
import { useToast } from '../../../../contexts/ToastContext';
import api from '@services/api';

// Import extracted tab components
import InvitationsTab from '../../../workspace/settings/InvitationsTab';
import MembersTab from '../../../workspace/settings/MembersTab';
import PermissionsTab from '../../../workspace/settings/PermissionsTab';
import GeneralTab from '../../../workspace/settings/GeneralTab';
import BillingTab from '../../../workspace/settings/BillingTab';
import AdvancedTab from '../../../workspace/settings/AdvancedTab';

/**
 * WorkspaceSettingsModal Component
 * Main orchestrator for workspace settings with tabbed interface
 * Delegates rendering to extracted tab components
 */
const WorkspaceSettingsModal = ({ showSettingsModal, setShowSettingsModal, setShowDeleteConfirm }) => {
    const { activeWorkspace, refreshWorkspace } = useWorkspace();
    const { showToast } = useToast();
    const [activeSettingsTab, setActiveSettingsTab] = useState("General");

    // General Tab State
    const [workspaceName, setWorkspaceName] = useState(activeWorkspace?.name || '');
    const [newWorkspaceName, setNewWorkspaceName] = useState(activeWorkspace?.name || '');
    const [editingIcon, setEditingIcon] = useState(false);
    const [selectedIcon, setSelectedIcon] = useState(activeWorkspace?.icon || 'rocket');
    const [selectedColor, setSelectedColor] = useState(activeWorkspace?.color || '#2563eb');
    const [savingIcon, setSavingIcon] = useState(false);
    const [savingName, setSavingName] = useState(false);
    const [workspaceRules, setWorkspaceRules] = useState(activeWorkspace?.rules || "");
    const [editingRules, setEditingRules] = useState(false);
    const [savingRules, setSavingRules] = useState(false);

    // Permissions Tab State
    const [permissions, setPermissions] = useState({
        allowMemberChannelCreation: activeWorkspace?.allowMemberChannelCreation || false,
        allowMemberInvite: activeWorkspace?.allowMemberInvite || false,
        requireAdminApproval: activeWorkspace?.requireAdminApproval || false,
        isDiscoverable: activeWorkspace?.isDiscoverable || false
    });
    const [savingPermissions, setSavingPermissions] = useState(false);

    // Members Tab State
    const [members, setMembers] = useState([]);
    const [loadingMembers, setLoadingMembers] = useState(true);
    const [openMemberDropdown, setOpenMemberDropdown] = useState(null);
    const [memberActionLoading, setMemberActionLoading] = useState({});

    // Stats State (for General and Billing tabs)
    const [stats, setStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(true);

    // Derived state
    const isAdmin = activeWorkspace?.role === 'admin' || activeWorkspace?.role === 'owner';

    // Fetch workspace stats
    const fetchStats = useCallback(async () => {
        if (!activeWorkspace?.id) return;

        setLoadingStats(true);
        try {
            // Route uses :workspaceId param
            const response = await api.get(`/api/workspaces/${activeWorkspace.id}/stats`);
            setStats(response.data);
        } catch (error) {
            // Stats are non-critical — don't crash the modal
            console.warn('Stats not available:', error?.response?.status);
        } finally {
            setLoadingStats(false);
        }
    }, [activeWorkspace?.id]);

    // Fetch workspace members
    const fetchMembers = useCallback(async () => {
        if (!activeWorkspace?.id) return;

        setLoadingMembers(true);
        try {
            const response = await api.get(`/api/workspaces/${activeWorkspace.id}/members`);
            // Backend returns { members: [...] } — extract the array and normalise to the
            // shape that MembersTab expects (name, avatar, id, status, role, isCurrentUser)
            const raw = response.data?.members || response.data || [];
            const currentUserId = activeWorkspace?.currentUserId;
            const normalised = raw.map(m => ({
                id: m._id || m.id,
                name: m.username || m.name || m.email || 'Unknown',
                email: m.email,
                avatar: m.profilePicture || m.avatar || null,
                status: m.isOnline ? 'online' : 'offline',
                memberStatus: m.status || 'active',
                role: m.role || 'member',
                isCurrentUser: currentUserId
                    ? String(m._id || m.id) === String(currentUserId)
                    : false,
            }));
            setMembers(normalised);
        } catch (error) {
            console.error('Error fetching members:', error);
        } finally {
            setLoadingMembers(false);
        }
    }, [activeWorkspace?.id, activeWorkspace?.currentUserId]);


    // Initialize state when workspace changes
    useEffect(() => {
        if (activeWorkspace) {
            setWorkspaceName(activeWorkspace.name || '');
            setNewWorkspaceName(activeWorkspace.name || '');
            setSelectedIcon(activeWorkspace.icon || 'rocket');
            setSelectedColor(activeWorkspace.color || '#2563eb');
            setWorkspaceRules(activeWorkspace.rules || "");
            setPermissions({
                allowMemberChannelCreation: activeWorkspace.allowMemberChannelCreation || false,
                allowMemberInvite: activeWorkspace.allowMemberInvite || false,
                requireAdminApproval: activeWorkspace.requireAdminApproval || false,
                isDiscoverable: activeWorkspace.isDiscoverable || false
            });
        }
    }, [activeWorkspace]);

    // Fetch data when modal opens
    useEffect(() => {
        if (showSettingsModal && activeWorkspace?.id) {
            fetchStats();
            fetchMembers();
        }
    }, [showSettingsModal, activeWorkspace?.id, fetchStats, fetchMembers]);

    // Handle permission changes
    const handlePermissionChange = async (permissionKey, value) => {
        if (!isAdmin) return;

        try {
            setSavingPermissions(true);
            await api.put(`/api/workspaces/${activeWorkspace.id}`, {
                [permissionKey]: value
            });

            setPermissions(prev => ({ ...prev, [permissionKey]: value }));
            showToast('✅ Permission updated successfully', 'success');
            await refreshWorkspace();
        } catch (error) {
            console.error('Error updating permission:', error);
            showToast(error.response?.data?.message || 'Failed to update permission', 'error');
        } finally {
            setSavingPermissions(false);
        }
    };

    if (!showSettingsModal) return null;

    return (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center animate-fade-in backdrop-blur-md">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-[800px] h-[600px] flex overflow-hidden transform transition-all scale-100 border border-gray-100 dark:border-gray-700">
                {/* Sidebar */}
                <div className="w-56 bg-gray-50/80 dark:bg-gray-800/80 backdrop-blur-sm border-r border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-6 px-2">Settings</h3>
                    <nav className="space-y-1">
                        {(isAdmin
                            ? ["General", "Permissions", "Members", "Invitations", "Billing", "Advanced"]
                            : ["General", "Members"]
                        ).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveSettingsTab(tab)}
                                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${activeSettingsTab === tab
                                    ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-gray-200 dark:ring-gray-600"
                                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200"}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Content */}
                <div className="flex-1 p-10 overflow-y-auto bg-white dark:bg-gray-900">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">{activeSettingsTab}</h2>

                    {/* Render active tab component */}
                    {activeSettingsTab === "General" && (
                        <GeneralTab
                            activeWorkspace={activeWorkspace}
                            isAdmin={isAdmin}
                            workspaceName={workspaceName}
                            setWorkspaceName={setWorkspaceName}
                            newWorkspaceName={newWorkspaceName}
                            setNewWorkspaceName={setNewWorkspaceName}
                            editingIcon={editingIcon}
                            setEditingIcon={setEditingIcon}
                            selectedIcon={selectedIcon}
                            setSelectedIcon={setSelectedIcon}
                            selectedColor={selectedColor}
                            setSelectedColor={setSelectedColor}
                            savingIcon={savingIcon}
                            setSavingIcon={setSavingIcon}
                            savingName={savingName}
                            setSavingName={setSavingName}
                            workspaceRules={workspaceRules}
                            setWorkspaceRules={setWorkspaceRules}
                            editingRules={editingRules}
                            setEditingRules={setEditingRules}
                            savingRules={savingRules}
                            setSavingRules={setSavingRules}
                            stats={stats}
                            loadingStats={loadingStats}
                            refreshWorkspace={refreshWorkspace}
                        />
                    )}

                    {activeSettingsTab === "Permissions" && (
                        <PermissionsTab
                            isAdmin={isAdmin}
                            permissions={permissions}
                            savingPermissions={savingPermissions}
                            handlePermissionChange={handlePermissionChange}
                        />
                    )}

                    {activeSettingsTab === "Members" && (
                        <MembersTab
                            activeWorkspace={activeWorkspace}
                            isAdmin={isAdmin}
                            members={members}
                            loadingMembers={loadingMembers}
                            memberActionLoading={memberActionLoading}
                            openMemberDropdown={openMemberDropdown}
                            setOpenMemberDropdown={setOpenMemberDropdown}
                            fetchMembers={fetchMembers}
                            refreshWorkspace={refreshWorkspace}
                        />
                    )}

                    {activeSettingsTab === "Invitations" && (
                        <InvitationsTab
                            activeWorkspace={activeWorkspace}
                            isAdmin={isAdmin}
                        />
                    )}

                    {activeSettingsTab === "Billing" && (
                        <BillingTab
                            stats={stats}
                            loadingStats={loadingStats}
                        />
                    )}

                    {activeSettingsTab === "Advanced" && (
                        <AdvancedTab
                            isAdmin={isAdmin}
                            setShowDeleteConfirm={setShowDeleteConfirm}
                        />
                    )}
                </div>

                {/* Close Button */}
                <button
                    onClick={() => setShowSettingsModal(false)}
                    className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 bg-white dark:bg-gray-800 rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        </div >
    );
};

export default WorkspaceSettingsModal;
