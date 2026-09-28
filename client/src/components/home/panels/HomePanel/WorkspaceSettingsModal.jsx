import React, { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '../../../../contexts/WorkspaceContext';
import { useToast } from '../../../../contexts/ToastContext';
import api from '@services/api';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import InvitationsTab from '../../../workspace/settings/InvitationsTab';
import MembersTab from '../../../workspace/settings/MembersTab';
import PermissionsTab from '../../../workspace/settings/PermissionsTab';
import GeneralTab from '../../../workspace/settings/GeneralTab';
import BillingTab from '../../../workspace/settings/BillingTab';
import AdvancedTab from '../../../workspace/settings/AdvancedTab';
import FeaturesTab from '../../../workspace/settings/FeaturesTab';
import DataTab from '../../../workspace/settings/DataTab';
import WorkspaceAnalyticsDashboard from '../../../../pages/workspace-os/WorkspaceAnalyticsDashboard';
import { useFlag } from '../../../../contexts/FeatureFlagsContext';
import logger from '../../../../utils/logger';
import { DEFAULT_WORKSPACE_COLOR } from '../../../../utils/workspaceIcons';

const PERMISSION_KEYS = ['allowMemberChannelCreation', 'allowMemberInvite', 'requireAdminApproval', 'isDiscoverable'];
const permissionsFrom = (ws) => Object.fromEntries(PERMISSION_KEYS.map(k => [k, !!ws?.settings?.[k]]));

const WorkspaceSettingsModal = ({ showSettingsModal, setShowSettingsModal, setShowDeleteConfirm }) => {
    const { activeWorkspace, refreshWorkspace } = useWorkspace();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [leaving, setLeaving] = useState(false);
    const [activeSettingsTab, setActiveSettingsTab] = useState("General");

    
    const [workspaceName, setWorkspaceName] = useState(activeWorkspace?.name || '');
    const [newWorkspaceName, setNewWorkspaceName] = useState(activeWorkspace?.name || '');
    const [editingIcon, setEditingIcon] = useState(false);
    const [selectedIcon, setSelectedIcon] = useState(activeWorkspace?.icon || 'rocket');
    const [selectedColor, setSelectedColor] = useState(activeWorkspace?.color || DEFAULT_WORKSPACE_COLOR);
    const [savingIcon, setSavingIcon] = useState(false);
    const [savingName, setSavingName] = useState(false);
    const [workspaceRules, setWorkspaceRules] = useState(activeWorkspace?.rules || "");
    const [editingRules, setEditingRules] = useState(false);
    const [savingRules, setSavingRules] = useState(false);

    
    // Seeded from GET /api/workspaces/my `settings`.
    const [permissions, setPermissions] = useState(() => permissionsFrom(activeWorkspace));
    const [savingPermissions, setSavingPermissions] = useState(false);

    
    const [members, setMembers] = useState([]);
    const [loadingMembers, setLoadingMembers] = useState(true);
    const [openMemberDropdown, setOpenMemberDropdown] = useState(null);
    const [memberActionLoading, setMemberActionLoading] = useState({});

    
    const [stats, setStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(true);

    const isOwner = activeWorkspace?.role === 'owner' || !!activeWorkspace?.isOwner;
    const isAdmin = isOwner || activeWorkspace?.role === 'admin';
    const billingEnabled = useFlag('billing');
    useEffect(() => {
        if (!showSettingsModal) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setShowSettingsModal(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [showSettingsModal, setShowSettingsModal]);

    const fetchStats = useCallback(async () => {
        if (!activeWorkspace?.id) return;
        setLoadingStats(true);
        try {
            const response = await api.get(`/api/workspaces/${activeWorkspace.id}/stats`);
            setStats(response.data);
        } catch (error) {
            logger.warn('Stats not available:', error?.response?.status);
        } finally {
            setLoadingStats(false);
        }
    }, [activeWorkspace?.id]);

    const fetchMembers = useCallback(async () => {
        if (!activeWorkspace?.id) return;
        setLoadingMembers(true);
        try {
            const response = await api.get(`/api/workspaces/${activeWorkspace.id}/members`);
            const raw = response.data?.members || response.data || [];
            // Presence is `status`/`isOnline`; membership state is `membershipStatus`.
            const normalised = raw.map(m => ({
                id: m._id || m.id,
                name: m.username || m.name || m.email || 'Unknown',
                email: m.email,
                avatar: m.profilePicture || m.avatar || null,
                status: m.isOnline ? 'online' : 'offline',
                memberStatus: m.membershipStatus || 'active',
                role: m.role || 'member',
                joinedAt: m.joinedAt,
                isCurrentUser: !!m.isCurrentUser,
            }));
            setMembers(normalised);
        } catch (error) {
            logger.error('Error fetching members:', error);
            showToast(error.response?.data?.message || 'Could not load members', 'error');
        } finally {
            setLoadingMembers(false);
        }
    }, [activeWorkspace?.id, showToast]);

    useEffect(() => {
        if (activeWorkspace) {
            setWorkspaceName(activeWorkspace.name || '');
            setNewWorkspaceName(activeWorkspace.name || '');
            setSelectedIcon(activeWorkspace.icon || 'rocket');
            setSelectedColor(activeWorkspace.color || DEFAULT_WORKSPACE_COLOR);
            setWorkspaceRules(activeWorkspace.rules || "");
            setPermissions(permissionsFrom(activeWorkspace));
        }
    }, [activeWorkspace]);

    useEffect(() => {
        if (showSettingsModal && activeWorkspace?.id) {
            fetchStats();
            fetchMembers();
        }
    }, [showSettingsModal, activeWorkspace?.id, fetchStats, fetchMembers]);

    const handlePermissionChange = async (permissionKey, value) => {
        if (!isAdmin) return;
        try {
            setSavingPermissions(true);
            await api.put(`/api/workspaces/${activeWorkspace.id}`, { settings: { [permissionKey]: value } });
            setPermissions(prev => ({ ...prev, [permissionKey]: value }));
            showToast('Permission updated successfully', 'success');
            await refreshWorkspace();
        } catch (error) {
            logger.error('Error updating permission:', error);
            showToast(error.response?.data?.message || 'Failed to update permission', 'error');
        } finally {
            setSavingPermissions(false);
        }
    };

    const handleLeave = async () => {
        if (!activeWorkspace?.id || isOwner) return;
        setLeaving(true);
        try {
            await api.post(`/api/workspaces/${activeWorkspace.id}/leave`);
            showToast(`You left ${activeWorkspace.name}`, 'success');
            setShowSettingsModal(false);
            navigate('/workspaces', { replace: true });
        } catch (error) {
            showToast(error.response?.data?.message || 'Could not leave the workspace', 'error');
        } finally {
            setLeaving(false);
        }
    };

    if (!showSettingsModal) return null;

    const tabs = isAdmin
        ? ["General", "Permissions", "Members", "Invitations", "Features", "Analytics", "Data", ...(billingEnabled ? ["Billing"] : []), "Advanced"]
        : ["General", "Members"];

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: 'var(--bg-overlay)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', boxSizing: 'border-box', fontFamily: 'var(--font)' }}
            onClick={e => { if (e.target === e.currentTarget) setShowSettingsModal(false); }}
        >
            <div role="dialog" aria-modal="true" aria-label="Workspace settings" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', width: '100%', maxWidth: '860px', height: 'min(640px, calc(100vh - 32px))', display: 'flex', overflow: 'hidden', position: 'relative' }}>

                {}
                <div style={{ width: '184px', background: 'var(--bg-base)', borderRight: '1px solid var(--border-subtle)', padding: '20px 0', flexShrink: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                    <div style={{ padding: '0 16px 12px', fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                        Settings
                    </div>
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: '1px', padding: '0 8px' }}>
                        {tabs.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveSettingsTab(tab)}
                                style={{
                                    width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: '13px', fontWeight: 500,
                                    borderRadius: '2px', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)',
                                    transition: '150ms ease',
                                    background: activeSettingsTab === tab ? 'var(--bg-hover)' : 'none',
                                    color: activeSettingsTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    borderLeft: activeSettingsTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                                }}
                                onMouseEnter={e => { if (activeSettingsTab !== tab) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                                onMouseLeave={e => { if (activeSettingsTab !== tab) { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                            >
                                {tab}
                            </button>
                        ))}
                    </nav>
                </div>

                {}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {}
                    <div style={{ padding: '18px 28px 14px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                        <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                            {activeSettingsTab}
                        </h2>
                    </div>

                    {}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }} className="custom-scrollbar">
                        {activeSettingsTab === "General" && (
                            <GeneralTab
                                activeWorkspace={activeWorkspace} isAdmin={isAdmin}
                                workspaceName={workspaceName} setWorkspaceName={setWorkspaceName}
                                newWorkspaceName={newWorkspaceName} setNewWorkspaceName={setNewWorkspaceName}
                                editingIcon={editingIcon} setEditingIcon={setEditingIcon}
                                selectedIcon={selectedIcon} setSelectedIcon={setSelectedIcon}
                                selectedColor={selectedColor} setSelectedColor={setSelectedColor}
                                savingIcon={savingIcon} setSavingIcon={setSavingIcon}
                                savingName={savingName} setSavingName={setSavingName}
                                workspaceRules={workspaceRules} setWorkspaceRules={setWorkspaceRules}
                                editingRules={editingRules} setEditingRules={setEditingRules}
                                savingRules={savingRules} setSavingRules={setSavingRules}
                                stats={stats} loadingStats={loadingStats}
                                refreshWorkspace={refreshWorkspace}
                                isOwner={isOwner} onLeave={handleLeave} leaving={leaving}
                            />
                        )}
                        {activeSettingsTab === "Permissions" && (
                            <PermissionsTab isAdmin={isAdmin} permissions={permissions} savingPermissions={savingPermissions} handlePermissionChange={handlePermissionChange} />
                        )}
                        {activeSettingsTab === "Members" && (
                            <MembersTab
                                activeWorkspace={activeWorkspace} isAdmin={isAdmin} isOwner={isOwner}
                                members={members} loadingMembers={loadingMembers}
                                memberActionLoading={memberActionLoading}
                                openMemberDropdown={openMemberDropdown} setOpenMemberDropdown={setOpenMemberDropdown}
                                fetchMembers={fetchMembers} refreshWorkspace={refreshWorkspace}
                            />
                        )}
                        {activeSettingsTab === "Invitations" && (
                            <InvitationsTab activeWorkspace={activeWorkspace} isAdmin={isAdmin} />
                        )}
                        {activeSettingsTab === "Billing" && (
                            <BillingTab stats={stats} loadingStats={loadingStats} />
                        )}
                        {activeSettingsTab === "Features" && (
                            <FeaturesTab workspaceId={activeWorkspace?.id} isAdmin={isAdmin} />
                        )}
                        {activeSettingsTab === "Analytics" && (
                            <WorkspaceAnalyticsDashboard workspaceId={activeWorkspace?.id} workspaceName={activeWorkspace?.name} />
                        )}
                        {activeSettingsTab === "Data" && (
                            <DataTab workspaceId={activeWorkspace?.id} workspaceName={activeWorkspace?.name} />
                        )}
                        {activeSettingsTab === "Advanced" && (
                            <AdvancedTab isOwner={isOwner} setShowDeleteConfirm={setShowDeleteConfirm} />
                        )}
                    </div>
                </div>

                {}
                <button
                    onClick={() => setShowSettingsModal(false)}
                    aria-label="Close settings"
                    style={{ position: 'absolute', top: '14px', right: '14px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', borderRadius: '2px', transition: '150ms ease' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
};

export default WorkspaceSettingsModal;
