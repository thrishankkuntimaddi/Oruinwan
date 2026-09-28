import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AtSign, Check, Clock, Copy, Mail, MessageSquare, Megaphone, Sparkles, User, UserX, X } from 'lucide-react';
import api from '@services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useOptionalSocket } from '../../contexts/SocketContext';
import { getAvatarUrl } from '../../utils/avatarUtils';
import { presenceState, presenceLabel } from '../../shared/utils/presence';
import BRAND from '../../shared/brand';
import { applyPresence, fetchCard, peekCard, subscribe } from './profileCardStore';
import { findComposerFor, insertMentionIntoComposer } from './composerBridge';
import './profileCard.css';

const GAP = 6;
const EDGE = 8;
const MOBILE_QUERY = '(max-width: 639px)';

const isMobile = () => typeof window !== 'undefined' && !!window.matchMedia?.(MOBILE_QUERY).matches;

/** "4:12 PM" in the person's time zone, or null when unknown/invalid. */
export function localTimeIn(timezone, now = new Date()) {
    if (!timezone) return null;
    try {
        return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: timezone }).format(now);
    } catch {
        return null;
    }
}

function lastSeenText(lastSeen) {
    if (!lastSeen) return null;
    const mins = Math.round((Date.now() - new Date(lastSeen).getTime()) / 60000);
    if (!Number.isFinite(mins) || mins < 0) return null;
    if (mins < 1) return 'Last seen just now';
    if (mins < 60) return `Last seen ${mins}m ago`;
    if (mins < 60 * 24) return `Last seen ${Math.round(mins / 60)}h ago`;
    return `Last seen ${Math.round(mins / (60 * 24))}d ago`;
}

export function presenceOfCard(card) {
    if (!card?.isOnline) return 'offline';
    return presenceState({ isOnline: true, status: card.userStatus });
}

const WS_ROLE = { owner: 'Workspace owner', admin: 'Workspace admin', member: 'Member' };

function useLiveSocket() {
    return useOptionalSocket()?.socket || null;
}

/** Keep the popover next to its anchor, flipping above/left to stay on screen. */
function usePlacement(anchor, popRef, deps) {
    const [pos, setPos] = useState({ top: -9999, left: -9999, sheet: isMobile() });
    const place = useCallback(() => {
        const pop = popRef.current;
        if (!pop || !anchor) return;
        if (isMobile()) { setPos({ top: 0, left: 0, sheet: true }); return; }
        const r = anchor.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const w = pop.offsetWidth;
        const h = pop.offsetHeight;
        let top = r.bottom + GAP;
        if (top + h > vh - EDGE) {
            top = r.top - GAP - h >= EDGE ? r.top - GAP - h : Math.max(EDGE, vh - EDGE - h);
        }
        let left = r.left;
        if (left + w > vw - EDGE) left = vw - EDGE - w;
        left = Math.max(EDGE, left);
        setPos({ top, left, sheet: false });
    }, [anchor, popRef]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useLayoutEffect(place, [place, ...deps]);
    useEffect(() => {
        window.addEventListener('resize', place);
        return () => window.removeEventListener('resize', place);
    }, [place]);
    return pos;
}

function Skeleton() {
    return (
        <div aria-busy="true" aria-label="Loading profile" data-testid="profile-card-loading">
            <div className="pc-banner" />
            <div className="pc-body">
                <div className="pc-head"><div className="pc-avatar pc-skel" /></div>
                <div className="pc-skel" style={{ height: 14, width: '55%', marginTop: 12 }} />
                <div className="pc-skel" style={{ height: 10, width: '35%', marginTop: 8 }} />
                <div className="pc-skel" style={{ height: 10, width: '70%', marginTop: 16 }} />
                <div className="pc-skel" style={{ height: 10, width: '60%', marginTop: 8 }} />
                <div className="pc-skel" style={{ height: 30, width: '100%', marginTop: 16 }} />
            </div>
        </div>
    );
}

function Empty({ icon, title, text, children }) {
    return (
        <div className="pc-empty">
            <div className="pc-empty-icon" aria-hidden>{icon}</div>
            <h3 id="pc-title">{title}</h3>
            <p>{text}</p>
            {children}
        </div>
    );
}

/**
 * The profile popover. `kind` is 'person' | 'assistant' | 'broadcast'.
 * `query` is { userId?, username?, workspaceId }.
 */
export default function ProfileCardPopover({ anchor, kind = 'person', query, mentionName, onClose, onViewProfile }) {
    const popRef = useRef(null);
    const navigate = useNavigate();
    const auth = useAuth?.();
    const socket = useLiveSocket();
    const me = auth?.user?._id || auth?.user?.id || null;

    const entry = useSyncExternalStore(subscribe, () => (kind === 'person' ? peekCard(query) : null));
    const card = entry?.card || null;
    const error = entry?.error || null;
    const loading = kind === 'person' && !entry;

    const [copied, setCopied] = useState(false);
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState('');
    const [, setTick] = useState(0);

    useEffect(() => {
        if (kind === 'person') fetchCard(query);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kind, query.userId, query.username, query.workspaceId]);

    // Live presence while open.
    useEffect(() => {
        if (!socket) return undefined;
        const onStatus = (p) => applyPresence(p);
        const onOffline = (p) => applyPresence({ ...p, status: 'offline' });
        socket.on('user-status-changed', onStatus);
        socket.on('user:offline', onOffline);
        return () => { socket.off('user-status-changed', onStatus); socket.off('user:offline', onOffline); };
    }, [socket]);

    // The local clock ticks while the card is open.
    useEffect(() => {
        if (!card?.timezone) return undefined;
        const t = setInterval(() => setTick((n) => n + 1), 30000);
        return () => clearInterval(t);
    }, [card?.timezone]);

    const pos = usePlacement(anchor, popRef, [entry, kind]);

    // Close: Escape (focus back to the mention), a click outside, or scrolling the page.
    const close = useCallback((restoreFocus) => {
        onClose?.();
        if (restoreFocus) anchor?.focus?.();
    }, [onClose, anchor]);
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') { e.stopPropagation(); close(true); return; }
            if (e.key === 'Tab' && popRef.current) {
                const f = Array.from(popRef.current.querySelectorAll('button:not(:disabled), a[href], [tabindex="0"]'));
                if (!f.length) return;
                const first = f[0];
                const last = f[f.length - 1];
                if (e.shiftKey && (document.activeElement === first || document.activeElement === popRef.current)) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        };
        const onDown = (e) => {
            if (popRef.current?.contains(e.target) || anchor?.contains?.(e.target)) return;
            close(false);
        };
        const onScroll = (e) => {
            if (popRef.current?.contains(e.target)) return;
            if (!isMobile()) close(false);
        };
        document.addEventListener('keydown', onKey, true);
        document.addEventListener('mousedown', onDown, true);
        document.addEventListener('touchstart', onDown, true);
        window.addEventListener('scroll', onScroll, true);
        return () => {
            document.removeEventListener('keydown', onKey, true);
            document.removeEventListener('mousedown', onDown, true);
            document.removeEventListener('touchstart', onDown, true);
            window.removeEventListener('scroll', onScroll, true);
        };
    }, [close, anchor]);

    // Focus the dialog when it opens, then its first action once loaded.
    useEffect(() => { popRef.current?.focus({ preventScroll: true }); }, []);
    useEffect(() => {
        if (!card && kind === 'person') return;
        const first = popRef.current?.querySelector('.pc-actions button:not(:disabled)');
        first?.focus({ preventScroll: true });
    }, [card, kind]);

    const hasComposer = !!findComposerFor(anchor);
    const mention = (name) => { if (insertMentionIntoComposer(name, anchor)) onClose?.(); };

    const openDM = async () => {
        if (!card || !query.workspaceId) return;
        setBusy(true);
        setActionError('');
        try {
            const res = await api.get(`/api/v2/messages/workspace/${query.workspaceId}/dm/resolve/${card.id}`);
            const sessionId = res.data?.dmSessionId;
            const inHome = /\/home\//.test(window.location.pathname);
            const base = `/workspace/${query.workspaceId}${inHome ? '/home' : '/messages'}/dm`;
            onClose?.();
            navigate(sessionId ? `${base}/${sessionId}` : `/workspace/${query.workspaceId}/dm/new/${card.id}`);
        } catch (err) {
            setActionError(err?.response?.data?.message || 'Could not open a conversation.');
        } finally {
            setBusy(false);
        }
    };

    const copyEmail = async () => {
        try {
            await navigator.clipboard.writeText(card.email);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard blocked: the address is still selectable */ }
    };

    const closeBtn = (
        <button type="button" className="gl-icon-btn pc-close" aria-label="Close profile" onClick={() => close(true)}><X size={14} /></button>
    );

    let content;
    let label = 'Profile';
    if (kind === 'assistant') {
        label = BRAND.ai;
        content = (
            <>
                <div className="pc-banner" />
                <div className="pc-body">
                    <div className="pc-head">
                        <div className="pc-avatar"><img src="/icons/oruinwan-128.png" alt="" /></div>
                        {closeBtn}
                    </div>
                    <h2 className="pc-name" id="pc-title">{BRAND.ai}</h2>
                    <div className="pc-handle">@Oruinwan · assistant</div>
                    <div className="pc-about" style={{ WebkitLineClamp: 'unset' }}>
                        Your workspace assistant. Mention <strong>@Oruinwan</strong> in a channel, DM or thread and it answers
                        right there, using the conversation it can see. It runs on {BRAND.name || 'Oruinwan'}'s own AI, not a third-party service.
                    </div>
                    <div className="pc-actions">
                        <button type="button" className="gl-btn gl-btn--primary gl-btn--sm" onClick={() => mention('Oruinwan')} disabled={!hasComposer}
                            title={hasComposer ? undefined : 'Open a conversation to ask'}>
                            <Sparkles size={13} /> Ask Oruinwan
                        </button>
                    </div>
                </div>
            </>
        );
    } else if (kind === 'broadcast') {
        const here = String(mentionName).toLowerCase() === 'here';
        label = `@${here ? 'here' : 'channel'}`;
        content = (
            <div className="pc-body" style={{ paddingTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="pc-empty-icon" style={{ margin: 0, width: 36, height: 36 }} aria-hidden><Megaphone size={16} /></div>
                    <h2 className="pc-name" id="pc-title" style={{ margin: 0 }}>@{here ? 'here' : 'channel'}</h2>
                    {closeBtn}
                </div>
                <div className="pc-about" style={{ WebkitLineClamp: 'unset' }}>
                    {here
                        ? 'Notified the members of this channel who were online when the message was sent.'
                        : 'Notified every member of this channel, online or not.'}
                    {' '}People who muted the channel or turned off @channel/@here alerts were not notified.
                </div>
            </div>
        );
    } else if (loading) {
        content = <Skeleton />;
    } else if (error || !card) {
        const denied = error?.status === 403;
        label = denied ? 'Profile unavailable' : 'User not found';
        content = (
            <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', top: 8, right: 8 }}>{closeBtn}</div>
                <Empty icon={<UserX size={18} />} title={denied ? 'Profile unavailable' : 'User not found'}
                    text={denied
                        ? 'You can only see profiles of people you share a workspace or company with.'
                        : `${mentionName ? `@${mentionName}` : 'This person'} isn't in this workspace any more, or the account was removed.`} />
            </div>
        );
    } else {
        const state = presenceOfCard(card);
        const status = state === 'offline' ? (lastSeenText(card.lastSeen) || 'Offline') : presenceLabel({ isOnline: true, status: card.userStatus });
        const name = card.displayName || card.username;
        const isMe = me && String(me) === String(card.id);
        const time = localTimeIn(card.timezone);
        label = `${name} profile`;
        content = (
            <>
                <div className="pc-banner" />
                <div className="pc-body">
                    <div className="pc-head">
                        <div className="pc-avatar-wrap">
                            <div className="pc-avatar">
                                <img src={card.profilePicture || getAvatarUrl({ _id: card.id, username: card.username })} alt=""
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            </div>
                            <span className="pc-dot" data-state={state} aria-hidden />
                        </div>
                        {closeBtn}
                    </div>
                    <h2 className="pc-name" id="pc-title" data-testid="profile-card-name">{name}{isMe ? ' (you)' : ''}</h2>
                    {card.displayName && card.displayName !== card.username && <div className="pc-handle">@{card.username}</div>}
                    <div className="pc-status"><i data-state={state} aria-hidden />{status}</div>
                    {(card.designation || card.department) && (
                        <div className="pc-title">
                            {card.designation}{card.designation && card.department ? <span> · </span> : null}
                            {card.department && <span style={{ color: card.designation ? 'var(--text-muted)' : 'inherit' }}>{card.department}</span>}
                        </div>
                    )}
                    {(card.workspaceRole || card.companyRole) && (
                        <div className="pc-badges">
                            {card.workspaceRole && <span className={`pc-badge${card.workspaceRole !== 'member' ? ' pc-badge--accent' : ''}`}>{WS_ROLE[card.workspaceRole] || card.workspaceRole}</span>}
                            {card.companyRole && <span className="pc-badge">Company {card.companyRole}</span>}
                        </div>
                    )}
                    {(card.email || time) && (
                        <div className="pc-rows">
                            {card.email && (
                                <div className="pc-row">
                                    <Mail size={13} aria-hidden />
                                    <span className="pc-row-text"><a href={`mailto:${card.email}`} data-testid="profile-card-email">{card.email}</a></span>
                                    <button type="button" className="gl-icon-btn pc-copy" onClick={copyEmail} aria-label={copied ? 'Email copied' : 'Copy email'} title={copied ? 'Copied' : 'Copy email'}>
                                        {copied ? <Check size={12} /> : <Copy size={12} />}
                                    </button>
                                </div>
                            )}
                            {time && (
                                <div className="pc-row" title={card.timezone}>
                                    <Clock size={13} aria-hidden />
                                    <span className="pc-row-text">{time} local time</span>
                                </div>
                            )}
                        </div>
                    )}
                    {card.about && <div className="pc-about">{card.about}</div>}
                    {actionError && <div role="alert" style={{ marginTop: 10, fontSize: 12, color: 'var(--state-danger)' }}>{actionError}</div>}
                    <div className="pc-actions">
                        {!isMe && (
                            <button type="button" className="gl-btn gl-btn--primary gl-btn--sm" onClick={openDM} disabled={busy || !query.workspaceId}>
                                <MessageSquare size={13} /> Message
                            </button>
                        )}
                        <button type="button" className="gl-btn gl-btn--sm" onClick={() => mention(card.username)} disabled={!hasComposer}
                            title={hasComposer ? `Mention @${card.username} in the message box` : 'No message box open'}>
                            <AtSign size={13} /> Mention
                        </button>
                        <button type="button" className="gl-btn gl-btn--sm" onClick={() => { onClose?.(); onViewProfile?.(card); }}>
                            <User size={13} /> Profile
                        </button>
                    </div>
                </div>
            </>
        );
    }

    const sheet = pos.sheet;
    return createPortal(
        <>
            {sheet && <div className="pc-backdrop" aria-hidden onMouseDown={() => close(false)} />}
            <div
                ref={popRef}
                role="dialog"
                aria-modal={sheet ? 'true' : 'false'}
                aria-label={label}
                tabIndex={-1}
                data-testid="profile-card"
                className={`pc-pop${sheet ? ' pc-sheet' : ''}`}
                style={sheet ? undefined : { top: pos.top, left: pos.left }}
            >
                <span className="pc-grip" aria-hidden />
                {content}
            </div>
        </>,
        document.body,
    );
}
