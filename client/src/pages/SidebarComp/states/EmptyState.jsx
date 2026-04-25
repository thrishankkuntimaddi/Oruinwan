import { Hash, Users } from 'lucide-react';

function EmptyState({ onNavigateChannels, onNavigateDMs }) {
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%',
            background: 'var(--bg-base)', position: 'relative', overflow: 'hidden',
            fontFamily: 'var(--font)',
        }}>
            {}
            <div style={{ position: 'absolute', top: '25%', left: '30%', width: '360px', height: '360px', background: 'var(--accent)', opacity: 0.03, borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />

            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '400px', textAlign: 'center', padding: '32px 24px' }}>

                {}
                <div style={{ width: '80px', height: '80px', borderRadius: '2px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '28px', overflow: 'hidden', flexShrink: 0 }}>
                    <video
                        src="/hover-animation.mp4"
                        autoPlay loop muted playsInline
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                </div>

                <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                    Welcome to Chttrix
                </h1>

                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 28px', lineHeight: 1.7, maxWidth: '280px' }}>
                    Your command centre for collaboration. Select a channel or direct message to start.
                </p>

                {}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%' }}>
                    {[
                        { label: 'Channels', sub: 'Team discussions', Icon: Hash, onClick: onNavigateChannels },
                        { label: 'Direct Messages', sub: 'Private chats', Icon: Users, onClick: onNavigateDMs },
                    ].map(({ label, sub, Icon, onClick }) => (
                        <div key={label} onClick={onClick}
                            style={{ padding: '14px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', transition: 'background 150ms ease, border-color 150ms ease' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                        >
                            <div style={{ width: '32px', height: '32px', borderRadius: '2px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--text-muted)', transition: 'color 150ms ease' }}>
                                <Icon size={16} />
                            </div>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '2px' }}>{label}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sub}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default EmptyState;
