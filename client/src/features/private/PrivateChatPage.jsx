import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Lock, Send, ShieldCheck, Trash2 } from 'lucide-react';
import { PanelEmpty } from '../../components/layout/WorkspacePanel';
import { useContacts } from '../../contexts/ContactsContext';
import { useOptionalSocket } from '../../contexts/SocketContext';
import { useToast } from '../../contexts/ToastContext';
import { usePrivateChats } from './usePrivateChats';
import { personName } from './PrivateChatsPanel';

const box = { border: '1px solid var(--border-subtle)', borderRadius: 12, background: 'var(--surface, var(--bg-elevated))' };
const time = (iso) => { try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

/** Safety number: compare it with the other person (in person or on a call) to rule out a swapped key. */
function SafetyBar({ client, chat, otherName }) {
    const [safety, setSafety] = useState(null);
    const [open, setOpen] = useState(false);
    const refresh = useCallback(() => { client.safety(chat).then(setSafety).catch(() => {}); }, [client, chat]);
    useEffect(refresh, [refresh]);
    if (!safety) return null;
    const accept = async (verified) => { await client.acceptSafety(chat, safety.number, { verified }); setOpen(false); refresh(); };
    return (
        <div style={{ ...box, padding: '8px 12px', margin: '0 16px 8px', fontSize: 13 }} role={safety.changed ? 'alert' : undefined}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {safety.changed ? <AlertTriangle size={15} style={{ color: 'var(--warning, #b7791f)' }} aria-hidden />
                    : <ShieldCheck size={15} style={{ color: safety.verified ? 'var(--success, #2f855a)' : 'var(--accent)' }} aria-hidden />}
                <span style={{ flex: 1 }}>
                    {safety.changed ? `${otherName}’s or your devices changed. Compare the safety number again.`
                        : safety.verified ? 'Verified: you compared safety numbers.' : 'End-to-end encrypted. Compare safety numbers to be sure.'}
                </span>
                <button type="button" className="gl-btn" onClick={() => setOpen((v) => !v)}>{open ? 'Hide' : 'Safety number'}</button>
            </div>
            {open && (
                <div style={{ marginTop: 8 }}>
                    <code style={{ display: 'block', fontSize: 15, letterSpacing: 1, lineHeight: 1.7, wordSpacing: 6 }} data-testid="safety-number">{safety.number}</code>
                    <p style={{ margin: '6px 0', color: 'var(--text-secondary)' }}>
                        {otherName} sees the same 60 digits on their device if nobody is in between. Compare them in person or on a call.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="gl-btn gl-btn--primary" onClick={() => accept(true)}>They match</button>
                        {safety.changed && <button type="button" className="gl-btn" onClick={() => accept(false)}>Dismiss for now</button>}
                    </div>
                </div>
            )}
        </div>
    );
}

/** /workspace/:id/private/:chatId — one end-to-end encrypted conversation. */
export default function PrivateChatPage() {
    const { chatId } = useParams();
    const { showToast } = useToast();
    const { client, ready, error, userId } = usePrivateChats();
    const { allMembers = [] } = useContacts() || {};
    const socket = useOptionalSocket()?.socket;
    const [chat, setChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const endRef = useRef(null);

    const other = useMemo(() => {
        const id = chat?.participants.find((p) => p !== userId);
        return allMembers.find((m) => String(m.id) === id);
    }, [chat, allMembers, userId]);

    useEffect(() => {
        if (!client || !ready || !chatId) return undefined;
        let cancelled = false;
        client.get(chatId)
            .then(async (c) => {
                if (cancelled) return;
                setChat(c);
                const list = await client.messages(c);
                if (!cancelled) setMessages(list);
            })
            .catch((err) => showToast(err.message, 'error'));
        return () => { cancelled = true; };
    }, [client, ready, chatId, showToast]);

    useEffect(() => {
        if (!socket || !chat) return undefined;
        const onMessage = async ({ message }) => {
            if (message?.chatId !== chat.id) return;
            const m = await client.read(chat, message);
            setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        };
        const onDeleted = ({ chatId: id, messageId }) => { if (id === chat.id) setMessages((prev) => prev.filter((x) => x.id !== messageId)); };
        socket.on('private:message', onMessage);
        socket.on('private:deleted', onDeleted);
        return () => { socket.off('private:message', onMessage); socket.off('private:deleted', onDeleted); };
    }, [socket, chat, client]);

    useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }); }, [messages.length]);

    const send = async (e) => {
        e.preventDefault();
        if (!text.trim() || sending) return;
        setSending(true);
        try {
            const sent = await client.send(chat, text);
            const m = await client.read(chat, sent);
            setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
            setText('');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setSending(false);
        }
    };
    const remove = async (m) => {
        try { await client.remove(chat, m.id); setMessages((prev) => prev.filter((x) => x.id !== m.id)); } catch (err) { showToast(err.message, 'error'); }
    };

    if (error) return <PanelEmpty icon={AlertTriangle} title="Private chats are not available here" text={error} />;
    if (!chatId) {
        return (
            <PanelEmpty icon={Lock} title="Private chats"
                text="Messages here are encrypted on your device for the other person’s devices only. Oruinwan’s servers and workspace admins can’t read them. There is no AI, no search and no history on new devices; if you lose all your devices, the messages are gone." />
        );
    }
    if (!chat) return null;
    const otherName = personName(other);
    return (
        <section aria-label={`Private chat with ${otherName}`} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px' }}>
                <Lock size={16} aria-hidden style={{ color: 'var(--accent)' }} />
                <h1 style={{ fontSize: 16, margin: 0, fontWeight: 600 }}>{otherName}</h1>
                <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Private chat</span>
            </header>
            <SafetyBar client={client} chat={chat} otherName={otherName} />
            <ol style={{ flex: 1, overflowY: 'auto', listStyle: 'none', margin: 0, padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 6 }} aria-live="polite">
                {messages.map((m) => (
                    <li key={m.id} style={{ alignSelf: m.mine ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                        <div style={{
                            ...box, padding: '8px 12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                            background: m.mine ? 'var(--accent-soft, var(--bg-hover))' : undefined,
                            color: m.error ? 'var(--text-secondary)' : undefined, fontStyle: m.error ? 'italic' : undefined,
                        }}>
                            {m.error || m.text}
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: m.mine ? 'flex-end' : 'flex-start', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {time(m.at)}
                            {m.mine && (
                                <button type="button" className="gl-icon-btn" aria-label="Delete for everyone" onClick={() => remove(m)} style={{ width: 20, height: 20 }}>
                                    <Trash2 size={11} />
                                </button>
                            )}
                        </div>
                    </li>
                ))}
                {!messages.length && <li style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: 24 }}>Say hello. Only you and {otherName} can read this.</li>}
                <li ref={endRef} aria-hidden />
            </ol>
            <form onSubmit={send} style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border-subtle)' }}>
                <textarea className="gl-input" rows={1} value={text} placeholder={`Private message to ${otherName}`} aria-label="Private message"
                    onChange={(e) => setText(e.target.value)} maxLength={20000}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) send(e); }}
                    style={{ flex: 1, resize: 'none', minHeight: 38 }} />
                <button type="submit" className="gl-btn gl-btn--primary" disabled={!text.trim() || sending} aria-label="Send">
                    <Send size={15} />
                </button>
            </form>
        </section>
    );
}
