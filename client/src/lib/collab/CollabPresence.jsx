import React from 'react';
import { Check, Loader2, WifiOff, Eye, Radio } from 'lucide-react';
import { collabLabel } from './useCollabDoc';
import './collab.css';

const PILL = {
    connecting: { Icon: Loader2, text: 'Connecting…', spin: true },
    live: { Icon: Radio, text: 'Live' },
    saving: { Icon: Loader2, text: 'Saving…', spin: true },
    saved: { Icon: Check, text: 'Saved' },
    offline: { Icon: WifiOff, text: 'Offline', title: 'Your changes are kept and sync when you reconnect.' },
    readonly: { Icon: Eye, text: 'Live · view only' },
};

/** Stacked avatars of the other people in a document. */
export function PeerAvatars({ peers, max = 4, size = 22 }) {
    if (!peers || peers.length === 0) return null;
    const shown = peers.slice(0, max);
    const extra = peers.length - shown.length;
    const names = peers.map((p) => p.name).join(', ');
    return (
        <span className="gl-collab-avatars" role="group" aria-label={`Also here: ${names}`} title={`Also here: ${names}`}>
            {shown.map((p) => (
                <span key={p.key} className="gl-collab-avatar" style={{ width: size, height: size }}>
                    {p.avatar
                        ? <img src={p.avatar} alt="" draggable={false} />
                        : <span aria-hidden="true">{(p.name || '?').slice(0, 1).toUpperCase()}</span>}
                </span>
            ))}
            {extra > 0 && <span className="gl-collab-avatar gl-collab-avatar--more" style={{ width: size, height: size }}>+{extra}</span>}
        </span>
    );
}

/**
 * Presence + save state for a live document: the other editors' avatars and a
 * pill ("Live", "Saving…", "Saved", "Offline"). Renders nothing when the
 * document is not live, so the caller's own REST save indicator shows instead.
 */
export default function CollabPresence({ collab, className = '' }) {
    if (!collab) return null;
    const label = collabLabel(collab);
    if (label === 'off') {
        if (!collab.closedText) return null;
        return <span className={`gl-collab-pill gl-collab-pill--warn ${className}`} role="status">{collab.closedText}</span>;
    }
    const conf = PILL[label];
    return (
        <span className={`gl-collab ${className}`} data-testid="collab-presence">
            <PeerAvatars peers={collab.peers} />
            <span className={`gl-collab-pill gl-collab-pill--${label}`} role="status" aria-live="polite" title={conf.title || undefined}>
                <conf.Icon size={11} className={conf.spin ? 'animate-spin' : ''} aria-hidden="true" />
                {conf.text}
            </span>
        </span>
    );
}

/** Small marks next to a block or line showing who is there. */
export function PeerMarks({ peers, label, detail }) {
    if (!peers || peers.length === 0) return null;
    const names = peers.map((p) => p.name).join(', ');
    return (
        <span className="gl-collab-marks" title={`${names} ${label || 'here'}`} aria-label={`${names} ${label || 'here'}`}>
            {peers.slice(0, 3).map((p) => (
                <span key={p.key} className="gl-collab-mark">
                    {p.avatar ? <img src={p.avatar} alt="" draggable={false} /> : (p.name || '?').slice(0, 1).toUpperCase()}
                </span>
            ))}
            <span className="gl-collab-mark-name">{peers[0].name}{peers.length > 1 ? ` +${peers.length - 1}` : ''}{detail ? ` · ${detail}` : ''}</span>
        </span>
    );
}
