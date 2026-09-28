import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, GitBranch, Lock, CheckCheck } from 'lucide-react';
import UserAvatarImage from '../../shared/components/ui/UserAvatarImage';
import { notificationTypeMeta } from '../notifications/notificationTypes';
import useHomeActivity from './useHomeActivity';
import { ACTIVITY_LIMIT, activityCounts, filterActivityRows, shortAgo } from './activityModel';
import '../../styles/gloss.css';
import '../../components/layout/shell.css';
import './activity.css';

const FILTER_LABELS = { all: 'All', mentions: 'Mentions', dms: 'DMs' };
const PRESENCE = { active: 'is-online', online: 'is-online', away: 'is-away', dnd: 'is-busy', busy: 'is-busy' };

function RowGlyph({ row, size }) {
    if (row.kind === 'dm') {
        return (
            <span className="gl-shell-avatar">
                <UserAvatarImage
                    userId={row.userId}
                    name={row.title}
                    src={row.avatar}
                    size={size}
                    initialStyle={{ background: 'var(--bg-active)', color: 'var(--text-secondary)' }}
                />
                {row.status && <span className={`gl-shell-presence ${PRESENCE[row.status] || ''}`} aria-hidden="true" />}
            </span>
        );
    }
    if (row.kind === 'channel') {
        return (
            <span className={`gl-shell-glyph gl-activity-glyph${row.mentioned ? ' gl-shell-glyph--accent' : ''}`} aria-hidden="true">
                {row.isPrivate ? <Lock size={11} strokeWidth={2.5} /> : '#'}
            </span>
        );
    }
    if (row.kind === 'thread') {
        return <span className="gl-shell-glyph gl-activity-glyph" aria-hidden="true"><GitBranch size={11} strokeWidth={2.5} /></span>;
    }
    const { Icon, color } = notificationTypeMeta(row.notificationType);
    return (
        <span className="gl-shell-glyph gl-activity-glyph" aria-hidden="true" style={{ color }}>
            <Icon size={11} strokeWidth={2.5} />
        </span>
    );
}

function rowSub(row) {
    if (row.kind === 'channel') {
        const head = [`${row.unread} new`, row.mentioned ? '@you' : null].filter(Boolean).join(' · ');
        const body = row.preview ? `${row.senderName ? `${row.senderName}: ` : ''}${row.preview}` : null;
        return { head, body };
    }
    if (row.kind === 'dm') return { head: null, body: row.preview || 'New message' };
    if (row.kind === 'thread') {
        const who = row.senderName ? `${row.senderName} replied` : null;
        return { head: row.unread > 1 ? `${row.unread} replies` : null, body: who || row.preview || 'New reply' };
    }
    return { head: null, body: row.preview };
}

function ActivityRow({ row, onOpen, avatarSize }) {
    const { head, body } = rowSub(row);
    const label = row.kind === 'channel' ? row.title.replace(/^#/, '') : row.title;
    const showPill = row.kind === 'dm' || (row.kind === 'thread' && row.unread > 1);
    const onKeyDown = (e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(row); }
    };
    return (
        <div
            role="link"
            tabIndex={0}
            className="gl-item gl-shell-row gl-shell-row--tall is-unread gl-activity-row"
            data-testid="activity-row"
            data-kind={row.kind}
            data-key={row.key}
            onClick={() => onOpen(row)}
            onKeyDown={onKeyDown}
        >
            <RowGlyph row={row} size={avatarSize} />
            <span className="gl-shell-row-text">
                <span className="gl-activity-line">
                    <span className="gl-shell-row-label">{label}</span>
                    <time className="gl-activity-time" dateTime={row.at ? new Date(row.at).toISOString() : undefined}>{shortAgo(row.at)}</time>
                </span>
                <span className="gl-activity-line">
                    <span className="gl-shell-row-sub">
                        {head && <span className={`gl-activity-head${row.mentioned ? ' is-mention' : ''}`}>{head}</span>}
                        {head && body ? ' · ' : ''}
                        {body}
                    </span>
                    {showPill && (
                        <span className={`gl-shell-unread${row.mentioned ? ' is-mention' : ''}`} title={`${row.unread} unread`}>
                            {row.unread > 99 ? '99+' : row.unread}
                        </span>
                    )}
                </span>
            </span>
        </div>
    );
}

/**
 * "Activity" at the top of Home: unread DMs, channels with new messages or
 * @mentions, thread replies and other bell notifications, newest first.
 *
 *   variant   'panel' (desktop Home panel) | 'mobile' (MobileHomePage)
 *   isOpen / onToggle   optional controlled collapse (else local state)
 */
export default function ActivitySection({ variant = 'panel', isOpen, onToggle }) {
    const navigate = useNavigate();
    const { rows, loading, open, workspaceId } = useHomeActivity({ base: variant === 'mobile' ? 'app' : 'home' });
    const [filter, setFilter] = useState('all');
    const [localOpen, setLocalOpen] = useState(true);
    const expanded = isOpen !== undefined ? isOpen : localOpen;
    const toggle = onToggle || (() => setLocalOpen(v => !v));

    const counts = useMemo(() => activityCounts(rows), [rows]);
    const visible = useMemo(() => filterActivityRows(rows, filter), [rows, filter]);
    const shown = visible.slice(0, ACTIVITY_LIMIT);
    const avatarSize = variant === 'mobile' ? 32 : 24;
    const viewAll = () => workspaceId && navigate(`/workspace/${workspaceId}/notifications`);

    return (
        <section className={`gl-activity gl-activity--${variant}`} aria-label="Activity" data-testid="home-activity">
            <div className="gl-section-label gl-shell-section">
                <button type="button" className="gl-shell-section-toggle" onClick={toggle} aria-expanded={!!expanded}>
                    <ChevronRight size={11} />
                    <span>Activity</span>
                    {counts.all > 0 && <span className="gl-shell-section-count" data-testid="activity-count">{counts.all}</span>}
                </button>
                <button type="button" className="gl-activity-viewall" onClick={viewAll}>View all</button>
            </div>

            {expanded && (
                <>
                    <div className="gl-tabs gl-activity-tabs" role="tablist" aria-label="Filter activity">
                        {Object.keys(FILTER_LABELS).map(f => (
                            <button
                                key={f}
                                type="button"
                                role="tab"
                                className="gl-tab"
                                aria-selected={filter === f}
                                onClick={() => setFilter(f)}
                            >
                                {FILTER_LABELS[f]}
                                {f !== 'all' && counts[f] > 0 && <span className="gl-count gl-activity-tabcount">{counts[f]}</span>}
                            </button>
                        ))}
                    </div>

                    {loading && rows.length === 0 ? (
                        <div aria-busy="true" aria-label="Loading activity">
                            {[70, 55].map((w, i) => <div key={i} className="gl-shell-skel is-round"><i /><i style={{ width: `${w}%` }} /></div>)}
                        </div>
                    ) : shown.length === 0 ? (
                        <div className="gl-activity-empty" data-testid="activity-empty">
                            <CheckCheck size={13} aria-hidden="true" />
                            <span>
                                {filter === 'mentions' ? 'No new mentions' : filter === 'dms' ? 'No unread direct messages' : "You're all caught up"}
                            </span>
                        </div>
                    ) : (
                        <div className="gl-activity-list">
                            {shown.map(row => (
                                <ActivityRow key={row.key} row={row} onOpen={open} avatarSize={avatarSize} />
                            ))}
                            {visible.length > shown.length && (
                                <button type="button" className="gl-activity-more" onClick={viewAll}>
                                    {visible.length - shown.length} more · View all
                                </button>
                            )}
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
