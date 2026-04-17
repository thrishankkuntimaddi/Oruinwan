import React, { useState, useCallback } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
    Video, Calendar, Clock, Users, ChevronRight, Hash,
    Plus, Mic, PhoneOutgoing, MoreHorizontal, Radio, History,
    ExternalLink,
} from "lucide-react";
import { useHuddleContext } from "../../../contexts/HuddleContext";
import { useToast } from "../../../contexts/ToastContext";
import { useScheduledMeetings } from "../../../hooks/useScheduledMeetings";
import ScheduleMeetingModal from "../../messagesComp/chatWindowComp/modals/ScheduleMeetingModal";

// ── Section Header (same pattern as TasksPanel) ───────────────────────────
const SectionHeader = ({ label, isOpen, onClick, count }) => (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px', cursor: 'pointer', marginTop: '8px', transition: 'background 150ms ease' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--text-muted)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 200ms ease' }}><ChevronRight size={11} /></span>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, sans-serif' }}>{label}</span>
            {count !== undefined && (
                <span style={{ padding: '1px 6px', background: 'var(--bg-active)', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, sans-serif' }}>{count}</span>
            )}
        </div>
    </div>
);

// ── Meeting Card ───────────────────────────────────────────────────────────
const MeetingCard = ({ title, time, status, participants = [], channel, onJoin, isSelected }) => (
    <div onClick={onJoin} style={{ margin: '0 8px 6px', padding: '10px 12px 10px 14px', border: `1px solid ${isSelected ? 'rgba(184,149,106,0.3)' : 'rgba(255,255,255,0.08)'}`, background: isSelected ? 'rgba(184,149,106,0.08)' : 'rgba(255,255,255,0.03)', cursor: onJoin ? 'pointer' : 'default', position: 'relative', overflow: 'hidden', transition: 'all 150ms ease' }}
        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: status === 'live' ? '#ef4444' : status === 'past' ? 'rgba(255,255,255,0.1)' : '#3b82f6' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div>
                <h4 style={{ fontSize: '12px', fontWeight: 600, color: isSelected ? '#e4e4e4' : 'rgba(228,228,228,0.75)', fontFamily: 'Inter, system-ui, sans-serif' }}>{title}</h4>
                {channel && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        <Hash size={9} /><span>{channel}</span>
                    </div>
                )}
            </div>
            {status === 'live' ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '9px', fontWeight: 700, color: '#f87171', letterSpacing: '0.08em', flexShrink: 0 }}>
                    <span style={{ position: 'relative', display: 'flex', width: '6px', height: '6px' }}>
                        <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#f87171', opacity: 0.5, animation: 'ping 1s cubic-bezier(0,0,0.2,1) infinite' }} />
                        <span style={{ position: 'relative', width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
                    </span> LIVE
                </span>
            ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: 'var(--text-muted)', padding: '2px 6px', background: 'var(--bg-hover)', flexShrink: 0 }}>
                    {status === 'past' ? <History size={9} /> : <Clock size={9} />}<span>{time}</span>
                </div>
            )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '-4px' }}>
                {participants.slice(0, 4).map((p, i) => (
                    <div key={i} style={{ width: '18px', height: '18px', borderRadius: '50%', border: '2px solid #0c0c0c', background: 'rgba(184,149,106,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: 700, color: '#b8956a', marginLeft: i > 0 ? '-4px' : 0 }} title={p.username || p.initials}>
                        {(p.username || p.initials || '?').slice(0, 2).toUpperCase()}
                    </div>
                ))}
                {participants.length === 0 && <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, sans-serif' }}>No participants</span>}
            </div>
        </div>
    </div>
);

// ── Main Panel ─────────────────────────────────────────────────────────────
const MeetingsPanel = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { workspaceId } = useParams();
    const { showToast } = useToast();

    const {
        active,
        participants,
        muted,
        selectedHuddle,
        setSelectedHuddle,
        startHuddle,
        leaveHuddle,
        toggleMute,
        huddleHistory,
        activeWorkspaceHuddles,
    } = useHuddleContext();

    // Scheduled meetings (REST + real-time socket)
    const { meetings, createMeeting, cancelMeeting } = useScheduledMeetings(workspaceId);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [expandedScheduled, setExpandedScheduled] = useState(true);

    const activeTab = new URLSearchParams(location.search).get("tab") || "upcoming";
    const [expanded, setExpanded] = useState({ live: true, workspace: true, history: true });
    const [starting, setStarting] = useState(false);

    const handleTab = (tab) => {
        navigate(`/workspace/${workspaceId}/huddles?tab=${tab}`, { replace: true });
    };

    const toggle = (section) => setExpanded(prev => ({ ...prev, [section]: !prev[section] }));

    const handleStartInstant = useCallback(async () => {
        if (starting) return;
        setStarting(true);
        try {
            await startHuddle("Instant Huddle");
        } catch (err) {
            showToast("Microphone permission denied. Please allow mic access to start a huddle.", "error");
        } finally {
            setStarting(false);
        }
    }, [startHuddle, starting, showToast]);

    const handleSelectHuddle = (huddleData) => {
        setSelectedHuddle(huddleData);
    };

    const handleScheduleMeeting = useCallback(async (payload) => {
        try {
            await createMeeting(payload);
            showToast("Meeting scheduled!", "success");
            setShowScheduleModal(false);
        } catch (err) {
            showToast(err?.response?.data?.message || "Failed to schedule meeting", "error");
            throw err;
        }
    }, [createMeeting, showToast]);

    const handleCancelMeeting = useCallback(async (meetingId) => {
        try {
            await cancelMeeting(meetingId);
            showToast("Meeting cancelled", "info");
        } catch {
            showToast("Failed to cancel meeting", "error");
        }
    }, [cancelMeeting, showToast]);

    const totalLive = (active ? 1 : 0) + activeWorkspaceHuddles.length;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', borderRight: '1px solid var(--border-subtle)' }}>
            {/* ── Header ── */}
            <div style={{ height: '56px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: 'var(--bg-base)', flexShrink: 0 }}>
                <h2 style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', fontFamily: 'Inter, system-ui, sans-serif' }}>Video Huddles</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button onClick={handleStartInstant} disabled={starting || active} title="Start Instant Huddle"
                        style={{ padding: '6px', background: 'transparent', border: '1px solid transparent', color: 'var(--text-muted)', cursor: starting || active ? 'not-allowed' : 'pointer', opacity: starting || active ? 0.5 : 1, transition: 'all 150ms ease' }}
                        onMouseEnter={e => { if (!starting && !active) e.currentTarget.style.color = '#b8956a'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(228,228,228,0.4)'; }}>
                        {starting ? <span style={{ display: 'block', width: '16px', height: '16px', border: '2px solid #b8956a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : <Video size={17} />}
                    </button>
                    <button onClick={() => setShowScheduleModal(true)} title="Schedule a Meeting"
                        style={{ padding: '6px', background: 'transparent', border: '1px solid transparent', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 150ms ease' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#b8956a'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.4)'}>
                        <Calendar size={17} />
                    </button>
                </div>
            </div>

            {/* ── Active Huddle Quick Bar ── */}
            {active && (
                <div
                    onClick={() => setSelectedHuddle(prev => prev || { title: "Instant Huddle", status: "live", participants })}
                    style={{ margin: '10px 10px 0', padding: '10px', border: '1px solid rgba(34,197,94,0.25)', background: 'rgba(34,197,94,0.06)', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: 'all 150ms ease' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(34,197,94,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(34,197,94,0.06)'}
                >
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Radio size={13} style={{ color: '#fff', animation: 'pulse 1.5s ease-in-out infinite' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#4ade80', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Inter, system-ui, sans-serif' }}>
                            {selectedHuddle?.title || "Instant Huddle"} • Active
                        </p>
                        <p style={{ fontSize: '10px', color: 'rgba(74,222,128,0.7)', fontFamily: 'Inter, system-ui, sans-serif' }}>
                            {participants.length} participant{participants.length !== 1 ? "s" : ""} · {muted ? "Muted" : "Unmuted"}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                            title={muted ? "Unmute" : "Mute"}
                            style={{ padding: '5px', background: muted ? 'rgba(248,113,113,0.15)' : 'rgba(34,197,94,0.15)', border: `1px solid ${muted ? 'rgba(248,113,113,0.25)' : 'rgba(34,197,94,0.25)'}`, color: muted ? '#f87171' : '#4ade80', cursor: 'pointer', transition: 'all 150ms ease' }}
                        >
                            <Mic size={12} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); leaveHuddle(); }}
                            title="Leave Huddle"
                            style={{ padding: '5px', background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', cursor: 'pointer', transition: 'all 150ms ease' }}
                        >
                            <PhoneOutgoing size={12} />
                        </button>
                    </div>
                </div>
            )}

            {/* ── Tabs ── */}
            <div style={{ padding: '10px 12px 6px', flexShrink: 0 }}>
                <div style={{ display: 'flex', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', gap: '2px', padding: '3px' }}>
                    {[
                        { id: 'upcoming', label: 'Upcoming' },
                        { id: 'history', label: 'History' },
                    ].map(tab => (
                        <button key={tab.id} onClick={() => handleTab(tab.id)}
                            style={{ flex: 1, padding: '5px', fontSize: '11px', fontWeight: activeTab === tab.id ? 600 : 400, background: activeTab === tab.id ? '#1a1a1a' : 'transparent', border: 'none', color: activeTab === tab.id ? '#e4e4e4' : 'rgba(228,228,228,0.4)', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 150ms ease' }}>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Scrollable Content ── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pb-4 space-y-1">

                {/* UPCOMING TAB */}
                {activeTab === "upcoming" && (
                    <>
                        {/* My Active Huddle */}
                        {active && selectedHuddle && (
                            <>
                                <SectionHeader
                                    label="My Huddle"
                                    count={participants.length}
                                    isOpen={expanded.live}
                                    onClick={() => toggle("live")}
                                />
                                {expanded.live && (
                                    <MeetingCard
                                        title={selectedHuddle.title || "Instant Huddle"}
                                        time="Now"
                                        status="live"
                                        channel={selectedHuddle.channel}
                                        participants={participants}
                                        isSelected={true}
                                        onJoin={() => handleSelectHuddle(selectedHuddle)}
                                    />
                                )}
                            </>
                        )}

                        {/* Workspace Live Huddles */}
                        {activeWorkspaceHuddles.length > 0 && (
                            <>
                                <SectionHeader
                                    label="Live Now"
                                    count={activeWorkspaceHuddles.length}
                                    isOpen={expanded.workspace}
                                    onClick={() => toggle("workspace")}
                                />
                                {expanded.workspace && activeWorkspaceHuddles.map(h => (
                                    <MeetingCard
                                        key={h.id}
                                        title={h.title}
                                        time="Now"
                                        status="live"
                                        channel={h.channel}
                                        participants={[]}
                                        isSelected={selectedHuddle?.id === h.id}
                                        onJoin={() => handleSelectHuddle(h)}
                                    />
                                ))}
                            </>
                        )}

                        {/* Upcoming Scheduled Meetings */}
                        {meetings.length > 0 && (
                            <>
                                <SectionHeader
                                    label="Scheduled"
                                    count={meetings.length}
                                    isOpen={expandedScheduled}
                                    onClick={() => setExpandedScheduled(p => !p)}
                                />
                                {expandedScheduled && meetings.map(m => {
                                    const start = new Date(m.startTime);
                                    const timeStr = start.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                                    const isLive = m.status === 'live';
                                    return (
                                        <div key={m._id} style={{ margin: '0 8px 6px', padding: '10px 12px 10px 14px', border: '1px solid var(--border-default)', background: 'var(--bg-surface)', position: 'relative', overflow: 'hidden', transition: 'all 150ms ease' }}
                                            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'}
                                            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}>
                                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: isLive ? '#ef4444' : '#3b82f6' }} />
                                            <div style={{ paddingLeft: '6px' }}>
                                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                    <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '8px', fontFamily: 'Inter, system-ui, sans-serif' }}>{m.title}</p>
                                                    {isLive && (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '1px 5px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '9px', fontWeight: 700, color: '#f87171', flexShrink: 0 }}>
                                                            <span style={{ position: 'relative', display: 'flex', width: '5px', height: '5px' }}><span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#f87171', opacity: 0.5, animation: 'ping 1s ease infinite' }} /><span style={{ position: 'relative', width: '5px', height: '5px', borderRadius: '50%', background: '#ef4444' }} /></span>
                                                            LIVE
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                                                    <Clock size={9} /><span>{timeStr}</span><span>·</span><span>{m.duration} min</span>
                                                    {m.createdBy && (<><span>·</span><span style={{ color: 'var(--text-muted)' }}>{m.createdBy.username || m.createdBy.firstName}</span></>)}
                                                </div>
                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                    {m.meetingLink && (
                                                        <a href={m.meetingLink} target="_blank" rel="noopener noreferrer"
                                                            style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: 600, color: '#b8956a', textDecoration: 'none' }}>
                                                            <ExternalLink size={8} /> Join
                                                        </a>
                                                    )}
                                                    <button onClick={(e) => { e.stopPropagation(); navigate(`/workspace/${workspaceId}/meetings/${m._id}`); }}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: 600, color: '#b8956a', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
                                                        View Details →
                                                    </button>
                                                    <button onClick={() => handleCancelMeeting(m._id)}
                                                        style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto', fontFamily: 'Inter, system-ui, sans-serif' }}
                                                        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.3)'}>
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                            </>
                        )}

                        {/* Empty state */}
                        {!active && activeWorkspaceHuddles.length === 0 && meetings.length === 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 16px', textAlign: 'center' }}>
                                <div style={{ width: '44px', height: '44px', background: 'rgba(184,149,106,0.08)', border: '1px solid rgba(184,149,106,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                                    <Video size={20} style={{ color: '#b8956a' }} />
                                </div>
                                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'Inter, system-ui, sans-serif' }}>No active huddles</p>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px', fontFamily: 'Inter, system-ui, sans-serif' }}>Start an instant huddle or schedule one</p>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button onClick={handleStartInstant} disabled={starting}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#b8956a', border: 'none', color: '#0c0c0c', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', opacity: starting ? 0.6 : 1 }}>
                                        <Plus size={12} />{starting ? 'Starting...' : 'Instant Huddle'}
                                    </button>
                                    <button onClick={() => setShowScheduleModal(true)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'transparent', border: '1px solid rgba(184,149,106,0.3)', color: '#b8956a', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 150ms ease' }}>
                                        <Calendar size={12} /> Schedule
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* HISTORY TAB */}
                {activeTab === "history" && (
                    <>
                        {huddleHistory.length === 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 16px', textAlign: 'center' }}>
                                <div style={{ width: '44px', height: '44px', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                                    <History size={18} style={{ color: 'var(--text-muted)' }} />
                                </div>
                                <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, sans-serif' }}>No huddle history yet</p>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'Inter, system-ui, sans-serif' }}>Ended huddles will appear here</p>
                            </div>
                        ) : (
                            <>
                                <SectionHeader
                                    label="Recent"
                                    count={huddleHistory.length}
                                    isOpen={expanded.history}
                                    onClick={() => toggle("history")}
                                />
                                {expanded.history && huddleHistory.map((h, i) => (
                                    <MeetingCard
                                        key={i}
                                        title={h.title || "Instant Huddle"}
                                        time={h.endTime ? new Date(h.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                                        status="past"
                                        channel={h.channel}
                                        participants={[]}
                                        isSelected={false}
                                        onJoin={null}
                                    />
                                ))}
                            </>
                        )}
                    </>
                )}
            </div>

            {/* ── Footer Stats ── */}
            <div style={{ marginTop: 'auto', padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                <div style={{ padding: '10px 12px', background: 'rgba(184,149,106,0.06)', border: '1px solid rgba(184,149,106,0.12)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ padding: '6px', background: 'rgba(184,149,106,0.1)', color: '#b8956a' }}>
                        <Users size={13} />
                    </div>
                    <div>
                        <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Inter, system-ui, sans-serif' }}>Live Huddles</p>
                        <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, fontFamily: 'Inter, system-ui, sans-serif' }}>
                            {totalLive}<span style={{ fontSize: '11px', fontWeight: 400, color: '#b8956a', marginLeft: '4px' }}>active</span>
                        </p>
                    </div>
                    {active && (
                        <div style={{ marginLeft: 'auto' }}>
                            <span style={{ position: 'relative', display: 'flex', width: '10px', height: '10px' }}>
                                <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#22c55e', opacity: 0.6, animation: 'ping 1s cubic-bezier(0,0,0.2,1) infinite' }} />
                                <span style={{ position: 'relative', width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e' }} />
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Schedule Meeting Modal */}
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
