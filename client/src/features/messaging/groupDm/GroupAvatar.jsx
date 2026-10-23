import { Users } from 'lucide-react';

/** Round avatar for a group DM (people icon), sized like a person's avatar. */
export default function GroupAvatar({ size = 24, active = false, title }) {
    return (
        <span
            aria-hidden={title ? undefined : 'true'}
            title={title}
            data-testid="group-avatar"
            style={{
                width: size, height: size, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: active ? 'var(--gl-accent-soft, var(--bg-active))' : 'var(--bg-active)',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                border: '1px solid var(--border-default)',
            }}
        >
            <Users size={Math.max(10, Math.round(size * 0.5))} strokeWidth={2} />
        </span>
    );
}
