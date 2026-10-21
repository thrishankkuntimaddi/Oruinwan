import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ExternalLink, Loader2 } from 'lucide-react';
import { useHuddleContext, callTitle } from '../HuddleContext';
import { useAuth } from '../../../contexts/AuthContext';
import ChatTab from './ChatTab';
import { formatDuration } from './wrapUp';
import { useMeetingRecord, useHuddleMeetingId } from '../../meetings/useMeetingRecord';
import useMeetingTranscript from '../../meetings/useMeetingTranscript';
import { MeetingTabBar, MeetingTabContent } from '../../meetings/MeetingTabs';
import MeetingState from '../../meetings/MeetingStates';
import { normaliseTab, meetingTitle, meetingPath, meetingConversation } from '../../meetings/meetingModel';
import './huddleWorkspace.css';
import '../../meetings/meetings.css';

const initials = (name = '') => name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';

function useTicker(active) {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        if (!active) return undefined;
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [active]);
    return now;
}

/**
 * The in-call side panel: the call's meeting with the same tabs as the meeting
 * page (Overview · Agenda · Notes · Transcript · Summary & actions · Whiteboard ·
 * Brainstorm), plus Chat when the call belongs to a conversation. One panel for
 * every call UI (Huddles room, chat overlay, the floating pill); it stays open
 * after the call ends so the recap can be finished.
 */
export default function HuddleWorkspacePanel() {
    const ctx = useHuddleContext();
    const { user } = useAuth() || {};
    const navigate = useNavigate();
    const call = ctx.panelCall;
    const live = !!call && call.status === 'live' && ctx.active && ctx.huddleId === call.id;
    const workspaceId = call?.workspaceId || ctx.workspaceId;
    const myId = String(user?._id || user?.id || user?.sub || '');

    const { reloadSession } = ctx;
    useEffect(() => { if (call?.id) reloadSession(call.id); }, [call?.id, reloadSession]);
    const session = ctx.session;

    // The call's meeting record: from the huddle payloads / session, else GET /by-huddle.
    const { meetingId, failed } = useHuddleMeetingId(call?.id, call?.meetingId || session?.meetingId || null);
    const record = useMeetingRecord(meetingId, { enabled: !!meetingId });
    const meeting = record.meeting;
    const transcript = useMeetingTranscript(meeting);

    useEffect(() => {
        document.body.classList.add('hw-docked');
        return () => document.body.classList.remove('hw-docked');
    }, []);

    // Chat: the call's conversation, when it has one.
    const chatTarget = useMemo(() => {
        const conv = meeting ? meetingConversation(meeting) : null;
        if (conv && conv.kind !== 'workspace') return { type: conv.kind, id: conv.id, name: conv.name || '' };
        if (call?.channelId) return { type: 'channel', id: String(call.channelId), name: call.channelName || session?.channelName || '' };
        if (call?.dmId) return { type: 'dm', id: String(call.dmId), name: 'Direct message' };
        return null;
    }, [meeting, call, session]);
    const chatHref = chatTarget && workspaceId ? `/workspace/${workspaceId}/${chatTarget.type === 'dm' ? 'dm' : 'channel'}/${chatTarget.id}` : null;

    const now = useTicker(live);
    const startedAt = session?.startedAt || meeting?.startedAt || call?.startTime;
    const endedAt = !live ? (meeting?.endedAt || call?.endTime || session?.endedAt) : null;
    const durationSec = startedAt ? Math.max(0, Math.round(((endedAt ? new Date(endedAt).getTime() : now) - new Date(startedAt).getTime()) / 1000)) : null;

    const people = useMemo(() => {
        if (live) return ctx.participants.map((p) => ({ id: String(p.userId), username: p.isLocal ? (user?.username || 'You') : (p.username || 'Someone') }));
        return (session?.participants || []).map((p) => ({ id: String(p.userId), username: p.username }));
    }, [live, ctx.participants, session, user?.username]);

    if (!call) return null;

    const tab = normaliseTab(ctx.workspaceTab, { allowChat: !!chatTarget }) || 'notes';
    const setTab = (id) => ctx.setWorkspaceTab(id);
    const title = meeting ? meetingTitle(meeting) : callTitle({ ...call, channelName: call.channelName || session?.channelName });
    const pageHref = meetingPath(workspaceId, meetingId);
    const go = (href) => (e) => { e?.preventDefault?.(); if (href) navigate(href); };

    let body;
    if (tab === 'chat' && chatTarget) {
        body = <ChatTab conversation={chatTarget} workspaceId={workspaceId} conversationHref={chatHref} onOpen={go(chatHref)} />;
    } else if (meeting) {
        body = (
            <div className="mt-compact">
                <MeetingTabContent tab={tab} meeting={meeting} record={record} transcript={transcript} workspaceId={workspaceId} myId={myId}
                    compact onOpenTab={setTab} />
            </div>
        );
    } else if (failed || record.error) {
        body = record.error
            ? <MeetingState error={record.error} onRetry={record.reload} />
            : <p className="hw-muted" data-testid="huddle-no-meeting">This call has no meeting page (it was held before meetings and huddles were joined up).{chatTarget ? ' Chat still works.' : ''}</p>;
    } else {
        body = <p className="hw-muted"><Loader2 size={12} className="animate-spin" /> Opening the meeting…</p>;
    }

    return (
        <aside className="hw-panel" data-testid="huddle-workspace" aria-label="Meeting panel">
            <div className="hw-head">
                <div className="hw-head-titles">
                    <p className="hw-title" data-testid="huddle-workspace-title">{title}</p>
                    <p className="hw-sub">
                        {live ? <span className="hw-live-dot" /> : null}
                        <span className={live ? '' : 'hw-ended'}>{live ? 'Live' : 'Huddle ended'}</span>
                        {durationSec != null && <><span>·</span><span>{formatDuration(durationSec)}</span></>}
                        {pageHref && (
                            <>
                                <span>·</span>
                                <a href={pageHref} className="gl-x-link" onClick={go(pageHref)} data-testid="huddle-open-meeting-page">
                                    <ExternalLink size={10} /> Open meeting page
                                </a>
                            </>
                        )}
                    </p>
                </div>
                <button type="button" className="gl-icon-btn" onClick={ctx.closeWorkspace} title="Close the meeting panel" aria-label="Close the meeting panel">
                    <X size={15} />
                </button>
            </div>
            {people.length > 0 && (
                <div className="hw-people" aria-label="People in the huddle" style={{ paddingTop: 8 }}>
                    {people.map((p) => (
                        <span key={p.id} className="hw-chip"><span className="hw-avatar">{initials(p.username)}</span>{p.id === myId ? 'You' : p.username}</span>
                    ))}
                </div>
            )}
            <div className="hw-tabs-wrap">
                <MeetingTabBar active={tab} onChange={setTab} meeting={meeting} withChat={!!chatTarget} testIdPrefix="huddle-tab" />
            </div>
            <div className={`hw-body${tab === 'chat' && chatTarget ? ' hw-body--flush' : ''}`} role="tabpanel">
                {body}
            </div>
        </aside>
    );
}
