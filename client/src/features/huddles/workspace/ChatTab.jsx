import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Loader2, ExternalLink, RotateCcw } from 'lucide-react';
import api from '../../../services/api';
import { batchDecryptMessages } from '../../../services/messageEncryptionService';
import { normalizeMessage, sameId } from '../../../hooks/conversationUtils';
import { useMessageActions } from '../../../hooks/useMessageActions';
import MessageMarkdown from '../../../shared/components/messages/MessageMarkdown';
import { useToast } from '../../../contexts/ToastContext';
import { useSocket } from '../../../contexts/SocketContext';

const PREVIEW = {
    poll: '📊 Poll', image: '🖼 Image', video: '🎬 Video', file: '📎 File', voice: '🎙 Voice note',
    contact: '👤 Contact', meeting: '📅 Meeting', checklist: '☑ Checklist',
};

function textOf(e) {
    if (e.type === 'system') return e.payload?.text || e.systemEvent?.replace(/_/g, ' ') || 'Update';
    if (PREVIEW[e.type] && e.type !== 'checklist') return PREVIEW[e.type];
    const t = e.decryptedContent ?? e.payload?.text ?? '';
    if (e.type === 'checklist') {
        try { const c = JSON.parse(t); return `☑ ${c.title || 'Checklist'}`; } catch { return PREVIEW.checklist; }
    }
    return t;
}

const time = (d) => (d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');

/**
 * The huddle's conversation, side by side with the call: the last messages of
 * the channel (or DM), live, with a composer that uses the normal E2EE send path.
 */
export default function ChatTab({ conversation, workspaceId, conversationHref, onOpen }) {
    const { showToast } = useToast();
    const { socket } = useSocket() || {};
    const [events, setEvents] = useState([]);
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState(null);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const listRef = useRef(null);
    const convId = conversation?.id || null;
    const convType = conversation?.type || 'channel';
    const { sendMessage } = useMessageActions(convId, convType, workspaceId);

    const load = useCallback(async () => {
        if (!convId) return;
        setStatus('loading');
        setError(null);
        try {
            const url = convType === 'dm'
                ? `/api/v2/messages/workspace/${workspaceId}/dm/${convId}`
                : `/api/v2/messages/channel/${convId}`;
            const res = await api.get(url, { params: { limit: 40 } });
            const normalized = (res.data?.messages || []).map(normalizeMessage).filter((e) => !e.parentId);
            const decrypted = normalized.length ? await batchDecryptMessages(normalized, convId, convType, null) : [];
            decrypted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            setEvents(decrypted);
            setStatus('ready');
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not load the conversation.');
            setStatus('error');
        }
    }, [convId, convType, workspaceId]);

    useEffect(() => { load(); }, [load]);

    const addEvent = useCallback(async (raw) => {
        const [ev] = await batchDecryptMessages([normalizeMessage(raw)], convId, convType, null);
        if (!ev) return;
        setEvents((prev) => (prev.some((x) => String(x.id) === String(ev.id)) ? prev : [...prev, ev]));
    }, [convId, convType]);

    useEffect(() => {
        if (!socket || !convId) return undefined;
        const onNew = (data) => {
            const m = data?.message || data;
            const where = convType === 'dm' ? (m.dmId || m.dm?._id || m.dm) : (m.channelId || m.channel?._id || m.channel);
            if (!sameId(where, convId) || m.parentId || !m._id) return;
            addEvent(m).catch(() => {});
        };
        const onDeleted = (p) => {
            const id = String(p?.messageId || p?._id || '');
            if (id) setEvents((prev) => prev.filter((e) => String(e.id) !== id));
        };
        socket.on('new-message', onNew);
        socket.on('message:deleted', onDeleted);
        socket.on('message-deleted', onDeleted);
        return () => {
            socket.off('new-message', onNew);
            socket.off('message:deleted', onDeleted);
            socket.off('message-deleted', onDeleted);
        };
    }, [socket, convId, convType, addEvent]);

    useEffect(() => {
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [events.length]);

    const send = async (e) => {
        e?.preventDefault?.();
        const body = text.trim();
        if (!body || sending) return;
        setSending(true);
        try {
            const res = await sendMessage({ text: body });
            if (!res?.success) {
                showToast(res?.message || res?.error || 'Could not send the message.', 'error');
                return;
            }
            setText('');
            if (res.message?._id) {
                const ev = { ...normalizeMessage(res.message), decryptedContent: body };
                setEvents((prev) => (prev.some((x) => String(x.id) === String(ev.id)) ? prev : [...prev, ev]));
            }
        } finally {
            setSending(false);
        }
    };

    if (!convId) return <p className="hw-muted" style={{ padding: 14 }}>Pick a channel for this huddle in Wrap-up to chat here.</p>;

    return (
        <>
            <div className="hw-row" style={{ padding: '8px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span className="hw-muted hw-grow">Messages here go to the {convType === 'dm' ? 'conversation' : 'channel'} (end-to-end encrypted).</span>
                {conversationHref && (
                    <a className="gl-btn gl-btn--sm gl-btn--ghost" href={conversationHref} onClick={onOpen}><ExternalLink size={12} /> Open</a>
                )}
            </div>
            <div className="hw-chat-list" ref={listRef} data-testid="huddle-chat-list">
                {status === 'loading' && <div className="hw-muted hw-row"><Loader2 size={14} className="animate-spin" /> Loading messages…</div>}
                {status === 'error' && (
                    <div>
                        <p className="hw-error" role="alert">{error}</p>
                        <button type="button" className="gl-btn gl-btn--sm" onClick={load}><RotateCcw size={12} /> Try again</button>
                    </div>
                )}
                {status === 'ready' && events.length === 0 && <p className="hw-muted">No messages yet. Say hello.</p>}
                {events.map((e) => (
                    e.type === 'system'
                        ? <div key={e.id} className="hw-msg hw-msg-system">{textOf(e)}</div>
                        : (
                            <div key={e.id} className="hw-msg" data-testid="huddle-chat-message">
                                <div className="hw-msg-head">
                                    <span className="hw-msg-name">{e.sender?.username || e.payload?.sender?.username || 'Someone'}</span>
                                    <span className="hw-msg-time">{time(e.createdAt)}</span>
                                </div>
                                <div className="hw-msg-body">
                                    {PREVIEW[e.type] && e.type !== 'checklist' ? textOf(e) : <MessageMarkdown text={textOf(e)} />}
                                </div>
                            </div>
                        )
                ))}
            </div>
            <form className="hw-composer" onSubmit={send}>
                <textarea
                    value={text}
                    rows={1}
                    placeholder="Message the huddle's conversation"
                    aria-label="Message"
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                />
                <button type="submit" className="gl-btn gl-btn--primary" disabled={!text.trim() || sending} aria-label="Send" title="Send">
                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
            </form>
        </>
    );
}
