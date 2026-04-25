import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, X, Calendar, Clock, Video, ExternalLink, Plus, Loader } from 'lucide-react';
import ConfirmationModal from "../../../../shared/components/ui/ConfirmationModal";
import { useContacts } from "../../../../contexts/ContactsContext";
import { useAuth } from "../../../../contexts/AuthContext";
import { useToast } from "../../../../contexts/ToastContext";
import { useWorkspace } from "../../../../contexts/WorkspaceContext";
import api, { API_BASE } from '@services/api';
import { io } from "socket.io-client";
import { useScheduledMeetings } from "../../../../hooks/useScheduledMeetings";

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

    
    const { meetings: scheduledMeetings, loading: meetingsLoading, createMeeting, cancelMeeting } = useScheduledMeetings(activeWorkspace?.id);

    
    React.useEffect(() => {
        if (activeWorkspace?.id) {
            refreshContacts(activeWorkspace.id);
        }
    }, [activeWorkspace?.id, refreshContacts]);

    
    React.useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && activeWorkspace?.id) {
                refreshContacts(activeWorkspace.id);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [activeWorkspace?.id, refreshContacts]);

    
    React.useEffect(() => {
        if (!activeWorkspace?.id) return;

        const interval = setInterval(() => {
            refreshContacts(activeWorkspace.id);
        }, 30000); 

        return () => clearInterval(interval);
    }, [activeWorkspace?.id, refreshContacts]);

    
    React.useEffect(() => {
        if (!accessToken || !activeWorkspace?.id) return;

        const socket = io(API_BASE, {
            auth: { token: accessToken },
            transports: ["websocket"],
        });

        socket.on("new-dm-session", (data) => {
            
            refreshContacts(activeWorkspace.id);
        });

        return () => {
            socket.disconnect();
        };
    }, [activeWorkspace?.id, accessToken, refreshContacts]);

    
    

    const [expanded, setExpanded] = useState({
        favorites: true,
        channels: true,
        dms: true,
        schedules: true,
    });

    
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [scheduleForm, setScheduleForm] = useState({ title: '', startDate: '', startHour: '09', startMin: '00', duration: 30, meetingLink: '' });
    const [schedulingLoading, setSchedulingLoading] = useState(false);

    const [workspaceName, setWorkspaceName] = useState(title || localStorage.getItem("currentWorkspace") || "Chttrix");

    
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

    
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState(new Set());

    

    const [workspaceMembers, setWorkspaceMembers] = useState([]);

    
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

    

    const handleStartDM = (selectedUser) => {
        if (!activeWorkspace?.id) return;

        
        const userId = selectedUser.id || selectedUser._id || selectedUser.user?._id;
        const userName = selectedUser.username || selectedUser.name || selectedUser.user?.username;

        
        const existingDM = items.find(i =>
            i.type === 'dm' &&
            (i.userId === userId || i.label === userName)
        );

        if (existingDM) {
            navigate(`/workspace/${activeWorkspace.id}/home/dm/${existingDM.id}`);
        } else {
            
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
        setInviteLink(""); 
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
        
        if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const formatTime = (date) =>
        new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const favorites = items.filter(i => i.isFavorite);
    const channels = items.filter(i => !i.isFavorite && i.type === 'channel');
    const dms = items.filter(i => !i.isFavorite && i.type === 'dm');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', position: 'relative' }}>
            {}
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

            {}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-0 pb-2 pt-2 space-y-0.5">

                {}
                {isSelectionMode && (
                    <div style={{ padding: '6px 14px', background: 'var(--bg-hover)', borderBottom: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedItems.size} selected</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                                onClick={() => setShowSelectionDeleteConfirm(true)}
                                disabled={selectedItems.size === 0}
                                style={{ padding: '5px', color: 'var(--state-danger)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '2px', display: 'flex', opacity: selectedItems.size === 0 ? 0.4 : 1, transition: '150ms ease' }}
                                title="Delete Selected"
                            >
                                <Trash2 size={15} />
                            </button>
                            <button
                                onClick={() => { setIsSelectionMode(false); setSelectedItems(new Set()); }}
                                style={{ padding: '5px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '2px', display: 'flex', transition: '150ms ease' }}
                                title="Cancel"
                            >
                                <X size={15} />
                            </button>
                        </div>
                    </div>
                )}

                {}
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

                {}
                <SectionHeader
                    label="Channels"
                    isOpen={expanded.channels}
                    onClick={() => toggle("channels")}
                    onAdd={(() => {
                        const userRole = activeWorkspace?.role?.toLowerCase() || '';
                        const isAdmin = userRole === 'admin' || userRole === 'owner';
                        const canCreate = isAdmin || activeWorkspace?.settings?.allowMemberChannelCreation !== false;

                        
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

                {}
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
                {}
                <SectionHeader
                    label="Upcoming Schedules"
                    isOpen={expanded.schedules}
                    onClick={() => toggle('schedules')}
                    onAdd={() => setShowScheduleModal(true)}
                />
                {expanded.schedules && (
                    <div style={{ padding: '0 0 4px' }}>
                        {meetingsLoading ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', color: 'var(--text-muted)' }}>
                                <Loader size={11} className="animate-spin" />
                                <span style={{ fontSize: '12px' }}>Loading...</span>
                            </div>
                        ) : (
                            scheduledMeetings.map(meeting => (
                                <div
                                    key={meeting._id}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px 6px 18px', cursor: 'default', transition: '150ms ease' }}
                                    className="group"
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                >
                                    {}
                                    <div style={{ width: '24px', height: '24px', borderRadius: '2px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {meeting.status === 'live' ? (
                                            <span style={{ position: 'relative', display: 'flex', width: '8px', height: '8px' }}>
                                                <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--state-danger)', opacity: 0.75, animation: 'ws-spin 1s ease infinite' }} />
                                                <span style={{ position: 'relative', display: 'inline-flex', borderRadius: '50%', width: '8px', height: '8px', background: 'var(--state-danger)' }} />
                                            </span>
                                        ) : (
                                            <Calendar size={11} style={{ color: 'var(--accent)' }} />
                                        )}
                                    </div>

                                    {}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0, lineHeight: 1.3 }}>
                                            {meeting.title}
                                        </p>
                                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', margin: '2px 0 0' }}>
                                            <Clock size={8} />
                                            {formatTime(meeting.startTime)} · {formatRelativeTime(meeting.startTime)}
                                            {meeting.duration ? ` · ${meeting.duration}m` : ''}
                                        </p>
                                    </div>

                                    {}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', opacity: 0, transition: '150ms ease' }} className="group-hover:opacity-100">
                                        {meeting.meetingLink && (
                                            <a href={meeting.meetingLink} target="_blank" rel="noopener noreferrer" title="Open meeting link"
                                                style={{ padding: '3px', borderRadius: '2px', color: 'var(--accent)', display: 'flex', transition: '150ms ease' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <ExternalLink size={11} />
                                            </a>
                                        )}
                                        <button onClick={() => handleCancelMeeting(meeting._id)} title="Cancel"
                                            style={{ padding: '3px', borderRadius: '2px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', transition: '150ms ease' }}
                                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--state-danger)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
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

            {}
            {showScheduleModal && (
                <div
                    style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', fontFamily: 'var(--font)' }}
                    onClick={e => { if (e.target === e.currentTarget) setShowScheduleModal(false); }}
                >
                    <div style={{ position: 'relative', width: '100%', maxWidth: '340px', margin: '0 16px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', overflow: 'hidden' }}>
                        {}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-active)' }}>
                            <Calendar size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                            <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', flex: 1, margin: 0 }}>Schedule Meeting</h2>
                            <button onClick={() => setShowScheduleModal(false)} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '2px', borderRadius: '2px', transition: '150ms ease' }}
                                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                            >
                                <X size={15} />
                            </button>
                        </div>

                        {}
                        <form onSubmit={handleScheduleMeeting} style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {}
                            <div>
                                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '5px' }}>
                                    Title <span style={{ color: 'var(--state-danger)' }}>*</span>
                                </label>
                                <input
                                    type="text" value={scheduleForm.title}
                                    onChange={e => setScheduleForm(f => ({ ...f, title: e.target.value }))}
                                    placeholder="e.g. Weekly Sync" maxLength={100}
                                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '2px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)', boxSizing: 'border-box' }}
                                    onFocus={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
                                    onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '5px' }}>
                                    Date <span style={{ color: 'var(--state-danger)' }}>*</span>
                                </label>
                                <input
                                    type="date" value={scheduleForm.startDate}
                                    onChange={e => setScheduleForm(f => ({ ...f, startDate: e.target.value }))}
                                    min={new Date().toISOString().slice(0, 10)}
                                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '2px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)', boxSizing: 'border-box', colorScheme: 'dark' }}
                                    onFocus={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
                                    onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '5px' }}>Time</label>
                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                        <select value={scheduleForm.startHour} onChange={e => setScheduleForm(f => ({ ...f, startHour: e.target.value }))}
                                            style={{ flex: 1, padding: '8px 6px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '2px', fontSize: '12px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)', cursor: 'pointer' }}
                                        >
                                            {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                        <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '12px' }}>:</span>
                                        <select value={scheduleForm.startMin} onChange={e => setScheduleForm(f => ({ ...f, startMin: e.target.value }))}
                                            style={{ flex: 1, padding: '8px 6px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '2px', fontSize: '12px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)', cursor: 'pointer' }}
                                        >
                                            {['00', '15', '30', '45'].map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '5px' }}>Duration</label>
                                    <select value={scheduleForm.duration} onChange={e => setScheduleForm(f => ({ ...f, duration: Number(e.target.value) }))}
                                        style={{ width: '100%', padding: '8px 6px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '2px', fontSize: '12px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)', cursor: 'pointer' }}
                                    >
                                        {[15, 30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '5px' }}>
                                    Meeting link <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '11px' }}>(optional)</span>
                                </label>
                                <input
                                    type="url" value={scheduleForm.meetingLink}
                                    onChange={e => setScheduleForm(f => ({ ...f, meetingLink: e.target.value }))}
                                    placeholder="https://meet.google.com/..."
                                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '2px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)', boxSizing: 'border-box' }}
                                    onFocus={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
                                    onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
                                <button type="button" onClick={() => setShowScheduleModal(false)}
                                    style={{ flex: 1, padding: '9px', fontSize: '13px', fontWeight: 500, borderRadius: '2px', border: '1px solid var(--border-default)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font)', transition: '150ms ease' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                >
                                    Cancel
                                </button>
                                <button type="submit" disabled={schedulingLoading}
                                    style={{ flex: 1, padding: '9px', fontSize: '13px', fontWeight: 600, borderRadius: '2px', border: '1px solid var(--border-accent)', background: 'var(--bg-active)', color: 'var(--accent)', cursor: schedulingLoading ? 'wait' : 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: schedulingLoading ? 0.65 : 1, transition: '150ms ease' }}
                                    onMouseEnter={e => { if (!schedulingLoading) e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
                                    onMouseLeave={e => { if (!schedulingLoading) e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
                                >
                                    {schedulingLoading ? <><Loader size={12} className="animate-spin" /> Scheduling…</> : 'Schedule'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {}

            <ConfirmationModal
                isOpen={showSelectionDeleteConfirm}
                onClose={() => setShowSelectionDeleteConfirm(false)}
                onConfirm={handleDeleteSelected}
                title="Delete Selected Items?"
                message={`Are you sure you want to delete ${selectedItems.size} selected item(s)? This action cannot be undone.`}
                confirmText="Delete Items"
            />

            {}
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

            {}
            <WorkspaceSettingsModal
                showSettingsModal={showSettingsModal}
                setShowSettingsModal={setShowSettingsModal}
                activeSettingsTab={activeSettingsTab}
                setActiveSettingsTab={setActiveSettingsTab}
                workspaceName={workspaceName}
                setWorkspaceName={setWorkspaceName}
                setShowDeleteConfirm={setShowDeleteConfirm}
            />

            {}
            <DeleteWorkspaceModal
                showDeleteConfirm={showDeleteConfirm}
                setShowDeleteConfirm={setShowDeleteConfirm}
                workspaceName={workspaceName}
                deleteVerification={deleteVerification}
                setDeleteVerification={setDeleteVerification}
                setShowSettingsModal={setShowSettingsModal}
            />

            {}
            {showCreateChannelModal && (
                <CreateChannelModal
                    onClose={() => setShowCreateChannelModal(false)}
                    onCreated={(channel) => {
                        
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

            {}
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
