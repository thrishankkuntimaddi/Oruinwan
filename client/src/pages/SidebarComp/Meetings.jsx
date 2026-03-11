import React, { useState, useCallback, useEffect } from 'react';
import {
    Mic, MicOff, Video, VideoOff, Monitor, Phone,
    Users, MessageSquare, Grid, Signal, Settings, Hand,
    Radio, Plus, Play, Calendar,
} from 'lucide-react';
import { useHuddleContext } from '../../contexts/HuddleContext';
import { useToast } from '../../contexts/ToastContext';
import { useScheduledMeetings } from '../../hooks/useScheduledMeetings';
import ScheduleMeetingModal from '../../components/messagesComp/chatWindowComp/modals/ScheduleMeetingModal';
import { useParams } from 'react-router-dom';

// ── Helpers ────────────────────────────────────────────────────────────────
function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

const AVATAR_COLORS = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-indigo-600',
    'from-emerald-400 to-cyan-500',
    'from-rose-400 to-pink-500',
    'from-amber-400 to-orange-500',
    'from-sky-400 to-blue-500',
];

function getInitials(name = '') {
    return name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '??';
}

// ── Participant Video Card ─────────────────────────────────────────────────
const ParticipantCard = ({ participant, isLocal, colorIdx }) => {
    const color = AVATAR_COLORS[colorIdx % AVATAR_COLORS.length];
    const label = isLocal ? 'You' : (participant.username || participant.userId?.slice(-4) || 'Guest');
    const isAudioOn = participant.audioEnabled !== false;

    return (
        <div className="relative bg-gradient-to-br from-white/5 to-white/[0.02] rounded-[28px] overflow-hidden border border-white/10 shadow-2xl transition-all duration-300 hover:border-white/20 group aspect-video flex items-center justify-center">
            {/* Ambient glow */}
            <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-10`} />

            {/* Avatar */}
            <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${color} p-[2px] shadow-2xl`}>
                <div className="w-full h-full rounded-full bg-[#1a1b23] flex items-center justify-center">
                    <span className="text-3xl font-bold text-white">{getInitials(label)}</span>
                </div>
            </div>

            {/* Speaking ring */}
            {isAudioOn && (
                <div className="absolute inset-0 border-2 border-emerald-500/40 rounded-[28px] animate-pulse pointer-events-none" />
            )}

            {/* Name label */}
            <div className="absolute bottom-4 left-4 flex items-center gap-2">
                <div className="px-3 py-1.5 bg-black/60 backdrop-blur-xl rounded-xl border border-white/10 flex items-center gap-2 shadow-lg">
                    <span className="text-sm font-semibold text-white tracking-wide">{label}</span>
                    <div className={`w-1.5 h-1.5 rounded-full ${isAudioOn ? 'bg-emerald-400' : 'bg-red-500'}`} />
                </div>
                {!isAudioOn && (
                    <div className="px-2 py-1.5 bg-red-500/20 backdrop-blur-xl rounded-xl border border-red-500/20 flex items-center justify-center text-red-400">
                        <MicOff size={12} />
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Landing / No Huddle Selected View ─────────────────────────────────────
const LandingView = ({ onStart, onSchedule, starting }) => (
    <div className="h-full flex flex-col items-center justify-center text-center px-8 bg-gray-50 dark:bg-gray-950">
        {/* Ambient blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1/3 left-1/4 w-[40vw] h-[40vw] bg-indigo-500/5 rounded-full blur-[100px]" />
            <div className="absolute bottom-1/3 right-1/4 w-[30vw] h-[30vw] bg-purple-500/5 rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 flex flex-col items-center">
            <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/10">
                <Video size={36} className="text-indigo-600 dark:text-indigo-400" />
            </div>

            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3 tracking-tight">
                Video Huddles Center
            </h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-8 text-base leading-relaxed">
                Start a real-time video call with your team, or select an active huddle from the sidebar to join.
            </p>

            <div className="flex flex-col gap-3 w-full max-w-xs">
                <button
                    onClick={onStart}
                    disabled={starting}
                    className="flex items-center justify-center gap-2.5 w-full px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-2xl transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                    {starting ? (
                        <>
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Starting...
                        </>
                    ) : (
                        <>
                            <Radio size={17} />
                            Start Instant Huddle
                        </>
                    )}
                </button>
                <button
                    onClick={onSchedule}
                    className="flex items-center justify-center gap-2 w-full px-6 py-3 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-sm"
                >
                    <Calendar size={14} />
                    Schedule for Later
                </button>
            </div>

            {/* Feature Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-10">
                {["HD Video", "Screen Share", "Real-time Audio", "Participants List", "In-call Chat"].map(f => (
                    <span key={f} className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs rounded-full font-medium">
                        {f}
                    </span>
                ))}
            </div>
        </div>
    </div>
);

// ── Active Meeting Room ────────────────────────────────────────────────────
const ActiveRoom = ({ huddle, participants, muted, isVideoOff, isScreenSharing,
    onToggleMute, onToggleVideo, onToggleScreen, onLeave }) => {

    const [duration, setDuration] = useState(0);
    const [handRaised, setHandRaised] = useState(false);
    const [showChat, setShowChat] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => setDuration(d => d + 1), 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="h-full w-full flex flex-col bg-[#0F1115] text-white overflow-hidden relative">
            {/* Ambient Background */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] bg-purple-600/15 rounded-full blur-[150px] animate-pulse" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-blue-600/15 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            {/* ── Header ── */}
            <header className="relative z-10 flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-3 px-4 py-2 bg-white/5 backdrop-blur-2xl rounded-full border border-white/10 shadow-lg">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        <div className="h-3.5 w-px bg-white/20" />
                        <h3 className="font-semibold text-sm text-white/90 tracking-wide">
                            {huddle?.title || 'Instant Huddle'}
                        </h3>
                        <span className="font-mono text-sm text-white/50 tabular-nums">{formatTime(duration)}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Signal */}
                    <div className="relative group flex items-center justify-center w-9 h-9 bg-white/5 rounded-full border border-white/10 text-emerald-400 cursor-help">
                        <Signal size={15} />
                        <div className="absolute top-11 right-0 w-32 bg-black/90 text-[10px] p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-white/10 text-center">
                            Connection: Good
                        </div>
                    </div>
                    <button className="flex items-center justify-center w-9 h-9 bg-white/5 rounded-full border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all">
                        <Grid size={15} />
                    </button>
                    <button className="flex items-center justify-center w-9 h-9 bg-white/5 rounded-full border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all">
                        <Settings size={15} />
                    </button>
                </div>
            </header>

            {/* ── Participant Grid ── */}
            <main className="relative z-10 flex-1 px-6 pb-28 overflow-hidden">
                {participants.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4">
                        <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                            <Users size={28} className="text-white/40" />
                        </div>
                        <p className="text-white/50 text-sm">Waiting for others to join...</p>
                    </div>
                ) : (
                    <div className={`h-full grid gap-4 items-center ${participants.length === 1 ? "grid-cols-1 max-w-xl mx-auto" :
                            participants.length <= 4 ? "grid-cols-2" :
                                "grid-cols-3"
                        }`}>
                        {participants.map((p, i) => (
                            <ParticipantCard
                                key={p.userId}
                                participant={p}
                                isLocal={p.isLocal}
                                colorIdx={i}
                            />
                        ))}
                    </div>
                )}
            </main>

            {/* ── Control Dock ── */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
                <div className="flex items-center gap-2 p-2 px-4 bg-black/40 backdrop-blur-3xl rounded-3xl border border-white/10 shadow-2xl ring-1 ring-white/5 h-18">
                    {/* Mic */}
                    <button
                        onClick={onToggleMute}
                        className={`w-13 h-13 rounded-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg ${muted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                            }`}
                        style={{ width: 52, height: 52 }}
                        title={muted ? "Unmute" : "Mute"}
                    >
                        {muted ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>

                    {/* Video */}
                    <button
                        onClick={onToggleVideo}
                        className={`flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg rounded-2xl ${isVideoOff ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                            }`}
                        style={{ width: 52, height: 52 }}
                        title={isVideoOff ? "Turn Video On" : "Turn Video Off"}
                    >
                        {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
                    </button>

                    {/* Screen Share */}
                    <button
                        onClick={onToggleScreen}
                        className={`flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg rounded-2xl ${isScreenSharing ? 'bg-blue-500 text-white' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                            }`}
                        style={{ width: 52, height: 52 }}
                        title="Share Screen"
                    >
                        <Monitor size={20} />
                    </button>

                    {/* Raise Hand */}
                    <button
                        onClick={() => setHandRaised(h => !h)}
                        className={`flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg rounded-2xl ${handRaised ? 'bg-yellow-500 text-white' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                            }`}
                        style={{ width: 52, height: 52 }}
                        title={handRaised ? "Lower Hand" : "Raise Hand"}
                    >
                        <Hand size={20} />
                    </button>

                    <div className="w-px h-8 bg-white/10 mx-1" />

                    {/* Chat */}
                    <button
                        onClick={() => setShowChat(c => !c)}
                        className={`relative flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg rounded-2xl ${showChat ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                            }`}
                        style={{ width: 52, height: 52 }}
                    >
                        <MessageSquare size={20} />
                    </button>

                    {/* Participants */}
                    <button
                        className="flex items-center justify-center bg-white/10 text-white hover:bg-white/20 border border-white/10 transition-all hover:scale-105 active:scale-95 shadow-lg rounded-2xl relative"
                        style={{ width: 52, height: 52 }}
                        title="Participants"
                    >
                        <Users size={20} />
                        {participants.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full text-[9px] font-bold flex items-center justify-center">
                                {participants.length}
                            </span>
                        )}
                    </button>

                    <div className="w-px h-8 bg-white/10 mx-1" />

                    {/* Leave */}
                    <button
                        onClick={onLeave}
                        className="flex items-center justify-center bg-red-500 hover:bg-red-600 text-white transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-500/30 rounded-2xl"
                        style={{ width: 68, height: 52 }}
                        title="Leave Huddle"
                    >
                        <Phone size={22} style={{ transform: 'rotate(135deg)' }} />
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Connecting State ───────────────────────────────────────────────────────
const ConnectingView = () => (
    <div className="h-full flex flex-col items-center justify-center bg-[#0F1115] text-white">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] bg-indigo-600/10 rounded-full blur-[150px]" />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-6">
            <div className="relative">
                <div className="w-28 h-28 rounded-full border border-white/20 animate-ping absolute inset-0" />
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 p-[2px] shadow-2xl shadow-indigo-500/50 relative z-10">
                    <div className="w-full h-full rounded-full bg-[#1a1b23] flex items-center justify-center">
                        <Radio size={32} className="text-indigo-400 animate-pulse" />
                    </div>
                </div>
            </div>
            <div className="text-center">
                <h3 className="text-xl font-bold text-white mb-1">Connecting...</h3>
                <p className="text-white/40 text-sm">Establishing secure connection</p>
            </div>
        </div>
    </div>
);

// ── Main Component ─────────────────────────────────────────────────────────
const Meetings = () => {
    const { showToast } = useToast();
    const { workspaceId } = useParams();

    const {
        active,
        participants,
        muted,
        selectedHuddle,
        setSelectedHuddle,
        startHuddle,
        leaveHuddle,
        toggleMute,
    } = useHuddleContext();

    const { createMeeting } = useScheduledMeetings(workspaceId);
    const [showScheduleModal, setShowScheduleModal] = useState(false);

    const [starting, setStarting] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    // When a huddle starts, show connecting state briefly
    useEffect(() => {
        if (active && connecting) {
            const t = setTimeout(() => setConnecting(false), 2000);
            return () => clearTimeout(t);
        }
    }, [active, connecting]);

    const handleStart = async () => {
        if (starting) return;
        setStarting(true);
        setConnecting(true);
        try {
            await startHuddle("Instant Huddle");
        } catch (err) {
            setConnecting(false);
            showToast("Microphone permission denied. Please allow mic access.", "error");
        } finally {
            setStarting(false);
        }
    };

    const handleLeave = () => {
        leaveHuddle();
        setSelectedHuddle(null);
        setIsVideoOff(false);
        setIsScreenSharing(false);
    };

    const handleSchedule = useCallback(async (payload) => {
        try {
            await createMeeting(payload);
            showToast("Meeting scheduled!", "success");
            setShowScheduleModal(false);
        } catch (err) {
            showToast(err?.response?.data?.message || "Failed to schedule meeting", "error");
            throw err;
        }
    }, [createMeeting, showToast]);

    // Show connecting animation briefly
    if (connecting) return <ConnectingView />;

    // Active huddle in this context — show the room
    if (active && selectedHuddle) {
        return (
            <>
                <ActiveRoom
                    huddle={selectedHuddle}
                    participants={participants}
                    muted={muted}
                    isVideoOff={isVideoOff}
                    isScreenSharing={isScreenSharing}
                    onToggleMute={toggleMute}
                    onToggleVideo={() => setIsVideoOff(v => !v)}
                    onToggleScreen={() => {
                        setIsScreenSharing(s => !s);
                        showToast(isScreenSharing ? "Screen sharing stopped" : "Screen sharing started", "info");
                    }}
                    onLeave={handleLeave}
                />
                {showScheduleModal && (
                    <ScheduleMeetingModal
                        onSchedule={handleSchedule}
                        onClose={() => setShowScheduleModal(false)}
                        conversationId={null}
                        conversationType={null}
                    />
                )}
            </>
        );
    }

    // Landing view
    return (
        <>
            <LandingView
                onStart={handleStart}
                onSchedule={() => setShowScheduleModal(true)}
                starting={starting}
            />
            {showScheduleModal && (
                <ScheduleMeetingModal
                    onSchedule={handleSchedule}
                    onClose={() => setShowScheduleModal(false)}
                    conversationId={null}
                    conversationType={null}
                />
            )}
        </>
    );
};

export default Meetings;
