import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, X, Calendar, Clock, Video, ExternalLink, Plus, Loader } from 'lucide-react';
import ConfirmationModal from "../../../../shared/components/ui/ConfirmationModal";
import { useContacts } from "../../../../contexts/ContactsContext";
import { useAuth } from "../../../../contexts/AuthContext";
import { useToast } from "../../../../contexts/ToastContext";
import { useWorkspace } from "../../../../contexts/WorkspaceContext";
import api, { API_BASE } from "../../../../services/api";
import { io } from "socket.io-client";
import { useScheduledMeetings } from "../../../../hooks/useScheduledMeetings";

// Import sub-components
import WorkspaceHeader from "./WorkspaceHeader";
import SectionHeader from "./SectionHeader";
import ListItem from "./ListItem";
import WorkspaceModals from "./WorkspaceModals";
import WorkspaceSettingsModal from "./WorkspaceSettingsModal";
import DeleteWorkspaceModal from "./DeleteWorkspaceModal";
import { CreateChannelModal, NewDMModal } from "./ChannelDMModals";


const HomePanel = ({ title }) => {
    const navigate = useNavigate();

    const { allItems: items, deleteItem, addItem, toggleFavorite, refreshContacts } = useContacts();
    const { accessToken } = useAuth();
    const { showToast } = useToast();
    const { activeWorkspace } = useWorkspace();

    // Real-time scheduled meetings
    const { meetings: scheduledMeetings, loading: meetingsLoading, createMeeting, cancelMeeting } = useScheduledMeetings(activeWorkspace?.id);

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
        schedules: true,
    });

    // Schedule modal state
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [scheduleForm, setScheduleForm] = useState({ title: '', startDate: '', startHour: '09', startMin: '00', duration: 30, meetingLink: '' });
    const [schedulingLoading, setSchedulingLoading] = useState(false);

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

    // Workspace members for DM creation

    const [workspaceMembers, setWorkspaceMembers] = useState([]);

    // Fetch workspace members for DM creation
    React.useEffect(() => {
        const fetchWorkspaceMembers = async () => {
            if (!activeWorkspace?.id) return;

            try {
                const response = await api.get(`/api/workspaces/${activeWorkspace.id}/members`);
                setWorkspaceMembers(response.data.members || []);
            } catch (err) {
                console.error('Error fetching workspace members:', err);
            }
        };

        fetchWorkspaceMembers();
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

            // Refresh contacts so sidebar reflects the new workspace name without a page reload
            if (activeWorkspace?.id) refreshContacts(activeWorkspace.id);
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

            const response = await api.post(`/api/workspaces/${activeWorkspace.id}/invite`, {
                inviteType: "link",
                role: selectedRole,
                daysValid: 7
            });

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

        const socket = io(API_BASE, {
            auth: { token: accessToken },
            transports: ["websocket"],
        });

        socket.on("connect", () => {
            socket.emit("join-workspace", { workspaceId: activeWorkspace.id });
        });

        socket.on("connect_error", (err) => {
            console.error('❌ [HomePanel] Socket connection error:', err.message);
        });

        socket.on("workspace-joined", (data) => {
            // If the invite modal is open AND a link was generated, refresh it automatically
            if (inviteLink) {
                handleGenerateLink();
                showToast(`🔔 ${data.username} joined! Link refreshed.`, "success");
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [activeWorkspace?.id, showInviteModal, inviteLink, handleGenerateLink, showToast, accessToken]);


    const handleDeleteSelected = () => {
        selectedItems.forEach(id => deleteItem(id));
        setSelectedItems(new Set());
        setIsSelectionMode(false);
        setShowSelectionDeleteConfirm(false);
    };

    // ── Schedule Meeting Handler ──────────────────────────────────────
    const handleScheduleMeeting = useCallback(async (e) => {
        e.preventDefault();
        if (!scheduleForm.title.trim()) { showToast('Title is required', 'error'); return; }
        if (!scheduleForm.startDate) { showToast('Start date is required', 'error'); return; }
        const isoTime = new Date(`${scheduleForm.startDate}T${scheduleForm.startHour}:${scheduleForm.startMin}:00`).toISOString();
        if (new Date(isoTime) <= new Date()) { showToast('Start time must be in the future', 'error'); return; }

        setSchedulingLoading(true);
        try {
            await createMeeting({
                title: scheduleForm.title.trim(),
                startTime: isoTime,
                duration: scheduleForm.duration,
                meetingLink: scheduleForm.meetingLink || null,
            });
            setShowScheduleModal(false);
            setScheduleForm({ title: '', startDate: '', startHour: '09', startMin: '00', duration: 30, meetingLink: '' });
            showToast('Meeting scheduled!', 'success');
        } catch (err) {
            showToast('Failed to schedule meeting', 'error');
        } finally {
            setSchedulingLoading(false);
        }
    }, [scheduleForm, createMeeting, showToast]);

    const handleCancelMeeting = useCallback(async (meetingId) => {
        try {
            await cancelMeeting(meetingId);
            showToast('Meeting cancelled', 'info');
        } catch {
            showToast('Failed to cancel meeting', 'error');
        }
    }, [cancelMeeting, showToast]);

    // ── Helper: format relative time ─────────────────────────────────
    const formatRelativeTime = (date) => {
        const now = new Date();
        const d = new Date(date);
        const diffMs = d - now;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        if (diffMins < 60) return `in ${diffMins}m`;
        if (diffHours < 24) return `in ${diffHours}h`;
        if (diffDays === 1) return 'tomorrow';
        // If within a week show day name
        if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const formatTime = (date) =>
        new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const favorites = items.filter(i => i.isFavorite);
    const channels = items.filter(i => !i.isFavorite && i.type === 'channel');
    const dms = items.filter(i => !i.isFavorite && i.type === 'dm');

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 relative">
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


            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-0 pb-2 pt-2 space-y-0.5">

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
                {/* Upcoming Schedules */}
                <SectionHeader
                    label="Upcoming Schedules"
                    isOpen={expanded.schedules}
                    onClick={() => toggle('schedules')}
                    onAdd={() => setShowScheduleModal(true)}
                />
                {expanded.schedules && (
                    <div className="space-y-0.5 pb-1">
                        {meetingsLoading ? (
                            <div className="flex items-center gap-2 px-5 py-2 text-gray-400">
                                <Loader size={12} className="animate-spin" />
                                <span className="text-xs">Loading...</span>
                            </div>
                        ) : scheduledMeetings.length === 0 ? (
                            <div className="px-5 py-2">
                                <p className="text-xs text-gray-400 dark:text-gray-500">No upcoming meetings</p>
                                <button
                                    onClick={() => setShowScheduleModal(true)}
                                    className="mt-1 text-xs text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1"
                                >
                                    <Plus size={10} /> Schedule one
                                </button>
                            </div>
                        ) : (
                            scheduledMeetings.map(meeting => (
                                <div
                                    key={meeting._id}
                                    className="group flex items-center gap-2.5 px-4 py-2 rounded-md mx-1 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-default"
                                >
                                    {/* Icon */}
                                    <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                                        {meeting.status === 'live' ? (
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                                            </span>
                                        ) : (
                                            <Calendar size={13} className="text-indigo-500 dark:text-indigo-400" />
                                        )}
                                    </div>

                                    {/* Details */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate leading-tight">
                                            {meeting.title}
                                        </p>
                                        <p className="text-[10px] text-gray-400 flex items-center gap-1">
                                            <Clock size={8} />
                                            {formatTime(meeting.startTime)} · {formatRelativeTime(meeting.startTime)}
                                            {meeting.duration ? ` · ${meeting.duration}m` : ''}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {meeting.meetingLink && (
                                            <a
                                                href={meeting.meetingLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title="Open meeting link"
                                                className="p-1 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-500"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <ExternalLink size={11} />
                                            </a>
                                        )}
                                        <button
                                            onClick={() => handleCancelMeeting(meeting._id)}
                                            title="Cancel"
                                            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors"
                                        >
                                            <X size={11} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Schedule Meeting Modal */}
            {showScheduleModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    onClick={e => { if (e.target === e.currentTarget) setShowScheduleModal(false); }}
                >
                    <div className="relative w-full max-w-sm mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-indigo-600">
                            <div className="p-1.5 bg-white/20 rounded-lg">
                                <Calendar size={15} className="text-white" />
                            </div>
                            <h2 className="text-sm font-bold text-white flex-1">Schedule Meeting</h2>
                            <button onClick={() => setShowScheduleModal(false)} className="text-white/70 hover:text-white p-1">
                                <X size={16} />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleScheduleMeeting} className="px-5 py-4 space-y-3">
                            {/* Title */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                    Title <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={scheduleForm.title}
                                    onChange={e => setScheduleForm(f => ({ ...f, title: e.target.value }))}
                                    placeholder="e.g. Weekly Sync"
                                    maxLength={100}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            {/* Date */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                    Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={scheduleForm.startDate}
                                    onChange={e => setScheduleForm(f => ({ ...f, startDate: e.target.value }))}
                                    min={new Date().toISOString().slice(0, 10)}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            {/* Time + Duration */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Time</label>
                                    <div className="flex gap-1">
                                        <select
                                            value={scheduleForm.startHour}
                                            onChange={e => setScheduleForm(f => ({ ...f, startHour: e.target.value }))}
                                            className="flex-1 px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => (
                                                <option key={h} value={h}>{h}</option>
                                            ))}
                                        </select>
                                        <span className="self-center text-gray-400 font-bold">:</span>
                                        <select
                                            value={scheduleForm.startMin}
                                            onChange={e => setScheduleForm(f => ({ ...f, startMin: e.target.value }))}
                                            className="flex-1 px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            {['00', '15', '30', '45'].map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Duration</label>
                                    <select
                                        value={scheduleForm.duration}
                                        onChange={e => setScheduleForm(f => ({ ...f, duration: Number(e.target.value) }))}
                                        className="w-full px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        {[15, 30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Meeting Link (optional) */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                    Meeting link <span className="text-gray-400 font-normal">(optional)</span>
                                </label>
                                <input
                                    type="url"
                                    value={scheduleForm.meetingLink}
                                    onChange={e => setScheduleForm(f => ({ ...f, meetingLink: e.target.value }))}
                                    placeholder="https://meet.google.com/..."
                                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => setShowScheduleModal(false)}
                                    className="flex-1 py-2 text-sm font-medium rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={schedulingLoading}
                                    className="flex-1 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                    {schedulingLoading ? (
                                        <><Loader size={13} className="animate-spin" /> Scheduling…</>
                                    ) : (
                                        'Schedule'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

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
            {showCreateChannelModal && (
                <CreateChannelModal
                    onClose={() => setShowCreateChannelModal(false)}
                    onCreated={(channel) => {
                        // Add the new channel to the list
                        addItem({
                            id: channel._id,
                            type: 'channel',
                            label: channel.name,
                            path: `/workspace/${activeWorkspace.id}/channel/${channel._id}`,
                            isFavorite: false,
                            isPrivate: channel.isPrivate,
                            isDefault: false,
                            description: channel.description || '',
                            canDelete: true,
                            createdBy: channel.createdBy
                        });
                    }}
                    workspaceId={activeWorkspace?.id}
                />
            )}

            {/* New DM Modal */}
            <NewDMModal
                showNewDMModal={showNewDMModal}
                setShowNewDMModal={setShowNewDMModal}
                workspaceMembers={workspaceMembers}
                handleStartDM={handleStartDM}
            />
        </div >
    );
};

export default HomePanel;
