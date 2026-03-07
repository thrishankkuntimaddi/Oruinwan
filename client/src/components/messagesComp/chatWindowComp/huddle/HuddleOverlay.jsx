/**
 * HuddleOverlay.jsx — Phase 7.7
 *
 * Fixed bottom-left overlay shown while a huddle is active.
 * Features:
 *   - Participant avatars
 *   - Duration timer
 *   - Mute toggle
 *   - Leave button
 *   - Minimise toggle
 */
import React, { useState, useEffect } from 'react';
import { Mic, MicOff, PhoneOff, ChevronDown, ChevronUp, Radio } from 'lucide-react';
import HuddleParticipants from './HuddleParticipants';

function formatDuration(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

export default function HuddleOverlay({
    active = false,
    participants = [],
    muted = false,
    channelName = '',
    onToggleMute,
    onLeave,
}) {
    const [minimised, setMinimised] = useState(false);
    const [elapsed, setElapsed] = useState(0);

    // Duration timer
    useEffect(() => {
        if (!active) { setElapsed(0); return; }
        const t = setInterval(() => setElapsed(s => s + 1), 1000);
        return () => clearInterval(t);
    }, [active]);

    if (!active) return null;

    return (
        <div
            className={`fixed bottom-4 left-4 z-50 flex flex-col bg-gray-900/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${minimised ? 'w-52' : 'w-64'}`}
            style={{ minWidth: 208 }}
        >
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2.5 bg-green-600/20 border-b border-white/10">
                <Radio size={13} className="text-green-400 flex-shrink-0 animate-pulse" />
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
                        {channelName ? `# ${channelName}` : 'Huddle'}
                    </p>
                    <p className="text-[10px] text-green-400">{formatDuration(elapsed)}</p>
                </div>
                <button
                    onClick={() => setMinimised(m => !m)}
                    className="text-white/50 hover:text-white transition p-1"
                    title={minimised ? 'Expand' : 'Minimise'}
                >
                    {minimised ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
            </div>

            {/* Body — hidden when minimised */}
            {!minimised && (
                <>
                    {/* Participants */}
                    <div className="px-3 py-2.5">
                        <p className="text-[10px] text-white/40 mb-2 uppercase tracking-wider">
                            {participants.length} {participants.length === 1 ? 'participant' : 'participants'}
                        </p>
                        <HuddleParticipants participants={participants} />
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-white/10 mx-3" />
                </>
            )}

            {/* Controls */}
            <div className="flex items-center justify-between px-3 py-2.5 gap-2">
                {/* Mute toggle */}
                <button
                    onClick={onToggleMute}
                    title={muted ? 'Unmute' : 'Mute'}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex-1 justify-center
                        ${muted
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            : 'bg-white/10 text-white hover:bg-white/20'
                        }`}
                >
                    {muted ? <MicOff size={13} /> : <Mic size={13} />}
                    <span>{muted ? 'Unmute' : 'Mute'}</span>
                </button>

                {/* Leave */}
                <button
                    onClick={onLeave}
                    title="Leave huddle"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-700 text-white transition-all"
                >
                    <PhoneOff size={13} />
                    <span>Leave</span>
                </button>
            </div>
        </div>
    );
}
