import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Ticket, Send, Paperclip, Clock, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { useToast } from '../../contexts/ToastContext';
import api from '@services/api';
import io from 'socket.io-client';

const inputSt = {
    background: 'var(--bg-input)', border: '1px solid var(--border-default)',
    color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif', padding: '8px 12px', width: '100%',
};

const statusColor = { open: 'var(--text-primary)', 'in-progress': 'var(--accent)', resolved: 'var(--state-success)', closed: 'var(--text-muted)' };
const priorityColor = { low: 'var(--text-muted)', medium: 'var(--text-secondary)', high: 'var(--accent)', critical: 'var(--state-danger)' };

const ContactAdmin = () => {
    const { user } = useAuth();
    const { company } = useCompany();
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState('chat');
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loadingMessages, setLoadingMessages] = useState(false);
    const messagesEndRef = useRef(null);
    const socketRef = useRef(null);
    const [tickets, setTickets] = useState([]);
    const [loadingTickets, setLoadingTickets] = useState(false);
    const [isCreateTicketOpen, setIsCreateTicketOpen] = useState(false);
    const [newTicket, setNewTicket] = useState({ subject: '', priority: 'medium', description: '' });

    useEffect(() => {
        if (user && activeTab === 'chat') {
            socketRef.current = io(import.meta.env.VITE_BACKEND_URL);
            socketRef.current.on('platform-message', (message) => {
                setMessages(prev => prev.some(m => m._id === message._id) ? prev : [...prev, message]);
            });
            return () => { if (socketRef.current) socketRef.current.disconnect(); };
        }
    }, [user, activeTab]);

    const fetchMessages = useCallback(async (showLoading = true) => {
        if (!user) return;
        try {
            if (showLoading) setLoadingMessages(true);
            const response = await api.get('/api/platform/support/messages/me');
            setMessages(response.data.messages || []);
        } catch { } finally { setLoadingMessages(false); }
    }, []);

    const fetchTickets = useCallback(async () => {
        if (!company?._id) return;
        try {
            setLoadingTickets(true);
            const response = await api.get(`/api/platform/support/tickets/${company._id}`);
            setTickets(response.data.tickets || []);
        } catch { showToast('Failed to load tickets', 'error'); } finally { setLoadingTickets(false); }
    }, [company?._id, showToast]);

    useEffect(() => {
        if (activeTab === 'chat' && user) {
            fetchMessages(true);
            const interval = setInterval(() => fetchMessages(false), 10000);
            return () => clearInterval(interval);
        }
    }, [activeTab, user, fetchMessages]);

    useEffect(() => { if (activeTab === 'tickets' && company?._id) fetchTickets(); }, [activeTab, company?._id, fetchTickets]);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        try {
            const response = await api.post('/api/platform/support/messages', { companyId: company._id, content: newMessage });
            setMessages(prev => [...prev, response.data.message]);
            setNewMessage('');
        } catch { showToast('Failed to send message', 'error'); }
    };

    const handleCreateTicket = async (e) => {
        e.preventDefault();
        try {
            const response = await api.post('/api/platform/support/tickets', { companyId: company._id, ...newTicket });
            setTickets(prev => [response.data.ticket, ...prev]);
            setIsCreateTicketOpen(false);
            setNewTicket({ subject: '', priority: 'medium', description: '' });
            showToast('Ticket created successfully', 'success');
        } catch { showToast('Failed to create ticket', 'error'); }
    };

    return (
        <div style={{ height: '100%', background: 'var(--bg-base)', overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {}
            <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div>
                    <h1 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>Contact Platform Admin</h1>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Get support from the Chttrix team</p>
                </div>
                <div style={{ display: 'flex', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)', padding: '2px' }}>
                    {[{ id: 'chat', icon: MessageSquare, label: 'Live Chat' }, { id: 'tickets', icon: Ticket, label: 'Support Tickets' }].map(t => {
                        const active = activeTab === t.id;
                        return (
                            <button key={t.id} onClick={() => setActiveTab(t.id)}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: active ? 'var(--bg-surface)' : 'none', border: active ? '1px solid var(--border-accent)' : '1px solid transparent', color: active ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '12px', fontWeight: active ? 600 : 400, cursor: 'pointer', borderRadius: '2px', transition: 'all 150ms ease' }}>
                                <t.icon size={13} /> {t.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {}
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                {activeTab === 'chat' ? (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        {}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }} className="custom-scrollbar">
                            {loadingMessages ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px 0' }}>
                                    {[1,2,3].map((i, idx) => {
                                        const isRight = idx % 2 === 0;
                                        return (
                                            <div key={i} style={{ display: 'flex', flexDirection: isRight ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: '8px' }}>
                                                <div className="sk" style={{ width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0 }} />
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isRight ? 'flex-end' : 'flex-start', gap: '4px' }}>
                                                    <div className="sk" style={{ height: '8px', width: '70px' }} />
                                                    <div className="sk" style={{ height: '44px', width: `${160 + i * 30}px`, borderRadius: isRight ? '12px 12px 2px 12px' : '12px 12px 12px 2px' }} />
                                                    <div className="sk" style={{ height: '8px', width: '45px' }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : messages.length === 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', paddingBottom: '48px' }}>
                                    <div style={{ width: '56px', height: '56px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                                        <MessageSquare size={24} style={{ color: 'var(--accent)' }} />
                                    </div>
                                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>How can we help?</h3>
                                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '320px', lineHeight: '1.6' }}>Start a conversation with the Chttrix platform team.</p>
                                </div>
                            ) : (
                                <>
                                    {messages.map((msg, idx) => {
                                        const isOwn = msg.senderRole === 'company';
                                        const senderName = user?.firstName || user?.username || 'You';
                                        const initials = senderName.charAt(0).toUpperCase();
                                        return (
                                            <div key={msg._id || idx} style={{ display: 'flex', flexDirection: isOwn ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: '8px' }}>
                                                {}
                                                <div style={{ width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--bg-base)', background: isOwn ? '#7a7a7a' : 'var(--accent)' }}>
                                                    {isOwn ? initials : 'C'}
                                                </div>
                                                {}
                                                <div style={{ maxWidth: '60%', display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start', gap: '3px' }}>
                                                    <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                        {isOwn ? senderName : 'Chttrix Support'}
                                                    </p>
                                                    <div style={{ padding: '10px 14px', background: isOwn ? 'var(--accent)' : 'var(--bg-surface)', border: `1px solid ${isOwn ? 'var(--accent)' : 'var(--border-default)'}`, borderRadius: isOwn ? '12px 12px 2px 12px' : '12px 12px 12px 2px' }}>
                                                        <p style={{ fontSize: '13px', color: isOwn ? 'var(--bg-base)' : 'var(--text-primary)', lineHeight: '1.5' }}>{msg.content}</p>
                                                    </div>
                                                    <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={messagesEndRef} />
                                </>
                            )}
                        </div>
                        {}
                        <div style={{ padding: '12px 24px', background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px', alignItems: 'center', maxWidth: '800px', margin: '0 auto' }}>
                                <button type="button" style={{ padding: '8px', background: 'none', border: '1px solid var(--border-default)', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>
                                    <Paperclip size={15} />
                                </button>
                                <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type your message..." style={{ ...inputSt, boxSizing: 'border-box' }} />
                                <button type="submit" disabled={!newMessage.trim()}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: newMessage.trim() ? 'var(--accent)' : 'var(--bg-active)', border: 'none', color: newMessage.trim() ? 'var(--bg-base)' : 'var(--text-muted)', fontSize: '12px', fontWeight: 700, cursor: newMessage.trim() ? 'pointer' : 'not-allowed', flexShrink: 0, transition: 'all 150ms ease' }}>
                                    <Send size={13} /> Send
                                </button>
                            </form>
                        </div>
                    </div>
                ) : (
                    
                    <div style={{ height: '100%', overflowY: 'auto', padding: '20px 24px' }} className="custom-scrollbar">
                        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                                    <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                    <input type="text" placeholder="Search tickets..." style={{ ...inputSt, paddingLeft: '30px', boxSizing: 'border-box' }} />
                                </div>
                                <NewTicketBtn onClick={() => setIsCreateTicketOpen(true)} />
                            </div>

                            {loadingTickets ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {[1,2,3].map(i => (
                                        <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '14px 16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                <div className="sk" style={{ height: '11px', width: '220px' }} />
                                                <div className="sk" style={{ height: '18px', width: '65px', flexShrink: 0 }} />
                                            </div>
                                            <div className="sk" style={{ height: '9px', width: '100%', marginBottom: '3px' }} />
                                            <div className="sk" style={{ height: '9px', width: '80%', marginBottom: '12px' }} />
                                            <div style={{ display: 'flex', gap: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                                                <div className="sk" style={{ height: '9px', width: '50px' }} />
                                                <div className="sk" style={{ height: '9px', width: '90px' }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : tickets.length === 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', background: 'var(--bg-surface)', border: '1px dashed var(--border-accent)' }}>
                                    <div style={{ width: '48px', height: '48px', background: 'var(--bg-active)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                                        <Ticket size={22} style={{ color: 'var(--text-muted)' }} />
                                    </div>
                                    <h3 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>No tickets yet</h3>
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Create a support ticket and our team will get back to you shortly.</p>
                                    <NewTicketBtn onClick={() => setIsCreateTicketOpen(true)} />
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {tickets.map(ticket => (
                                        <div key={ticket._id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '14px 16px', transition: 'border-color 150ms ease', cursor: 'default' }}
                                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
                                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                <h3 style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', flex: 1, paddingRight: '12px' }}>{ticket.subject}</h3>
                                                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'capitalize', padding: '2px 7px', border: `1px solid ${statusColor[ticket.status] || 'var(--border-default)'}`, color: statusColor[ticket.status] || 'var(--text-muted)', flexShrink: 0 }}>
                                                    {ticket.status}
                                                </span>
                                            </div>
                                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '10px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ticket.description}</p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--text-muted)', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                                                <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.06em', color: priorityColor[ticket.priority] || 'var(--text-muted)' }}>{ticket.priority}</span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Clock size={11} /> {new Date(ticket.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {}
            {isCreateTicketOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', width: '100%', maxWidth: '520px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Create Support Ticket</h2>
                        </div>
                        <form onSubmit={handleCreateTicket} style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {[
                                { key: 'subject', label: 'Subject', type: 'text', placeholder: 'Brief description of your issue' },
                            ].map(f => (
                                <div key={f.key}>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '6px' }}>{f.label}</label>
                                    <input type={f.type} required value={newTicket[f.key]} onChange={e => setNewTicket(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} style={{ ...inputSt, boxSizing: 'border-box' }} />
                                </div>
                            ))}
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '6px' }}>Priority</label>
                                <select value={newTicket.priority} onChange={e => setNewTicket(p => ({ ...p, priority: e.target.value }))} style={{ ...inputSt, boxSizing: 'border-box' }}>
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                    <option value="critical">Critical</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '6px' }}>Description</label>
                                <textarea required rows={5} value={newTicket.description} onChange={e => setNewTicket(p => ({ ...p, description: e.target.value }))} placeholder="Provide detailed information about your issue..." style={{ ...inputSt, resize: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                                <button type="button" onClick={() => setIsCreateTicketOpen(false)} style={{ padding: '8px 14px', background: 'none', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', borderRadius: '2px' }}>Cancel</button>
                                <button type="submit" style={{ padding: '8px 14px', background: 'var(--accent)', border: 'none', color: 'var(--bg-base)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', borderRadius: '2px' }}>Create Ticket</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const NewTicketBtn = ({ onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: hov ? 'var(--accent-hover)' : 'var(--accent)', border: 'none', color: 'var(--bg-base)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', borderRadius: '2px', transition: 'background 150ms ease', flexShrink: 0 }}>
            <Ticket size={13} /> New Ticket
        </button>
    );
};

export default ContactAdmin;
