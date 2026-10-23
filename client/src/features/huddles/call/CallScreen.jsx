import React, { useEffect, useState } from 'react';
import {
    Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, PhoneOff, Users, PanelRight, Hand,
    Captions, Circle, Minimize2, PictureInPicture2,
} from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { useCallCapture } from '../capture/CallCaptureContext';
import { callTitle } from '../HuddleContext';
import { DockButton, ParticipantsPanel, Spinner, formatTime } from './callParts';
import CallStage from './CallStage';
import { useSpeaking } from './useSpeaking';
import { canPopOut } from './floatingWindow';

/** Seconds since the call started, ticking every second. */
export function useCallClock(startedAt) {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);
    return startedAt ? Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000)) : 0;
}

/** Typing in a field must never toggle the mic or camera. */
function isTyping(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/** { userId: stream } of everyone, me included, for the speaking ring. */
export function audioStreams(participants, { localStream, remoteStreams }) {
    const out = {};
    for (const p of participants) {
        const s = p.isLocal ? localStream : remoteStreams?.[p.userId];
        if (s) out[p.userId] = s;
    }
    return out;
}

/** The call's name, time and kind, shared by the full and the mini call. */
export function useCallHeader(ctx) {
    const call = ctx.selectedHuddle || ctx.panelCall || {};
    const started = ctx.session?.startedAt || call.startTime;
    const seconds = useCallClock(started);
    const title = callTitle({ ...call, channelName: call.channelName || ctx.session?.channelName });
    return { title, seconds, call };
}

/**
 * The call, full window: everyone's video or initials, the controls, the participants list
 * and the meeting panel (notes, agenda, transcript…). "Minimise" (or Esc) shrinks it to the
 * floating mini call so the app can be used while staying in the call.
 * Shortcuts: M mute, V camera, Esc minimise.
 */
export default function CallScreen({ ctx, onPopOut }) {
    const { showToast } = useToast();
    const {
        participants, muted, toggleMute, isVideo, cameraOn, toggleCamera, localStream, remoteStreams,
        screenStream, startScreenShare, stopScreenShare, peerStates, handRaised, toggleHand, huddleId,
    } = ctx;
    const [showPeople, setShowPeople] = useState(false);
    const { title, seconds } = useCallHeader(ctx);
    const speaking = useSpeaking(audioStreams(participants, { localStream, remoteStreams }));

    const capture = useCallCapture();
    const cap = capture?.live && capture.huddleId === huddleId ? capture : null;
    const recording = cap?.recording.state === 'recording';

    const sharing = !!screenStream;
    const canShare = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;
    const anyVideo = isVideo || sharing || cameraOn || participants.some(p => !p.isLocal && p.videoEnabled);
    const count = participants.length;
    const raised = participants.filter(p => p.handRaised).length;

    const handleScreen = async () => {
        if (sharing) { stopScreenShare(); return; }
        try {
            const ok = await startScreenShare();
            if (!ok) showToast('Screen sharing is not available in this call.', 'info');
        } catch (err) {
            if (err?.name === 'NotAllowedError') return; // the picker was closed
            showToast(err?.message || 'Could not share your screen.', 'error');
        }
    };

    useEffect(() => {
        const onKey = (e) => {
            if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
            if (e.key === 'Escape') { ctx.minimiseCall(); return; }
            const k = e.key.toLowerCase();
            if (k === 'm') { e.preventDefault(); toggleMute(); }
            if (k === 'v' && !sharing) { e.preventDefault(); toggleCamera(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [ctx, toggleMute, toggleCamera, sharing]);

    return (
        <div className="cs-screen" data-testid="call-screen" role="dialog" aria-label={`Call: ${title}`}>
            <header className="cs-head">
                <span className="hw-live-dot" />
                <h2 className="cs-title">{title}</h2>
                <span className="cs-time">{formatTime(seconds)}</span>
                {sharing && <span className="cs-chip is-accent">Sharing your screen</span>}
                {recording && <span className="cs-chip is-danger">Recording</span>}
                {raised > 0 && <span className="cs-chip">{raised} {raised === 1 ? 'hand' : 'hands'} up</span>}
                <span className="cs-head-spacer" />
                <span className="cs-sub">
                    {anyVideo ? 'Video call' : 'Voice call'} · {count} {count === 1 ? 'participant' : 'participants'}
                </span>
                <DockButton small testId="call-minimise" icon={Minimize2} label="Minimise (Esc)" onClick={ctx.minimiseCall} />
            </header>

            <div className="cs-body">
                <main className="cs-stage">
                    <CallStage
                        participants={participants}
                        localStream={localStream}
                        screenStream={screenStream}
                        remoteStreams={remoteStreams}
                        cameraOn={cameraOn}
                        speaking={speaking}
                        peerStates={peerStates}
                    />
                </main>
                {showPeople && <ParticipantsPanel participants={participants} peerStates={peerStates} onClose={() => setShowPeople(false)} />}
            </div>

            <footer className="cs-dock">
                <DockButton testId="call-mute" icon={muted ? MicOff : Mic} label={muted ? 'Unmute (M)' : 'Mute (M)'} onClick={toggleMute} danger={muted} />
                <DockButton testId="call-camera" icon={cameraOn ? Video : VideoOff}
                    label={sharing ? 'Stop sharing to change the camera' : cameraOn ? 'Turn camera off' : 'Turn camera on'}
                    onClick={toggleCamera} active={cameraOn} unavailable={sharing} />
                <DockButton testId="call-screen-share" icon={sharing ? MonitorOff : Monitor}
                    label={!canShare ? 'Screen sharing is not supported here' : sharing ? 'Stop sharing screen' : 'Share screen'}
                    onClick={handleScreen} active={sharing} unavailable={!canShare} />
                <DockButton testId="call-hand" icon={Hand} label={handRaised ? 'Lower hand' : 'Raise hand'} onClick={toggleHand} active={!!handRaised} />
                {cap && (
                    <DockButton testId="call-captions" icon={Captions}
                        label={!cap.captions.supported ? cap.captions.reason : cap.captions.on ? 'Stop my live captions' : 'Turn on my live captions'}
                        onClick={cap.captions.on ? cap.captions.stop : cap.captions.start} active={cap.captions.on} unavailable={!cap.captions.supported} />
                )}
                {cap?.recording.isHost && (
                    <DockButton testId="call-record" icon={Circle} label={recording ? 'Recording: open the Transcript tab to stop' : 'Record the call'}
                        onClick={() => ctx.openWorkspace('transcript')} danger={recording} unavailable={!cap.recording.supported} />
                )}
                <DockButton testId="call-workspace" icon={PanelRight}
                    label={ctx.workspaceOpen ? 'Hide the meeting panel' : 'Meeting panel: notes, agenda, transcript and recap'}
                    onClick={() => (ctx.workspaceOpen ? ctx.closeWorkspace() : ctx.openWorkspace())} active={!!ctx.workspaceOpen} />
                <span className="cs-sep" />
                <DockButton testId="call-people" icon={Users} label={showPeople ? 'Hide participants' : 'Show participants'}
                    onClick={() => setShowPeople(s => !s)} active={showPeople} badge={count} />
                {onPopOut && canPopOut() && (
                    <DockButton testId="call-popout" icon={PictureInPicture2} label="Pop out: keep the call on top of other windows" onClick={onPopOut} />
                )}
                <DockButton testId="call-leave" icon={PhoneOff} label="Leave huddle" onClick={ctx.leaveHuddle} danger wide />
            </footer>
        </div>
    );
}

/** Full-window "Connecting…" while the microphone is being opened. */
export function CallConnecting({ label, onCancel }) {
    return (
        <div className="cs-screen cs-connecting" data-testid="call-connecting" role="status">
            <Spinner size={36} color="var(--accent)" />
            <h2 className="cs-title">{label || 'Connecting'}…</h2>
            <p className="cs-sub">If you are asked, allow the microphone.</p>
            <button type="button" className="gl-btn" onClick={onCancel}>Cancel</button>
        </div>
    );
}
