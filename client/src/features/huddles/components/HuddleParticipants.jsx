import React from 'react';
import { MicOff } from 'lucide-react';

function getInitials(name = '') {
    return name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
}

const AVATAR_COLORS = [
    'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
    'bg-rose-500', 'bg-amber-500', 'bg-cyan-500',
];

export default function HuddleParticipants({ participants = [] }) {
    if (participants.length === 0) return null;

    return (
        <div className="flex items-center gap-1.5 flex-wrap">
            {participants.map((p, idx) => {
                const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                const label = p.isLocal ? 'You' : (p.username || p.userId?.slice(-4) || '?');

                return (
                    <div key={p.userId} className="flex flex-col items-center gap-0.5" title={label}>
                        {}
                        <div className="relative">
                            <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-[11px] font-bold ring-2 ring-white/20`}>
                                {getInitials(label)}
                            </div>
                            {}
                            {p.audioEnabled === false && (
                                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center ring-1 ring-white">
                                    <MicOff size={8} className="text-white" />
                                </div>
                            )}
                            {}
                            {p.audioEnabled !== false && (
                                <div className="absolute inset-0 rounded-full ring-2 ring-green-400/60 animate-pulse pointer-events-none" />
                            )}
                        </div>
                        <span className="text-[9px] text-white/70 max-w-[36px] truncate">{label}</span>
                    </div>
                );
            })}
        </div>
    );
}
