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

const ParticipantCard = ({ participant, isLocal, colorIdx }) => {
    const color = AVATAR_COLORS[colorIdx % AVATAR_COLORS.length];
    const label = isLocal ? 'You' : (participant.username || participant.userId?.slice(-4) || 'Guest');
    const isAudioOn = participant.audioEnabled !== false;

    return (
        <div className="relative bg-gradient-to-br from-white/5 to-white/[0.02] rounded-[28px] overflow-hidden border border-white/10 shadow-2xl transition-all duration-300 hover:border-white/20 group aspect-video flex items-center justify-center">
            {}
            <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-10`} />

            {}
            <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${color} p-[2px] shadow-2xl`}>
                <div className="w-full h-full rounded-full flex items-center justify-center" style={{ background: '#111' }}>
                    <span className="text-3xl font-bold text-white">{getInitials(label)}</span>
                </div>
            </div>

            {}
            {isAudioOn && (
                <div className="absolute inset-0 border-2 border-emerald-500/40 rounded-[28px] animate-pulse pointer-events-none" />
            )}

            {}
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

const LandingView = ({ onStart, onSchedule, starting }) => (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px', background: 'var(--bg-base)', position: 'relative', overflow: 'hidden' }}>
        {}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '30%', left: '20%', width: '40vw', height: '40vw', background: 'rgba(184,149,106,0.04)', borderRadius: '50%', filter: 'blur(100px)' }} />
            <div style={{ position: 'absolute', bottom: '25%', right: '20%', width: '30vw', height: '30vw', background: 'rgba(184,149,106,0.03)', borderRadius: '50%', filter: 'blur(80px)' }} />
        </div>

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '88px', height: '88px', background: 'rgba(184,149,106,0.1)', border: '1px solid rgba(184,149,106,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                <Video size={34} style={{ color: '#b8956a' }} />
            </div>

            <h2 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px', letterSpacing: '-0.02em', fontFamily: 'Inter, system-ui, sans-serif' }}>
                Video Huddles Center
            </h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: '360px', marginBottom: '32px', fontSize: '14px', lineHeight: 1.6, fontFamily: 'Inter, system-ui, sans-serif' }}>
                Start a real-time video call with your team, or select an active huddle from the sidebar to join.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '260px' }}>
                <button
                    onClick={onStart}
                    disabled={starting}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '12px 24px', background: '#b8956a', border: 'none', color: '#0c0c0c', fontWeight: 700, fontSize: '14px', cursor: starting ? 'not-allowed' : 'pointer', opacity: starting ? 0.6 : 1, transition: 'opacity 150ms ease', fontFamily: 'Inter, system-ui, sans-serif' }}
                >
                    {starting ? (
                        <>
                            <span style={{ width: '14px', height: '14px', border: '2px solid #0c0c0c', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                            Starting...
                        </>
                    ) : (
                        <>
                            <Radio size={16} />
                            Start Instant Huddle
                        </>
                    )}
                </button>
                <button
                    onClick={onSchedule}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '10px 24px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', fontWeight: 500, fontSize: '13px', cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'Inter, system-ui, sans-serif' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#e4e4e4'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(228,228,228,0.6)'; }}
                >
                    <Calendar size={13} />
                    Schedule for Later
                </button>
            </div>

            {}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '36px' }}>
                {["HD Video", "Screen Share", "Real-time Audio", "Participants List", "In-call Chat"].map(f => (
                    <span key={f} style={{ padding: '4px 12px', background: 'var(--bg-hover)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                        {f}
                    </span>
                ))}
            </div>
        </div>
    </div>
);

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
        <div className="h-full w-full flex flex-col text-white overflow-hidden relative" style={{ background: 'var(--bg-base)' }}>
            {}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] rounded-full" style={{ background: 'rgba(184,149,106,0.04)', filter: 'blur(150px)', animation: 'pulse 4s ease-in-out infinite' }} />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full" style={{ background: 'rgba(184,149,106,0.025)', filter: 'blur(150px)', animation: 'pulse 4s ease-in-out infinite', animationDelay: '1s' }} />
            </div>

            {}
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
                    {}
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

            {}
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

            {}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
                <div className="flex items-center gap-2 p-2 px-4 bg-black/40 backdrop-blur-3xl rounded-3xl border border-white/10 shadow-2xl ring-1 ring-white/5 h-18">
                    {}
                    <button
                        onClick={onToggleMute}
                        className={`w-13 h-13 rounded-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg ${muted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                            }`}
                        style={{ width: 52, height: 52 }}
                        title={muted ? "Unmute" : "Mute"}
                    >
                        {muted ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>

                    {}
                    <button
                        onClick={onToggleVideo}
                        className={`flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg rounded-2xl ${isVideoOff ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                            }`}
                        style={{ width: 52, height: 52 }}
                        title={isVideoOff ? "Turn Video On" : "Turn Video Off"}
                    >
                        {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
                    </button>

                    {}
                    <button
                        onClick={onToggleScreen}
                        className={`flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg rounded-2xl ${isScreenSharing ? 'text-white' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'}`}
                        style={{ width: 52, height: 52, ...(isScreenSharing ? { background: '#b8956a' } : {}) }}
                        title="Share Screen"
                    >
                        <Monitor size={20} />
                    </button>

                    {}
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

                    {}
                    <button
                        onClick={() => setShowChat(c => !c)}
                        className={`relative flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg rounded-2xl ${showChat ? 'text-white' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'}`}
                        style={{ width: 52, height: 52, ...(showChat ? { background: '#b8956a' } : {}) }}
                    >
                        <MessageSquare size={20} />
                    </button>

                    {}
                    <button
                        className="flex items-center justify-center bg-white/10 text-white hover:bg-white/20 border border-white/10 transition-all hover:scale-105 active:scale-95 shadow-lg rounded-2xl relative"
                        style={{ width: 52, height: 52 }}
                        title="Participants"
                    >
                        <Users size={20} />
                        {participants.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center" style={{ background: '#b8956a', color: '#0c0c0c' }}>
                                {participants.length}
                            </span>
                        )}
                    </button>

                    <div className="w-px h-8 bg-white/10 mx-1" />

                    {}
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

const ConnectingView = () => (
    <div className="h-full flex flex-col items-center justify-center text-white" style={{ background: 'var(--bg-base)' }}>
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] rounded-full" style={{ background: 'rgba(184,149,106,0.06)', filter: 'blur(150px)' }} />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-6">
            <div className="relative">
                <div className="w-28 h-28 rounded-full border border-white/10 animate-ping absolute inset-0" />
                <div className="w-28 h-28 rounded-full p-[2px] shadow-2xl relative z-10" style={{ background: 'linear-gradient(135deg, #b8956a, #8a6a47)' }}>
                    <div className="w-full h-full rounded-full flex items-center justify-center" style={{ background: '#111' }}>
                        <Radio size={32} style={{ color: '#b8956a', animation: 'pulse 1.5s ease-in-out infinite' }} />
                    </div>
                </div>
            </div>
            <div className="text-center">
                <h3 className="text-xl font-bold text-white mb-1">Connecting...</h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Establishing secure connection</p>
            </div>
        </div>
    </div>
);

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

    
    if (connecting) return <ConnectingView />;

    
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
