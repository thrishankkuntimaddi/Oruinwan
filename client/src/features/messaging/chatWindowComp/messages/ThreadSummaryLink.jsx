import React from 'react';
import { MessageSquare } from 'lucide-react';
import { getAvatarUrl } from '../../../../utils/avatarUtils';
import { formatTime, isToday, isYesterday } from '../helpers/helpers';

/** "today at 3:04 PM", "yesterday at 9:12 AM", "Oct 3 at 5:40 PM". */
export function lastReplyLabel(iso) {
    if (!iso) return '';
    const time = formatTime(iso);
    if (isToday(iso)) return `today at ${time}`;
    if (isYesterday(iso)) return `yesterday at ${time}`;
    const d = new Date(iso);
    const sameYear = d.getFullYear() === new Date().getFullYear();
    const day = d.toLocaleDateString([], sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
    return `${day} at ${time}`;
}

/**
 * The "3 replies · Last reply today at 3:04 PM" link under a message that has a thread,
 * with the most recent repliers' avatars. Shown on deleted messages too, so their
 * replies stay reachable.
 */
export default function ThreadSummaryLink({ count, participants = [], lastReplyAt, onOpen }) {
    if (!count || !onOpen) return null;
    const people = (participants || []).filter(p => p && typeof p === 'object').slice(0, 3);
    return (
        <button
            type="button"
            data-testid="thread-summary"
            onClick={(e) => { e.stopPropagation(); onOpen(); }}
            style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: 'none', border: 'none', padding: 0, font: 'inherit', maxWidth: '100%', minWidth: 0 }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
        >
            {people.length > 0 ? (
                <span style={{ display: 'flex' }}>
                    {people.map((p, i) => (
                        <img
                            key={p._id || i}
                            src={getAvatarUrl(p)}
                            alt={p.username || 'Replier'}
                            title={p.username}
                            style={{ width: '18px', height: '18px', borderRadius: '2px', objectFit: 'cover', border: '1px solid var(--bg-surface)', marginLeft: i > 0 ? '-4px' : 0, position: 'relative', zIndex: people.length - i }}
                        />
                    ))}
                </span>
            ) : (
                <MessageSquare size={12} style={{ color: 'var(--accent)' }} />
            )}
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', fontFamily: 'var(--font)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {count} {count === 1 ? 'reply' : 'replies'}
            </span>
            {lastReplyAt && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Last reply {lastReplyLabel(lastReplyAt)}
                </span>
            )}
        </button>
    );
}
