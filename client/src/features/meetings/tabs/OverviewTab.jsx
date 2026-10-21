import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Square, ExternalLink, Hash, AtSign, Radio, Film, Captions, ListChecks, Users } from 'lucide-react';
import { Btn, Chip, Confirm } from '../../../components/ui/page';
import { useToast } from '../../../contexts/ToastContext';
import { formatDuration } from '../../huddles/workspace/wrapUp';
import useMeetingCall from '../useMeetingCall';
import {
    meetingPhase, PHASE_LABEL, PHASE_TONE, meetingTimes, meetingConversation, conversationLabel,
    conversationPath, meetingPeople, normaliseActionItems, summaryText, errorText,
} from '../meetingModel';

const initials = (name = '') => name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
const fmt = (d) => (d ? d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export function StatusChip({ meeting }) {
    const phase = meetingPhase(meeting);
    return (
        <Chip tone={PHASE_TONE[phase]}>
            {phase === 'live' && <span className="mt-live-dot" style={{ marginRight: 5 }} />}
            {PHASE_LABEL[phase]}
        </Chip>
    );
}

/** Start / Join huddle, End for everyone, the external link. Shown in the page head or the Overview tab. */
export function MeetingCallActions({ meeting, workspaceId, onEnd, onOpenTab }) {
    const { showToast } = useToast();
    const call = useMeetingCall(meeting, workspaceId);
    const [confirmEnd, setConfirmEnd] = useState(false);
    const [ending, setEnding] = useState(false);
    const phase = meetingPhase(meeting);

    const end_ = async () => {
        setEnding(true);
        try {
            await onEnd?.();
            showToast('Huddle ended for everyone', 'info');
            setConfirmEnd(false);
        } catch (err) {
            showToast(errorText(err, 'Could not end the huddle'), 'error');
        } finally {
            setEnding(false);
        }
    };

    return (
        <>
            {call.inThisCall ? (
                <Chip tone="success"><span className="mt-live-dot" style={{ marginRight: 5 }} />You are in this huddle</Chip>
            ) : call.canJoin ? (
                <Btn variant="primary" icon={Video} onClick={call.join} loading={call.busy} data-testid="meeting-join">{call.joinLabel}</Btn>
            ) : null}
            {phase === 'live' && onEnd && (
                <Btn variant="danger" icon={Square} onClick={() => setConfirmEnd(true)} data-testid="meeting-end">End for everyone</Btn>
            )}
            {meeting.meetingLink && phase !== 'ended' && (
                <a className="gl-btn gl-btn--ghost" href={meeting.meetingLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={13} /> Open meeting link
                </a>
            )}
            {phase === 'ended' && onOpenTab && (
                <Btn variant="ghost" icon={ListChecks} onClick={() => onOpenTab('summary')} data-testid="meeting-view-recap">View recap</Btn>
            )}
            <Confirm open={confirmEnd} title="End the huddle for everyone?" confirmLabel="End for everyone" tone="danger" busy={ending}
                onConfirm={end_} onClose={() => setConfirmEnd(false)}>
                Everyone in the call is disconnected. The meeting keeps its notes, transcript and action items, and everyone gets the recap.
            </Confirm>
        </>
    );
}

/**
 * Overview: status, time and length, where it happens, who is in it, and the
 * call actions (Start / Join huddle, End for everyone).
 */
export default function OverviewTab({ meeting, workspaceId, onEnd, onOpenTab, compact = false, showCallActions = true }) {
    const navigate = useNavigate();
    const call = useMeetingCall(meeting, workspaceId);
    const phase = meetingPhase(meeting);
    const { start, end, durationSec, plannedMin } = meetingTimes(meeting);
    const conv = meetingConversation(meeting);
    const convPath = conversationPath(workspaceId, conv);
    const people = meetingPeople(meeting);
    const items = normaliseActionItems(meeting.actionItems);
    const open = items.filter((a) => !a.done).length;
    const ConvIcon = conv.kind === 'channel' ? Hash : conv.kind === 'dm' ? AtSign : Radio;

    return (
        <div className="mt-stack mt-stack--wide" data-testid="meeting-tab-overview">
            <div className="mt-facts">
                <div className="gl-card mt-fact">
                    <p className="mt-label">Status</p>
                    <p className="mt-fact-value"><StatusChip meeting={meeting} /></p>
                    {meeting.hasRecording && <p className="mt-fact-sub"><Film size={11} style={{ verticalAlign: '-1px' }} /> Recorded</p>}
                </div>
                <div className="gl-card mt-fact">
                    <p className="mt-label">{phase === 'upcoming' ? 'Starts' : 'Started'}</p>
                    <p className="mt-fact-value">{fmt(start)}</p>
                    {phase === 'ended' && end && <p className="mt-fact-sub">Ended {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
                </div>
                <div className="gl-card mt-fact">
                    <p className="mt-label">{phase === 'upcoming' ? 'Planned' : 'Length'}</p>
                    <p className="mt-fact-value">
                        {Number.isFinite(durationSec) && phase !== 'upcoming' ? formatDuration(durationSec) : plannedMin ? `${plannedMin} min` : '—'}
                    </p>
                    {plannedMin && phase !== 'upcoming' && <p className="mt-fact-sub">Planned {plannedMin} min</p>}
                </div>
                <div className="gl-card mt-fact">
                    <p className="mt-label">Where</p>
                    <p className="mt-fact-value">
                        {convPath ? (
                            <button type="button" className="gl-x-link" onClick={() => navigate(convPath)} data-testid="meeting-conversation-link">
                                <ConvIcon size={12} /> {conversationLabel(conv)}
                            </button>
                        ) : <><ConvIcon size={12} style={{ verticalAlign: '-1px' }} /> {conversationLabel(conv)}</>}
                    </p>
                    <p className="mt-fact-sub">{meeting.kind === 'huddle' ? 'Quick huddle' : 'Scheduled meeting'}</p>
                </div>
            </div>

            {showCallActions && (
                <div className="mt-row">
                    <MeetingCallActions meeting={meeting} workspaceId={workspaceId} onEnd={onEnd} onOpenTab={onOpenTab} />
                </div>
            )}
            {phase === 'live' && !call.inThisCall && (
                <p className="mt-muted"><Captions size={11} style={{ verticalAlign: '-1px' }} /> The huddle is live now. Notes, agenda and the transcript update here as people talk.</p>
            )}

            <div className="mt-stack" style={{ gap: 8 }}>
                <p className="mt-label"><Users size={12} /><span>People ({people.length})</span></p>
                {people.length ? (
                    <div className="mt-people">
                        {people.map((p) => (
                            <span key={p.id} className="mt-person"><span className="mt-avatar">{initials(p.name)}</span>{p.name}</span>
                        ))}
                    </div>
                ) : <p className="mt-muted">Nobody has joined yet.</p>}
            </div>

            {!compact && (phase === 'ended' || items.length > 0 || summaryText(meeting.summary)) && (
                <div className="mt-row">
                    <Chip>{(meeting.agenda || []).length} agenda {(meeting.agenda || []).length === 1 ? 'item' : 'items'}</Chip>
                    <Chip tone={open ? 'accent' : undefined}>{open} open action {open === 1 ? 'item' : 'items'}</Chip>
                    <Chip tone={summaryText(meeting.summary) ? 'success' : undefined}>{summaryText(meeting.summary) ? 'Summary ready' : 'No summary yet'}</Chip>
                </div>
            )}
        </div>
    );
}
