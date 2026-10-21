import { useCallback, useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HuddleContext } from '../huddles/HuddleContext';
import { meetingConversation, conversationPath, meetingPhase, meetingIdOf, meetingTitle } from './meetingModel';

/**
 * Start or join the huddle of a meeting, from wherever the meeting is shown.
 * Scheduled meetings use their fixed huddle ("meeting-<id>", via the Huddles
 * page which opens the right conversation); a live quick huddle is joined in
 * its channel / DM, or on the Huddles page for workspace huddles.
 */
export default function useMeetingCall(meeting, workspaceId) {
    const ctx = useContext(HuddleContext);
    const navigate = useNavigate();
    const [busy, setBusy] = useState(false);
    const phase = meetingPhase(meeting);
    const inThisCall = !!ctx?.active && !!meeting?.huddleId && ctx.huddleId === meeting.huddleId;
    const isScheduled = meeting?.kind !== 'huddle';
    // A finished quick huddle cannot be restarted; a scheduled meeting can be held again.
    const canJoin = !!meeting && !inThisCall && (phase === 'live' || (isScheduled && phase !== 'cancelled'));
    const joinLabel = phase === 'live' ? 'Join huddle' : 'Start huddle';

    const join = useCallback(async () => {
        if (!meeting || !workspaceId || busy) return;
        const id = meetingIdOf(meeting);
        if (isScheduled) {
            navigate(`/workspace/${workspaceId}/huddles?meeting=${id}`, { state: { meetingTitle: meetingTitle(meeting) } });
            return;
        }
        const conv = meetingConversation(meeting);
        if (conv.kind === 'workspace') {
            navigate(`/workspace/${workspaceId}/huddles?join=${encodeURIComponent(meeting.huddleId)}`);
            return;
        }
        const path = conversationPath(workspaceId, conv);
        if (path) navigate(path);
        if (!ctx?.joinHuddle) return;
        setBusy(true);
        try {
            await ctx.joinHuddle({
                id: meeting.huddleId,
                video: !!meeting.video,
                channelId: conv.kind === 'channel' ? conv.id : null,
                dmId: conv.kind === 'dm' ? conv.id : null,
                channelName: conv.kind === 'channel' ? conv.name : null,
                title: meetingTitle(meeting),
            }, { quiet: true });
        } catch { /* the conversation shows its own error */ } finally {
            setBusy(false);
        }
    }, [meeting, workspaceId, busy, isScheduled, navigate, ctx]);

    return { join, busy, canJoin, joinLabel, inThisCall, phase, leave: ctx?.leaveHuddle || null };
}
