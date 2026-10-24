import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useHuddleContext, meetingHuddleId, meetingConversationPath } from '../../features/huddles/HuddleContext';
import { useToast } from '../../contexts/ToastContext';
import { useScheduledMeetings } from '../../hooks/useScheduledMeetings';
import ScheduleMeetingModal from '../../features/messaging/chatWindowComp/modals/ScheduleMeetingModal';
import { HuddlesLanding } from './landing/Landings';
import { scheduledToast } from '../../utils/meetingConflicts';
import api from '../../services/api';

const FONT = 'Inter, system-ui, sans-serif';

const primaryButton = (disabled) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '11px 20px',
    background: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: '2px', color: 'var(--bg-base)', fontWeight: 700, fontSize: '14px',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, fontFamily: FONT, whiteSpace: 'nowrap',
});
const secondaryButton = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '10px 20px',
    background: 'var(--bg-surface)', border: '1px solid var(--border-accent)', borderRadius: '2px', color: 'var(--text-primary)',
    fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap',
};

const CenteredPanel = ({ children }) => (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px', background: 'var(--bg-base)', fontFamily: FONT }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '380px', width: '100%' }}>
            {children}
        </div>
    </div>
);

const IconBadge = ({ icon: Icon, tone = 'accent' }) => (
    <div style={{
        width: '72px', height: '72px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px',
        background: tone === 'danger' ? 'var(--bg-active)' : 'var(--accent-dim)',
        border: `1px solid ${tone === 'danger' ? 'var(--state-danger)' : 'var(--border-accent)'}`,
    }}>
        <Icon size={28} style={{ color: tone === 'danger' ? 'var(--state-danger)' : 'var(--accent)' }} />
    </div>
);

const ErrorView = ({ message, onRetry, onBack }) => (
    <CenteredPanel>
        <IconBadge icon={AlertTriangle} tone="danger" />
        <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Couldn't connect</h3>
        <p data-testid="huddle-connect-error" style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>{message}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '220px' }}>
            <button onClick={onRetry} style={primaryButton(false)}><RotateCcw size={14} /> Try again</button>
            <button onClick={onBack} style={secondaryButton}>Back</button>
        </div>
    </CenteredPanel>
);

const Meetings = () => {
    const { showToast } = useToast();
    const { workspaceId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    const huddle = useHuddleContext();
    const {
        active, startHuddle, joinHuddle, connecting, connectError, dismissConnectError, activeWorkspaceHuddles,
    } = huddle;

    const { createMeeting } = useScheduledMeetings(workspaceId);
    const [showScheduleModal, setShowScheduleModal] = useState(false);

    const params = new URLSearchParams(location.search);
    const meetingParam = params.get('meeting');
    const joinParam = params.get('join');
    const startParam = params.get('start');
    const handledRef = useRef(null);

    const clearParams = useCallback(() => {
        const next = new URLSearchParams(location.search);
        ['meeting', 'join', 'start'].forEach(k => next.delete(k));
        const qs = next.toString();
        navigate(`/workspace/${workspaceId}/huddles${qs ? `?${qs}` : ''}`, { replace: true });
    }, [location.search, navigate, workspaceId]);

    // ?meeting=<id>: the call for a scheduled meeting (one fixed huddle per meeting).
    useEffect(() => {
        if (!meetingParam || handledRef.current === `meeting:${meetingParam}`) return;
        handledRef.current = `meeting:${meetingParam}`;
        const stateTitle = location.state?.meetingTitle;
        (async () => {
            let meeting = null;
            try {
                const { data } = await api.post(`/api/v2/meetings/${meetingParam}/join`, {});
                meeting = data.meeting;
            } catch (err) {
                showToast(err?.response?.data?.message || 'Could not open that meeting.', 'error');
                clearParams();
                return;
            }
            const path = meetingConversationPath(workspaceId, meeting);
            if (path) {
                // Meetings scheduled in a conversation meet there: open it and start (or join) the meeting's huddle.
                const idOf = (v) => (v && typeof v === 'object' ? (v._id || v.id) : v) || null;
                const channelId = idOf(meeting.channelId);
                const scope = channelId ? { channelId: String(channelId) } : { dmId: String(idOf(meeting.dmSessionId)) };
                navigate(path, { replace: true });
                startHuddle(meeting.title || stateTitle || 'Meeting', { huddleId: meetingHuddleId(meetingParam), scope, quiet: true })
                    .catch(() => showToast('Could not start the meeting huddle. Allow the microphone and try again.', 'error'));
                return;
            }
            clearParams();
            try {
                await startHuddle(meeting?.title || stateTitle || 'Meeting', { huddleId: meetingHuddleId(meetingParam) });
            } catch { /* the error view offers Retry */ }
        })();
    }, [meetingParam, location.state, workspaceId, startHuddle, showToast, clearParams, navigate]);

    // ?start=1: "Start huddle" pressed elsewhere (e.g. from a meeting page's sidebar).
    useEffect(() => {
        if (!startParam || handledRef.current === 'start') return;
        handledRef.current = 'start';
        clearParams();
        if (!active) startHuddle('Workspace huddle').catch(() => {});
    }, [startParam, active, startHuddle, clearParams]);

    // ?join=<huddleId>: join a live workspace huddle once it shows up in the list.
    useEffect(() => {
        if (!joinParam || handledRef.current === `join:${joinParam}`) return undefined;
        const target = activeWorkspaceHuddles.find(h => h.id === joinParam);
        if (target) {
            handledRef.current = `join:${joinParam}`;
            clearParams();
            joinHuddle(target).catch(() => {});
            return undefined;
        }
        const t = setTimeout(() => {
            handledRef.current = `join:${joinParam}`;
            clearParams();
            showToast('That huddle has already ended.', 'info');
        }, 4000);
        return () => clearTimeout(t);
    }, [joinParam, activeWorkspaceHuddles, joinHuddle, clearParams, showToast]);

    const handleStart = (video) => {
        startHuddle(video ? 'Workspace video huddle' : 'Workspace huddle', { video }).catch(() => { /* error view */ });
    };

    const handleSchedule = useCallback(async (payload) => {
        const created = await createMeeting(payload);
        const t = scheduledToast(created);
        showToast(t.text, t.tone);
    }, [createMeeting, showToast]);

    const modal = showScheduleModal && (
        <ScheduleMeetingModal
            onSchedule={handleSchedule}
            onClose={() => setShowScheduleModal(false)}
        />
    );

    // The call itself (and "Connecting…") shows above every page: features/huddles/call/CallScreen.
    if (connectError && !active) {
        return (
            <ErrorView
                message={connectError.message}
                onRetry={connectError.retry}
                onBack={dismissConnectError}
            />
        );
    }

    return (
        <>
            <HuddlesLanding
                onStart={() => handleStart(false)}
                onStartVideo={() => handleStart(true)}
                onSchedule={() => setShowScheduleModal(true)}
                starting={!!connecting}
            />
            {modal}
        </>
    );
};

export default Meetings;
