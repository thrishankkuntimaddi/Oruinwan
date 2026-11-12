import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Lock, Plus, Search, X } from 'lucide-react';
import WorkspacePanel, { PanelEmpty, PanelSection } from '../../components/layout/WorkspacePanel';
import { useContacts } from '../../contexts/ContactsContext';
import { useOptionalSocket } from '../../contexts/SocketContext';
import { useToast } from '../../contexts/ToastContext';
import { usePrivateChats } from './usePrivateChats';
import '../../styles/gloss.css';

export const personName = (p) => p?.username || p?.email || 'Someone';

/** Side panel of /workspace/:id/private: my private chats and "New private chat". */
export default function PrivateChatsPanel() {
    const { workspaceId, chatId } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { client, userId } = usePrivateChats();
    const { allMembers = [], members = [] } = useContacts() || {};
    const socketCtx = useOptionalSocket();
    const [chats, setChats] = useState([]);
    const [picking, setPicking] = useState(false);
    const [query, setQuery] = useState('');

    const byId = useMemo(() => new Map(allMembers.map((m) => [String(m.id), m])), [allMembers]);
    const load = useCallback(() => {
        if (!client || !workspaceId) return;
        client.list(workspaceId).then(setChats).catch((err) => showToast(err.message, 'error'));
    }, [client, workspaceId, showToast]);
    useEffect(load, [load]);

    const socket = socketCtx?.socket;
    useEffect(() => {
        if (!socket) return undefined;
        socket.on('private:chat', load);
        socket.on('private:message', load);
        return () => { socket.off('private:chat', load); socket.off('private:message', load); };
    }, [socket, load]);

    const start = async (person) => {
        try {
            const chat = await client.open(workspaceId, person.id);
            setPicking(false);
            setQuery('');
            load();
            navigate(`/workspace/${workspaceId}/private/${chat.id}`);
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const q = query.trim().toLowerCase();
    const candidates = members
        .filter((m) => String(m.id) !== userId)
        .filter((m) => !q || personName(m).toLowerCase().includes(q) || String(m.email || '').toLowerCase().includes(q))
        .slice(0, 30);

    return (
        <WorkspacePanel
            icon={Lock}
            title="Private chats"
            subtitle="End-to-end encrypted"
            actions={(
                <button type="button" className="gl-icon-btn" aria-label={picking ? 'Cancel' : 'New private chat'} onClick={() => setPicking((v) => !v)}>
                    {picking ? <X size={15} /> : <Plus size={15} />}
                </button>
            )}
            tools={picking ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                    <Search size={13} aria-hidden />
                    <input className="gl-input" autoFocus placeholder="Who do you want to talk to?" aria-label="Search people"
                        value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: 1 }} />
                </label>
            ) : null}
        >
            {picking ? (
                <PanelSection label="People">
                    {candidates.map((m) => (
                        <button key={m.id} type="button" className="gl-item" onClick={() => start(m)}>
                            <span className="gl-x-item-title">{personName(m)}</span>
                        </button>
                    ))}
                    {!candidates.length && <PanelEmpty title="Nobody found" text="Private chats are with people in this workspace." />}
                </PanelSection>
            ) : chats.length ? (
                <PanelSection label="Chats">
                    {chats.map((c) => {
                        const other = byId.get(c.participants.find((p) => p !== userId));
                        const active = c.id === chatId;
                        return (
                            <button key={c.id} type="button" className={`gl-item${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}
                                onClick={() => navigate(`/workspace/${workspaceId}/private/${c.id}`)}>
                                <Lock size={13} className="gl-x-item-icon" aria-hidden />
                                <span className="gl-x-item-title">{personName(other)}</span>
                            </button>
                        );
                    })}
                </PanelSection>
            ) : (
                <PanelEmpty icon={Lock} title="No private chats yet"
                    text="Only the two of you can read a private chat: not Oruinwan, not workspace admins."
                    action={<button type="button" className="gl-btn gl-btn--primary" onClick={() => setPicking(true)}>New private chat</button>} />
            )}
        </WorkspacePanel>
    );
}
