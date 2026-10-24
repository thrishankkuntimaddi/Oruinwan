import React, { useCallback, useContext, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
    Mic, Video, CalendarPlus, CalendarClock, History, Radio, Hash, AtSign, ChevronRight, Film, ListChecks, AlertTriangle,
} from 'lucide-react';
import { HuddleContext } from '../huddles/HuddleContext';
import { useOptionalWorkspace } from '../../contexts/WorkspaceContext';
import {
    DashPage, PageHead, Section, Panel, Toolbar, SearchBox, FilterTabs, Btn, Chip, EmptyState, LoadingState, ErrorState,
} from '../../components/ui/page';
import useMeetingList from './useMeetingList';
import {
    huddlesTab, meetingTitle, meetingWhenLabel, meetingConversation, conversationLabel, meetingPath, meetingIdOf,
    summaryText, normaliseActionItems, openMeetingPage,
} from './meetingModel';
import { clashMarker, priorityLabel, priorityTone, normalizePriority } from '../../utils/meetingConflicts';
import './meetings.css';

export const HUDDLE_LIST_TABS = [
    { value: 'live', label: 'Live now' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'past', label: 'Past' },
];

/** The Huddles tab in the URL (?tab=live|upcoming|past), shared by the side list and the page. */
export function useHuddlesTab() {
    const location = useLocation();
    const navigate = useNavigate();
    const { workspaceId } = useParams();
    const tab = huddlesTab(new URLSearchParams(location.search).get('tab'));
    const onHuddlesPage = location.pathname.endsWith('/huddles');
    const setTab = useCallback((next) => {
        navigate(`/workspace/${workspaceId}/huddles${next === 'live' ? '' : `?tab=${next}`}`, { replace: onHuddlesPage });
    }, [navigate, workspaceId, onHuddlesPage]);
    return [tab, setTab];
}

/** Join a live huddle from a list: in its channel / DM, or right here for workspace huddles. */
export function useJoinLive() {
    const ctx = useContext(HuddleContext);
    const navigate = useNavigate();
    const { workspaceId } = useParams();
    const { pathname } = useLocation();
    return useCallback(async (h, title) => {
        if (!ctx) return;
        if (h.scope === 'channel' && h.channelId) navigate(`/workspace/${workspaceId}/channel/${h.channelId}`);
        else if (h.scope === 'dm' && h.dmId) navigate(`/workspace/${workspaceId}/dm/${h.dmId}`);
        else if (!pathname.endsWith('/huddles')) { navigate(`/workspace/${workspaceId}/huddles?join=${encodeURIComponent(h.id)}`); return; }
        try {
            await ctx.joinHuddle({ ...h, title: title || h.title }, { quiet: h.scope !== 'workspace' });
        } catch { /* the call UI shows the error */ }
    }, [ctx, navigate, workspaceId, pathname]);
}

const ScopeIcon = ({ kind, size = 14 }) => (kind === 'channel' ? <Hash size={size} /> : kind === 'dm' ? <AtSign size={size} /> : <Radio size={size} />);

/** A scheduled meeting or a past huddle; the whole row opens its meeting page. */
export function MeetingRow({ meeting, workspaceId, onJoin, compact = false }) {
    const navigate = useNavigate();
    const conv = meetingConversation(meeting);
    const isPast = meeting.status === 'completed';
    const open = () => navigate(meetingPath(workspaceId, meetingIdOf(meeting), isPast ? 'summary' : undefined));
    const items = normaliseActionItems(meeting.actionItems);
    const hasRecap = !!summaryText(meeting.summary) || items.length > 0;
    const sub = [meetingWhenLabel(meeting), conversationLabel(conv)].filter(Boolean).join(' · ');
    // Upcoming meetings show their priority (when not normal) and a clash marker.
    const clash = !isPast && meeting.status !== 'cancelled' ? clashMarker(meeting) : null;
    const priority = normalizePriority(meeting.priority);
    const showPriority = !isPast && meeting.kind !== 'huddle' && priority !== 'normal';

    if (compact) {
        return (
            <div className="gl-card gl-x-pcard" data-testid={isPast ? 'past-meeting-card' : 'scheduled-meeting-card'} role="button" tabIndex={0}
                onClick={open} onKeyDown={(e) => { if (e.key === 'Enter') open(); }} style={{ cursor: 'pointer' }}>
                {meeting.status === 'live' && <span className="gl-x-pcard-bar is-live" aria-hidden="true" />}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <p className="gl-x-pcard-title">{meetingTitle(meeting)}</p>
                    {meeting.hasRecording && <span title="Recorded" style={{ display: 'flex', color: 'var(--text-secondary)' }}><Film size={11} /></span>}
                    {showPriority && <Chip tone={priorityTone(priority)}>{priorityLabel(priority)}</Chip>}
                </div>
                <div className="gl-x-pcard-meta" style={{ marginBottom: 6 }}><ScopeIcon kind={conv.kind} size={10} /><span>{sub}</span></div>
                {clash && (
                    <div className="gl-x-pcard-meta" data-testid="meeting-clash" title={clash.title} style={{ marginBottom: 6, color: 'var(--color-warning)' }}>
                        <AlertTriangle size={10} aria-hidden="true" /><span>{clash.label}</span>
                    </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    {!isPast && onJoin && (
                        <button type="button" className="gl-x-link" onClick={(e) => { e.stopPropagation(); onJoin(meeting); }}>
                            <Video size={11} /> {meeting.status === 'live' ? 'Join huddle' : 'Start huddle'}
                        </button>
                    )}
                    <button type="button" className="gl-x-link gl-x-link--muted" onClick={(e) => { e.stopPropagation(); open(); }}>
                        {isPast ? <><ListChecks size={11} /> View recap</> : 'Open meeting page'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <button type="button" className="mt-list-row" onClick={open} data-testid={isPast ? 'past-meeting-row' : 'upcoming-meeting-row'}>
            <span className="mt-list-icon">{isPast ? <History size={14} /> : <CalendarClock size={14} />}</span>
            <span className="mt-grow">
                <span className="mt-list-title">{meetingTitle(meeting)}</span>
                <span className="mt-list-sub">{sub}</span>
            </span>
            <span className="mt-list-right">
                {clash && <span data-testid="meeting-clash" title={clash.title}><Chip tone="warning"><AlertTriangle size={10} style={{ marginRight: 4 }} />{clash.label}</Chip></span>}
                {showPriority && <Chip tone={priorityTone(priority)}>{priorityLabel(priority)} priority</Chip>}
                <Chip>{meeting.kind === 'huddle' ? 'Quick huddle' : 'Scheduled'}</Chip>
                {meeting.hasRecording && <Chip><Film size={10} style={{ marginRight: 4 }} />Recorded</Chip>}
                {isPast && hasRecap && <Chip tone="success">Recap</Chip>}
                {meeting.status === 'live' && <Chip tone="success">Live</Chip>}
                {!isPast && onJoin && (
                    <span role="button" tabIndex={0} className="gl-btn gl-btn--sm" onClick={(e) => { e.stopPropagation(); onJoin(meeting); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onJoin(meeting); } }}>
                        <Video size={12} /> {meeting.status === 'live' ? 'Join huddle' : 'Start huddle'}
                    </span>
                )}
                <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
            </span>
        </button>
    );
}

/** The scheduled-meeting call: the Huddles page opens it in the right conversation. */
export function useJoinScheduled() {
    const navigate = useNavigate();
    const { workspaceId } = useParams();
    return useCallback((m) => navigate(`/workspace/${workspaceId}/huddles?meeting=${meetingIdOf(m)}`, { state: { meetingTitle: meetingTitle(m) } }), [navigate, workspaceId]);
}

/** Upcoming / Past list with search and "Load more" (the Huddles page). */
function MeetingListSection({ status, workspaceId, q }) {
    const list = useMeetingList({ workspaceId, status, q });
    const joinScheduled = useJoinScheduled();
    if (list.loading && !list.items.length) return <Panel><LoadingState label="Loading…" /></Panel>;
    if (list.error && !list.items.length) return <Panel><ErrorState message={list.error} onRetry={list.reload} /></Panel>;
    if (!list.items.length) {
        return (
            <Panel>
                {q ? <EmptyState icon={History} title="Nothing matches" text={`No ${status === 'past' ? 'past' : 'upcoming'} meetings match “${q}”.`} />
                    : status === 'upcoming'
                        ? <EmptyState icon={CalendarClock} title="Nothing scheduled" text="Scheduled meetings show here and in everyone’s Up next on Home." />
                        : <EmptyState icon={History} title="No past huddles yet" text="Every finished call — scheduled or a quick huddle — keeps its notes, transcript, summary and action items here." />}
            </Panel>
        );
    }
    return (
        <>
            <Panel flush>
                {list.items.map((m) => <MeetingRow key={meetingIdOf(m)} meeting={m} workspaceId={workspaceId} onJoin={status === 'upcoming' ? joinScheduled : undefined} />)}
            </Panel>
            {list.hasMore && (
                <div className="mt-more"><Btn onClick={list.loadMore} loading={list.loadingMore} data-testid="meetings-load-more">Load more</Btn></div>
            )}
        </>
    );
}

/** Live huddles I can see (socket list), the one I'm in first. */
function LiveSection({ workspaceId, onStart }) {
    const ctx = useContext(HuddleContext);
    const navigate = useNavigate();
    const joinLive = useJoinLive();
    const live = ctx?.activeWorkspaceHuddles || [];
    const mine = ctx?.active ? ctx.selectedHuddle || ctx.panelCall : null;
    if (!live.length && !mine) {
        return (
            <Panel>
                <EmptyState icon={Radio} title="No live huddles" text="Start one and your teammates see it here and can drop in."
                    action={<Btn variant="primary" icon={Mic} onClick={onStart}>Start a huddle</Btn>} />
            </Panel>
        );
    }
    const openPage = (mid) => (e) => { e.stopPropagation(); navigate(meetingPath(workspaceId, mid)); };
    return (
        <Panel flush>
            {mine && (
                <div className="mt-list-row" style={{ cursor: 'default' }} data-testid="live-mine-row">
                    <span className="mt-list-icon"><span className="mt-live-dot" /></span>
                    <span className="mt-grow"><span className="mt-list-title">Your huddle</span><span className="mt-list-sub">{(ctx.participants || []).length} in the call</span></span>
                    <span className="mt-list-right">
                        <Btn size="sm" onClick={() => ctx.openWorkspace?.()}>Meeting panel</Btn>
                        {mine.meetingId && <Btn size="sm" variant="ghost" onClick={() => openMeetingPage(meetingPath(workspaceId, mine.meetingId), { navigate, inApp: ctx.minimiseCall })}>Open meeting page</Btn>}
                    </span>
                </div>
            )}
            {live.map((h) => (
                <div key={h.id} className="mt-list-row" style={{ cursor: 'default' }} data-testid="live-huddle-row">
                    <span className="mt-list-icon"><ScopeIcon kind={h.scope} /></span>
                    <span className="mt-grow">
                        <span className="mt-list-title">{h.title}</span>
                        <span className="mt-list-sub">{(h.participants || []).length ? `${h.participants.length} in the call` : `Started by ${h.startedBy?.username || 'someone'}`}</span>
                    </span>
                    <span className="mt-list-right">
                        <Chip tone="success">Live</Chip>
                        {h.meetingId && <Btn size="sm" variant="ghost" onClick={openPage(h.meetingId)}>Open meeting page</Btn>}
                        <Btn size="sm" variant="primary" icon={Video} onClick={() => joinLive(h)} disabled={!!ctx.connecting}>Join huddle</Btn>
                    </span>
                </div>
            ))}
        </Panel>
    );
}

/**
 * The Huddles page (menu name stays "Huddles"): Live now · Upcoming · Past,
 * with "Start a huddle" and "Schedule". Past holds every finished call —
 * scheduled meetings and quick huddles — and opens its meeting page.
 */
export function HuddlesHome({ onStart, onStartVideo, onSchedule, starting }) {
    const { workspaceId } = useParams();
    const { activeWorkspace } = useOptionalWorkspace() || {};
    const ctx = useContext(HuddleContext);
    const [tab, setTab] = useHuddlesTab();
    const [q, setQ] = useState('');
    const liveCount = (ctx?.activeWorkspaceHuddles || []).length + (ctx?.active ? 1 : 0);
    const options = HUDDLE_LIST_TABS.map((t) => (t.value === 'live' && liveCount ? { ...t, count: liveCount } : t));

    return (
        <DashPage head={(
            <PageHead
                eyebrow={activeWorkspace?.name || 'Workspace'}
                title="Huddles"
                icon={Radio}
                lead="Talk it through live, or schedule a meeting. Every call keeps its notes, transcript, summary and action items."
                actions={(
                    <>
                        <Btn variant="ghost" icon={CalendarPlus} onClick={onSchedule}>Schedule</Btn>
                        <Btn variant="ghost" icon={Video} onClick={onStartVideo} disabled={starting}>Video huddle</Btn>
                        <Btn variant="primary" icon={Mic} onClick={onStart} loading={starting} data-testid="huddles-start">Start a huddle</Btn>
                    </>
                )}
            />
        )}>
            <div data-testid="huddles-home">
                <Toolbar>
                    <FilterTabs value={tab} onChange={setTab} options={options} label="Huddles" />
                    {tab !== 'live' && <SearchBox value={q} onChange={setQ} placeholder={tab === 'past' ? 'Search past huddles…' : 'Search upcoming…'} label="Search meetings" />}
                </Toolbar>
                <Section>
                    {tab === 'live'
                        ? <LiveSection workspaceId={workspaceId} onStart={onStart} />
                        : <MeetingListSection key={tab} status={tab} workspaceId={workspaceId} q={q} />}
                </Section>
            </div>
        </DashPage>
    );
}

export default HuddlesHome;
