import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutList, ListOrdered, NotebookPen, Captions, ListChecks, PenTool, StickyNote, MessageSquare } from 'lucide-react';
import Whiteboard from '../../components/meetingsComp/Whiteboard';
import BrainstormBoard from '../../components/meetingsComp/BrainstormBoard';
import OverviewTab from './tabs/OverviewTab';
import AgendaTab from './tabs/AgendaTab';
import NotesTab from './tabs/NotesTab';
import TranscriptTab from './tabs/TranscriptTab';
import SummaryTab from './tabs/SummaryTab';
import { MEETING_TAB_IDS, MEETING_TAB_LABELS, normaliseActionItems } from './meetingModel';
import './meetings.css';

const ICONS = {
    overview: LayoutList, agenda: ListOrdered, notes: NotebookPen, transcript: Captions,
    summary: ListChecks, whiteboard: PenTool, brainstorm: StickyNote, chat: MessageSquare,
};

/** The tab list for a meeting: the shared seven, plus "Chat" last when asked. */
export function meetingTabs({ withChat = false } = {}) {
    const ids = withChat ? [...MEETING_TAB_IDS, 'chat'] : MEETING_TAB_IDS;
    return ids.map((id) => ({ id, label: MEETING_TAB_LABELS[id], Icon: ICONS[id] }));
}

/** The tab bar — the same on the meeting page and in the in-call panel. */
export function MeetingTabBar({ active, onChange, meeting, withChat = false, testIdPrefix = 'meeting-tab' }) {
    const open = meeting ? normaliseActionItems(meeting.actionItems).filter((a) => !a.done).length : 0;
    const barRef = useRef(null);
    const [more, setMore] = useState({ start: false, end: false });

    // In a narrow panel the bar scrolls: fade the side that has more tabs.
    const measure = useCallback(() => {
        const el = barRef.current;
        if (!el) return;
        const start = el.scrollLeft > 2;
        const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
        setMore(prev => (prev.start === start && prev.end === end ? prev : { start, end }));
    }, []);
    useEffect(() => {
        measure();
        const el = barRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return undefined;
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [measure, withChat]);
    // Keep the chosen tab in view.
    useEffect(() => {
        const tab = barRef.current?.querySelector('[aria-selected="true"]');
        try { tab?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); } catch { /* old browsers */ }
    }, [active]);

    return (
        <div ref={barRef} className="gl-tabs mt-tabs" role="tablist" aria-label="Meeting" onScroll={measure}
            data-more-start={more.start} data-more-end={more.end}>
            {meetingTabs({ withChat }).map(({ id, label, Icon }) => (
                <button key={id} type="button" role="tab" className="gl-tab" aria-selected={active === id}
                    onClick={() => onChange(id)} data-testid={`${testIdPrefix}-${id}`}>
                    <Icon size={12} /> {label}
                    {id === 'summary' && open > 0 && <span className="gl-count">{open}</span>}
                </button>
            ))}
        </div>
    );
}

/**
 * One tab's content. Every tab is implemented once (features/meetings/tabs)
 * and rendered by this component wherever the meeting is shown.
 *
 * props: tab, meeting, record (useMeetingRecord), transcript (useMeetingTranscript),
 * workspaceId, myId, compact (the narrow in-call panel), onOpenTab,
 * showCallActions (false where the page head already shows Join / End).
 */
export function MeetingTabContent({ tab, meeting, record, transcript, workspaceId, myId, compact = false, onOpenTab, showCallActions = true }) {
    switch (tab) {
        case 'overview':
            return <OverviewTab meeting={meeting} workspaceId={workspaceId} onEnd={record.end} onOpenTab={onOpenTab} compact={compact} showCallActions={showCallActions} />;
        case 'agenda':
            return <AgendaTab meeting={meeting} onSave={record.saveAgenda} readOnly={meeting.status === 'cancelled'} />;
        case 'notes':
            return <NotesTab meeting={meeting} workspaceId={workspaceId} ensureNote={record.ensureNote} />;
        case 'transcript':
            return <TranscriptTab meeting={meeting} transcript={transcript} myId={myId} compact={compact} />;
        case 'summary':
            return <SummaryTab meeting={meeting} workspaceId={workspaceId} record={record} transcript={transcript} myId={myId} compact={compact} />;
        case 'whiteboard':
            return <div data-testid="meeting-tab-whiteboard" style={{ height: compact ? 460 : 'min(70vh, 640px)' }}><Whiteboard meetingId={String(meeting.id || meeting._id)} /></div>;
        case 'brainstorm':
            return <div data-testid="meeting-tab-brainstorm"><BrainstormBoard meetingId={String(meeting.id || meeting._id)} liveReady={record.roomJoined} /></div>;
        default:
            return null;
    }
}
