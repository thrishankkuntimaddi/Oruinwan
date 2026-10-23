import React, { useEffect, useState } from 'react';
import { Phone, PhoneOff, Video, Users, X } from 'lucide-react';
import { getInitials } from './callParts';

function CallerAvatar({ from, size = 88 }) {
    const [broken, setBroken] = useState(false);
    const src = !broken && from?.avatar ? from.avatar : null;
    return (
        <span className="ic-avatar" style={{ width: size, height: size }} aria-hidden="true">
            {src
                ? <img src={src} alt="" onError={() => setBroken(true)} />
                : <span className="ic-initials">{getInitials(from?.name || '?')}</span>}
        </span>
    );
}

/** What the ring is about: "Incoming video call", "Group call · Launch crew". */
export function ringLabel(ring) {
    const what = ring?.video ? 'video call' : 'voice call';
    if (ring?.kind === 'group_dm') return `Incoming group ${what}`;
    return `Incoming ${what}`;
}

/**
 * The incoming-call screen (DM and group-DM calls): who is calling, Accept and Decline.
 * Esc declines; Enter accepts.
 */
export function IncomingCall({ ring, onAccept, onDecline }) {
    useEffect(() => {
        if (!ring) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); onDecline(); }
            if (e.key === 'Enter' && !e.target?.closest?.('input, textarea, [contenteditable="true"]')) { e.preventDefault(); onAccept(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [ring, onAccept, onDecline]);

    if (!ring) return null;
    const name = ring.from?.name || 'Someone';
    const group = ring.kind === 'group_dm';
    return (
        <div className="ic-backdrop" data-testid="incoming-call" role="alertdialog" aria-modal="true" aria-label={`${ringLabel(ring)} from ${name}`}>
            <div className="ic-card">
                <div className="ic-pulse">
                    <CallerAvatar from={ring.from} />
                </div>
                <p className="ic-kind">
                    {ring.video ? <Video size={14} aria-hidden="true" /> : <Phone size={14} aria-hidden="true" />}
                    {ringLabel(ring)}
                </p>
                <h2 className="ic-name" data-testid="incoming-call-name">{group ? (ring.title || 'Group call') : name}</h2>
                {group && <p className="ic-sub"><Users size={13} aria-hidden="true" /> {name} is calling</p>}
                <div className="ic-actions">
                    <button type="button" className="ic-btn is-decline" data-testid="incoming-call-decline" onClick={onDecline}>
                        <span className="ic-btn-circle"><PhoneOff size={22} /></span>
                        <span>Decline</span>
                    </button>
                    <button type="button" className="ic-btn is-accept" data-testid="incoming-call-accept" onClick={onAccept} autoFocus>
                        <span className="ic-btn-circle">{ring.video ? <Video size={22} /> : <Phone size={22} />}</span>
                        <span>Accept</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

/** "Ben started a huddle in #design · Join": a channel huddle never rings, it shows this banner. */
export function HuddleStartedBanner({ banner, onJoin, onDismiss }) {
    if (!banner) return null;
    const name = banner.from?.name || 'Someone';
    return (
        <div className="ic-banner" data-testid="huddle-started-banner" role="status">
            <CallerAvatar from={banner.from} size={32} />
            <div className="ic-banner-text">
                <p className="ic-banner-title">{name} started a {banner.video ? 'video huddle' : 'huddle'}</p>
                <p className="ic-banner-sub">{banner.title ? `in ${banner.title}` : 'in a channel'}</p>
            </div>
            <button type="button" className="gl-btn gl-btn--primary gl-btn--sm" data-testid="huddle-started-join" onClick={onJoin}>Join</button>
            <button type="button" className="ic-banner-close" aria-label="Dismiss" onClick={onDismiss}><X size={14} /></button>
        </div>
    );
}
