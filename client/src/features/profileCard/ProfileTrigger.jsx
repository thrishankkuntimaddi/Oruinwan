import React, { Suspense, lazy, useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useOptionalWorkspace } from '../../contexts/WorkspaceContext';
import BRAND from '../../shared/brand';
import { cancelPrefetch, mentionKind, prefetchCard } from './profileCardStore';
import './profileCard.css';

// Loaded when first opened, so message lists don't pay for it up front.
const ProfileCardPopover = lazy(() => import('./ProfileCardPopover'));
const ContactInfoModal = lazy(() => import('../messaging/chatWindowComp/modals/contactInfoModal.jsx'));

const OPEN_EVENT = 'oruinwan:profile-card:open';

function workspaceFromPath() {
    if (typeof window === 'undefined') return null;
    return window.location.pathname.match(/\/workspace\/([a-f0-9]{24})/i)?.[1] || null;
}

/**
 * Click / Enter / Space on the trigger opens the profile popover; hovering warms
 * the cache. Only one popover is open at a time.
 */
export function useProfilePopover({ userId = null, username = null }) {
    const ws = useOptionalWorkspace();
    const workspaceId = ws?.activeWorkspace?.id ? String(ws.activeWorkspace.id) : workspaceFromPath();
    const isAI = username === BRAND.ai;
    const kind = isAI ? 'assistant' : mentionKind(username);
    const validId = userId && /^[a-f0-9]{24}$/i.test(String(userId)) ? String(userId) : null;
    const query = useMemo(() => ({ userId: validId, username, workspaceId }), [validId, username, workspaceId]);

    const id = useId();
    const [anchor, setAnchor] = useState(null);
    const open = !!anchor;
    const [profile, setProfile] = useState(null);

    useEffect(() => {
        if (!open) return undefined;
        const onOther = (e) => { if (e.detail !== id) setAnchor(null); };
        window.addEventListener(OPEN_EVENT, onOther);
        return () => window.removeEventListener(OPEN_EVENT, onOther);
    }, [open, id]);

    const toggle = useCallback((el) => {
        if (anchor) { setAnchor(null); return; }
        window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
        setAnchor(el);
    }, [id, anchor]);

    const triggerProps = {
        role: 'button',
        tabIndex: 0,
        'aria-haspopup': 'dialog',
        'aria-expanded': open,
        onClick: (e) => { e.preventDefault(); e.stopPropagation(); toggle(e.currentTarget); },
        onKeyDown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggle(e.currentTarget); }
        },
        onMouseEnter: () => { if (kind === 'person') prefetchCard(query); },
        onMouseLeave: cancelPrefetch,
        onFocus: () => { if (kind === 'person') prefetchCard(query, 0); },
    };

    const elements = (
        <Suspense fallback={null}>
            {anchor && (
                <ProfileCardPopover
                    anchor={anchor}
                    kind={kind}
                    query={query}
                    mentionName={username}
                    onClose={() => setAnchor(null)}
                    onViewProfile={(card) => setProfile(card)}
                />
            )}
            {profile && (
                <ContactInfoModal
                    chat={{
                        workspaceId,
                        userId: profile.id,
                        name: profile.username,
                        username: profile.username,
                        email: profile.email,
                        image: profile.profilePicture,
                        status: profile.isOnline ? 'online' : 'offline',
                        profile: { about: profile.about },
                    }}
                    onClose={() => setProfile(null)}
                />
            )}
        </Suspense>
    );

    return { triggerProps, elements, open, kind };
}

/**
 * An @mention in a message: the same chip look as before, now a button that
 * opens the profile popover (a card for @Oruinwan, @here and @channel).
 */
export function MentionChip({ mention, className = '', children }) {
    const { triggerProps, elements } = useProfilePopover({ username: mention });
    return (
        <>
            <span data-mention={mention} {...triggerProps} aria-label={`@${mention}, show profile`} className={`pc-mention ${className}`}>
                {children}
            </span>
            {elements}
        </>
    );
}

/** Wrap a message header's avatar or name so it opens the sender's profile. */
export function ProfileTrigger({ userId, username, children, style, className = '', label }) {
    const { triggerProps, elements } = useProfilePopover({ userId, username });
    if (!userId && !username) return children;
    return (
        <>
            <span {...triggerProps} aria-label={label || `Show profile of ${username || 'this person'}`}
                className={`pc-trigger ${className}`} style={{ display: 'inline-flex', ...style }}>
                {children}
            </span>
            {elements}
        </>
    );
}

export default ProfileTrigger;
