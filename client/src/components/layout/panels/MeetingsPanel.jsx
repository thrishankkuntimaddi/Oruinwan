import React, { useState, useCallback, useMemo } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
    Video, Calendar, Clock, ChevronRight, Hash, AtSign,
    Plus, Mic, MicOff, PhoneOff, Radio, History, ExternalLink, NotebookPen, CheckCircle2, PanelRight,
} from "lucide-react";
import {
    useHuddleContext, meetingIdFromHuddleId,
} from "../../../features/huddles/HuddleContext";
import { useToast } from "../../../contexts/ToastContext";
import { useAuth } from "../../../contexts/AuthContext";
import { useWorkspace } from "../../../contexts/WorkspaceContext";
import { useScheduledMeetings } from "../../../hooks/useScheduledMeetings";
import ScheduleMeetingModal from "../../../features/messaging/chatWindowComp/modals/ScheduleMeetingModal";
import WorkspacePanel, { PanelEmpty } from "../WorkspacePanel";
import "../../../styles/gloss-x-panels.css";

const TABS = [
    { id: 'live', label: 'Live now' },
    { id: 'scheduled', label: 'Scheduled' },
    { id: 'history', label: 'History' },
];

const SectionHeader = ({ label, isOpen, onClick, count }) => (
    <button type="button" className="gl-section-label" onClick={onClick} aria-expanded={isOpen}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', fontSize: '10px', fontWeight: 700 }}>
        <span style={{ display: 'flex', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 200ms ease' }}><ChevronRight size={11} /></span>
        <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
        {count !== undefined && <span className="gl-count">{count}</span>}
    </button>
);

const LiveDot = ({ size = 6 }) => (
    <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size, flexShrink: 0 }}>
        <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--state-success)', opacity: 0.5, animation: 'ping 1.2s cubic-bezier(0,0,0.2,1) infinite' }} />
        <span style={{ position: 'relative', width: size, height: size, borderRadius: '50%', background: 'var(--state-success)' }} />
    </span>
);

const Avatars = ({ people = [] }) => {
    if (people.length === 0) return <span className="gl-x-pcard-meta">Nobody has joined yet</span>;
    const names = people.map(p => p.username || 'Someone');
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            <div style={{ display: 'flex', flexShrink: 0 }}>
                {people.slice(0, 4).map((p, i) => (
                    <div key={p.userId || i} title={p.username} style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid var(--bg-surface)', background: 'var(--bg-active)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, color: 'var(--text-primary)', marginLeft: i > 0 ? '-5px' : 0 }}>
                        {(p.username || '?').slice(0, 2).toUpperCase()}
                    </div>
                ))}
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2}`}
            </span>
        </div>
    );
};

const LiveHuddleCard = ({ huddle, title, onOpen, disabled }) => {
    const action = huddle.scope === 'channel' ? 'Open channel' : huddle.scope === 'dm' ? 'Open conversation' : 'Join';
    const ScopeIcon = huddle.scope === 'channel' ? Hash : huddle.scope === 'dm' ? AtSign : Radio;
    return (
        <div data-testid="live-huddle-card" className="gl-card gl-x-pcard">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <ScopeIcon size={12} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                <p className="gl-x-pcard-title">{title}</p>
                <span className="gl-x-live"><LiveDot /> LIVE</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                {huddle.scope === 'dm'
                    ? <span className="gl-x-pcard-meta">Started by {huddle.startedBy?.username || 'someone'}</span>
                    : <Avatars people={huddle.participants} />}
                <button type="button" className="gl-x-link" onClick={onOpen} disabled={disabled}>
                    {action} <ChevronRight size={11} />
                </button>
            </div>
        </div>
    );
};

const MeetingsPanel = ({ title }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { workspaceId } = useParams();
    const { showToast } = useToast();
    const { user } = useAuth();
    const { activeWorkspace } = useWorkspace();

    const {
        active,
        participants,
        muted,
        selectedHuddle,
        startHuddle,
        joinHuddle,
        leaveHuddle,
        toggleMute,
        huddleHistory,
        historyLoading,
        activeWorkspaceHuddles,
        connecting,
        openWorkspace,
    } = useHuddleContext();

    const { meetings, createMeeting, cancelMeeting } = useScheduledMeetings(workspaceId);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [expanded, setExpanded] = useState({ live: true, history: true, scheduled: true });

    const rawTab = new URLSearchParams(location.search).get("tab");
    const activeTab = rawTab === 'history' ? 'history' : rawTab === 'scheduled' ? 'scheduled' : 'live';
    const onHuddlesPage = location.pathname.includes('/huddles');

    const myId = String(user?.sub || user?._id || user?.id || '');
    const isWorkspaceAdmin = ['owner', 'admin'].includes(activeWorkspace?.role);
    const canManage = (m) => isWorkspaceAdmin || String(m.createdBy?._id || m.createdBy || '') === myId;

    const meetingTitles = useMemo(() => Object.fromEntries(meetings.map(m => [String(m._id), m.title])), [meetings]);
    const titleFor = (h) => {
        const mid = meetingIdFromHuddleId(h.id);
        return mid && meetingTitles[mid] ? meetingTitles[mid] : h.title;
    };

    const handleTab = (tab) => {
        navigate(`/workspace/${workspaceId}/huddles?tab=${tab}`, { replace: onHuddlesPage });
    };

    const toggle = (section) => setExpanded(prev => ({ ...prev, [section]: !prev[section] }));

    const handleStartInstant = useCallback(async () => {
        if (connecting) return;
        if (!onHuddlesPage) {
            navigate(`/workspace/${workspaceId}/huddles?start=1`);
            return;
        }
        // Errors are shown (with Retry) on the Huddles page itself.
        try { await startHuddle("Workspace huddle"); } catch { /* shown by the page */ }
    }, [connecting, onHuddlesPage, navigate, workspaceId, startHuddle]);

    const handleOpenLive = useCallback(async (h) => {
        if (h.scope === 'channel' && h.channelId) {
            navigate(`/workspace/${workspaceId}/channel/${h.channelId}`);
            return;
        }
        if (h.scope === 'dm' && h.dmId) {
            navigate(`/workspace/${workspaceId}/dm/${h.dmId}`);
            return;
        }
        const withTitle = { ...h, title: titleFor(h), meetingId: meetingIdFromHuddleId(h.id) };
        if (!onHuddlesPage) {
            navigate(`/workspace/${workspaceId}/huddles?join=${encodeURIComponent(h.id)}`);
            return;
        }
        try { await joinHuddle(withTitle); } catch { /* shown by the page */ }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate, workspaceId, onHuddlesPage, joinHuddle, meetingTitles]);

    const handleJoinScheduled = useCallback((m) => {
        navigate(`/workspace/${workspaceId}/huddles?meeting=${m._id}`, { state: { meetingTitle: m.title } });
    }, [navigate, workspaceId]);

    const handleScheduleMeeting = useCallback(async (payload) => {
        await createMeeting(payload);
        showToast("Meeting scheduled", "success");
    }, [createMeeting, showToast]);

    const handleCancelMeeting = useCallback(async (m) => {
        if (!window.confirm(`Cancel "${m.title}"? Everyone in the workspace will see it removed.`)) return;
        try {
            await cancelMeeting(m._id);
            showToast("Meeting cancelled", "info");
        } catch (err) {
            showToast(err?.response?.data?.message || "Could not cancel the meeting", "error");
        }
    }, [cancelMeeting, showToast]);

    const totalLive = (active ? 1 : 0) + activeWorkspaceHuddles.length;
    const myTitle = selectedHuddle?.title || 'Your huddle';

    const liveCount = activeWorkspaceHuddles.length;
    const subtitle = totalLive > 0 ? `${totalLive} live now` : (title || 'Voice and video');

    return (
        <WorkspacePanel
            icon={Video}
            title="Huddles"
            subtitle={subtitle}
            actions={(
                <>
                    <button type="button" className="gl-icon-btn" onClick={() => setShowScheduleModal(true)} title="Schedule a meeting" aria-label="Schedule a meeting">
                        <Calendar size={15} />
                    </button>
                    <button type="button" className="gl-icon-btn" onClick={handleStartInstant} disabled={!!connecting || active}
                        title={active ? "You are already in a huddle" : "Start a huddle"} aria-label="Start a huddle">
                        <Plus size={15} />
                    </button>
                </>
            )}
            tools={(
                <div className="gl-tabs" role="tablist" aria-label="Huddles">
                    {TABS.map(tab => (
                        <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} className="gl-tab" onClick={() => handleTab(tab.id)}>
                            {tab.label}
                            {tab.id === 'live' && liveCount > 0 && <span className="gl-count">{liveCount}</span>}
                            {tab.id === 'scheduled' && meetings.length > 0 && <span className="gl-count">{meetings.length}</span>}
                        </button>
                    ))}
                </div>
            )}
            footer={(
                <div className="gl-x-status">
                    {totalLive > 0 ? <LiveDot size={7} /> : <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--border-accent)' }} />}
                    <span>{totalLive === 0 ? 'No live huddles' : `${totalLive} live ${totalLive === 1 ? 'huddle' : 'huddles'}`}</span>
                </div>
            )}
        >
            {/* The huddle I'm in */}
            {active && (
                <div data-testid="active-huddle-banner" className="gl-card gl-x-banner"
                    onClick={() => { if (!onHuddlesPage) navigate(`/workspace/${workspaceId}/huddles`); }}
                    style={{ margin: '4px 10px 8px', cursor: onHuddlesPage ? 'default' : 'pointer' }}>
                    <LiveDot size={8} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="gl-x-pcard-title">{myTitle}</p>
                        <p className="gl-x-pcard-meta" style={{ margin: 0 }}>
                            {participants.length} {participants.length === 1 ? 'participant' : 'participants'} · {muted ? 'Muted' : 'Mic on'}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button type="button" className={`gl-icon-btn${muted ? ' gl-x-danger' : ''}`}
                            onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                            title={muted ? "Unmute" : "Mute"} aria-label={muted ? "Unmute" : "Mute"} aria-pressed={muted}
                            style={muted ? { color: 'var(--state-danger)', borderColor: 'var(--state-danger)', background: 'none' } : undefined}>
                            {muted ? <MicOff size={13} /> : <Mic size={13} />}
                        </button>
                        <button type="button" className="gl-icon-btn"
                            onClick={(e) => { e.stopPropagation(); openWorkspace(); }}
                            title="Notes, tasks, chat and wrap-up" aria-label="Open huddle workspace">
                            <PanelRight size={13} />
                        </button>
                        <button type="button" className="gl-icon-btn"
                            onClick={(e) => { e.stopPropagation(); leaveHuddle(); }}
                            title="Leave huddle" aria-label="Leave huddle"
                            style={{ background: 'var(--state-danger)', color: '#fff' }}>
                            <PhoneOff size={13} />
                        </button>
                    </div>
                </div>
            )}

            {activeTab === "live" && (
                liveCount === 0 ? (
                    <PanelEmpty icon={Radio} title={active ? 'No other live huddles' : 'No live huddles'}
                        text={active ? 'Nobody else is in a huddle right now.' : 'Start a huddle and your teammates can join from here.'}
                        action={(
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '180px' }}>
                                {!active && (
                                    <button type="button" className="gl-btn gl-btn--primary gl-btn--block" onClick={handleStartInstant} disabled={!!connecting}>
                                        <Plus size={12} />{connecting ? 'Starting…' : 'Start huddle'}
                                    </button>
                                )}
                                <button type="button" className="gl-btn gl-btn--block" onClick={() => setShowScheduleModal(true)}>
                                    <Calendar size={12} /> Schedule
                                </button>
                            </div>
                        )} />
                ) : (
                    <>
                        <SectionHeader label="Live now" count={liveCount} isOpen={expanded.live} onClick={() => toggle("live")} />
                        {expanded.live && activeWorkspaceHuddles.map(h => (
                            <LiveHuddleCard key={h.id} huddle={h} title={titleFor(h)} disabled={!!connecting} onOpen={() => handleOpenLive(h)} />
                        ))}
                    </>
                )
            )}

            {activeTab === "scheduled" && (
                meetings.length === 0 ? (
                    <PanelEmpty icon={Calendar} title="Nothing scheduled" text="Upcoming meetings in this workspace appear here."
                        action={(
                            <button type="button" className="gl-btn gl-btn--primary" onClick={() => setShowScheduleModal(true)}>
                                <Calendar size={12} /> Schedule a meeting
                            </button>
                        )} />
                ) : (
                    <>
                        <SectionHeader label="Scheduled" count={meetings.length} isOpen={expanded.scheduled} onClick={() => toggle("scheduled")} />
                        {expanded.scheduled && meetings.map(m => {
                            const start = new Date(m.startTime);
                            const timeStr = start.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                            const isLive = m.status === 'live';
                            return (
                                <div key={m._id} data-testid="scheduled-meeting-card" className="gl-card gl-x-pcard">
                                    <span className={`gl-x-pcard-bar${isLive ? ' is-live' : ''}`} aria-hidden="true" />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <p className="gl-x-pcard-title">{m.title}</p>
                                        {isLive && <span className="gl-x-live"><LiveDot size={5} /> LIVE</span>}
                                    </div>
                                    <div className="gl-x-pcard-meta" style={{ marginBottom: '8px' }}>
                                        <Clock size={10} /><span>{timeStr}</span><span>·</span><span>{m.duration} min</span>
                                        {m.createdBy && (<><span>·</span><span>{m.createdBy.username || m.createdBy.firstName}</span></>)}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                        <button type="button" className="gl-x-link" onClick={() => handleJoinScheduled(m)}>
                                            <Video size={11} /> Join
                                        </button>
                                        {m.meetingLink && (
                                            <a href={m.meetingLink} target="_blank" rel="noopener noreferrer" className="gl-x-link" title={m.meetingLink}>
                                                <ExternalLink size={10} /> Link
                                            </a>
                                        )}
                                        <button type="button" className="gl-x-link gl-x-link--muted" onClick={() => navigate(`/workspace/${workspaceId}/meetings/${m._id}`)}>
                                            Details
                                        </button>
                                        {canManage(m) && (
                                            <button type="button" className="gl-x-link gl-x-link--muted gl-x-link--danger" style={{ fontWeight: 500, marginLeft: 'auto' }}
                                                onClick={() => handleCancelMeeting(m)}>
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </>
                )
            )}

            {activeTab === "history" && (
                huddleHistory.length === 0 ? (
                    <PanelEmpty icon={History} title={historyLoading ? 'Loading history…' : 'No huddle history yet'}
                        text="Finished huddles in this workspace appear here, with their notes and wrap-up." />
                ) : (
                    <>
                        <SectionHeader label="Recent" count={huddleHistory.length} isOpen={expanded.history} onClick={() => toggle("history")} />
                        {expanded.history && huddleHistory.map((h) => {
                            const mid = meetingIdFromHuddleId(h.huddleId);
                            const titleText = h.channelName ? `# ${h.channelName}`
                                : h.scope === 'dm' ? 'Direct message call'
                                    : (mid && meetingTitles[mid]) || (mid ? 'Meeting huddle' : 'Workspace huddle');
                            const start = h.startedAt ? new Date(h.startedAt) : null;
                            const mins = Math.max(1, Math.round((h.durationSec || 0) / 60));
                            return (
                                <div key={h.id} data-testid="huddle-history-card" className="gl-card gl-x-pcard">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <p className="gl-x-pcard-title">{titleText}</p>
                                        {h.summary && <span title="Wrap-up posted" style={{ display: 'flex', color: 'var(--state-success)' }}><CheckCircle2 size={11} /></span>}
                                    </div>
                                    <div className="gl-x-pcard-meta" style={{ marginBottom: '8px' }}>
                                        <Clock size={10} />
                                        <span>{start ? start.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                        <span>·</span><span>{mins} min</span>
                                    </div>
                                    <Avatars people={h.participants || []} />
                                    {(h.notesId || h.channelId || h.dmId) && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
                                            {h.notesId && (
                                                <button type="button" className="gl-x-link" onClick={() => navigate(`/workspace/${workspaceId}/notes/${h.notesId}`)}>
                                                    <NotebookPen size={11} /> Notes
                                                </button>
                                            )}
                                            {h.channelId && (
                                                <button type="button" className="gl-x-link gl-x-link--muted" onClick={() => navigate(`/workspace/${workspaceId}/channel/${h.channelId}`)}>
                                                    <Hash size={10} /> Channel
                                                </button>
                                            )}
                                            {h.dmId && (
                                                <button type="button" className="gl-x-link gl-x-link--muted" onClick={() => navigate(`/workspace/${workspaceId}/dm/${h.dmId}`)}>
                                                    <AtSign size={10} /> Conversation
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </>
                )
            )}

            {showScheduleModal && (
                <ScheduleMeetingModal
                    onSchedule={handleScheduleMeeting}
                    onClose={() => setShowScheduleModal(false)}
                    conversationId={null}
                    conversationType={null}
                />
            )}
        </WorkspacePanel>
    );
};

export default MeetingsPanel;
