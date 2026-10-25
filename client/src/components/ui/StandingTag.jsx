import React from 'react';

/**
 * Someone who left the workspace, was removed or suspended, or closed their account keeps
 * their name on what they wrote; this small tag says they're no longer active.
 */
export const STANDING_LABELS = { former: 'Former member', deactivated: 'Deactivated', suspended: 'Suspended' };

export function standingLabel(standing) {
    return STANDING_LABELS[standing] || null;
}

export default function StandingTag({ standing, style }) {
    const label = standingLabel(standing);
    if (!label) return null;
    return (
        <span data-testid="standing-tag" style={{
            flexShrink: 0, marginLeft: 6, padding: '0 6px', borderRadius: 999, border: '1px solid var(--border-default)',
            fontSize: 9.5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', lineHeight: '16px', ...style,
        }}>{label}</span>
    );
}
