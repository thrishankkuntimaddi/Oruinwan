import React, { useState, useEffect } from 'react';
import api from '@services/api';
import { MessageCircle, X } from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';

const statusStyle = (status) => {
    const map = {
        open: { color: 'var(--state-success)', border: 'var(--state-success)' },
        'in-progress': { color: 'var(--accent)', border: 'var(--accent)' },
        resolved: { color: 'var(--text-muted)', border: 'var(--border-accent)' },
        closed: { color: 'var(--text-muted)', border: 'var(--border-default)' },
    };
    return map[status] || map.closed;
};

const SupportTickets = () => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [reply, setReply] = useState('');
    const { showToast } = useToast();

    useEffect(() => { fetchTickets(); }, []);

    const fetchTickets = async () => {
        try {
            const res = await api.get('/api/admin/tickets');
            setTickets(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (status) => {
        if (!selectedTicket) return;
        try {
            const res = await api.put(`/api/admin/tickets/${selectedTicket._id}`, { status });
            setTickets(prev => prev.map(t => t._id === selectedTicket._id ? res.data : t));
            setSelectedTicket(res.data);
            showToast(`Status updated to ${status}`, 'success');
        } catch { showToast('Failed to update status', 'error'); }
    };

    const handleReply = async () => {
        if (!reply.trim() || !selectedTicket) return;
        try {
            const res = await api.put(`/api/admin/tickets/${selectedTicket._id}`, { message: reply });
            setTickets(prev => prev.map(t => t._id === selectedTicket._id ? res.data : t));
            setSelectedTicket(res.data);
            setReply('');
            showToast('Reply sent', 'success');
        } catch { showToast('Failed to reply', 'error'); }
    };

    if (loading) return <LoadSpinner />;

    return (
        <div style={{ height: 'calc(100vh - 140px)', display: 'flex', gap: '1px', background: 'var(--border-subtle)', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
            {}
            <div style={{ width: '320px', flexShrink: 0, background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Support Tickets</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', padding: '2px 6px', border: '1px solid var(--border-accent)' }}>{tickets.length}</span>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
                    {tickets.map(ticket => (
                        <TicketListItem
                            key={ticket._id}
                            ticket={ticket}
                            selected={selectedTicket?._id === ticket._id}
                            onClick={() => setSelectedTicket(ticket)}
                        />
                    ))}
                    {tickets.length === 0 && (
                        <div style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>No tickets found</div>
                    )}
                </div>
            </div>

            {}
            {selectedTicket ? (
                <div style={{ flex: 1, background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {}
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-active)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <StatusBadge status={selectedTicket.status} />
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID: {selectedTicket._id.slice(-6)}</span>
                            <button onClick={() => setSelectedTicket(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                <X size={16} />
                            </button>
                        </div>
                        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>{selectedTicket.subject}</h2>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            From <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{selectedTicket.creatorId?.username}</span> ({selectedTicket.companyId?.name})
                        </p>
                    </div>

                    {}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }} className="custom-scrollbar">
                        {}
                        <div style={{ background: 'var(--bg-active)', border: '1px solid var(--border-subtle)', padding: '16px' }}>
                            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>Issue Description</div>
                            <p style={{ fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{selectedTicket.description}</p>
                        </div>
                        {selectedTicket.messages.map((msg, i) => {
                            const isAdmin = msg.sender?._id !== selectedTicket.creatorId?._id;
                            return (
                                <div key={i} style={{ display: 'flex', gap: '10px', flexDirection: isAdmin ? 'row-reverse' : 'row' }}>
                                    <div style={{ width: '28px', height: '28px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: isAdmin ? 'var(--bg-base)' : 'var(--text-primary)', background: isAdmin ? 'var(--accent)' : 'var(--bg-active)', border: '1px solid var(--border-accent)' }}>
                                        {msg.sender?.username?.charAt(0) || '?'}
                                    </div>
                                    <div style={{ maxWidth: '80%', padding: '10px 14px', background: isAdmin ? 'var(--accent)' : 'var(--bg-active)', border: `1px solid ${isAdmin ? 'var(--accent)' : 'var(--border-subtle)'}` }}>
                                        <p style={{ fontSize: '13px', color: isAdmin ? 'var(--bg-base)' : 'var(--text-primary)', margin: 0 }}>{msg.message}</p>
                                        <p style={{ fontSize: '10px', color: isAdmin ? 'rgba(12,12,12,0.6)' : 'var(--text-muted)', marginTop: '4px' }}>{new Date(msg.createdAt).toLocaleString()}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {}
                    <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-active)' }}>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                            {['open', 'in-progress', 'resolved'].map(s => (
                                <StatusBtn key={s} label={`Mark ${s}`} active={selectedTicket.status === s} onClick={() => handleUpdateStatus(s)} />
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <textarea
                                value={reply}
                                onChange={e => setReply(e.target.value)}
                                placeholder="Type a reply..."
                                style={{ flex: 1, padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', resize: 'none', height: '72px', fontFamily: 'inherit' }}
                            />
                            <button onClick={handleReply} style={{ padding: '0 20px', background: 'var(--accent)', border: 'none', color: 'var(--bg-base)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', borderRadius: '2px', transition: 'background 150ms ease' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}>
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div style={{ flex: 1, background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
                    <MessageCircle size={40} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Select a ticket to view details</p>
                </div>
            )}
        </div>
    );
};

const TicketListItem = ({ ticket, selected, onClick }) => {
    const [hov, setHov] = React.useState(false);
    const st = statusStyle(ticket.status);
    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                padding: '14px 16px',
                borderBottom: '1px solid var(--border-subtle)',
                borderLeft: selected ? '2px solid var(--accent)' : '2px solid transparent',
                background: selected ? 'var(--bg-active)' : hov ? 'var(--bg-hover)' : 'transparent',
                cursor: 'pointer',
                transition: 'background 150ms ease'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                <span style={{
                    fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em',
                    color: ticket.priority === 'critical' ? 'var(--state-danger)' : 'var(--text-muted)',
                    padding: '1px 5px',
                    border: `1px solid ${ticket.priority === 'critical' ? 'var(--state-danger)' : 'var(--border-default)'}`
                }}>
                    {ticket.priority}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(ticket.createdAt).toLocaleDateString()}</span>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.subject}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '8px' }}>{ticket.description}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{ticket.companyId?.name}</span>
                <StatusBadge status={ticket.status} />
            </div>
        </div>
    );
};

const StatusBadge = ({ status }) => {
    const st = statusStyle(status);
    return (
        <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: st.color, padding: '1px 6px', border: `1px solid ${st.border}` }}>
            {status}
        </span>
    );
};

const StatusBtn = ({ label, active, onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                padding: '5px 10px',
                background: active ? 'var(--bg-active)' : 'transparent',
                border: active ? '1px solid var(--accent)' : '1px solid var(--border-default)',
                color: active ? 'var(--accent)' : hov ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '11px', fontWeight: 500,
                borderRadius: '2px', cursor: 'pointer',
                transition: 'all 150ms ease'
            }}
        >
            {label}
        </button>
    );
};

const LoadSpinner = () => (
    <div style={{ padding: '20px', background: 'var(--bg-base)' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <div className="sk" style={{ height: '32px', flex: 1 }} />
            <div className="sk" style={{ height: '32px', width: '110px' }} />
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '16px 3fr 1.5fr 1fr 1fr 70px', background: 'var(--bg-active)', borderBottom: '1px solid var(--border-subtle)', padding: '10px 16px', gap: '12px' }}>
                {[0,120,80,60,90,0].map((w,i) => <div key={i} className="sk" style={{ height: '8px', width: `${w || 10}px` }} />)}
            </div>
            {[1,2,3,4,5].map(i => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '16px 3fr 1.5fr 1fr 1fr 70px', padding: '11px 16px', borderBottom: '1px solid var(--border-subtle)', gap: '12px', alignItems: 'center' }}>
                    <div className="sk" style={{ width: '8px', height: '8px', borderRadius: '50%' }} />
                    <div><div className="sk" style={{ height: '10px', width: '70%', marginBottom: '4px' }} /><div className="sk" style={{ height: '8px', width: '50%' }} /></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}><div className="sk" style={{ width: '18px', height: '18px', flexShrink: 0 }} /><div className="sk" style={{ height: '9px', width: '80px' }} /></div>
                    <div className="sk" style={{ height: '18px', width: '65px' }} />
                    <div className="sk" style={{ height: '9px', width: '70px' }} />
                    <div className="sk" style={{ height: '24px', width: '100%' }} />
                </div>
            ))}
        </div>
    </div>
);

export default SupportTickets;
