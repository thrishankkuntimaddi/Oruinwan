import React from 'react';
import { Clock, Star } from 'lucide-react';

const EmptyState = ({ loading }) => {
    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--bg-base)' }}>
                <div style={{ width: '72px', height: '72px', background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                    <Clock size={28} style={{ color: 'var(--text-muted)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                </div>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font)', marginBottom: '6px' }}>Loading Notes…</h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font)', textAlign: 'center', maxWidth: '220px' }}>Please wait while we fetch your notes.</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--bg-base)' }}>
            {}
            <div style={{ position: 'absolute', width: '280px', height: '280px', background: '#b8956a', opacity: 0.03, borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '72px', height: '72px', background: 'var(--accent-dim)', border: '1px solid rgba(184,149,106,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                    <Star size={28} style={{ color: 'var(--accent)' }} />
                </div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font)', marginBottom: '8px', letterSpacing: '-0.02em' }}>Select a Note</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font)', textAlign: 'center', maxWidth: '260px', lineHeight: 1.6 }}>
                    Choose a note from the sidebar or create a new one to get started.
                </p>
            </div>
        </div>
    );
};

export default EmptyState;
