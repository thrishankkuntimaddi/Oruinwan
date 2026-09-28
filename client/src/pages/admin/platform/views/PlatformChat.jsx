import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import api from '@services/api';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, MessageSquare, ArrowLeft, Building2 } from 'lucide-react';
import { useSocket } from '../../../../contexts/SocketContext';
import logger from '../../../../utils/logger';
import {
    PageHead, SearchBox, Btn, IconBtn, RoleChip, Dot, Avatar, EmptyState, ErrorState, LoadingState,
    errorMessage, timeAgo,
} from '../../../../components/company-dash/dashUi';

const formatTime = (date) => new Date(date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Live support chat between platform staff and company owners/admins. */
const PlatformChat = () => {
    const { userId } = useParams();
    const navigate = useNavigate();
    const { socket } = useSocket() || {};
    const [users, setUsers] = useState(null);
    const [usersError, setUsersError] = useState('');
    const [messages, setMessages] = useState([]);
    const [messagesState, setMessagesState] = useState({ loading: false, error: '' });
    const [input, setInput] = useState('');
    const [q, setQ] = useState('');
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState('');
    const endRef = useRef(null);

    const selected = useMemo(() => (users || []).find((u) => u._id === userId) || null, [users, userId]);
    const scrollToBottom = () => setTimeout(() => endRef.current?.scrollIntoView({ block: 'end' }), 30);

    const fetchUsers = useCallback(async () => {
        try {
            const res = await api.get('/api/admin/dm-users');
            setUsers(Array.isArray(res.data) ? res.data : []);
            setUsersError('');
        } catch (err) {
            logger.error('Failed to fetch DM users:', err);
            setUsersError(errorMessage(err, 'Could not load company contacts'));
            setUsers((u) => u || []);
        }
    }, []);

    const fetchMessages = useCallback(async (uid) => {
        setMessagesState({ loading: true, error: '' });
        try {
            const res = await api.get(`/api/admin/dm/user/${uid}`);
            setMessages(Array.isArray(res.data) ? res.data : []);
            setMessagesState({ loading: false, error: '' });
            scrollToBottom();
        } catch (err) {
            setMessagesState({ loading: false, error: errorMessage(err, 'Could not load this conversation') });
        }
    }, []);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);
    useEffect(() => { setMessages([]); setSendError(''); if (userId) fetchMessages(userId); }, [userId, fetchMessages]);

    useEffect(() => {
        if (!socket) return undefined;
        const onMessage = (message) => {
            setMessages((prev) => (prev.some((m) => m._id === message._id) ? prev : [...prev, message]));
            scrollToBottom();
            fetchUsers();
        };
        socket.on('platform-message', onMessage);
        return () => { socket.off('platform-message', onMessage); };
    }, [socket, fetchUsers]);

    const send = async (e) => {
        e.preventDefault();
        const text = input.trim();
        if (!text || !selected || sending) return;
        setSending(true);
        setSendError('');
        try {
            const res = await api.post(`/api/admin/dm/user/${selected._id}`, { message: text });
            setMessages((prev) => [...prev, res.data]);
            setInput('');
            scrollToBottom();
            fetchUsers();
        } catch (err) {
            setSendError(errorMessage(err, 'Message not sent'));
        } finally {
            setSending(false);
        }
    };

    const filtered = (users || []).filter((u) => {
        const needle = q.trim().toLowerCase();
        return !needle || [u.username, u.companyName, u.email].some((v) => String(v || '').toLowerCase().includes(needle));
    });

    return (
        <div className="cd-page">
            <PageHead eyebrow="Communication" title="Direct messages" lead="Talk to company owners and admins." />
            <div className="pf-chat" data-has-selection={selected ? 'true' : undefined}>
                <aside className="pf-chat-list" aria-label="Company contacts">
                    <div className="pf-chat-list-head">
                        <SearchBox value={q} onChange={setQ} placeholder="Search people or companies…" />
                    </div>
                    <div className="pf-chat-list-body">
                        {users === null ? <LoadingState /> : usersError ? <ErrorState message={usersError} onRetry={fetchUsers} /> : filtered.length === 0 ? (
                            <EmptyState icon={MessageSquare} title={users.length ? 'No match' : 'No company contacts'} text={users.length ? 'Try another search.' : 'Owners and admins of companies appear here.'} />
                        ) : filtered.map((u) => (
                            <button
                                key={u._id}
                                type="button"
                                className="pf-chat-person"
                                aria-current={selected?._id === u._id ? 'true' : undefined}
                                onClick={() => navigate(`/platform-admin/dm/user/${u._id}`, { replace: !!userId })}
                            >
                                <Avatar user={u} />
                                <span className="cd-grow">
                                    <span className="cd-cell-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {u.isOnline && <Dot tone="success" />}{u.username}
                                    </span>
                                    <span className="cd-cell-sub" style={{ display: 'block' }}>{u.companyName}</span>
                                    {u.lastMessage && <span className="cd-cell-sub" style={{ display: 'block' }}>{u.lastMessage.content}</span>}
                                </span>
                                {u.unreadCount > 0 && <span className="pf-unread" aria-label={`${u.unreadCount} unread`}>{u.unreadCount > 9 ? '9+' : u.unreadCount}</span>}
                            </button>
                        ))}
                    </div>
                </aside>

                <section className="pf-chat-main" aria-label="Conversation">
                    {!selected ? (
                        <EmptyState
                            icon={MessageSquare}
                            title={userId && users !== null ? 'Contact not found' : 'Pick a conversation'}
                            text={userId && users !== null ? 'Only owners and admins of a company can be messaged here.' : 'Choose an owner or admin on the left.'}
                        />
                    ) : (
                        <>
                            <div className="pf-chat-head">
                                <IconBtn label="Back to contacts" className="pf-chat-back" onClick={() => navigate('/platform-admin/dm')}><ArrowLeft size={16} /></IconBtn>
                                <Avatar user={selected} />
                                <div className="cd-grow" style={{ minWidth: 0, flex: 1 }}>
                                    <div className="cd-cell-title" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{selected.username} <RoleChip role={selected.companyRole} /></div>
                                    <div className="cd-cell-sub" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Building2 size={11} /> {selected.companyName} · {selected.isOnline ? 'Online' : 'Offline'}</div>
                                </div>
                            </div>
                            <div className="pf-chat-msgs">
                                {messagesState.loading && messages.length === 0 ? <LoadingState /> : messagesState.error ? (
                                    <ErrorState message={messagesState.error} onRetry={() => fetchMessages(selected._id)} />
                                ) : messages.length === 0 ? (
                                    <EmptyState icon={MessageSquare} title="No messages yet" text={`Start the conversation with ${selected.username}.`} />
                                ) : messages.map((m, i) => {
                                    const mine = m.senderRole === 'platform';
                                    return (
                                        <div key={m._id || i} className="pf-msg" data-mine={mine ? 'true' : undefined}>
                                            <div className="pf-msg-bubble">{m.content}</div>
                                            <span className="pf-msg-meta" title={formatTime(m.createdAt)}>
                                                {mine ? (m.sender?.username || 'Oruinwan') : (m.sender?.username || selected.username)} · {timeAgo(m.createdAt)}
                                            </span>
                                        </div>
                                    );
                                })}
                                <div ref={endRef} />
                            </div>
                            <form className="pf-chat-compose" onSubmit={send}>
                                <input
                                    className="gl-input"
                                    value={input}
                                    onChange={(e) => { setInput(e.target.value); if (sendError) setSendError(''); }}
                                    placeholder={`Message ${selected.username}…`}
                                    aria-label="Message"
                                    aria-invalid={sendError ? 'true' : undefined}
                                />
                                <Btn type="submit" variant="primary" icon={Send} loading={sending} disabled={!input.trim()}>Send</Btn>
                            </form>
                            {sendError && <div className="cd-error-text" role="alert" style={{ padding: '0 16px 10px' }}>{sendError}</div>}
                        </>
                    )}
                </section>
            </div>
        </div>
    );
};

export default PlatformChat;
