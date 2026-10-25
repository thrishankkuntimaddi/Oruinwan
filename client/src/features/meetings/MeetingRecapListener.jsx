import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useOptionalSocket } from '../../contexts/SocketContext';
import { useToast } from '../../contexts/ToastContext';
import { meetingPath } from './meetingModel';

/** The toast key shared with the meeting_recap notification, so one call shows one notice. */
export const recapToastKey = (meetingId) => `meeting-recap:${meetingId}`;

/** What "Meeting ended · View recap" says and where it goes (null = say nothing). */
export function recapNotice(payload, { workspaceId, pathname = '' } = {}) {
    const meetingId = payload?.meetingId ? String(payload.meetingId) : null;
    if (!meetingId || !workspaceId) return null;
    const href = meetingPath(workspaceId, meetingId, 'summary');
    // Already looking at that meeting: it updates in place.
    if (pathname.startsWith(`/workspace/${workspaceId}/meetings/${meetingId}`)) return null;
    return {
        key: recapToastKey(meetingId),
        title: payload.title || 'Huddle',
        message: 'Meeting ended · View recap',
        href,
    };
}

/**
 * When a call ends, people stay where they are and get a "Meeting ended ·
 * View recap" notice (socket `meeting:ended`) that opens the meeting page on
 * Summary & actions.
 */
export default function MeetingRecapListener({ workspaceId }) {
    const socket = useOptionalSocket()?.socket || null;
    const { showToast } = useToast();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const ref = useRef({ workspaceId, pathname });
    ref.current = { workspaceId, pathname };
    const seen = useRef(new Set());

    useEffect(() => {
        if (!socket) return undefined;
        const onEnded = (payload) => {
            const notice = recapNotice(payload, ref.current);
            if (!notice || seen.current.has(notice.key)) return;
            seen.current.add(notice.key);
            // Sent to my user room and the meeting room: one notice per meeting.
            setTimeout(() => seen.current.delete(notice.key), 60000);
            showToast(notice.message, 'info', 5000, { title: notice.title, key: notice.key, onClick: () => navigate(notice.href) });
        };
        socket.on('meeting:ended', onEnded);
        return () => socket.off('meeting:ended', onEnded);
    }, [socket, showToast, navigate]);

    return null;
}
