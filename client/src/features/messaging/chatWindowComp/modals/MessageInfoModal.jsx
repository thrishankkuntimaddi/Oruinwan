import React from 'react';
import { Info, Loader2, CheckCheck, Clock, Lock, Smile, Pin, History, RefreshCw } from 'lucide-react';
import ToolbarModalShell, { FONT, SecondaryButton, PrimaryButton } from './ToolbarModalShell';
import { getAvatarUrl } from '../../../../utils/avatarUtils';

const idOf = (u) => String(u?._id || u || '');

const fmt = (ts) => {
    if (!ts) return '–';
    const d = new Date(ts);
    return `${d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })} at ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
};

/** Group reactions into [{ emoji, userIds }] whatever shape the server sent. */
function groupReactions(reactions = []) {
    const map = new Map();
    reactions.forEach(r => {
        if (!r?.emoji) return;
        const list = map.get(r.emoji) || [];
        if (Array.isArray(r.users)) list.push(...r.users.map(idOf));
        else if (r.userId || r.user) list.push(idOf(r.userId || r.user));
        map.set(r.emoji, list);
    });
    return [...map.entries()].map(([emoji, userIds]) => ({ emoji, userIds }));
}

/**
 * Message info. `info` is `{ status: 'loading' | 'done' | 'error', data, error }`
 * where data is the GET /api/v2/messages/:id/info response. `msg` is the
 * client-side message (it carries the decrypted text).
 */
export default function MessageInfoModal({ info, msg, onClose, onRetry }) {
    const status = info?.status || 'loading';
    const data = info?.data || {};
    const m = data.message || {};
    const pick = (key) => (data[key] !== undefined ? data[key] : m[key]);

    const sender = m.sender || msg?.sender || {};
    const senderId = idOf(sender);
    const senderName = sender.username || msg?.senderName || 'Unknown';
    const text = msg?.decryptedContent || msg?.text || m.text || '';

    const members = Array.isArray(data.members) ? data.members : [];
    const memberById = new Map(members.map(u => [idOf(u), u]));
    const readByUsers = (Array.isArray(pick('readByUsers')) ? pick('readByUsers') : [])
        .filter(u => idOf(u) !== senderId);
    const readIds = new Set([
        ...readByUsers.map(idOf),
        ...(Array.isArray(data.readBy) ? data.readBy.map(idOf) : []),
    ]);
    const readList = readByUsers.length
        ? readByUsers
        : [...readIds].filter(id => id !== senderId).map(id => memberById.get(id) || { _id: id, username: 'Unknown' });
    const unreadList = members.filter(u => idOf(u) !== senderId && !readIds.has(idOf(u)));

    const editCount = pick('editCount') ?? (Array.isArray(m.editHistory) ? m.editHistory.length : 0);
    const editedAt = pick('editedAt') || msg?.editedAt;
    const restoredFrom = pick('restoredFromVersion');
    const version = pick('version');
    const isPinned = pick('isPinned') ?? msg?.isPinned;
    const pinnedBy = pick('pinnedBy');
    const pinnedByName = typeof pinnedBy === 'string' ? pinnedBy : (pinnedBy?.username || msg?.pinnedByName);
    const pinnedAt = pick('pinnedAt');
    const reactions = groupReactions(m.reactions || msg?.reactions || []);
    const nameOf = (id) => memberById.get(id)?.username || 'Unknown';

    return (
        <ToolbarModalShell
            title="Message info"
            icon={<Info size={14} style={{ color: 'var(--accent)' }} />}
            onClose={onClose}
            width={420}
            footer={(
                <>
                    {status === 'error' && onRetry && <SecondaryButton onClick={onRetry}><RefreshCw size={12} /> Retry</SecondaryButton>}
                    <PrimaryButton onClick={onClose}>Close</PrimaryButton>
                </>
            )}
        >
            {/* Message preview — available immediately from the client copy */}
            <div style={{ padding: '12px 16px', backgroundColor: 'var(--bg-active)', borderBottom: '1px solid var(--border-default)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <UserAvatar user={{ ...sender, username: senderName }} />
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{senderName}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={10} /> Sent {fmt(m.createdAt || msg?.createdAt || msg?.ts)}
                        </div>
                    </div>
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '120px', overflowY: 'auto', fontFamily: FONT }}>
                    {text || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No text content</span>}
                </p>
                <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>
                    <Lock size={10} style={{ color: 'var(--accent)' }} />
                    {(m.isEncrypted ?? msg?.isEncrypted) ? 'End-to-end encrypted' : 'Encrypted in transit'}
                </div>
            </div>

            {status === 'loading' && (
                <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} /> Loading details…
                </div>
            )}
            {status === 'error' && (
                <div role="alert" style={{ padding: '16px', fontSize: '12px', color: 'var(--state-danger)' }}>
                    {info?.error || 'Could not load message info.'}
                </div>
            )}
            {status === 'done' && (
                <>
                    {(editedAt || editCount > 0) && (
                        <Section icon={<History size={12} />} title="Edited">
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                                <div>{editCount || 1} {editCount === 1 || !editCount ? 'edit' : 'edits'}{version ? ` · now version ${version}` : ''}</div>
                                <div>Last edited {fmt(editedAt)}</div>
                                {restoredFrom && <div style={{ color: 'var(--accent)' }}>Restored from version {restoredFrom}</div>}
                            </div>
                        </Section>
                    )}
                    {isPinned && (
                        <Section icon={<Pin size={12} />} title="Pinned">
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                Pinned by {pinnedByName || 'someone'}{pinnedAt ? ` · ${fmt(pinnedAt)}` : ''}
                            </div>
                        </Section>
                    )}
                    {reactions.length > 0 && (
                        <Section icon={<Smile size={12} />} title={`Reactions (${reactions.reduce((n, r) => n + r.userIds.length, 0)})`}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {reactions.map(r => (
                                    <div key={r.emoji} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontSize: '16px' }}>{r.emoji}</span>
                                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.userIds.map(nameOf).join(', ')}</span>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}
                    <Section icon={<CheckCheck size={12} />} title={`Read by (${readList.length})`}>
                        {readList.length
                            ? <UserList users={readList} />
                            : <Empty>No one has read this yet.</Empty>}
                    </Section>
                    <Section icon={<Clock size={12} />} title={`Not yet read (${unreadList.length})`}>
                        {unreadList.length
                            ? <UserList users={unreadList} muted />
                            : <Empty>{members.length > 1 ? 'Everyone has read this.' : 'No other recipients.'}</Empty>}
                    </Section>
                </>
            )}
        </ToolbarModalShell>
    );
}

function Section({ icon, title, children }) {
    return (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                <span style={{ color: 'var(--accent)', display: 'flex' }}>{icon}</span>{title}
            </div>
            {children}
        </div>
    );
}

function Empty({ children }) {
    return <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{children}</p>;
}

function UserAvatar({ user, muted }) {
    const src = user.profilePicture || getAvatarUrl({ username: user.username, _id: user._id });
    return (
        <img
            src={src}
            alt=""
            style={{ width: '24px', height: '24px', borderRadius: '2px', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border-default)', opacity: muted ? 0.6 : 1 }}
        />
    );
}

function UserList({ users, muted }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {users.map(u => (
                <div key={idOf(u)} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <UserAvatar user={u} muted={muted} />
                    <span style={{ fontSize: '13px', color: muted ? 'var(--text-muted)' : 'var(--text-secondary)' }}>{u.username || 'Unknown'}</span>
                </div>
            ))}
        </div>
    );
}
