import React, { useCallback, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock } from 'lucide-react';
import { DashPage, PageHead, Btn, Chip } from '../../components/ui/page';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import ScheduleMeetingModal from '../../features/messaging/chatWindowComp/modals/ScheduleMeetingModal';
import meetingApi from '../../features/meetings/meetingApi';
import { normalizePriority, priorityLabel, priorityTone, scheduledToast } from '../../utils/meetingConflicts';
import { useMeetingRecord } from '../../features/meetings/useMeetingRecord';
import useMeetingTranscript from '../../features/meetings/useMeetingTranscript';
import { MeetingTabBar, MeetingTabContent } from '../../features/meetings/MeetingTabs';
import MeetingState from '../../features/meetings/MeetingStates';
import { StatusChip, MeetingCallActions } from '../../features/meetings/tabs/OverviewTab';
import {
    normaliseTab, meetingTitle, personName, meetingConversation, conversationLabel, meetingTimes, meetingPhase, idOf,
} from '../../features/meetings/meetingModel';
import '../../features/meetings/meetings.css';

/**
 * The meeting page: one page per call — scheduled meetings and quick huddles
 * alike — before, during and after it. Same tabs as the in-call panel.
 * ?tab=summary opens the recap (from "View recap" and the recap notification).
 */
const MeetingDetailPage = () => {
    const { meetingId, workspaceId } = useParams();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const tab = normaliseTab(params.get('tab')) || 'overview';
    const setTab = useCallback((id) => {
        const next = new URLSearchParams(params);
        if (id === 'overview') next.delete('tab'); else next.set('tab', id);
        setParams(next, { replace: true });
    }, [params, setParams]);

    const record = useMeetingRecord(meetingId);
    const { meeting, loading, error } = record;
    const transcript = useMeetingTranscript(meeting);
    const { user } = useAuth() || {};
    const myId = String(user?._id || user?.id || user?.sub || '');
    const { showToast } = useToast();
    const [rescheduling, setRescheduling] = useState(false);
    const back = () => navigate(`/workspace/${workspaceId}/huddles${meeting?.status === 'completed' ? '?tab=past' : ''}`);

    const eyebrow = (
        <button type="button" className="mt-back" onClick={back} aria-label="Back to Huddles">
            <ArrowLeft size={12} /> Huddles
        </button>
    );

    if (loading || error || !meeting) {
        return (
            <DashPage head={<PageHead eyebrow={eyebrow} title="Meeting" />}>
                <MeetingState loading={loading} error={error || (!loading && !meeting ? { kind: 'not_found' } : null)} onBack={back} onRetry={record.reload} />
            </DashPage>
        );
    }

    const organiser = meeting.createdBy && typeof meeting.createdBy === 'object' ? personName(meeting.createdBy) : null;
    // The organiser can move a scheduled meeting that has not started (the server also lets admins).
    const canReschedule = meeting.kind !== 'huddle' && meetingPhase(meeting) === 'upcoming' && idOf(meeting.createdBy) === myId;
    const priority = normalizePriority(meeting.priority);
    const reschedule = async (patch) => {
        const res = await meetingApi.update(meeting.id || meeting._id, patch);
        const t = scheduledToast({ conflicts: res?.conflicts || [] }, { verb: 'updated' });
        showToast(t.text, t.tone);
        record.reload();
    };
    const { start } = meetingTimes(meeting);
    const lead = [
        meeting.kind === 'huddle' ? 'Quick huddle' : organiser ? `Organised by ${organiser}` : 'Scheduled meeting',
        conversationLabel(meetingConversation(meeting)),
        start ? start.toLocaleDateString([], { dateStyle: 'medium' }) : null,
    ].filter(Boolean).join(' · ');

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow={eyebrow}
                    title={(
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0, flexWrap: 'wrap' }}>
                            {meetingTitle(meeting)} <StatusChip meeting={meeting} />
                            {meeting.kind !== 'huddle' && priority !== 'normal' && <Chip tone={priorityTone(priority)}>{priorityLabel(priority)} priority</Chip>}
                        </span>
                    )}
                    lead={lead}
                    actions={(
                        <>
                            {canReschedule && <Btn variant="ghost" icon={CalendarClock} onClick={() => setRescheduling(true)} data-testid="meeting-reschedule">Reschedule</Btn>}
                            <MeetingCallActions meeting={meeting} workspaceId={workspaceId} onEnd={record.end} onOpenTab={setTab} />
                        </>
                    )}
                />
            )}
        >
            <div data-testid="meeting-page">
                <div className="mt-page-tabs">
                    <MeetingTabBar active={tab} onChange={setTab} meeting={meeting} />
                </div>
                <div className="mt-page-body" role="tabpanel">
                    <MeetingTabContent
                        tab={tab}
                        meeting={meeting}
                        record={record}
                        transcript={transcript}
                        workspaceId={workspaceId}
                        myId={myId}
                        onOpenTab={setTab}
                        showCallActions={false}
                    />
                </div>
            </div>
            {rescheduling && (
                <ScheduleMeetingModal meeting={meeting} workspaceId={workspaceId} onSchedule={reschedule} onClose={() => setRescheduling(false)} />
            )}
        </DashPage>
    );
};

export default MeetingDetailPage;
