import React, { useState, useCallback, useMemo } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
    Video, Calendar, ChevronRight, Hash, AtSign,
    Plus, Mic, MicOff, PhoneOff, Radio, History, PanelRight, ExternalLink,
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
import { Confirm } from "../../ui/page";
import useMeetingList from "../../../features/meetings/useMeetingList";
import { MeetingRow, HUDDLE_LIST_TABS, useHuddlesTab, useJoinLive, useJoinScheduled } from "../../../features/meetings/HuddlesLists";
import { meetingIdOf, meetingTitle, meetingPath } from "../../../features/meetings/meetingModel";
import "../../../styles/gloss-x-panels.css";


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

const LiveHuddleCard = ({ huddle, title, onOpen, onOpenPage, disabled }) => {
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
                <span style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                    {onOpenPage && (
                        <button type="button" className="gl-x-link gl-x-link--muted" onClick={onOpenPage} title="Open meeting page" aria-label="Open meeting page">
                            <ExternalLink size={10} />
                        </button>
                    )}
                    <button type="button" className="gl-x-link" onClick={onOpen} disabled={disabled}>
                        Join huddle <ChevronRight size={11} />
                    </button>
                </span>
            </div>
        </div>
    );
};

/** A Huddles list (Upcoming or Past) as compact cards, with paging. */
const MeetingCards = ({ status, workspaceId, onJoin, canManage, onCancel, onSchedule }) => {
    const list = useMeetingList({ workspaceId, status });
    if (list.loading && !list.items.length) return <PanelEmpty icon={status === 'past' ? History : Calendar} title="Loading…" text="" />;
    if (list.error && !list.items.length) return <PanelEmpty icon={History} title="Could not load meetings" text={list.error} />;
    if (!list.items.length) {
        return status === 'upcoming' ? (
            <PanelEmpty icon={Calendar} title="Nothing scheduled" text="Upcoming meetings in this workspace appear here."
                action={<button type="button" className="gl-btn gl-btn--primary" onClick={onSchedule}><Calendar size={12} /> Schedule</button>} />
        ) : (
            <PanelEmpty icon={History} title="No past huddles yet" text="Finished calls — scheduled or quick huddles — keep their notes, transcript and recap here." />
        );
    }
    return (
        <>
            {list.items.map((m) => (
                <div key={meetingIdOf(m)} style={{ position: 'relative' }}>
                    <MeetingRow meeting={m} workspaceId={workspaceId} onJoin={onJoin} compact />
                    {status === 'upcoming' && canManage(m) && (
                        <button type="button" className="gl-x-link gl-x-link--muted gl-x-link--danger"
                            style={{ position: 'absolute', right: 22, bottom: 14, fontWeight: 500 }}
                            onClick={() => onCancel(m)}>
                            Cancel
                        </button>
                    )}
                </div>
            ))}
            {list.hasMore && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 10px 10px' }}>
                    <button type="button" className="gl-btn gl-btn--sm" onClick={list.loadMore} disabled={list.loadingMore}>
                        {list.loadingMore ? 'Loading…' : 'Load more'}
                    </button>
                </div>
            )}
        </>
    );
};

/**
 * The Huddles side list: Live now · Upcoming · Past — the same tabs and data as
 * the Huddles page. Every card opens the call's meeting page.
 */
const MeetingsPanel = ({ title }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { workspaceId } = useParams();
    const { showToast } = useToast();
    const { user } = useAuth();
    const { activeWorkspace } = useWorkspace();

    const {
        active, participants, muted, selectedHuddle, panelCall, startHuddle, leaveHuddle, toggleMute,
        activeWorkspaceHuddles, connecting, openWorkspace,
    } = useHuddleContext();

    const { meetings, createMeeting, cancelMeeting } = useScheduledMeetings(workspaceId);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [expanded, setExpanded] = useState({ live: true });
    const [cancelling, setCancelling] = useState(null);
    const [activeTab, setTab] = useHuddlesTab();
    const joinLive = useJoinLive();
    const joinScheduled = useJoinScheduled();
    const onHuddlesPage = location.pathname.endsWith('/huddles');

    const myId = String(user?.sub || user?._id || user?.id || '');
    const isWorkspaceAdmin = ['owner', 'admin'].includes(activeWorkspace?.role);
    const canManage = useCallback((m) => isWorkspaceAdmin || String(m.createdBy?._id || m.createdBy || '') === myId, [isWorkspaceAdmin, myId]);

    const meetingTitles = useMemo(() => Object.fromEntries(meetings.map(m => [String(m._id), m.title])), [meetings]);
    const titleFor = (h) => {
        const mid = meetingIdFromHuddleId(h.id);
        return mid && meetingTitles[mid] ? meetingTitles[mid] : h.title;
    };

    const handleStartInstant = useCallback(async () => {
        if (connecting) return;
        if (!onHuddlesPage) {
            navigate(`/workspace/${workspaceId}/huddles?start=1`);
            return;
        }
        // Errors are shown (with Retry) on the Huddles page itself.
        try { await startHuddle("Workspace huddle"); } catch { /* shown by the page */ }
    }, [connecting, onHuddlesPage, navigate, workspaceId, startHuddle]);

    const handleScheduleMeeting = useCallback(async (payload) => {
        await createMeeting(payload);
        showToast("Meeting scheduled", "success");
    }, [createMeeting, showToast]);

    const doCancel = useCallback(async () => {
        const m = cancelling;
        if (!m) return;
        try {
            await cancelMeeting(meetingIdOf(m));
            showToast("Meeting cancelled", "info");
        } catch (err) {
            showToast(err?.response?.data?.message || "Could not cancel the meeting", "error");
        } finally {
            setCancelling(null);
        }
    }, [cancelling, cancelMeeting, showToast]);

    const totalLive = (active ? 1 : 0) + activeWorkspaceHuddles.length;
    const myCall = selectedHuddle || panelCall;
    const myTitle = myCall?.title || 'Your huddle';
    const liveCount = activeWorkspaceHuddles.length;
    const subtitle = totalLive > 0 ? `${totalLive} live now` : (title || 'Voice and video');

    return (
        <WorkspacePanel
            icon={Video}
            title="Huddles"
            subtitle={subtitle}
            actions={(
                <>
                    <button type="button" className="gl-icon-btn" onClick={() => setShowScheduleModal(true)} title="Schedule" aria-label="Schedule a meeting">
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
                    {HUDDLE_LIST_TABS.map(tab => (
                        <button key={tab.value} type="button" role="tab" aria-selected={activeTab === tab.value} className="gl-tab" onClick={() => setTab(tab.value)}>
                            {tab.label}
                            {tab.value === 'live' && liveCount > 0 && <span className="gl-count">{liveCount}</span>}
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
                            title="Meeting panel: notes, agenda, transcript and recap" aria-label="Open the meeting panel">
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
                                        <Plus size={12} />{connecting ? 'Starting…' : 'Start a huddle'}
                                    </button>
                                )}
                                <button type="button" className="gl-btn gl-btn--block" onClick={() => setShowScheduleModal(true)}>
                                    <Calendar size={12} /> Schedule
                                </button>
                            </div>
                        )} />
                ) : (
                    <>
                        <SectionHeader label="Live now" count={liveCount} isOpen={expanded.live} onClick={() => setExpanded(prev => ({ ...prev, live: !prev.live }))} />
                        {expanded.live && activeWorkspaceHuddles.map(h => (
                            <LiveHuddleCard key={h.id} huddle={h} title={titleFor(h)} disabled={!!connecting}
                                onOpen={() => joinLive(h, titleFor(h))}
                                onOpenPage={h.meetingId ? () => navigate(meetingPath(workspaceId, h.meetingId)) : undefined} />
                        ))}
                    </>
                )
            )}

            {activeTab === "upcoming" && (
                <MeetingCards status="upcoming" workspaceId={workspaceId} onJoin={joinScheduled} canManage={canManage}
                    onCancel={setCancelling} onSchedule={() => setShowScheduleModal(true)} />
            )}

            {activeTab === "past" && <MeetingCards status="past" workspaceId={workspaceId} canManage={canManage} />}

            <Confirm open={!!cancelling} title={`Cancel "${cancelling ? meetingTitle(cancelling) : ''}"?`} confirmLabel="Cancel meeting" tone="danger"
                onConfirm={doCancel} onClose={() => setCancelling(null)}>
                Everyone invited sees it removed.
            </Confirm>

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
