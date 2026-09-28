import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MessageSquare, Ticket, Send, Clock, LifeBuoy, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { useToast } from '../../contexts/ToastContext';
import api from '@services/api';
import { useSocket } from '../../contexts/SocketContext';
import {
    DashPage, PageHead, Panel, Toolbar, SearchBox, FilterTabs, Btn, IconBtn, Chip, Dialog, Field,
    LoadingState, ErrorState, EmptyState, errorMessage,
} from '../../components/company-dash/dashUi';
import '../OwnerDashboard/owner.css';

const STATUS_TONE = { open: undefined, 'in-progress': 'accent', resolved: 'success', closed: undefined };
const PRIORITY_TONE = { low: undefined, medium: undefined, high: 'warning', critical: 'danger' };

/** Support: live chat and tickets with the Oruinwan platform team. */
const ContactAdmin = () => {
    const { user } = useAuth();
    const { company } = useCompany();
    const { showToast } = useToast();
    const { socket } = useSocket();
    const companyId = company?._id;

    const [tab, setTab] = useState('chat');

    // ── chat ──
    const [messages, setMessages] = useState([]);
    const [chatState, setChatState] = useState({ loading: true, error: null });
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const endRef = useRef(null);

    // ── tickets ──
    const [tickets, setTickets] = useState([]);
    const [ticketState, setTicketState] = useState({ loading: false, error: null });
    const [query, setQuery] = useState('');
    const [createOpen, setCreateOpen] = useState(false);
    const [newTicket, setNewTicket] = useState({ subject: '', priority: 'medium', description: '' });
    const [creating, setCreating] = useState(false);
    const [openTicketId, setOpenTicketId] = useState(null);
    const [thread, setThread] = useState([]);
    const [loadingThread, setLoadingThread] = useState(false);
    const [threadReply, setThreadReply] = useState('');

    const fetchMessages = useCallback(async (showLoading = true) => {
        if (showLoading) setChatState({ loading: true, error: null });
        try {
            const response = await api.get('/api/platform/support/messages/me');
            setMessages(response.data.messages || []);
            setChatState({ loading: false, error: null });
        } catch (err) {
            if (showLoading) setChatState({ loading: false, error: errorMessage(err, 'Could not load messages') });
        }
    }, []);

    const fetchTickets = useCallback(async () => {
        if (!companyId) return;
        setTicketState({ loading: true, error: null });
        try {
            const response = await api.get(`/api/platform/support/tickets/${companyId}`);
            setTickets(response.data.tickets || []);
            setTicketState({ loading: false, error: null });
        } catch (err) {
            setTicketState({ loading: false, error: errorMessage(err, 'Could not load tickets') });
        }
    }, [companyId]);

    useEffect(() => {
        if (tab !== 'chat' || !user) return undefined;
        fetchMessages(true);
        const interval = setInterval(() => fetchMessages(false), 10000);
        return () => clearInterval(interval);
    }, [tab, user, fetchMessages]);

    useEffect(() => { if (tab === 'tickets') fetchTickets(); }, [tab, fetchTickets]);

    useEffect(() => {
        if (!socket || tab !== 'chat') return undefined;
        const onMessage = (message) => setMessages((prev) => (prev.some((m) => m._id === message._id) ? prev : [...prev, message]));
        socket.on('platform-message', onMessage);
        return () => { socket.off('platform-message', onMessage); };
    }, [socket, tab]);

    // Live replies and status changes from the Oruinwan support team.
    useEffect(() => {
        if (!socket || tab !== 'tickets') return undefined;
        const onSupportMessage = ({ ticketId, message }) => {
            if (ticketId !== openTicketId || !message) return;
            setThread((prev) => (prev.some((m) => m._id === message._id) ? prev : [...prev, message]));
        };
        const onTicketUpdated = ({ ticketId, status }) => {
            setTickets((prev) => prev.map((t) => (t._id === ticketId ? { ...t, status } : t)));
        };
        socket.on('support-message', onSupportMessage);
        socket.on('support-ticket-updated', onTicketUpdated);
        return () => {
            socket.off('support-message', onSupportMessage);
            socket.off('support-ticket-updated', onTicketUpdated);
        };
    }, [socket, tab, openTicketId]);

    useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages]);

    const sendMessage = async (e) => {
        e.preventDefault();
        const content = draft.trim();
        if (!content || !companyId) return;
        setSending(true);
        try {
            const response = await api.post('/api/platform/support/messages', { companyId, content });
            setMessages((prev) => [...prev, response.data.message]);
            setDraft('');
        } catch (err) {
            showToast(errorMessage(err, 'Failed to send message'), 'error');
        } finally {
            setSending(false);
        }
    };

    const toggleThread = useCallback(async (ticketId) => {
        if (openTicketId === ticketId) { setOpenTicketId(null); return; }
        setOpenTicketId(ticketId);
        setThread([]);
        setThreadReply('');
        setLoadingThread(true);
        try {
            const response = await api.get(`/api/platform/support/tickets/${ticketId}/messages`);
            setThread(response.data.messages || []);
        } catch (err) {
            showToast(errorMessage(err, 'Failed to load conversation'), 'error');
        } finally {
            setLoadingThread(false);
        }
    }, [openTicketId, showToast]);

    const sendThreadReply = async () => {
        const content = threadReply.trim();
        if (!content || !openTicketId) return;
        try {
            const response = await api.post(`/api/platform/support/tickets/${openTicketId}/messages`, { content });
            const message = response.data.message;
            setThread((prev) => (prev.some((m) => m._id === message._id) ? prev : [...prev, message]));
            setThreadReply('');
        } catch (err) {
            showToast(errorMessage(err, 'Failed to send reply'), 'error');
        }
    };

    const createTicket = async (e) => {
        e?.preventDefault();
        if (!newTicket.subject.trim() || !newTicket.description.trim()) return;
        setCreating(true);
        try {
            const response = await api.post('/api/platform/support/tickets', { companyId, ...newTicket });
            setTickets((prev) => [response.data.ticket, ...prev]);
            setCreateOpen(false);
            setNewTicket({ subject: '', priority: 'medium', description: '' });
            showToast('Ticket created', 'success');
        } catch (err) {
            showToast(errorMessage(err, 'Failed to create ticket'), 'error');
        } finally {
            setCreating(false);
        }
    };

    const shownTickets = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return tickets;
        return tickets.filter((t) => `${t.subject} ${t.description} ${t.status} ${t.priority}`.toLowerCase().includes(q));
    }, [tickets, query]);

    const myName = user?.profile?.name || user?.username || 'You';

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Support"
                    icon={LifeBuoy}
                    title="Contact Oruinwan"
                    lead="Chat with the platform team or track a support ticket"
                    actions={(
                        <FilterTabs
                            label="Support channel"
                            value={tab}
                            onChange={setTab}
                            options={[{ value: 'chat', label: 'Live chat' }, { value: 'tickets', label: 'Tickets', count: tickets.length || undefined }]}
                        />
                    )}
                />
            )}
        >
            {tab === 'chat' ? (
                <Panel flush title="Conversation" icon={MessageSquare}>
                    <div className="od-chat">
                        <div className="od-chat-log" aria-live="polite">
                            {chatState.loading ? <LoadingState label="Loading messages…" />
                                : chatState.error ? <ErrorState message={chatState.error} onRetry={() => fetchMessages(true)} />
                                    : messages.length === 0 ? (
                                        <EmptyState icon={MessageSquare} title="How can we help?" text="Start a conversation with the Oruinwan platform team. Replies arrive here." />
                                    ) : messages.map((msg, idx) => {
                                        const own = msg.senderRole === 'company';
                                        return (
                                            <div key={msg._id || idx} className="od-msg" data-own={own ? 'true' : undefined}>
                                                <span className="od-msg-meta">
                                                    {own ? (msg.sender?.username || myName) : 'Oruinwan support'} · {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <div className="od-msg-body">{msg.content}</div>
                                            </div>
                                        );
                                    })}
                            <div ref={endRef} />
                        </div>
                        <form className="od-chat-form" onSubmit={sendMessage}>
                            <input
                                className="gl-input"
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                placeholder="Type your message…"
                                aria-label="Message to Oruinwan support"
                            />
                            <Btn type="submit" variant="primary" icon={Send} loading={sending} disabled={!draft.trim() || !companyId}>Send</Btn>
                        </form>
                    </div>
                </Panel>
            ) : (
                <>
                    <Toolbar>
                        <SearchBox value={query} onChange={setQuery} placeholder="Search tickets…" />
                        <div className="cd-toolbar-spacer" />
                        <Btn variant="primary" icon={Plus} onClick={() => setCreateOpen(true)} disabled={!companyId}>New ticket</Btn>
                    </Toolbar>
                    {ticketState.loading ? <LoadingState label="Loading tickets…" />
                        : ticketState.error ? <ErrorState message={ticketState.error} onRetry={fetchTickets} />
                            : tickets.length === 0 ? (
                                <Panel>
                                    <EmptyState
                                        icon={Ticket}
                                        title="No tickets yet"
                                        text="Create a support ticket and the Oruinwan team will get back to you."
                                        action={<Btn variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>New ticket</Btn>}
                                    />
                                </Panel>
                            ) : shownTickets.length === 0 ? (
                                <EmptyState title="No matching tickets" text={`Nothing matches “${query}”.`} />
                            ) : shownTickets.map((ticket) => (
                                <div key={ticket._id} className="gl-card od-ticket">
                                    <div className="od-ticket-head">
                                        <h3 className="od-ticket-title">{ticket.subject}</h3>
                                        <Chip tone={STATUS_TONE[ticket.status]}>{ticket.status}</Chip>
                                    </div>
                                    {ticket.description && <p className="od-ticket-desc">{ticket.description}</p>}
                                    <div className="od-ticket-foot">
                                        <Chip tone={PRIORITY_TONE[ticket.priority]}>{ticket.priority}</Chip>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={11} /> {new Date(ticket.createdAt).toLocaleDateString()}</span>
                                        <Btn size="sm" variant="ghost" icon={MessageSquare} onClick={() => toggleThread(ticket._id)} style={{ marginLeft: 'auto' }}>
                                            {openTicketId === ticket._id ? 'Hide conversation' : 'View conversation'}
                                        </Btn>
                                    </div>
                                    {openTicketId === ticket._id && (
                                        <div data-testid="ticket-thread" className="od-thread">
                                            {loadingThread ? <span className="cd-muted" style={{ fontSize: 12 }}>Loading…</span>
                                                : thread.length === 0 ? <span className="cd-muted" style={{ fontSize: 12 }}>No replies yet.</span>
                                                    : thread.map((m) => {
                                                        const fromSupport = m.senderRole === 'platform';
                                                        return (
                                                            <div key={m._id} className="od-msg" data-own={fromSupport ? undefined : 'true'}>
                                                                <span className="od-msg-meta">
                                                                    {fromSupport ? 'Oruinwan support' : (m.sender?.username || 'You')} · {new Date(m.createdAt).toLocaleString()}
                                                                </span>
                                                                <div className="od-msg-body">{m.content}</div>
                                                            </div>
                                                        );
                                                    })}
                                            {ticket.status !== 'closed' && (
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <input
                                                        className="gl-input"
                                                        style={{ flex: 1, minWidth: 0 }}
                                                        value={threadReply}
                                                        onChange={(e) => setThreadReply(e.target.value)}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') sendThreadReply(); }}
                                                        placeholder="Reply to support…"
                                                        aria-label="Reply to support"
                                                    />
                                                    <IconBtn label="Send reply" onClick={sendThreadReply} disabled={!threadReply.trim()}><Send size={14} /></IconBtn>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                </>
            )}

            <Dialog
                open={createOpen}
                title="New support ticket"
                lead="Describe the problem; the Oruinwan team replies in the ticket thread."
                onClose={() => setCreateOpen(false)}
                busy={creating}
                footer={(
                    <>
                        <Btn variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Btn>
                        <Btn
                            variant="primary"
                            loading={creating}
                            onClick={createTicket}
                            disabled={!newTicket.subject.trim() || !newTicket.description.trim()}
                        >
                            Create ticket
                        </Btn>
                    </>
                )}
            >
                <form onSubmit={createTicket} style={{ display: 'contents' }}>
                    <Field label="Subject" htmlFor="ticket-subject">
                        <input id="ticket-subject" className="gl-input" required value={newTicket.subject} onChange={(e) => setNewTicket((p) => ({ ...p, subject: e.target.value }))} placeholder="Brief description of your issue" />
                    </Field>
                    <Field label="Priority" htmlFor="ticket-priority">
                        <select id="ticket-priority" className="gl-input cd-select" value={newTicket.priority} onChange={(e) => setNewTicket((p) => ({ ...p, priority: e.target.value }))}>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                        </select>
                    </Field>
                    <Field label="Description" htmlFor="ticket-description">
                        <textarea id="ticket-description" className="gl-input" required rows={5} value={newTicket.description} onChange={(e) => setNewTicket((p) => ({ ...p, description: e.target.value }))} placeholder="What happened, and what did you expect?" />
                    </Field>
                </form>
            </Dialog>
        </DashPage>
    );
};

export default ContactAdmin;
