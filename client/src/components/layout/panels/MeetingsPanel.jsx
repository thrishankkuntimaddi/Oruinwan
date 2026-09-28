import React, { useState, useCallback, useMemo } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
    Video, Calendar, Clock, ChevronRight, Hash, AtSign,
    Plus, Mic, MicOff, PhoneOff, Radio, History, ExternalLink,
} from "lucide-react";
import {
    useHuddleContext, meetingIdFromHuddleId,
} from "../../../features/huddles/HuddleContext";
import { useToast } from "../../../contexts/ToastContext";
import { useAuth } from "../../../contexts/AuthContext";
import { useWorkspace } from "../../../contexts/WorkspaceContext";
import { useScheduledMeetings } from "../../../hooks/useScheduledMeetings";
import ScheduleMeetingModal from "../../../features/messaging/chatWindowComp/modals/ScheduleMeetingModal";

const FONT = 'Inter, system-ui, sans-serif';

const TABS = [
    { id: 'live', label: 'Live now' },
    { id: 'scheduled', label: 'Scheduled' },
    { id: 'history', label: 'History' },
];

const SectionHeader = ({ label, isOpen, onClick, count }) => (
    <button type="button" onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 16px', marginTop: '8px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: FONT }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
        <span style={{ color: 'var(--text-muted)', display: 'flex', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 200ms ease' }}><ChevronRight size={11} /></span>
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{label}</span>
        {count !== undefined && (
            <span style={{ padding: '1px 6px', background: 'var(--bg-active)', fontSize: '10px', color: 'var(--text-secondary)', borderRadius: '2px' }}>{count}</span>
        )}
    </button>
);

const LiveDot = ({ size = 6 }) => (
    <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size, flexShrink: 0 }}>
        <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--state-success)', opacity: 0.5, animation: 'ping 1.2s cubic-bezier(0,0,0.2,1) infinite' }} />
        <span style={{ position: 'relative', width: size, height: size, borderRadius: '50%', background: 'var(--state-success)' }} />
    </span>
);

const Avatars = ({ people = [] }) => {
    if (people.length === 0) return <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Nobody has joined yet</span>;
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

const cardStyle = (highlight) => ({
    margin: '0 8px 6px', padding: '10px 12px', border: `1px solid ${highlight ? 'var(--border-accent)' : 'var(--border-subtle)'}`,
    background: highlight ? 'var(--accent-dim)' : 'var(--bg-surface)', borderRadius: '2px', position: 'relative', overflow: 'hidden', fontFamily: FONT,
});

const linkBtn = { display: 'inline-flex', alignItems: 'center', gap: '4px', padding: 0, fontSize: '11px', fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'none', fontFamily: FONT, whiteSpace: 'nowrap' };

const primaryBtn = (disabled) => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '7px 12px', background: 'var(--accent)', border: '1px solid var(--accent)', color: '#0c0c0c',
    fontSize: '12px', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, borderRadius: '2px', fontFamily: FONT, whiteSpace: 'nowrap',
});
const secondaryBtn = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '7px 12px', background: 'transparent', border: '1px solid var(--border-accent)',
    color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', borderRadius: '2px', fontFamily: FONT, whiteSpace: 'nowrap',
};

const EmptyState = ({ icon: Icon, title, text, children }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 16px', textAlign: 'center', fontFamily: FONT }}>
        <div style={{ width: '40px', height: '40px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
            <Icon size={18} style={{ color: 'var(--text-secondary)' }} />
        </div>
        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{title}</p>
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: children ? '16px' : 0, maxWidth: '220px', lineHeight: 1.5 }}>{text}</p>
        {children && <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '200px' }}>{children}</div>}
    </div>
);

const LiveHuddleCard = ({ huddle, title, onOpen, disabled }) => {
    const action = huddle.scope === 'channel' ? 'Open channel' : huddle.scope === 'dm' ? 'Open conversation' : 'Join';
    const ScopeIcon = huddle.scope === 'channel' ? Hash : huddle.scope === 'dm' ? AtSign : Radio;
    return (
        <div data-testid="live-huddle-card" style={cardStyle(false)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <ScopeIcon size={12} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                <p style={{ flex: 1, minWidth: 0, fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--state-success)', flexShrink: 0 }}>
                    <LiveDot /> LIVE
                </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                {huddle.scope === 'dm'
                    ? <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Started by {huddle.startedBy?.username || 'someone'}</span>
                    : <Avatars people={huddle.participants} />}
                <button type="button" onClick={onOpen} disabled={disabled} style={{ ...linkBtn, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
                    {action} <ChevronRight size={11} />
                </button>
            </div>
        </div>
    );
};

const MeetingsPanel = () => {
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
        activeWorkspaceHuddles,
        connecting,
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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', borderRight: '1px solid var(--border-subtle)', fontFamily: FONT }}>

            <div style={{ height: '56px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', flexShrink: 0 }}>
                <h2 style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>Huddles</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button onClick={handleStartInstant} disabled={!!connecting || active} title={active ? "You are already in a huddle" : "Start a huddle"} aria-label="Start a huddle"
                        style={{ padding: '6px', background: 'transparent', border: '1px solid transparent', borderRadius: '2px', color: 'var(--text-secondary)', cursor: connecting || active ? 'not-allowed' : 'pointer', opacity: connecting || active ? 0.5 : 1, display: 'flex' }}
                        onMouseEnter={e => { if (!connecting && !active) e.currentTarget.style.color = 'var(--accent)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}>
                        <Video size={17} />
                    </button>
                    <button onClick={() => setShowScheduleModal(true)} title="Schedule a meeting" aria-label="Schedule a meeting"
                        style={{ padding: '6px', background: 'transparent', border: '1px solid transparent', borderRadius: '2px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}>
                        <Calendar size={17} />
                    </button>
                </div>
            </div>

            {/* The huddle I'm in */}
            {active && (
                <div data-testid="active-huddle-banner"
                    onClick={() => { if (!onHuddlesPage) navigate(`/workspace/${workspaceId}/huddles`); }}
                    style={{ margin: '10px 10px 0', padding: '10px', border: '1px solid var(--border-accent)', borderLeft: '3px solid var(--state-success)', background: 'var(--bg-surface)', borderRadius: '2px', display: 'flex', alignItems: 'center', gap: '10px', cursor: onHuddlesPage ? 'default' : 'pointer' }}>
                    <LiveDot size={8} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {myTitle}
                        </p>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {participants.length} {participants.length === 1 ? 'participant' : 'participants'} · {muted ? 'Muted' : 'Mic on'}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                            title={muted ? "Unmute" : "Mute"}
                            style={{ padding: '5px', display: 'flex', borderRadius: '2px', background: muted ? 'var(--state-danger)' : 'var(--bg-active)', border: `1px solid ${muted ? 'var(--state-danger)' : 'var(--border-default)'}`, color: muted ? '#fff' : 'var(--text-primary)', cursor: 'pointer' }}
                        >
                            {muted ? <MicOff size={12} /> : <Mic size={12} />}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); leaveHuddle(); }}
                            title="Leave huddle"
                            style={{ padding: '5px', display: 'flex', borderRadius: '2px', background: 'var(--state-danger)', border: '1px solid var(--state-danger)', color: '#fff', cursor: 'pointer' }}
                        >
                            <PhoneOff size={12} />
                        </button>
                    </div>
                </div>
            )}

            <div style={{ padding: '10px 12px 6px', flexShrink: 0 }}>
                <div role="tablist" style={{ display: 'flex', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', borderRadius: '2px', gap: '2px', padding: '3px' }}>
                    {TABS.map(tab => (
                        <button key={tab.id} role="tab" aria-selected={activeTab === tab.id} onClick={() => handleTab(tab.id)}
                            style={{ flex: 1, padding: '5px 2px', fontSize: '11px', fontWeight: activeTab === tab.id ? 600 : 500, background: activeTab === tab.id ? 'var(--bg-surface)' : 'transparent', border: activeTab === tab.id ? '1px solid var(--border-default)' : '1px solid transparent', borderRadius: '2px', color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap' }}>
                            {tab.label}
                            {tab.id === 'live' && activeWorkspaceHuddles.length > 0 && ` (${activeWorkspaceHuddles.length})`}
                            {tab.id === 'scheduled' && meetings.length > 0 && ` (${meetings.length})`}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pb-4">

                {activeTab === "live" && (
                    activeWorkspaceHuddles.length === 0 ? (
                        <EmptyState icon={Radio} title={active ? 'No other live huddles' : 'No live huddles'}
                            text={active ? 'Nobody else is in a huddle right now.' : 'Start a huddle and your teammates can join from here.'}>
                            {!active && (
                                <button onClick={handleStartInstant} disabled={!!connecting} style={primaryBtn(!!connecting)}>
                                    <Plus size={12} />{connecting ? 'Starting…' : 'Start huddle'}
                                </button>
                            )}
                            <button onClick={() => setShowScheduleModal(true)} style={secondaryBtn}>
                                <Calendar size={12} /> Schedule
                            </button>
                        </EmptyState>
                    ) : (
                        <>
                            <SectionHeader label="Live now" count={activeWorkspaceHuddles.length} isOpen={expanded.live} onClick={() => toggle("live")} />
                            {expanded.live && activeWorkspaceHuddles.map(h => (
                                <LiveHuddleCard key={h.id} huddle={h} title={titleFor(h)} disabled={!!connecting} onOpen={() => handleOpenLive(h)} />
                            ))}
                        </>
                    )
                )}

                {activeTab === "scheduled" && (
                    meetings.length === 0 ? (
                        <EmptyState icon={Calendar} title="Nothing scheduled" text="Upcoming meetings in this workspace appear here.">
                            <button onClick={() => setShowScheduleModal(true)} style={primaryBtn(false)}>
                                <Calendar size={12} /> Schedule a meeting
                            </button>
                        </EmptyState>
                    ) : (
                        <>
                            <SectionHeader label="Scheduled" count={meetings.length} isOpen={expanded.scheduled} onClick={() => toggle("scheduled")} />
                            {expanded.scheduled && meetings.map(m => {
                                const start = new Date(m.startTime);
                                const timeStr = start.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                                const isLive = m.status === 'live';
                                return (
                                    <div key={m._id} data-testid="scheduled-meeting-card" style={cardStyle(false)}>
                                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: isLive ? 'var(--state-success)' : 'var(--accent)' }} />
                                        <div style={{ paddingLeft: '4px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{m.title}</p>
                                                {isLive && (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--state-success)', flexShrink: 0 }}>
                                                        <LiveDot size={5} /> LIVE
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                                <Clock size={10} /><span>{timeStr}</span><span>·</span><span>{m.duration} min</span>
                                                {m.createdBy && (<><span>·</span><span>{m.createdBy.username || m.createdBy.firstName}</span></>)}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                                <button type="button" onClick={() => handleJoinScheduled(m)} style={linkBtn}>
                                                    <Video size={11} /> Join
                                                </button>
                                                {m.meetingLink && (
                                                    <a href={m.meetingLink} target="_blank" rel="noopener noreferrer" style={linkBtn} title={m.meetingLink}>
                                                        <ExternalLink size={10} /> Link
                                                    </a>
                                                )}
                                                <button type="button" onClick={() => navigate(`/workspace/${workspaceId}/meetings/${m._id}`)} style={{ ...linkBtn, color: 'var(--text-secondary)' }}>
                                                    Details
                                                </button>
                                                {canManage(m) && (
                                                    <button type="button" onClick={() => handleCancelMeeting(m)}
                                                        style={{ ...linkBtn, fontWeight: 500, color: 'var(--text-secondary)', marginLeft: 'auto' }}
                                                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--state-danger)'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}>
                                                        Cancel
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )
                )}

                {activeTab === "history" && (
                    huddleHistory.length === 0 ? (
                        <EmptyState icon={History} title="No huddle history yet" text="Huddles you leave during this session appear here." />
                    ) : (
                        <>
                            <SectionHeader label="Recent" count={huddleHistory.length} isOpen={expanded.history} onClick={() => toggle("history")} />
                            {expanded.history && huddleHistory.map((h, i) => (
                                <div key={`${h.id}-${i}`} style={cardStyle(false)}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                        <p style={{ flex: 1, minWidth: 0, fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.title || 'Huddle'}</p>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: 'var(--text-secondary)', flexShrink: 0 }}>
                                            <History size={10} />
                                            {h.endTime ? new Date(h.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ''}
                                        </span>
                                    </div>
                                    {h.participants?.length > 0
                                        ? <Avatars people={h.participants} />
                                        : <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Nobody else joined</span>}
                                </div>
                            ))}
                        </>
                    )
                )}
            </div>

            <div style={{ marginTop: 'auto', padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {totalLive > 0 ? <LiveDot size={7} /> : <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--border-accent)' }} />}
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {totalLive === 0 ? 'No live huddles' : `${totalLive} live ${totalLive === 1 ? 'huddle' : 'huddles'}`}
                </span>
            </div>

            {showScheduleModal && (
                <ScheduleMeetingModal
                    onSchedule={handleScheduleMeeting}
                    onClose={() => setShowScheduleModal(false)}
                    conversationId={null}
                    conversationType={null}
                />
            )}
        </div>
    );
};

export default MeetingsPanel;
