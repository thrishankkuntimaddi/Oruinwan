import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '@services/api';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, Search, Circle, MessageSquare, Building2, CheckCheck } from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';
import io from 'socket.io-client';

const roleColor = (role) => {
    if (role === 'owner') return 'var(--accent)';
    if (role === 'admin') return 'var(--state-success)';
    return 'var(--text-secondary)';
};

const PlatformChat = () => {
    const { userId } = useParams();
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);
    const socketRef = useRef(null);
    const { showToast } = useToast();

    const scrollToBottom = () => setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    const fetchUsers = useCallback(async () => {
        try { const res = await api.get('/api/admin/dm-users'); setUsers(res.data || []); }
        catch (err) { console.error('Failed to fetch DM users:', err); showToast('Failed to load users', 'error'); }
    }, [showToast]);

    const fetchMessages = useCallback(async (uid) => {
        try { const res = await api.get(`/api/admin/dm/user/${uid}`); setMessages(Array.isArray(res.data) ? res.data : []); }
        catch (err) { console.error('Failed to fetch messages:', err); }
    }, []);

    useEffect(() => {
        socketRef.current = io(import.meta.env.VITE_BACKEND_URL);
        socketRef.current.on('platform-message', (message) => {
            setMessages(prev => prev.some(m => m._id === message._id) ? prev : [...prev, message]);
            scrollToBottom();
            fetchUsers();
        });
        return () => { if (socketRef.current) socketRef.current.disconnect(); };
    }, [fetchUsers]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);
    useEffect(() => {
        if (userId && users.length > 0) {
            const found = users.find(u => u._id === userId);
            if (found) { setSelectedUser(found); fetchMessages(userId); }
        }
    }, [userId, users, fetchMessages]);
    useEffect(() => { scrollToBottom(); }, [messages]);

    const selectUser = (user) => {
        setSelectedUser(user);
        setMessages([]);
        fetchMessages(user._id);
        navigate(`/chttrix-admin/dm/user/${user._id}`, { replace: true });
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || !selectedUser || sending) return;
        setSending(true);
        try {
            const res = await api.post(`/api/admin/dm/user/${selectedUser._id}`, { message: input });
            setMessages(prev => [...prev, res.data]);
            setInput('');
            scrollToBottom();
            fetchUsers();
        } catch (err) { showToast('Failed to send message', 'error'); }
        finally { setSending(false); }
    };

    const filteredUsers = users.filter(u =>
        u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isPlatformMsg = (msg) => msg.senderRole === 'platform';
    const formatTime = (date) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <div style={{ height: 'calc(100vh - 140px)', display: 'flex', gap: '1px', background: 'var(--border-subtle)', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
            {}
            <div style={{ width: '280px', flexShrink: 0, background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>Direct Messages</h2>
                    <div style={{ position: 'relative' }}>
                        <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        <input
                            type="text" placeholder="Search users or companies..." value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ width: '100%', paddingLeft: '30px', paddingRight: '10px', paddingTop: '8px', paddingBottom: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                        />
                    </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
                    {filteredUsers.length === 0 ? (
                        <div style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>No company users found</div>
                    ) : filteredUsers.map(user => (
                        <UserListItem key={user._id} user={user} selected={selectedUser?._id === user._id} onClick={() => selectUser(user)} roleColor={roleColor} formatTime={formatTime} />
                    ))}
                </div>
            </div>

            {}
            {selectedUser ? (
                <div style={{ flex: 1, background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {}
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-active)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '36px', height: '36px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                            {selectedUser.username?.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedUser.username}</span>
                                <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: roleColor(selectedUser.companyRole), padding: '1px 5px', border: `1px solid ${roleColor(selectedUser.companyRole)}` }}>
                                    {selectedUser.companyRole}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                <Building2 size={11} style={{ color: 'var(--text-muted)' }} />
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{selectedUser.companyName}</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: selectedUser.isOnline ? 'var(--state-success)' : 'var(--text-muted)', padding: '4px 10px', border: `1px solid ${selectedUser.isOnline ? 'var(--state-success)' : 'var(--border-default)'}` }}>
                            <Circle size={5} style={{ fill: selectedUser.isOnline ? 'var(--state-success)' : 'var(--text-muted)' }} />
                            {selectedUser.isOnline ? 'Online' : 'Offline'}
                        </div>
                    </div>

                    {}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-base)' }} className="custom-scrollbar">
                        {messages.length === 0 ? (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
                                <MessageSquare size={36} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No messages yet. Start the conversation!</p>
                            </div>
                        ) : messages.map((msg, i) => {
                            const isAdmin = isPlatformMsg(msg);
                            const initial = msg.sender?.username?.charAt(0).toUpperCase() || (isAdmin ? 'C' : selectedUser.username?.charAt(0).toUpperCase());
                            return (
                                <div key={msg._id || i} style={{ display: 'flex', gap: '10px', flexDirection: isAdmin ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
                                    <div style={{ width: '28px', height: '28px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: isAdmin ? 'var(--bg-base)' : 'var(--text-primary)', background: isAdmin ? 'var(--accent)' : 'var(--bg-active)', border: `1px solid ${isAdmin ? 'var(--accent)' : 'var(--border-accent)'}` }}>
                                        {initial}
                                    </div>
                                    <div style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', gap: '3px', alignItems: isAdmin ? 'flex-end' : 'flex-start' }}>
                                        <div style={{ padding: '10px 14px', background: isAdmin ? 'var(--accent)' : 'var(--bg-surface)', border: `1px solid ${isAdmin ? 'var(--accent)' : 'var(--border-subtle)'}`, fontSize: '13px', color: isAdmin ? 'var(--bg-base)' : 'var(--text-primary)', lineHeight: '1.5' }}>
                                            {msg.content}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-muted)', flexDirection: isAdmin ? 'row-reverse' : 'row' }}>
                                            <span>{formatTime(msg.createdAt)}</span>
                                            {isAdmin && <CheckCheck size={10} style={{ color: 'var(--text-muted)' }} />}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>

                    {}
                    <form onSubmit={sendMessage} style={{ padding: '14px 16px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', display: 'flex', gap: '8px' }}>
                        <input
                            type="text" value={input} onChange={e => setInput(e.target.value)}
                            placeholder={`Message ${selectedUser.username}...`}
                            style={{ flex: 1, padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }}
                        />
                        <button type="submit" disabled={!input.trim() || sending} style={{
                            padding: '0 20px', background: 'var(--accent)', border: 'none', color: 'var(--bg-base)',
                            fontSize: '13px', fontWeight: 700, cursor: !input.trim() || sending ? 'not-allowed' : 'pointer',
                            opacity: !input.trim() || sending ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderRadius: '2px', transition: 'background 150ms ease'
                        }}
                            onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'var(--accent-hover)'; }}
                            onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}
                        >
                            {sending ? <div style={{ width: '14px', height: '14px', border: '2px solid var(--bg-base)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : <Send size={15} />}
                        </button>
                    </form>
                </div>
            ) : (
                <div style={{ flex: 1, background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
                    <MessageSquare size={40} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>Select a user to start chatting</p>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Choose from owners, admins, or managers</p>
                    </div>
                </div>
            )}
        </div>
    );
};

const UserListItem = ({ user, selected, onClick, roleColor }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                width: '100%', padding: '12px 14px',
                borderBottom: '1px solid var(--border-subtle)',
                borderLeft: selected ? '2px solid var(--accent)' : '2px solid transparent',
                background: selected ? 'var(--bg-active)' : hov ? 'var(--bg-hover)' : 'transparent',
                cursor: 'pointer', textAlign: 'left',
                transition: 'background 150ms ease', border: 'none', display: 'block'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: '36px', height: '36px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>
                        {user.username?.charAt(0).toUpperCase()}
                    </div>
                    {user.isOnline && <span style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--state-success)', border: '1px solid var(--bg-surface)' }} />}
                    {user.unreadCount > 0 && <span style={{ position: 'absolute', top: '-4px', right: '-4px', width: '16px', height: '16px', borderRadius: '50%', background: 'var(--state-danger)', color: 'white', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{user.unreadCount > 9 ? '9+' : user.unreadCount}</span>}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.username}</span>
                        <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: roleColor(user.companyRole), flexShrink: 0, padding: '1px 4px', border: `1px solid ${roleColor(user.companyRole)}` }}>{user.companyRole}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Building2 size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.companyName}</span>
                    </div>
                    {user.lastMessage && <p style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>{user.lastMessage.content}</p>}
                </div>
            </div>
        </button>
    );
};

export default PlatformChat;
