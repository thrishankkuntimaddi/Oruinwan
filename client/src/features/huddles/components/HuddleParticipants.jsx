import React from 'react';
import { MicOff } from 'lucide-react';

function getInitials(name = '') {
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
}

export default function HuddleParticipants({ participants = [] }) {
    if (participants.length === 0) return null;

    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
            {participants.map((p) => {
                const label = p.isLocal ? 'You' : (p.username || p.userId?.slice(-4) || '?');
                const muted = p.audioEnabled === false;
                return (
                    <div key={p.userId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', width: '44px' }} title={muted ? `${label} (muted)` : label}>
                        <div style={{ position: 'relative' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>
                                {getInitials(p.username || label)}
                            </div>
                            {muted && (
                                <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '14px', height: '14px', borderRadius: '50%', background: 'var(--state-danger)', border: '1px solid var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <MicOff size={8} style={{ color: '#fff' }} />
                                </div>
                            )}
                        </div>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', maxWidth: '44px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                    </div>
                );
            })}
        </div>
    );
}
