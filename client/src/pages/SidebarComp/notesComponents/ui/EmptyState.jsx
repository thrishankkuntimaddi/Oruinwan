import React from 'react';
import { Clock, Star } from 'lucide-react';

const T = {
    bg: '#0c0c0c', text: '#e4e4e4', muted: 'rgba(228,228,228,0.35)',
    accent: '#b8956a', accentBg: 'rgba(184,149,106,0.08)',
    surface: 'rgba(255,255,255,0.04)', font: 'Inter, system-ui, sans-serif',
};

const EmptyState = ({ loading }) => {
    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: T.bg }}>
                <div style={{ width: '72px', height: '72px', background: T.surface, border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                    <Clock size={28} style={{ color: T.muted, animation: 'pulse 1.5s ease-in-out infinite' }} />
                </div>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: T.text, fontFamily: T.font, marginBottom: '6px' }}>Loading Notes…</h2>
                <p style={{ fontSize: '12px', color: T.muted, fontFamily: T.font, textAlign: 'center', maxWidth: '220px' }}>Please wait while we fetch your notes.</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: T.bg }}>
            {/* Ambient glow */}
            <div style={{ position: 'absolute', width: '280px', height: '280px', background: T.accent, opacity: 0.03, borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '72px', height: '72px', background: T.accentBg, border: '1px solid rgba(184,149,106,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                    <Star size={28} style={{ color: T.accent }} />
                </div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: T.text, fontFamily: T.font, marginBottom: '8px', letterSpacing: '-0.02em' }}>Select a Note</h2>
                <p style={{ fontSize: '13px', color: T.muted, fontFamily: T.font, textAlign: 'center', maxWidth: '260px', lineHeight: 1.6 }}>
                    Choose a note from the sidebar or create a new one to get started.
                </p>
            </div>
        </div>
    );
};

export default EmptyState;
