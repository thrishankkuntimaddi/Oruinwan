import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X, Users, Send } from 'lucide-react';
import api from '@services/api';
import ChatWindowV2 from '../chatWindowComp/ChatWindowV2';
import useWorkspaceRecipients from '../recipients/useWorkspaceRecipients';
import { filterRecipients } from '../recipients/recipients';
import { createGroupDM, MAX_GROUP_MEMBERS } from '../groupDm/groupDmApi';
import { groupChatObject } from '../groupDm/groupChat';
import { getAvatarUrl } from '../../../utils/avatarUtils';
import { useContacts } from '../../../contexts/ContactsContext';
import { useToast } from '../../../contexts/ToastContext';

/** The chat object ChatWindowV2 expects, from a POST /api/v2/dm/find result. */
export function chatFromFound(dm, workspaceId, myId) {
    if (!dm) return null;
    if (dm.isGroup) return groupChatObject({ ...dm, members: dm.participants }, workspaceId);
    const others = (dm.participants || []).filter((p) => String(p._id) !== String(myId));
    // A note-to-self chat has only me in it.
    const other = others[0] || (dm.participants || [])[0] || {};
    return {
        id: dm.id,
        userId: other._id || null,
        name: dm.isSelf ? `${other.username || 'You'} (you)` : (other.username || 'Direct message'),
        isSelf: !!dm.isSelf,
        type: 'dm',
        avatar: other.profilePicture || null,
        status: other.isOnline ? 'online' : 'offline',
        isNew: false,
        workspaceId,
    };
}

const names = (people) => {
    const n = people.map((p) => p.name);
    return n.length <= 2 ? n.join(' and ') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
};

/**
 * New message, like Slack: a "To:" bar on top. Pick one person and your chat with them opens
 * below; add more and the group with exactly those people (and you) opens. When there is no such
 * conversation yet, it says so: start the group (or the chat) with a first message, or without one.
 * Picking only yourself opens your note-to-self chat.
 *
 * base: 'home' or 'messages' — where conversations open and where Close goes back to.
 * A group's "+" opens this with its people already picked (route state `people`).
 */
export default function NewMessageView({ workspaceId, currentUserId, currentUser = null, base = 'messages' }) {
    const navigate = useNavigate();
    const location = useLocation();
    const home = `/workspace/${workspaceId}/${base}`;
    const prefill = location.state?.people;
    const { refreshContacts, contacts } = useContacts() || {};
    const { showToast } = useToast() || {};
    const [picked, setPicked] = useState(() => (Array.isArray(prefill) ? prefill.filter((p) => p?._id && String(p._id) !== String(currentUserId)) : []));
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const [found, setFound] = useState({ state: 'idle', dm: null });
    const [draft, setDraft] = useState('');
    const [groupName, setGroupName] = useState('');
    const [busy, setBusy] = useState(false);
    // The people list is open while the To field has focus (a click elsewhere closes it).
    const [menuOpen, setMenuOpen] = useState(true);
    const inputRef = useRef(null);
    const { list: others, loading } = useWorkspaceRecipients(workspaceId, currentUserId, true);

    // Me first ("Name (you)"): picking only me opens my note-to-self chat.
    const list = useMemo(() => {
        if (!currentUserId) return others;
        const myName = currentUser?.username || currentUser?.name || 'You';
        const me = { _id: String(currentUserId), username: myName, name: `${myName} (you)`, email: currentUser?.email || '', profilePicture: currentUser?.profilePicture || null, isMe: true };
        return [me, ...others];
    }, [others, currentUserId, currentUser]);

    const pickedIds = useMemo(() => new Set(picked.map((p) => p._id)), [picked]);
    const pickedMe = picked.some((p) => p.isMe);
    const results = useMemo(
        () => (!menuOpen ? [] : query.trim() || picked.length === 0
            ? filterRecipients(list, query).filter((p) => !pickedIds.has(p._id) && !(p.isMe && picked.length)).slice(0, 8)
            : []),
        [list, query, pickedIds, picked.length, menuOpen],
    );

    // Typing anywhere on this screen (nothing else focused) goes into the To field.
    useEffect(() => {
        const onKey = (e) => {
            if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
            const el = document.activeElement;
            if (el && el !== document.body && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el.tagName))) return;
            e.preventDefault();
            setMenuOpen(true);
            setQuery((q) => q + e.key);
            inputRef.current?.focus();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);
    useEffect(() => { setActive(0); }, [query]);

    // Who's in the To bar decides the conversation: look it up without creating anything.
    const key = picked.map((p) => p._id).sort().join(',');
    useEffect(() => {
        if (!key || !workspaceId) { setFound({ state: 'idle', dm: null }); return undefined; }
        let live = true;
        setFound((f) => ({ state: 'loading', dm: f.dm }));
        const ids = key.split(',');
        // One person (or only me): our 1:1 chat always exists, like Slack. Made on first use; an
        // empty one stays out of the chat list until someone writes in it.
        const lookup = ids.length === 1
            ? api.get(`/api/v2/messages/workspace/${workspaceId}/dm/resolve/${ids[0]}`).then((res) => {
                const id = res.data?.dmSessionId;
                if (!id) return null;
                const p = picked[0] || {};
                const self = String(ids[0]) === String(currentUserId);
                return { id, isGroup: false, isSelf: self, participants: [{ _id: String(ids[0]), username: self ? (currentUser?.username || p.username || 'You') : (p.name || p.username), profilePicture: p.profilePicture || null }] };
            })
            : api.post('/api/v2/dm/find', { workspaceId, userIds: ids }).then((res) => res.data?.dm || null);
        lookup
            .then((dm) => { if (live) setFound({ state: 'done', dm }); })
            .catch((err) => { if (live) setFound({ state: 'error', dm: null, error: err?.response?.data?.message || 'Could not look up the conversation' }); });
        return () => { live = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, workspaceId]);

    const add = (person) => {
        // Me on my own (notes to self), or other people: not both.
        if (person.isMe || pickedMe) {
            setPicked([person]);
        } else {
            if (picked.length + 1 >= MAX_GROUP_MEMBERS) {
                showToast?.(`A group can have up to ${MAX_GROUP_MEMBERS} people.`, 'error');
                return;
            }
            setPicked((p) => (p.some((x) => x._id === person._id) ? p : [...p, person]));
        }
        setQuery('');
        inputRef.current?.focus();
    };
    // Close: start over (on the Messages page this view is the default screen).
    const close = () => {
        setPicked([]);
        setQuery('');
        setDraft('');
        setGroupName('');
        navigate(home);
    };
    const remove = (id) => setPicked((p) => p.filter((x) => x._id !== id));

    const onKey = (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
        else if ((e.key === 'Enter' || e.key === 'Tab') && results[active] && query.trim()) { e.preventDefault(); add(results[active]); }
        else if (e.key === 'Backspace' && !query && picked.length) setPicked((p) => p.slice(0, -1));
        else if (e.key === 'Escape') { if (menuOpen && (query || !picked.length)) { setMenuOpen(false); setQuery(''); } else close(); }
    };

    // No conversation yet: make it (a 1:1 DM, or a new group), then open it; the first message,
    // if any, is sent there once the conversation is ready.
    const start = async (text) => {
        if (busy || !picked.length) return;
        setBusy(true);
        try {
            let id;
            if (picked.length === 1) {
                const { data } = await api.get(`/api/v2/messages/workspace/${workspaceId}/dm/resolve/${picked[0]._id}`);
                id = data?.dmSessionId;
            } else {
                const dm = await createGroupDM(workspaceId, picked.map((p) => p._id), groupName);
                id = dm?.id || dm?._id;
            }
            if (!id) throw new Error('Could not start the conversation');
            await refreshContacts?.(workspaceId);
            const body = String(text || '').trim();
            navigate(`${home}/dm/${id}`, body ? { state: { sendDraft: { text: body } } } : undefined);
        } catch (err) {
            showToast?.(err?.response?.data?.message || err.message || 'Could not start the conversation', 'error');
        } finally {
            setBusy(false);
        }
    };

    const chat = found.state === 'done' ? chatFromFound(found.dm, workspaceId, currentUserId) : null;
    const isGroup = picked.length > 1;
    const target = pickedMe ? 'yourself' : names(picked);

    return (
        <div data-testid="new-message-view" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, fontFamily: 'var(--font)' }}>
            {/* Same look as the chat header below it: surface colour, 16px sides, one border. */}
            <div style={{ padding: '0 16px 12px', borderBottom: '1px solid var(--border-default)', background: 'var(--bg-surface)', flexShrink: 0, position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
                    <h2 style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>New message</h2>
                    <button type="button" aria-label="Close" title="Close" onClick={close}
                        style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', borderRadius: 2 }}>
                        <X size={16} />
                    </button>
                </div>
                <div onClick={() => { setMenuOpen(true); inputRef.current?.focus(); }}
                    style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: '6px 10px', border: '1px solid var(--border-default)', borderRadius: 2, background: 'var(--bg-input)', cursor: 'text' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>To:</span>
                    {picked.map((p) => (
                        <span key={p._id} data-testid="to-chip"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 4px 2px 8px', fontSize: 12, fontWeight: 600, background: 'var(--bg-active)', color: 'var(--accent)', border: '1px solid var(--border-accent)', borderRadius: 2 }}>
                            {p.name}
                            <button type="button" aria-label={`Remove ${p.name}`} onClick={(e) => { e.stopPropagation(); remove(p._id); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}>
                                <X size={12} />
                            </button>
                        </span>
                    ))}
                    <input
                        ref={inputRef}
                        autoFocus
                        aria-label="To"
                        placeholder={picked.length ? 'Add someone else…' : 'Type a name, username or email'}
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setMenuOpen(true); }}
                        onFocus={() => setMenuOpen(true)}
                        onBlur={() => setMenuOpen(false)}
                        onKeyDown={onKey}
                        autoComplete="off"
                        style={{ flex: 1, minWidth: 140, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font)', padding: '4px 0' }}
                    />
                </div>

                {results.length > 0 && (
                    <div role="listbox" aria-label="People" className="gl-card"
                        style={{ position: 'absolute', left: 16, right: 16, top: 'calc(100% - 6px)', zIndex: 30, maxHeight: 320, overflowY: 'auto', padding: 4, boxShadow: '0 8px 28px rgba(0,0,0,0.14)' }}>
                        {loading && !others.length && <p style={{ margin: 0, padding: 12, fontSize: 12, color: 'var(--text-muted)' }}>Loading people…</p>}
                        {results.map((p, i) => (
                            <div key={p._id} role="option" aria-selected={i === active} data-testid="to-option"
                                onMouseDown={(e) => { e.preventDefault(); add(p); }} onMouseEnter={() => setActive(i)}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', cursor: 'pointer', borderRadius: 2, background: i === active ? 'var(--bg-hover)' : 'none' }}>
                                <img src={getAvatarUrl({ ...p, username: p.username || p.name })} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{p.name}</div>
                                    {p.isMe
                                        ? <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Notes, links and drafts just for you</div>
                                        : p.email && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.email}</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                {picked.length === 0 ? (
                    <Hint title="Who is this for?" body="Add one person to open your chat with them, or several to open your group with exactly those people. Pick yourself for notes only you see." />
                ) : found.state === 'error' ? (
                    <Hint title="Something went wrong" body={found.error} />
                ) : chat ? (
                    <div data-testid="to-conversation" data-conversation-id={chat.id} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                        {/* No close button of its own: the To bar above closes this view. */}
                        <ChatWindowV2 key={chat.id} chat={chat} contacts={contacts} workspaceId={workspaceId} />
                    </div>
                ) : found.state === 'done' ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div data-testid="no-conversation" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24, textAlign: 'center' }}>
                            <Users size={28} style={{ color: 'var(--text-muted)' }} />
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                                {isGroup ? `You don't have a group with ${names(picked)} yet` : pickedMe ? 'Your notes to yourself' : `No messages with ${picked[0].name} yet`}
                            </p>
                            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', maxWidth: 420 }}>
                                {isGroup
                                    ? 'Start one: send a first message below, or start the group now. Your other chats with these people stay as they are.'
                                    : pickedMe ? 'Jot down notes, links and drafts. Only you can see them.' : 'Say hello below to start your chat.'}
                            </p>
                            {isGroup && (
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                                    <input
                                        aria-label="Group name"
                                        placeholder="Group name (optional)"
                                        value={groupName}
                                        maxLength={80}
                                        onChange={(e) => setGroupName(e.target.value)}
                                        style={{ width: 220, padding: '6px 10px', border: '1px solid var(--border-default)', borderRadius: 2, background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font)', outline: 'none' }}
                                    />
                                    <button type="button" className="gl-btn gl-btn--primary gl-btn--sm" data-testid="start-group" disabled={busy} onClick={() => start('')}>
                                        {busy ? 'Starting…' : 'Start group'}
                                    </button>
                                </div>
                            )}
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); start(draft); }}
                            style={{ display: 'flex', gap: 8, padding: '10px 16px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                            <textarea
                                aria-label="First message"
                                rows={2}
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (draft.trim()) start(draft); } }}
                                placeholder={pickedMe ? 'Write a note to yourself' : `Message ${target}`}
                                style={{ flex: 1, resize: 'none', padding: '8px 10px', border: '1px solid var(--border-default)', borderRadius: 2, background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font)', outline: 'none' }}
                            />
                            <button type="submit" className="gl-btn gl-btn--primary" aria-label="Send" disabled={busy || !draft.trim()}><Send size={14} /></button>
                        </form>
                    </div>
                ) : (
                    <Hint title="Looking for your conversation…" body="" />
                )}
            </div>
        </div>
    );
}

function Hint({ title, body }) {
    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 24, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</p>
            {body && <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', maxWidth: 420 }}>{body}</p>}
        </div>
    );
}
