import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, UserPlus, UserMinus, Search, Check, Loader2 } from 'lucide-react';
import api from '@services/api';
import { getAvatarUrl } from '../../../../utils/avatarUtils';
import ToolbarModalShell, { FONT, fieldStyle, PrimaryButton, SecondaryButton } from './ToolbarModalShell';

const idOf = (u) => String(u?._id || u?.id || u || '');

/**
 * Who follows a thread, Slack-style: anyone can add people from the conversation (they are
 * notified "X added you to a thread"); channel admins (canModerate) can remove followers;
 * everyone can leave (unfollow) themselves.
 *
 *   messageId     the thread's parent message
 *   members       people who can be added (the channel's members / the DM's participants)
 *   onChanged     ({ followerCount, followingMe }) after a change
 */
export default function ThreadPeopleModal({ messageId, members = [], currentUserId, onClose, onChanged, showToast }) {
    const [followers, setFollowers] = useState(null);
    const [canModerate, setCanModerate] = useState(false);
    const [adding, setAdding] = useState(false);
    const [picked, setPicked] = useState([]);
    const [query, setQuery] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const { data } = await api.get(`/api/threads/${messageId}/followers`);
            setFollowers(data.followers || []);
            setCanModerate(!!data.canModerate);
        } catch (err) {
            setFollowers([]);
            showToast?.(err?.response?.data?.message || 'Could not load who follows this thread', 'error');
        }
    }, [messageId, showToast]);

    useEffect(() => { load(); }, [load]);

    const followerIds = useMemo(() => new Set((followers || []).map(idOf)), [followers]);
    const candidates = useMemo(() => {
        const q = query.trim().toLowerCase();
        return members
            .filter((m) => idOf(m) && !followerIds.has(idOf(m)))
            .filter((m) => !q || String(m.username || m.name || '').toLowerCase().includes(q));
    }, [members, followerIds, query]);

    const report = (list) => onChanged?.({ followerCount: list.length, followingMe: list.some((f) => idOf(f) === String(currentUserId)) });

    const add = async () => {
        if (!picked.length) return;
        setBusy(true);
        try {
            const { data } = await api.post(`/api/threads/${messageId}/followers`, { userIds: picked });
            const n = (data.added || []).length;
            showToast?.(n ? `Added ${n} ${n === 1 ? 'person' : 'people'} to this thread` : 'They already follow this thread', 'success');
            if ((data.skipped || []).length) showToast?.('Some people can’t see this conversation, so they weren’t added', 'info');
            setPicked([]);
            setAdding(false);
            const { data: fresh } = await api.get(`/api/threads/${messageId}/followers`);
            setFollowers(fresh.followers || []);
            report(fresh.followers || []);
        } catch (err) {
            showToast?.(err?.response?.data?.message || 'Could not add people', 'error');
        } finally {
            setBusy(false);
        }
    };

    const remove = async (person) => {
        const self = idOf(person) === String(currentUserId);
        setBusy(true);
        try {
            await api.delete(`/api/threads/${messageId}/followers/${idOf(person)}`);
            const next = (followers || []).filter((f) => idOf(f) !== idOf(person));
            setFollowers(next);
            report(next);
            showToast?.(self ? 'You left this thread' : `${person.username || 'They'} no longer follow this thread`, 'success');
        } catch (err) {
            showToast?.(err?.response?.data?.message || 'Could not remove them', 'error');
        } finally {
            setBusy(false);
        }
    };

    const row = { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px', fontFamily: FONT };
    const avatar = (u) => <img src={getAvatarUrl(u)} alt="" style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0 }} />;

    return (
        <ToolbarModalShell
            title="People in this thread"
            icon={<Users size={14} style={{ color: 'var(--accent)' }} />}
            onClose={onClose}
            footer={adding ? (
                <>
                    <SecondaryButton onClick={() => { setAdding(false); setPicked([]); }} disabled={busy}>Cancel</SecondaryButton>
                    <PrimaryButton onClick={add} disabled={busy || picked.length === 0}>
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />} Add {picked.length || ''}
                    </PrimaryButton>
                </>
            ) : (
                <PrimaryButton onClick={() => setAdding(true)} disabled={followers === null}><UserPlus size={13} /> Add people</PrimaryButton>
            )}
        >
            {adding ? (
                <div data-testid="thread-add-people">
                    <div style={{ padding: '12px 16px 6px', position: 'relative' }}>
                        <Search size={12} style={{ position: 'absolute', left: 26, top: '50%', transform: 'translateY(-25%)', color: 'var(--text-muted)' }} />
                        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people in this conversation" style={{ ...fieldStyle, paddingLeft: 28 }} />
                    </div>
                    {candidates.length === 0 && (
                        <p style={{ margin: 0, padding: '16px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>Everyone here already follows this thread.</p>
                    )}
                    {candidates.map((m) => {
                        const id = idOf(m);
                        const on = picked.includes(id);
                        return (
                            <button key={id} type="button" aria-pressed={on}
                                onClick={() => setPicked((p) => (on ? p.filter((x) => x !== id) : [...p, id]))}
                                style={{ ...row, width: '100%', border: 'none', cursor: 'pointer', textAlign: 'left', background: on ? 'var(--accent-dim, var(--bg-active))' : 'transparent' }}>
                                {avatar(m)}
                                <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)' }}>{m.username || m.name}</span>
                                <span style={{ width: 14, height: 14, borderRadius: '2px', border: `1px solid ${on ? 'var(--accent)' : 'var(--border-accent)'}`, background: on ? 'var(--accent)' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {on && <Check size={10} strokeWidth={3} style={{ color: 'var(--bg-base)' }} />}
                                </span>
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div data-testid="thread-followers">
                    {followers === null && <p style={{ margin: 0, padding: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>Loading…</p>}
                    {followers && followers.length === 0 && <p style={{ margin: 0, padding: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>Nobody follows this thread yet.</p>}
                    {(followers || []).map((f) => {
                        const self = idOf(f) === String(currentUserId);
                        return (
                            <div key={idOf(f)} style={row} data-testid="thread-follower">
                                {avatar(f)}
                                <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)' }}>{f.username || 'Someone'}{self ? ' (you)' : ''}</span>
                                {(self || canModerate) && (
                                    <button type="button" className="gl-icon-btn" disabled={busy}
                                        title={self ? 'Leave this thread' : 'Remove from this thread'} aria-label={self ? 'Leave this thread' : `Remove ${f.username || 'them'}`}
                                        onClick={() => remove(f)} style={{ width: 24, height: 24, color: self ? 'var(--text-muted)' : 'var(--state-danger)' }}>
                                        <UserMinus size={12} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                    <p style={{ margin: 0, padding: '8px 16px 12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        Followers get a notification for every new reply. Everyone in the conversation can still read the thread.
                    </p>
                </div>
            )}
        </ToolbarModalShell>
    );
}
