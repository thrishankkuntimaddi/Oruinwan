// Add people to the call you're in: pick workspace members; they ring (phone push too) and can
// join, even if they aren't in this DM or channel (server: huddle:invite).
import { useEffect, useMemo, useState } from 'react';
import { Check, UserPlus, X } from 'lucide-react';
import api from '@services/api';
import { useSocket } from '../../../contexts/SocketContext';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';

const nameOf = (m) => m?.profile?.name || m?.name || m?.username || 'Someone';
const idOf = (m) => String(m?._id || m?.id || m?.user?._id || m?.userId || '');

export default function AddPeopleDialog({ huddleId, inCall = [], onClose }) {
    const { socket } = useSocket();
    const { activeWorkspace } = useWorkspace();
    const { user } = useAuth();
    const { showToast } = useToast();
    const [members, setMembers] = useState([]);
    const [q, setQ] = useState('');
    const [picked, setPicked] = useState([]);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!activeWorkspace?.id) return;
        api.get(`/workspaces/${activeWorkspace.id}/members`)
            .then((res) => setMembers((res.data?.members || []).map((m) => m.user || m)))
            .catch(() => setMembers([]));
    }, [activeWorkspace?.id]);

    const here = useMemo(() => new Set(inCall.map((p) => String(p.userId))), [inCall]);
    const me = String(user?._id || user?.id || '');
    const list = useMemo(() => {
        const t = q.trim().toLowerCase();
        return members
            .filter((m) => idOf(m) && idOf(m) !== me && !here.has(idOf(m)))
            .filter((m) => !t || nameOf(m).toLowerCase().split(/\s+/).some((w) => w.startsWith(t)) || String(m.username || '').toLowerCase().startsWith(t))
            .slice(0, 50);
    }, [members, q, me, here]);

    const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    const add = () => {
        if (!socket || !picked.length) return;
        setBusy(true);
        const timer = setTimeout(() => { setBusy(false); showToast('No answer from the server. Check your connection.', 'error'); }, 6000);
        socket.emit('huddle:invite', { huddleId, userIds: picked }, (res) => {
            clearTimeout(timer);
            setBusy(false);
            if (!res?.ok) { showToast(res?.message || 'Could not add them.', 'error'); return; }
            showToast(res.invited === 1 ? 'Calling them now' : `Calling ${res.invited} people now`, 'success');
            onClose();
        });
    };

    return (
        <div className="cs-people-dialog" role="dialog" aria-label="Add people to the call" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.35)', zIndex: 20 }}>
            <div className="gl-card" style={{ width: 'min(420px, 92vw)', maxHeight: '70vh', display: 'flex', flexDirection: 'column', padding: 16, gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <UserPlus size={16} />
                    <strong style={{ flex: 1 }}>Add people to the call</strong>
                    <button type="button" aria-label="Close" onClick={onClose} className="gl-btn gl-btn--ghost gl-btn--sm"><X size={16} /></button>
                </div>
                <input autoFocus className="gl-input" placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} />
                <div style={{ overflowY: 'auto', flex: 1 }} role="list">
                    {list.map((m) => {
                        const id = idOf(m);
                        const on = picked.includes(id);
                        return (
                            <button key={id} type="button" role="listitem" aria-pressed={on} onClick={() => toggle(id)}
                                style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, padding: '8px 6px', background: on ? 'var(--accent-soft, rgba(184,149,106,0.12))' : 'transparent', border: 0, borderRadius: 8, color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left' }}>
                                <span style={{ flex: 1 }}>{nameOf(m)}</span>
                                {on && <Check size={15} style={{ color: 'var(--accent)' }} />}
                            </button>
                        );
                    })}
                    {!list.length && <p style={{ color: 'var(--text-secondary)', fontSize: 13, padding: 8 }}>{q ? 'No one matches.' : 'Everyone is already here.'}</p>}
                </div>
                <button type="button" className="gl-btn gl-btn--primary gl-btn--block" disabled={!picked.length || busy} onClick={add} data-testid="call-add-confirm">
                    {busy ? 'Adding…' : picked.length ? `Add ${picked.length} and ring` : 'Pick people to add'}
                </button>
            </div>
        </div>
    );
}
