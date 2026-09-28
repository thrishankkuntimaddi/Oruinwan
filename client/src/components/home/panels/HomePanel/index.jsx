import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, X, Calendar, Clock, ExternalLink, Loader, ChevronDown, Settings2, SquarePen } from 'lucide-react';
import WorkspacePanel from "../../../layout/WorkspacePanel";
import '../../../layout/shell.css';
import ConfirmationModal from "../../../../shared/components/ui/ConfirmationModal";
import { useContacts } from "../../../../contexts/ContactsContext";
import { useToast } from "../../../../contexts/ToastContext";
import { useWorkspace } from "../../../../contexts/WorkspaceContext";
import api from '@services/api';
import { useSocket } from "../../../../contexts/SocketContext";
import { useScheduledMeetings } from "../../../../hooks/useScheduledMeetings";

import WorkspaceHeader from "./WorkspaceHeader";
import SectionHeader from "./SectionHeader";
import ListItem from "./ListItem";
import WorkspaceModals from "./WorkspaceModals";
import WorkspaceSettingsModal from "./WorkspaceSettingsModal";
import DeleteWorkspaceModal from "./DeleteWorkspaceModal";
import { CreateChannelModal, NewDMModal } from "./ChannelDMModals";
import logger from '../../../../utils/logger';
import ActivitySection from "../../../../features/activity/ActivitySection";

const HomePanel = ({ title }) => {
    const navigate = useNavigate();

    const { allItems: items, deleteItem, addItem, toggleFavorite, refreshContacts } = useContacts();
    const { socket } = useSocket();
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
        if (!socket || !activeWorkspace?.id) return;
        const wsId = activeWorkspace.id;

        const handleNewDmSession = () => {
            refreshContacts(wsId);
        };
        socket.on("new-dm-session", handleNewDmSession);

        return () => {
            socket.off("new-dm-session", handleNewDmSession);
        };
    }, [socket, activeWorkspace?.id, refreshContacts]);

    
    

    const [expanded, setExpanded] = useState({
        activity: true,
        favorites: true,
        channels: true,
        dms: true,
        schedules: true,
    });

    
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [scheduleForm, setScheduleForm] = useState({ title: '', startDate: '', startHour: '09', startMin: '00', duration: 30, meetingLink: '' });
    const [schedulingLoading, setSchedulingLoading] = useState(false);

    const [workspaceName, setWorkspaceName] = useState(title || localStorage.getItem("currentWorkspace") || "Oruinwan");

    
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
                logger.error('Error fetching workspace members:', err);
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
            logger.error("Error renaming workspace:", error);
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
            logger.error("❌ Link generation error:", error);
            logger.error("Error response:", error.response);
            logger.error("Error data:", error.response?.data);

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
            logger.error("Invitation error:", error);
            showToast(error.response?.data?.message || "Failed to send invitations", "error");
        } finally {
            setIsInviting(false);
        }
    }, [activeWorkspace?.id, inviteEmail, selectedRole, showToast, handleCloseInvite]);

    
    // Workspace room is joined by WorkspaceContext on the shared socket.
    React.useEffect(() => {
        if (!socket || !activeWorkspace?.id || !showInviteModal) return;

        const handleWorkspaceJoined = (data) => {
            if (inviteLink) {
                handleGenerateLink();
                showToast(`🔔 ${data?.username || 'Someone'} joined! Link refreshed.`, "success");
            }
        };
        socket.on("workspace-joined", handleWorkspaceJoined);

        return () => {
            socket.off("workspace-joined", handleWorkspaceJoined);
        };
    }, [socket, activeWorkspace?.id, showInviteModal, inviteLink, handleGenerateLink, showToast]);

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

    const userRole = activeWorkspace?.role?.toLowerCase() || '';
    const canCreateChannel = userRole === 'admin' || userRole === 'owner' || activeWorkspace?.settings?.allowMemberChannelCreation !== false;
    const roleLabel = userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : '';
    const listProps = { isSelectionMode, selectedItems, setSelectedItems, toggleFavorite };

    return (
        <WorkspacePanel
            title={workspaceName}
            titleAfter={<ChevronDown size={13} style={{ flexShrink: 0, color: 'var(--text-secondary)', transition: 'transform 200ms ease', transform: showWorkspaceMenu ? 'rotate(180deg)' : 'none' }} />}
            titleButtonProps={{
                onClick: () => setShowWorkspaceMenu(!showWorkspaceMenu),
                'aria-haspopup': 'menu',
                'aria-expanded': showWorkspaceMenu,
                title: 'Workspace menu',
            }}
            subtitle={roleLabel ? `Home · ${roleLabel}` : 'Home'}
            actions={(
                <>
                    <button
                        type="button"
                        className="gl-icon-btn"
                        title="Manage Chats"
                        aria-label="Manage chats"
                        aria-pressed={isSelectionMode}
                        onClick={() => { setIsSelectionMode(!isSelectionMode); if (isSelectionMode) setSelectedItems(new Set()); }}
                    >
                        <Settings2 size={15} />
                    </button>
                    <button
                        type="button"
                        className="gl-icon-btn"
                        title="New Message"
                        aria-label="New message"
                        onClick={() => setShowNewDMModal(true)}
                    >
                        <SquarePen size={15} />
                    </button>
                </>
            )}
            headerExtra={(
                <WorkspaceHeader
                    workspaceName={workspaceName}
                    showWorkspaceMenu={showWorkspaceMenu}
                    setShowWorkspaceMenu={setShowWorkspaceMenu}
                    setShowInviteModal={setShowInviteModal}
                    setShowSettingsModal={setShowSettingsModal}
                    setShowRenameModal={setShowRenameModal}
                    setNewName={setNewName}
                />
            )}
            bodyClassName="custom-scrollbar"
            bodyProps={{ style: { paddingTop: isSelectionMode ? 0 : undefined } }}
        >
            {isSelectionMode && (
                <div className="gl-shell-selbar">
                    <span>{selectedItems.size} selected</span>
                    <div style={{ display: 'flex', gap: '2px' }}>
                        <button
                            type="button"
                            className="gl-icon-btn is-danger"
                            onClick={() => setShowSelectionDeleteConfirm(true)}
                            disabled={selectedItems.size === 0}
                            title="Delete Selected"
                            aria-label="Delete selected"
                        >
                            <Trash2 size={14} />
                        </button>
                        <button
                            type="button"
                            className="gl-icon-btn"
                            onClick={() => { setIsSelectionMode(false); setSelectedItems(new Set()); }}
                            title="Cancel"
                            aria-label="Cancel selection"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}

            {!isSelectionMode && (
                <ActivitySection isOpen={expanded.activity} onToggle={() => toggle("activity")} />
            )}

            {favorites.length > 0 && (
                <>
                    <SectionHeader label="Favorites" isOpen={expanded.favorites} onClick={() => toggle("favorites")} />
                    {expanded.favorites && favorites.map(item => <ListItem key={item.id} item={item} {...listProps} />)}
                </>
            )}

            <SectionHeader
                label="Channels"
                isOpen={expanded.channels}
                onClick={() => toggle("channels")}
                onAdd={canCreateChannel ? () => setShowCreateChannelModal(true) : undefined}
            />
            {expanded.channels && (
                channels.length > 0
                    ? channels.map(item => <ListItem key={item.id} item={item} {...listProps} />)
                    : favorites.every(f => f.type !== 'channel') && <div className="gl-shell-hint">No channels yet</div>
            )}

            <SectionHeader
                label="Direct Messages"
                isOpen={expanded.dms}
                onClick={() => toggle("dms")}
                onAdd={() => setShowNewDMModal(true)}
            />
            {expanded.dms && (
                dms.length > 0
                    ? dms.map(item => <ListItem key={item.id} item={item} {...listProps} />)
                    : favorites.every(f => f.type !== 'dm') && <div className="gl-shell-hint">No direct messages yet</div>
            )}

            <SectionHeader
                label="Upcoming Schedules"
                isOpen={expanded.schedules}
                onClick={() => toggle('schedules')}
                onAdd={() => setShowScheduleModal(true)}
            />
            {expanded.schedules && (
                meetingsLoading ? (
                    <div className="gl-shell-muted-note">
                        <Loader size={11} className="animate-spin" />
                        <span>Loading...</span>
                    </div>
                ) : scheduledMeetings.length === 0 ? (
                    <div className="gl-shell-hint">Nothing scheduled</div>
                ) : (
                    scheduledMeetings.map(meeting => (
                        <div key={meeting._id} className="gl-item gl-shell-row gl-shell-row--tall gl-shell-meeting">
                            <span className="gl-shell-glyph" aria-hidden="true">
                                {meeting.status === 'live'
                                    ? <span className="gl-shell-live" />
                                    : <Calendar size={11} style={{ color: 'var(--accent)' }} />}
                            </span>

                            <span className="gl-shell-row-text">
                                <span className="gl-shell-row-label" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{meeting.title}</span>
                                <span className="gl-shell-row-sub" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10.5px' }}>
                                    <Clock size={9} />
                                    {formatTime(meeting.startTime)} · {formatRelativeTime(meeting.startTime)}
                                    {meeting.duration ? ` · ${meeting.duration}m` : ''}
                                </span>
                            </span>

                            <span className="gl-shell-meeting-actions">
                                {meeting.meetingLink && (
                                    <a href={meeting.meetingLink} target="_blank" rel="noopener noreferrer" title="Open meeting link"
                                        className="gl-icon-btn" style={{ color: 'var(--accent)' }}
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <ExternalLink size={11} />
                                    </a>
                                )}
                                <button type="button" onClick={() => handleCancelMeeting(meeting._id)} title="Cancel" aria-label={`Cancel ${meeting.title}`}
                                    className="gl-icon-btn is-danger"
                                >
                                    <X size={11} />
                                </button>
                            </span>
                        </div>
                    ))
                )
            )}

            {showScheduleModal && (
                <div
                    className="gl-shell-modal-scrim"
                    onClick={e => { if (e.target === e.currentTarget) setShowScheduleModal(false); }}
                >
                    <div className="gl-card gl-shell-modal" role="dialog" aria-label="Schedule Meeting" style={{ background: 'var(--bg-surface)', backgroundImage: 'var(--gl-glass)' }}>
                        <div className="gl-shell-popover-head">
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="gl-panel-mark" aria-hidden="true"><Calendar size={13} /></span>
                                <h2 className="gl-shell-popover-title" style={{ margin: 0, fontSize: '13.5px' }}>Schedule Meeting</h2>
                            </span>
                            <button type="button" className="gl-icon-btn" onClick={() => setShowScheduleModal(false)} aria-label="Close">
                                <X size={15} />
                            </button>
                        </div>

                        <form onSubmit={handleScheduleMeeting} style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label className="gl-shell-field-label">
                                    Title <span style={{ color: 'var(--state-danger)' }}>*</span>
                                </label>
                                <input
                                    type="text" value={scheduleForm.title}
                                    onChange={e => setScheduleForm(f => ({ ...f, title: e.target.value }))}
                                    placeholder="e.g. Weekly Sync" maxLength={100}
                                    className="gl-input"
                                />
                            </div>

                            <div>
                                <label className="gl-shell-field-label">
                                    Date <span style={{ color: 'var(--state-danger)' }}>*</span>
                                </label>
                                <input
                                    type="date" value={scheduleForm.startDate}
                                    onChange={e => setScheduleForm(f => ({ ...f, startDate: e.target.value }))}
                                    min={new Date().toISOString().slice(0, 10)}
                                    className="gl-input"
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                    <label className="gl-shell-field-label">Time</label>
                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                        <select value={scheduleForm.startHour} onChange={e => setScheduleForm(f => ({ ...f, startHour: e.target.value }))} className="gl-input" aria-label="Hour">
                                            {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                        <span style={{ color: 'var(--text-secondary)', fontWeight: 700, fontSize: '12px' }}>:</span>
                                        <select value={scheduleForm.startMin} onChange={e => setScheduleForm(f => ({ ...f, startMin: e.target.value }))} className="gl-input" aria-label="Minute">
                                            {['00', '15', '30', '45'].map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="gl-shell-field-label">Duration</label>
                                    <select value={scheduleForm.duration} onChange={e => setScheduleForm(f => ({ ...f, duration: Number(e.target.value) }))} className="gl-input">
                                        {[15, 30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="gl-shell-field-label">
                                    Meeting link <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '11px' }}>(optional)</span>
                                </label>
                                <input
                                    type="url" value={scheduleForm.meetingLink}
                                    onChange={e => setScheduleForm(f => ({ ...f, meetingLink: e.target.value }))}
                                    placeholder="https://meet.google.com/..."
                                    className="gl-input"
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
                                <button type="button" onClick={() => setShowScheduleModal(false)} className="gl-btn gl-btn--block" style={{ flex: 1 }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={schedulingLoading} className="gl-btn gl-btn--primary gl-btn--block" style={{ flex: 1 }}>
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
        </WorkspacePanel>
    );
};

export default HomePanel;
