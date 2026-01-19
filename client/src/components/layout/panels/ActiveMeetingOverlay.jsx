import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Mic, MicOff, Video, VideoOff, Monitor, Phone, Users, MessageSquare, Grid, Signal, Settings, Hand } from 'lucide-react';

const ActiveMeetingOverlay = ({ isOpen, onClose, meetingTitle = "Instant Huddle" }) => {
    const [status, setStatus] = useState('connecting'); // connecting, connected
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            setStatus('connecting');
            setDuration(0);

            // Simulate connection delay
            const timer = setTimeout(() => {
                setStatus('connected');
            }, 2500);

            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Timer logic
    useEffect(() => {
        let interval;
        if (status === 'connected' && isOpen) {
            interval = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [status, isOpen]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center text-white animate-fade-in overflow-hidden bg-[#0F1115]">
            {/* AMBIENT BACKGROUND */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] bg-purple-600/20 rounded-full blur-[150px] mix-blend-screen opacity-40 animate-pulse-slow"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[70vw] h-[70vw] bg-blue-600/20 rounded-full blur-[150px] mix-blend-screen opacity-40 animate-pulse-slow delay-1000"></div>
                <div className="absolute top-[30%] left-[30%] w-[40vw] h-[40vw] bg-indigo-500/10 rounded-full blur-[120px] mix-blend-screen opacity-30"></div>
            </div>

            {/* CONNECTING STATE */}
            {status === 'connecting' && (
                <div className="relative z-10 flex flex-col items-center justify-center h-full w-full backdrop-blur-3xl bg-black/40">
                    <div className="relative">
                        <div className="w-32 h-32 rounded-full border-2 border-white/20 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite] absolute inset-0"></div>
                        <div className="w-32 h-32 rounded-full border border-white/40 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite_delay-300] absolute inset-0"></div>
                        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 p-[2px] shadow-2xl shadow-indigo-500/50 relative z-10">
                            <div className="w-full h-full rounded-full bg-[#1a1b23] flex items-center justify-center overflow-hidden">
                                <span className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-indigo-400 to-purple-400">ME</span>
                            </div>
                        </div>
                    </div>
                    <div className="text-center mt-8 space-y-2">
                        <h3 className="text-2xl font-bold tracking-tight text-white drop-shadow-md">Joining Huddle...</h3>
                        <p className="text-white/50 text-sm font-medium">Establishing secure connection</p>
                    </div>
                </div>
            )}

            {/* CONNECTED STATE */}
            {status === 'connected' && (
                <div className="relative z-10 w-full h-full flex flex-col p-6">
                    {/* Header */}
                    <header className="flex justify-between items-center mb-6 z-50">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3 px-5 py-2.5 bg-white/5 backdrop-blur-2xl rounded-full border border-white/10 shadow-lg hover:bg-white/10 transition-colors">
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
                                </span>
                                <div className="h-4 w-px bg-white/10"></div>
                                <h3 className="font-semibold text-sm tracking-wide text-white/90">{meetingTitle}</h3>
                                <span className="text-white/40 text-sm font-mono tracking-wider">{formatTime(duration)}</span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            {/* Network Status */}
                            <div className="flex items-center justify-center w-10 h-10 bg-white/5 backdrop-blur-lg rounded-full border border-white/10 text-emerald-400 shadow-inner group cursor-help relative">
                                <Signal size={16} />
                                <div className="absolute top-12 right-0 w-32 bg-black/90 text-white text-[10px] p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-white/10">
                                    Connection: Excellent
                                </div>
                            </div>

                            {/* Layout Toggle */}
                            <button className="flex items-center justify-center w-10 h-10 bg-white/5 backdrop-blur-lg rounded-full border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all active:scale-95">
                                <Grid size={18} />
                            </button>

                            {/* Settings */}
                            <button className="flex items-center justify-center w-10 h-10 bg-white/5 backdrop-blur-lg rounded-full border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all active:scale-95">
                                <Settings size={18} />
                            </button>
                        </div>
                    </header>

                    {/* MAIN GRID */}
                    <main className="flex-1 w-full max-w-[1600px] mx-auto grid grid-cols-2 gap-6 pb-24 h-full items-center">

                        {/* CARD: ME */}
                        <div className="relative w-full h-full max-h-[60vh] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-2xl rounded-[32px] overflow-hidden border border-white/10 shadow-2xl transition-all duration-300 hover:border-white/20 group">
                            {/* Video Area */}
                            <div className="absolute inset-0 bg-black/40">
                                {isVideoOff ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center">
                                        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 p-[2px] shadow-[0_0_60px_rgba(99,102,241,0.3)]">
                                            <div className="w-full h-full rounded-full bg-[#1a1b23] flex items-center justify-center">
                                                <span className="text-3xl font-bold text-white">ME</span>
                                            </div>
                                        </div>
                                        <div className="mt-6 px-4 py-2 bg-black/30 backdrop-blur-md rounded-full border border-white/10 text-sm text-white/60 font-medium">
                                            Camera is off
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full h-full relative overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-black animate-pulse-slow opacity-50"></div>
                                        <div className="absolute inset-0 flex items-center justify-center text-white/30 font-medium tracking-widest uppercase text-sm">
                                            Video Feed Simulation
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Label Overlay */}
                            <div className="absolute bottom-6 left-6 flex items-center gap-3">
                                <div className="px-4 py-2 bg-black/60 backdrop-blur-xl rounded-xl border border-white/10 flex items-center gap-2 shadow-lg">
                                    <span className="text-sm font-semibold tracking-wide text-white">You</span>
                                    <div className={`w-2 h-2 rounded-full ${isMuted ? 'bg-red-500' : 'bg-emerald-500'} shadow-[0_0_8px_rgba(255,255,255,0.3)]`}></div>
                                </div>
                                {isMuted && (
                                    <div className="px-3 py-2 bg-red-500/20 backdrop-blur-xl rounded-xl border border-red-500/20 flex items-center justify-center text-red-400 shadow-lg">
                                        <MicOff size={16} />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* CARD: PARTICIPANT */}
                        <div className="relative w-full h-full max-h-[60vh] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-2xl rounded-[32px] overflow-hidden border border-white/10 shadow-2xl transition-all duration-300 hover:border-emerald-500/30 group ring-1 ring-inset ring-white/5">
                            {/* Video Area */}
                            <div className="absolute inset-0 bg-black/40">
                                <div className="w-full h-full flex flex-col items-center justify-center">
                                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 p-[2px] shadow-[0_0_60px_rgba(16,185,129,0.3)] animate-pulse-slow">
                                        <div className="w-full h-full rounded-full bg-[#1a1b23] flex items-center justify-center">
                                            <span className="text-3xl font-bold text-white">JD</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Speaking Indicator Border */}
                            <div className="absolute inset-0 border-2 border-emerald-500/50 rounded-[32px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-[inset_0_0_40px_rgba(16,185,129,0.1)]"></div>

                            {/* Label Overlay */}
                            <div className="absolute bottom-6 left-6">
                                <div className="px-4 py-2 bg-black/60 backdrop-blur-xl rounded-xl border border-white/10 shadow-lg">
                                    <span className="text-sm font-semibold tracking-wide text-white">John Doe</span>
                                </div>
                            </div>

                            {/* Audio Indicator */}
                            <div className="absolute top-6 right-6">
                                <div className="px-3 py-2 bg-emerald-500/20 backdrop-blur-xl rounded-xl border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                                    <Mic size={16} />
                                </div>
                            </div>
                        </div>

                    </main>

                    {/* DOCK CONTROL BAR */}
                    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
                        <div className="flex items-center gap-3 p-2 bg-black/40 backdrop-blur-3xl rounded-3xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] ring-1 ring-white/5 px-4 h-20">

                            {/* Mic Toggle */}
                            <button
                                onClick={() => setIsMuted(!isMuted)}
                                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg ${isMuted
                                    ? 'bg-red-500 text-white shadow-red-500/30'
                                    : 'bg-white/10 text-white hover:bg-white/20 border border-white/5'
                                    }`}
                                title={isMuted ? "Unmute" : "Mute"}
                            >
                                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                            </button>

                            {/* Video Toggle */}
                            <button
                                onClick={() => setIsVideoOff(!isVideoOff)}
                                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg ${isVideoOff
                                    ? 'bg-red-500 text-white shadow-red-500/30'
                                    : 'bg-white/10 text-white hover:bg-white/20 border border-white/5'
                                    }`}
                                title={isVideoOff ? "Turn Video On" : "Turn Video Off"}
                            >
                                {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
                            </button>

                            {/* Screen Share */}
                            <button
                                onClick={() => setIsScreenSharing(!isScreenSharing)}
                                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg ${isScreenSharing
                                    ? 'bg-blue-500 text-white shadow-blue-500/30'
                                    : 'bg-white/10 text-white hover:bg-white/20 border border-white/5'
                                    }`}
                                title="Share Screen"
                            >
                                <Monitor size={24} />
                            </button>

                            {/* Hand Raise */}
                            <button
                                className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg bg-white/10 text-white hover:bg-white/20 border border-white/5"
                                title="Raise Hand"
                            >
                                <Hand size={24} />
                            </button>

                            <div className="w-px h-8 bg-white/10 mx-2"></div>

                            {/* Chat */}
                            <button className="relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg bg-white/10 text-white hover:bg-white/20 border border-white/5">
                                <MessageSquare size={24} />
                                <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#1a1b23]"></span>
                            </button>

                            {/* Participants */}
                            <button className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg bg-white/10 text-white hover:bg-white/20 border border-white/5">
                                <Users size={24} />
                            </button>

                            <div className="w-px h-8 bg-white/10 mx-2"></div>

                            {/* End Call */}
                            <button
                                onClick={onClose}
                                className="w-20 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg bg-red-500 hover:bg-red-600 text-white shadow-red-500/40"
                                title="Leave Meeting"
                            >
                                <Phone size={28} style={{ transform: 'rotate(135deg)' }} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
};

export default ActiveMeetingOverlay;
