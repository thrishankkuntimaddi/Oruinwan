import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, X } from 'lucide-react';
import ConfirmationModal from "../../../ui/ConfirmationModal";
import { useContacts } from "../../../../contexts/ContactsContext";
import { useAuth } from "../../../../contexts/AuthContext";
import { useToast } from "../../../../contexts/ToastContext";
// import { useUsers } from "../../../../hooks/useUsers"; // Currently unused
import { useWorkspace } from "../../../../contexts/WorkspaceContext";
import api from "../../../../services/api";
import { io } from "socket.io-client";

// Import sub-components
import WorkspaceHeader from "./WorkspaceHeader";
import SectionHeader from "./SectionHeader";
import ListItem from "./ListItem";
import WorkspaceModals from "./WorkspaceModals";
import WorkspaceSettingsModal from "./WorkspaceSettingsModal";
import DeleteWorkspaceModal from "./DeleteWorkspaceModal";
import { CreateChannelModal, NewDMModal } from "./ChannelDMModals";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

const HomePanel = ({ title }) => {
    const navigate = useNavigate();

    const { allItems: items, deleteItem, addItem, toggleFavorite, refreshContacts } = useContacts();
    const { accessToken } = useAuth(); // user removed - currently unused
    const { showToast } = useToast();
    const { activeWorkspace } = useWorkspace();

    // Refresh contacts (channels) when active workspace changes
    React.useEffect(() => {
        if (activeWorkspace?.id) {
            refreshContacts(activeWorkspace.id);
        }
    }, [activeWorkspace?.id, refreshContacts]);

    // ✅ AUTO-REFRESH: Refresh contacts when tab becomes visible
    React.useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && activeWorkspace?.id) {
                console.log('📱 Tab visible - refreshing contacts...');
                refreshContacts(activeWorkspace.id);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [activeWorkspace?.id, refreshContacts]);

    // ✅ PERIODIC REFRESH: Poll every 30 seconds
    React.useEffect(() => {
        if (!activeWorkspace?.id) return;

        const interval = setInterval(() => {
            console.log('🔄 Auto-refreshing contacts...');
            refreshContacts(activeWorkspace.id);
        }, 30000); // Every 30 seconds

        return () => clearInterval(interval);
    }, [activeWorkspace?.id, refreshContacts]);

    // ✅ SOCKET LISTENER: Refresh when a new DM session is created
    React.useEffect(() => {
        if (!accessToken || !activeWorkspace?.id) return;

        const socket = io(API_BASE, {
            auth: { token: accessToken },
            transports: ["websocket"],
        });

        socket.on("new-dm-session", (data) => {
            // Refresh contacts to include the new DM
            refreshContacts(activeWorkspace.id);
        });

        return () => {
            socket.disconnect();
        };
    }, [activeWorkspace?.id, accessToken, refreshContacts]);

    // Fetch real users from API (currently unused, but available for future use)
    // const { users } = useUsers(user?.companyId);

    const [expanded, setExpanded] = useState({
        favorites: true,
        channels: true,
        dms: true,
    });

    const [workspaceName, setWorkspaceName] = useState(title || localStorage.getItem("currentWorkspace") || "Chttrix");

    // Update workspace name when title prop changes
    React.useEffect(() => {
        if (title) {
            setWorkspaceName(title);
        }
    }, [title]);

    const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [activeSettingsTab, setActiveSettingsTab] = useState("General");
    const [newName, setNewName] = useState("");
    const [inviteEmail, setInviteEmail] = useState("");
    const [selectedRole, setSelectedRole] = useState("member");
    const [isInviting, setIsInviting] = useState(false);
    const [inviteLink, setInviteLink] = useState("");
    const [isGeneratingLink, setIsGeneratingLink] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showSelectionDeleteConfirm, setShowSelectionDeleteConfirm] = useState(false);
    const [deleteVerification, setDeleteVerification] = useState("");
    const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
    const [showNewDMModal, setShowNewDMModal] = useState(false);

    // Selection Mode State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState(new Set());

    // Channel Creation State
    const [newChannelData, setNewChannelData] = useState({ name: "", description: "", isPrivate: false });
    const [createStep, setCreateStep] = useState(1);
    const [selectedChannelMembers, setSelectedChannelMembers] = useState([]);
    const [workspaceMembers, setWorkspaceMembers] = useState([]);

    // Fetch workspace members for channel creation
    React.useEffect(() => {
        const fetchMembers = async () => {
            if (!activeWorkspace?.id) return;

            try {
                const response = await api.get(`/api/workspaces/${activeWorkspace.id}/members`);
                setWorkspaceMembers(response.data.members || []);
                console.log('👥 Fetched workspace members:', response.data.members);
            } catch (err) {
                console.error('Error fetching workspace members:', err);
            }
        };

        fetchMembers();
    }, [activeWorkspace?.id]);

    // No more MOCK_USERS - using real data from useUsers hook

    const handleStartDM = (selectedUser) => {
        if (!activeWorkspace?.id) return;

        // Extract user ID from various possible structures
        const userId = selectedUser.id || selectedUser._id || selectedUser.user?._id;
        const userName = selectedUser.username || selectedUser.name || selectedUser.user?.username;

        // Find if we already have a DM with this user in the current workspace
        const existingDM = items.find(i =>
            i.type === 'dm' &&
            (i.userId === userId || i.label === userName)
        );

        if (existingDM) {
            navigate(`/workspace/${activeWorkspace.id}/home/dm/${existingDM.id}`);
        } else {
            // Navigate to "new" DM route with the target user's ID
            navigate(`/workspace/${activeWorkspace.id}/home/dm/new/${userId}`);
        }
        setShowNewDMModal(false);
    };

    const toggle = (section) => {
        setExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
    };

    const handleRename = async () => {
        if (!newName.trim()) {
            showToast("Workspace name cannot be empty", "error");
            return;
        }

        if (!activeWorkspace?.id) {
            showToast("No active workspace found", "error");
            return;
        }

        try {
            const response = await api.put(`/api/workspaces/${activeWorkspace.id}/rename`, {
                name: newName.trim()
            });

            setWorkspaceName(newName.trim());
            setShowRenameModal(false);
            setNewName("");
            showToast(response.data.message || "Workspace renamed successfully");

            // Refresh the page to update workspace name everywhere
            window.location.reload();
        } catch (error) {
            console.error("Error renaming workspace:", error);
            showToast(error.response?.data?.message || "Failed to rename workspace", "error");
        }
    };

    const handleCloseInvite = useCallback(() => {
        setShowInviteModal(false);
        setInviteEmail("");
        setSelectedRole("member");
        setInviteLink(""); // Clear the link when closing
    }, []);

    const handleGenerateLink = useCallback(async () => {
        try {
            setIsGeneratingLink(true);
            console.log('🔗 Generating invite link for workspace:', activeWorkspace.id);

            const response = await api.post(`/api/workspaces/${activeWorkspace.id}/invite`, {
                inviteType: "link",
                role: selectedRole,
                daysValid: 7
            });

            console.log('✅ Link generation response:', response.data);
            setInviteLink(response.data.inviteLink);
            showToast("✅ Invitation link generated!", "success");
        } catch (error) {
            console.error("❌ Link generation error:", error);
            console.error("Error response:", error.response);
            console.error("Error data:", error.response?.data);

            const errorMsg = error.response?.data?.message || error.message || "Failed to generate link";
            showToast(errorMsg, "error");
        } finally {
            setIsGeneratingLink(false);
        }
    }, [activeWorkspace?.id, selectedRole, showToast]);

    const handleInvite = useCallback(async () => {
        if (!inviteEmail.trim()) {
            showToast("Please enter at least one email address", "error");
            return;
        }

        try {
            setIsInviting(true);
            const response = await api.post(`/api/workspaces/${activeWorkspace.id}/invite`, {
                emails: inviteEmail,
                inviteType: "email",
                role: selectedRole,
                daysValid: 7
            });

            const invites = response.data.invites || [];
            const existingUsers = invites.filter(inv => inv.userExists).length;
            const newUsers = invites.filter(inv => !inv.userExists).length;

            let message = "✅ Invitations sent!";
            if (existingUsers > 0 && newUsers > 0) {
                message += `\n• ${existingUsers} existing user${existingUsers > 1 ? 's' : ''}\n• ${newUsers} new user${newUsers > 1 ? 's' : ''} (will create account)`;
            } else if (existingUsers > 0) {
                message += ` to ${existingUsers} existing user${existingUsers > 1 ? 's' : ''}`;
            } else if (newUsers > 0) {
                message += ` to ${newUsers} new user${newUsers > 1 ? 's' : ''} (will create account via link)`;
            }
            showToast(message, "success");

            handleCloseInvite();
        } catch (error) {
            console.error("Invitation error:", error);
            showToast(error.response?.data?.message || "Failed to send invitations", "error");
        } finally {
            setIsInviting(false);
        }
    }, [activeWorkspace?.id, inviteEmail, selectedRole, showToast, handleCloseInvite]);

    // --- Real-time Link Refresh Logic ---
    React.useEffect(() => {
        if (!activeWorkspace?.id || !showInviteModal || !accessToken) return;

        console.log('🔌 [HomePanel] Connecting to workspace socket for real-time joins...');
        const socket = io(API_BASE, {
            auth: { token: accessToken },
            transports: ["websocket"],
        });

        socket.on("connect", () => {
            console.log('✅ [HomePanel] Connected to socket, joining workspace room...');
            socket.emit("join-workspace", { workspaceId: activeWorkspace.id });
        });

        socket.on("connect_error", (err) => {
            console.error('❌ [HomePanel] Socket connection error:', err.message);
        });

        socket.on("workspace-joined", (data) => {
            console.log('🎉 [HomePanel] Someone joined the workspace!', data);
            // If the invite modal is open AND a link was generated, refresh it automatically
            if (inviteLink) {
                console.log('🔄 [HomePanel] Refreshing invitation link automatically...');
                handleGenerateLink();
                showToast(`🔔 ${data.username} joined! Link refreshed.`, "success");
            }
        });

        return () => {
            console.log('🔌 [HomePanel] Disconnecting workspace socket...');
            socket.disconnect();
        };
    }, [activeWorkspace?.id, showInviteModal, inviteLink, handleGenerateLink, showToast, accessToken]);


    const handleDeleteSelected = () => {
        selectedItems.forEach(id => deleteItem(id));
        setSelectedItems(new Set());
        setIsSelectionMode(false);
        setShowSelectionDeleteConfirm(false);
    };

    const favorites = items.filter(i => i.isFavorite);
    const channels = items.filter(i => !i.isFavorite && i.type === 'channel');
    const dms = items.filter(i => !i.isFavorite && i.type === 'dm');

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 relative border-r border-gray-200 dark:border-gray-800">
            {/* Workspace Header with Dropdown */}
            <WorkspaceHeader
                workspaceName={workspaceName}
                showWorkspaceMenu={showWorkspaceMenu}
                setShowWorkspaceMenu={setShowWorkspaceMenu}
                isSelectionMode={isSelectionMode}
                setIsSelectionMode={setIsSelectionMode}
                setShowNewDMModal={setShowNewDMModal}
                setShowInviteModal={setShowInviteModal}
                setShowSettingsModal={setShowSettingsModal}
                setShowRenameModal={setShowRenameModal}
                setNewName={setNewName}
            />


            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pb-4">

                {/* Selection Mode Header */}
                {isSelectionMode && (
                    <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/30 flex items-center justify-between sticky top-0 z-10 transition-colors">
                        <span className="text-sm font-bold text-blue-900 dark:text-blue-100">{selectedItems.size} selected</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowSelectionDeleteConfirm(true)}
                                disabled={selectedItems.size === 0}
                                className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                title="Delete Selected"
                            >
                                <Trash2 size={16} />
                            </button>
                            <button
                                onClick={() => {
                                    setIsSelectionMode(false);
                                    setSelectedItems(new Set());
                                }}
                                className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                title="Cancel"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Favorites */}
                {favorites.length > 0 && (
                    <>
                        <SectionHeader label="Favorites" isOpen={expanded.favorites} onClick={() => toggle("favorites")} />
                        {expanded.favorites && (
                            <div className="space-y-0.5">
                                {favorites.map(item => (
                                    <ListItem
                                        key={item.id}
                                        item={item}
                                        isSelectionMode={isSelectionMode}
                                        selectedItems={selectedItems}
                                        setSelectedItems={setSelectedItems}
                                        toggleFavorite={toggleFavorite}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* Channels */}
                <SectionHeader
                    label="Channels"
                    isOpen={expanded.channels}
                    onClick={() => toggle("channels")}
                    onAdd={(() => {
                        const userRole = activeWorkspace?.role?.toLowerCase() || '';
                        const isAdmin = userRole === 'admin' || userRole === 'owner';
                        const canCreate = isAdmin || activeWorkspace?.settings?.allowMemberChannelCreation !== false;

                        // Only pass the function if creation is allowed
                        return canCreate ? () => setShowCreateChannelModal(true) : undefined;
                    })()}
                />
                {expanded.channels && (
                    <div className="space-y-0.5">
                        {channels.map(item => (
                            <ListItem
                                key={item.id}
                                item={item}
                                isSelectionMode={isSelectionMode}
                                selectedItems={selectedItems}
                                setSelectedItems={setSelectedItems}
                                toggleFavorite={toggleFavorite}
                            />
                        ))}
                    </div>
                )}

                {/* Direct Messages */}
                <SectionHeader
                    label="Direct Messages"
                    isOpen={expanded.dms}
                    onClick={() => toggle("dms")}
                    onAdd={() => setShowNewDMModal(true)}
                />
                {expanded.dms && (
                    <div className="space-y-0.5">
                        {dms.map(item => (
                            <ListItem
                                key={item.id}
                                item={item}
                                isSelectionMode={isSelectionMode}
                                selectedItems={selectedItems}
                                setSelectedItems={setSelectedItems}
                                toggleFavorite={toggleFavorite}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Confirmation Modal for Selection Delete */}
            <ConfirmationModal
                isOpen={showSelectionDeleteConfirm}
                onClose={() => setShowSelectionDeleteConfirm(false)}
                onConfirm={handleDeleteSelected}
                title="Delete Selected Items?"
                message={`Are you sure you want to delete ${selectedItems.size} selected item(s)? This action cannot be undone.`}
                confirmText="Delete Items"
            />

            {/* Workspace Modals (Rename & Invite) */}
            <WorkspaceModals
                showRenameModal={showRenameModal}
                setShowRenameModal={setShowRenameModal}
                newName={newName}
                setNewName={setNewName}
                handleRename={handleRename}
                showInviteModal={showInviteModal}
                setShowInviteModal={handleCloseInvite}
                inviteEmail={inviteEmail}
                setInviteEmail={setInviteEmail}
                selectedRole={selectedRole}
                setSelectedRole={setSelectedRole}
                isInviting={isInviting}
                handleInvite={handleInvite}
                inviteLink={inviteLink}
                isGeneratingLink={isGeneratingLink}
                handleGenerateLink={handleGenerateLink}
                workspaceName={workspaceName}
                activeWorkspace={activeWorkspace}
            />

            {/* Workspace Settings Modal */}
            <WorkspaceSettingsModal
                showSettingsModal={showSettingsModal}
                setShowSettingsModal={setShowSettingsModal}
                activeSettingsTab={activeSettingsTab}
                setActiveSettingsTab={setActiveSettingsTab}
                workspaceName={workspaceName}
                setWorkspaceName={setWorkspaceName}
                setShowDeleteConfirm={setShowDeleteConfirm}
            />

            {/* Delete Confirmation Modal */}
            <DeleteWorkspaceModal
                showDeleteConfirm={showDeleteConfirm}
                setShowDeleteConfirm={setShowDeleteConfirm}
                workspaceName={workspaceName}
                deleteVerification={deleteVerification}
                setDeleteVerification={setDeleteVerification}
                setShowSettingsModal={setShowSettingsModal}
            />

            {/* Create Channel Modal */}
            <CreateChannelModal
                showCreateChannelModal={showCreateChannelModal}
                setShowCreateChannelModal={setShowCreateChannelModal}
                newChannelData={newChannelData}
                setNewChannelData={setNewChannelData}
                createStep={createStep}
                setCreateStep={setCreateStep}
                selectedChannelMembers={selectedChannelMembers}
                setSelectedChannelMembers={setSelectedChannelMembers}
                workspaceMembers={workspaceMembers}
                addItem={addItem}
            />

            {/* New DM Modal */}
            <NewDMModal
                showNewDMModal={showNewDMModal}
                setShowNewDMModal={setShowNewDMModal}
                workspaceMembers={workspaceMembers}
                handleStartDM={handleStartDM}
            />
        </div>
    );
};

export default HomePanel;
