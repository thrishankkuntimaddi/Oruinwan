import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { useToast } from "../../contexts/ToastContext";
import { API_BASE } from "../../services/api";
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
    const isChannelCreator = String(channel?.createdBy) === String(currentUserId);
    const isPromotedAdmin = channel?.admins && Array.isArray(channel.admins)
        ? channel.admins.some(adminId => String(adminId) === String(currentUserId))
        : false;
    const isAdmin = isDefaultChannel ? isWorkspaceAdmin : (isChannelCreator || isPromotedAdmin);

    const loadMembers = useCallback(async () => {
        if (!channel?.id) return;
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.get(`${API_BASE}/api/channels/${channel.id}/members`, { headers });
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
            const res = await axios.get(`${API_BASE}/api/workspaces/${channel.workspaceId}/all-members`, { headers });
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
            await axios.post(`${API_BASE}/api/channels/${channel.id}/invite`, { userId }, { headers });
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
            await axios.post(`${API_BASE}/api/channels/${channel.id}/remove-member`,
                { userId: memberToRemove },
                { headers }
            );
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
            await axios.post(`${API_BASE}/api/channels/${channel.id}/assign-admin`,
                { userId: memberToPromote },
                { headers }
            );
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
            await axios.post(`${API_BASE}/api/channels/${channel.id}/demote-admin`,
                { userId: memberToDemote },
                { headers }
            );
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
            await axios.patch(
                `${API_BASE}/api/channels/${channel.id}/privacy`,
                { isPrivate: newPrivacy },
                { headers }
            );
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

    const handleDeleteChannel = async () => {
        if (deleteVerification !== channel.name) {
            showToast("Please type the channel name correctly to delete it.", "error");
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem("accessToken");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.delete(`${API_BASE}/api/channels/${channel.id}`, { headers });
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
            await axios.delete(`${API_BASE}/api/channels/${channel.id}/messages`, { headers });
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
            await axios.patch(`${API_BASE}/api/channels/${channel.id}/name`,
                { name: editedName },
                { headers }
            );
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
            await axios.patch(`${API_BASE}/api/channels/${channel.id}/description`,
                { description: editedDescription },
                { headers }
            );
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
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-sm animate-fade-in">
                <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col border border-gray-200 dark:border-gray-800">
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

                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
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
