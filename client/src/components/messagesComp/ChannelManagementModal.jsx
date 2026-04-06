import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import api from '@services/api';
import { useToast } from "../../contexts/ToastContext";
import { API_BASE } from '@services/api';
import ConfirmationModal from "../../shared/components/ui/ConfirmationModal";

// Extracted view components
import ModalHeader from "./channelManagementComponents/ModalHeader";
import TabNavigation from "./channelManagementComponents/TabNavigation";
import MembersTab from "./channelManagementComponents/MembersTab";
import SettingsTab from "./channelManagementComponents/SettingsTab";
import InviteTab from "./channelManagementComponents/InviteTab";
import RemoveMemberModal from "./channelManagementComponents/RemoveMemberModal";
import PromoteAdminModal from "./channelManagementComponents/PromoteAdminModal";
import DemoteAdminModal from "./channelManagementComponents/DemoteAdminModal";
import IntegrationsTab from "./channelManagementComponents/IntegrationsTab";

export default function ChannelManagementModal({ channel, onClose, currentUserId, initialTab = "members" }) {
    const { workspaceId } = useParams();
    const { showToast } = useToast();

    const [members, setMembers] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState(initialTab);
    const [searchQuery, setSearchQuery] = useState('');
    const [showDebugInfo, setShowDebugInfo] = useState(false);
    const [privacyVerification, setPrivacyVerification] = useState("");
    const [deleteVerification, setDeleteVerification] = useState("");
    const [memberToRemove, setMemberToRemove] = useState(null);
    const [memberToPromote, setMemberToPromote] = useState(null);
    const [memberToDemote, setMemberToDemote] = useState(null);
    const [showClearMessagesConfirm, setShowClearMessagesConfirm] = useState(false);

    // Editing states
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState(channel?.name || "");
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [editedDescription, setEditedDescription] = useState(channel?.description || "");

    // Admin permission logic
    const isDefaultChannel = channel?.isDefault || ['general', 'announcements'].includes(channel?.name?.toLowerCase().replace(/^#/, ''));
    const isWorkspaceAdmin = channel?.workspaceRole === 'owner' || channel?.workspaceRole === 'admin';
    // createdBy can be a populated object {_id, username} or a raw ID string
    const createdByIdStr = channel?.createdBy?._id
        ? String(channel.createdBy._id)
        : String(channel?.createdBy || '');
    const isChannelCreator = !!currentUserId && createdByIdStr === String(currentUserId);
    // admins entries can be populated objects {_id, username} or raw ID strings
    const isPromotedAdmin = channel?.admins && Array.isArray(channel.admins)
        ? channel.admins.some(a => String(a?._id || a) === String(currentUserId))
        : false;
    const isAdmin = isDefaultChannel ? isWorkspaceAdmin : (isChannelCreator || isPromotedAdmin);

    const loadMembers = useCallback(async () => {
        if (!channel?.id) return;
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await api.get(`/api/channels/${channel.id}/members`);
            setMembers(res.data.members || []);
        } catch (err) {
            console.error("Load members failed:", err);
        }
    }, [channel?.id]);

    const loadAllUsers = useCallback(async () => {
        if (!channel?.workspaceId) return;
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await api.get(`/api/workspaces/${channel.workspaceId}/all-members`);
            setAllUsers(res.data.members || []);
        } catch (err) {
            console.error("❌ Load workspace members failed:", err);
        }
    }, [channel?.workspaceId]);

    useEffect(() => {
        loadMembers();
        loadAllUsers();
    }, [loadMembers, loadAllUsers]);

    useEffect(() => {
        if (activeTab === 'invite') {
            loadAllUsers();
        }
    }, [activeTab, loadAllUsers]);

    // Safety check
    if (!channel) {
        console.error("ChannelManagementModal: channel prop is undefined");
        onClose?.();
        return null;
    }

    const handleInvite = async (userId) => {
        if (!userId) return;
        setLoading(true);
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await api.post(`/api/channels/${channel.id}/invite`, { userId });
            loadMembers();
        } catch (err) {
            console.error("Invite failed:", err);
            showToast(err?.response?.data?.message || "Invite failed", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async (userId) => {
        setMemberToRemove(userId);
    };

    const confirmRemove = async () => {
        if (!memberToRemove) return;
        setLoading(true);
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await api.post(`/api/channels/${channel.id}/remove-member`, { userId: memberToRemove });
            showToast("Member removed successfully", "success");
            setMemberToRemove(null);
            loadMembers();
        } catch (err) {
            console.error("Remove failed:", err);
            showToast(err?.response?.data?.message || "Failed to remove member", "error");
        } finally {
            setLoading(false);
        }
    };

    const handlePromoteAdmin = async (userId) => {
        setMemberToPromote(userId);
    };

    const confirmPromote = async () => {
        if (!memberToPromote) return;
        setLoading(true);
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await api.post(`/api/channels/${channel.id}/assign-admin`, { userId: memberToPromote });
            showToast("Member promoted to admin successfully", "success");
            setMemberToPromote(null);
            await loadMembers();
        } catch (err) {
            console.error("Promote failed:", err);
            showToast(err?.response?.data?.message || "Failed to promote member", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleDemoteAdmin = async (userId) => {
        setMemberToDemote(userId);
    };

    const confirmDemote = async () => {
        if (!memberToDemote) return;
        setLoading(true);
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await api.post(`/api/channels/${channel.id}/demote-admin`, { userId: memberToDemote });
            const isSelf = String(memberToDemote) === String(currentUserId);
            showToast(isSelf ? "You have withdrawn as admin" : "Admin demoted to member successfully", "success");
            setMemberToDemote(null);
            await loadMembers();
        } catch (err) {
            console.error("Demote failed:", err);
            showToast(err?.response?.data?.message || "Failed to demote admin", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePrivacy = async () => {
        if (channel.isPrivate) {
            if (privacyVerification !== channel.name) {
                showToast("Please type the channel name correctly to make it public.", "error");
                return;
            }
        }

        setLoading(true);
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const newPrivacy = !channel.isPrivate;
            await api.patch(`/api/channels/${channel.id}/privacy`, { isPrivate: newPrivacy });
            showToast(
                `Channel is now ${newPrivacy ? "Private" : "Public"}. ${newPrivacy ? "Only invited members can see it." : "Everyone in workspace can access it."}`,
                "success"
            );
            setPrivacyVerification("");
            // Close modal — 'channel-updated' socket event propagates the change reactively
            setTimeout(() => onClose?.(), 800);
        } catch (err) {
            console.error("Toggle privacy failed:", err);
            showToast(err?.response?.data?.message || "Failed to change channel privacy", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePublic = async (newIsPublic) => {
        setLoading(true);
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await api.patch(`/api/channels/${channel.id}/make-public`, { isPublic: newIsPublic });
            showToast(
                newIsPublic
                    ? "Channel is now publicly accessible via link."
                    : "Public link disabled. Channel is now workspace-only.",
                "success"
            );
            // Update local channel state
            channel.isPublic = newIsPublic;
        } catch (err) {
            console.error("Toggle public failed:", err);
            showToast(err?.response?.data?.message || "Failed to change public status", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteChannel = async () => {
        if (deleteVerification !== channel.name) {
            showToast("Please type the channel name correctly to delete it.", "error");
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await api.delete(`/api/channels/${channel.id}`);
            showToast(`Channel ${channel.name} has been permanently deleted`, "success");
            setTimeout(() => {
                window.location.href = `/workspace/${workspaceId}/home`;
            }, 1000);
        } catch (err) {
            console.error("Delete channel failed:", err);
            showToast(err?.response?.data?.message || "Failed to delete channel", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleClearMessages = async () => {
        setShowClearMessagesConfirm(true);
    };

    const confirmClearMessages = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await api.delete(`/api/channels/${channel.id}/messages`);
            showToast("All messages have been cleared from this channel", "success");
            setShowClearMessagesConfirm(false);
            // 'messages-cleared' socket event empties the chat window reactively
        } catch (err) {
            console.error("Clear messages failed:", err);
            showToast(err?.response?.data?.message || "Failed to clear messages", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateName = async () => {
        if (!editedName.trim()) {
            showToast("Channel name cannot be empty", "error");
            return;
        }
        if (editedName === channel.name) {
            setIsEditingName(false);
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await api.patch(`/api/channels/${channel.id}/name`, { name: editedName });
            showToast("Channel name updated successfully", "success");
            setIsEditingName(false);
            setEditedName(editedName.trim().toLowerCase());
            // 'channel-updated' socket event propagates the new name to all clients reactively
        } catch (err) {
            console.error("Update name failed:", err);
            showToast(err?.response?.data?.message || "Failed to update channel name", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateDescription = async () => {
        if (editedDescription === channel.description) {
            setIsEditingDescription(false);
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await api.patch(`/api/channels/${channel.id}/description`, { description: editedDescription });
            showToast("Channel description updated successfully", "success");
            setIsEditingDescription(false);
            channel.description = editedDescription;
        } catch (err) {
            console.error("Update description failed:", err);
            showToast(err?.response?.data?.message || "Failed to update channel description", "error");
        } finally {
            setLoading(false);
        }
    };

    const nonMembers = allUsers.filter(
        (u) => !members.some((m) => String(m._id) === String(u._id))
    );

    const filteredNonMembers = searchQuery
        ? nonMembers.filter(user =>
            user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : nonMembers;

    return (
        <>
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)', fontFamily: 'var(--font)' }}>
                <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-accent)', borderRadius: '2px', width: '100%', maxWidth: '680px', maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }}>
                    <ModalHeader
                        channel={channel}
                        members={members}
                        onClose={onClose}
                        activeTab={activeTab}
                        showDebugInfo={showDebugInfo}
                        onToggleDebugInfo={() => setShowDebugInfo(!showDebugInfo)}
                    />

                    <TabNavigation
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        isAdmin={isAdmin}
                    />

                    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }} className="custom-scrollbar">
                        {activeTab === "members" && (
                            <MembersTab
                                members={members}
                                channel={channel}
                                currentUserId={currentUserId}
                                isAdmin={isAdmin}
                                loading={loading}
                                onPromoteAdmin={handlePromoteAdmin}
                                onDemoteAdmin={handleDemoteAdmin}
                                onRemoveMember={handleRemove}
                            />
                        )}

                        {activeTab === "settings" && isAdmin && (
                            <SettingsTab
                                channel={channel}
                                isDefaultChannel={isDefaultChannel}
                                isEditingName={isEditingName}
                                editedName={editedName}
                                onEditedNameChange={setEditedName}
                                onStartEditName={() => setIsEditingName(true)}
                                onSaveName={handleUpdateName}
                                onCancelEditName={() => {
                                    setEditedName(channel.name);
                                    setIsEditingName(false);
                                }}
                                isEditingDescription={isEditingDescription}
                                editedDescription={editedDescription}
                                onEditedDescriptionChange={setEditedDescription}
                                onStartEditDescription={() => setIsEditingDescription(true)}
                                onSaveDescription={handleUpdateDescription}
                                onCancelEditDescription={() => {
                                    setEditedDescription(channel.description || "");
                                    setIsEditingDescription(false);
                                }}
                                privacyVerification={privacyVerification}
                                onPrivacyVerificationChange={setPrivacyVerification}
                                onTogglePrivacy={handleTogglePrivacy}
                                onTogglePublic={handleTogglePublic}
                                deleteVerification={deleteVerification}
                                onDeleteVerificationChange={setDeleteVerification}
                                onDeleteChannel={handleDeleteChannel}
                                onClearMessages={handleClearMessages}
                                loading={loading}
                            />
                        )}

                        {activeTab === "invite" && (
                            <InviteTab
                                searchQuery={searchQuery}
                                onSearchQueryChange={setSearchQuery}
                                filteredNonMembers={filteredNonMembers}
                                allUsers={allUsers}
                                members={members}
                                channel={channel}
                                showDebugInfo={showDebugInfo}
                                onInvite={handleInvite}
                                loading={loading}
                            />
                        )}

                        {activeTab === "integrations" && (
                            <IntegrationsTab />
                        )}
                    </div>
                </div>
            </div>

            <RemoveMemberModal
                isOpen={!!memberToRemove}
                onClose={() => setMemberToRemove(null)}
                onConfirm={confirmRemove}
                loading={loading}
            />

            <PromoteAdminModal
                isOpen={!!memberToPromote}
                onClose={() => setMemberToPromote(null)}
                onConfirm={confirmPromote}
                loading={loading}
            />

            <DemoteAdminModal
                isOpen={!!memberToDemote}
                onClose={() => setMemberToDemote(null)}
                onConfirm={confirmDemote}
                isSelf={String(memberToDemote) === String(currentUserId)}
                loading={loading}
            />

            <ConfirmationModal
                isOpen={showClearMessagesConfirm}
                onClose={() => setShowClearMessagesConfirm(false)}
                onConfirm={confirmClearMessages}
                title="Clear All Messages"
                message="Are you sure you want to clear all messages in this channel? This action cannot be undone."
                confirmText="Clear History"
                cancelText="Cancel"
                variant="danger"
            />
        </>
    );
}
