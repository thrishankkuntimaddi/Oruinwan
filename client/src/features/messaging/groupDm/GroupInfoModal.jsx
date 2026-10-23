import { useEffect, useMemo, useState } from 'react';
import { X, UserPlus, LogOut, Pencil } from 'lucide-react';
import api from '@services/api';
import UserAvatarImage from '../../../shared/components/ui/UserAvatarImage';
import { getErrorMessage } from '../../../utils/apiHelpers';
import {
    MAX_GROUP_MEMBERS, getDMDetails, renameGroupDM, addGroupDMMembers, removeGroupDMMember, leaveGroupDM, groupTitle,
} from './groupDmApi';

const row = { display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 4px' };
const small = { fontSize: '11px', color: 'var(--text-muted)' };

/** Group DM details: people, rename, add people, remove (creator only), leave. */
export default function GroupInfoModal({ dmId, workspaceId, currentUserId, onClose, onChanged, onLeft }) {
    const [group, setGroup] = useState(null);
    const [error, setError] = useState(null);
    const [name, setName] = useState('');
    const [editing, setEditing] = useState(false);
    const [adding, setAdding] = useState(false);
    const [members, setMembers] = useState([]);
    const [picked, setPicked] = useState([]);
    const [query, setQuery] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let alive = true;
        getDMDetails(dmId)
            .then((dm) => { if (alive) { setGroup(dm); setName(dm.name || ''); } })
            .catch((err) => alive && setError(getErrorMessage(err)));
        return () => { alive = false; };
    }, [dmId]);

    useEffect(() => {
        if (!adding || !workspaceId) return;
        api.get(`/api/workspaces/${workspaceId}/members`)
            .then((res) => setMembers((res.data.members || []).map((m) => ({
                _id: String(m.user?._id || m._id || m.id),
                username: m.user?.username || m.username || m.email,
                profilePicture: m.user?.profilePicture || m.profilePicture || null,
            }))))
            .catch((err) => setError(getErrorMessage(err)));
    }, [adding, workspaceId]);

    const inGroup = useMemo(() => new Set((group?.participants || []).map((p) => String(p._id))), [group]);
    const candidates = members
        .filter((m) => !inGroup.has(m._id))
        .filter((m) => !query.trim() || (m.username || '').toLowerCase().includes(query.trim().toLowerCase()));
    const isCreator = group && String(group.createdBy) === String(currentUserId);
    const room = MAX_GROUP_MEMBERS - (group?.participants?.length || 0);

    const run = async (fn) => {
        setBusy(true);
        setError(null);
        try {
            const next = await fn();
            if (next) { setGroup(next); onChanged?.(next); }
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const saveName = () => run(async () => { const dm = await renameGroupDM(dmId, name); setEditing(false); return dm; });
    const addPicked = () => run(async () => { const dm = await addGroupDMMembers(dmId, picked); setPicked([]); setAdding(false); return dm; });
    const remove = (userId) => run(async () => { await removeGroupDMMember(dmId, userId); return getDMDetails(dmId); });
    const leave = async () => {
        setBusy(true);
        try {
            await leaveGroupDM(dmId);
            onLeft?.();
        } catch (err) {
            setError(getErrorMessage(err));
            setBusy(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-overlay)', backdropFilter: 'blur(4px)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div role="dialog" aria-modal="true" aria-label="Group info" data-testid="group-info"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', width: 'min(440px, calc(100vw - 32px))', maxHeight: 'min(600px, calc(100dvh - 32px))', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle, var(--border-default))', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {group ? groupTitle(group, currentUserId) : 'Group'}
                        </div>
                        <div style={small}>{group ? `${group.participants.length} people` : 'Loading…'}</div>
                    </div>
                    <button type="button" aria-label="Close" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}><X size={16} /></button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px' }}>
                    {error && <div role="alert" style={{ fontSize: '12px', color: 'var(--state-danger)', marginBottom: '8px' }}>{error}</div>}

                    {group && (
                        <>
                            <div style={{ marginBottom: '14px' }}>
                                <div style={{ ...small, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: '6px' }}>Name</div>
                                {editing ? (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input value={name} maxLength={80} autoFocus onChange={(e) => setName(e.target.value)} aria-label="Group name"
                                            onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditing(false); }}
                                            placeholder="Group name"
                                            style={{ flex: 1, padding: '7px 10px', background: 'var(--bg-input, var(--bg-hover))', border: '1px solid var(--border-default)', borderRadius: '2px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                                        <button type="button" className="gl-btn gl-btn--primary gl-btn--sm" disabled={busy} onClick={saveName}>Save</button>
                                    </div>
                                ) : (
                                    <button type="button" onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-primary)', fontSize: '13px' }}>
                                        {group.name || <span style={{ color: 'var(--text-muted)' }}>No name yet</span>}
                                        <Pencil size={12} aria-hidden="true" /> <span style={small}>Rename</span>
                                    </button>
                                )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                                <div style={{ ...small, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, flex: 1 }}>People</div>
                                {room > 0 && !adding && (
                                    <button type="button" onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px' }}>
                                        <UserPlus size={13} aria-hidden="true" /> Add people
                                    </button>
                                )}
                            </div>

                            {adding && (
                                <div style={{ border: '1px solid var(--border-default)', borderRadius: '2px', padding: '8px', marginBottom: '10px' }}>
                                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people" aria-label="Search people to add" autoFocus
                                        style={{ width: '100%', boxSizing: 'border-box', padding: '6px 9px', background: 'var(--bg-input, var(--bg-hover))', border: '1px solid var(--border-default)', borderRadius: '2px', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', marginBottom: '6px' }} />
                                    <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                                        {candidates.length === 0 && <div style={small}>Everyone in this workspace is already here.</div>}
                                        {candidates.map((m) => {
                                            const on = picked.includes(m._id);
                                            return (
                                                <label key={m._id} style={{ ...row, cursor: 'pointer' }}>
                                                    <input type="checkbox" checked={on} disabled={!on && picked.length >= room}
                                                        onChange={() => setPicked((p) => (on ? p.filter((x) => x !== m._id) : [...p, m._id]))} />
                                                    <UserAvatarImage userId={m._id} name={m.username} src={m.profilePicture} size={24} />
                                                    <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{m.username}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                                        <button type="button" className="gl-btn gl-btn--ghost gl-btn--sm" onClick={() => { setAdding(false); setPicked([]); }}>Cancel</button>
                                        <button type="button" className="gl-btn gl-btn--primary gl-btn--sm" disabled={busy || picked.length === 0} onClick={addPicked}>
                                            Add {picked.length || ''}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {group.participants.map((p) => {
                                const me = String(p._id) === String(currentUserId);
                                return (
                                    <div key={p._id} style={row}>
                                        <UserAvatarImage userId={p._id} name={p.username} src={p.profilePicture} size={28} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{me ? 'You' : p.username}</div>
                                            {String(group.createdBy) === String(p._id) && <div style={small}>Created the group</div>}
                                        </div>
                                        {isCreator && !me && (
                                            <button type="button" disabled={busy} onClick={() => remove(p._id)} aria-label={`Remove ${p.username}`}
                                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px' }}>Remove</button>
                                        )}
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>

                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-default)' }}>
                    <button type="button" disabled={busy || !group} onClick={leave}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--state-danger)', cursor: 'pointer', fontSize: '13px', padding: 0 }}>
                        <LogOut size={14} aria-hidden="true" /> Leave group
                    </button>
                    <div style={{ ...small, marginTop: '4px' }}>You'll stop getting messages. Someone in the group can add you back.</div>
                </div>
            </div>
        </div>
    );
}
