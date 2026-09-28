import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { isSameLanguage } from '../../../../utils/autoTranslate';
import { createPortal } from 'react-dom';
import {
    MessageSquare, Share, Pin, Copy, Trash2, Info, Pencil, Check, X, History, Globe,
    Bookmark, Bell, CheckSquare, Sparkles, Reply, Loader2, Code2,
} from 'lucide-react';
import { getMessageText, hasEditHistory, isBookmarkedBy } from '../../../../utils/messageActionUtils';

const NON_EDITABLE_TYPES = ['poll', 'system', 'meeting', 'contact', 'image', 'video', 'file', 'voice'];

/** Can the current user edit this message inline? */
export function canEditMessage(msg, isMe) {
    if (!isMe || !msg) return false;
    if (msg.isDeleted || msg.isDeletedUniversally || msg.sending || msg.failed) return false;
    if (NON_EDITABLE_TYPES.includes(msg.type)) return false;
    return !!getMessageText(msg);
}

/* ------------------------------------------------------------------ */
/* More menu                                                           */
/* ------------------------------------------------------------------ */

function MenuItem({ label, icon, onClick, accent = false, danger = false }) {
    const color = danger ? 'var(--state-danger)' : accent ? 'var(--accent)' : 'var(--text-secondary)';
    const hoverBg = danger ? 'rgba(192,57,43,0.08)' : 'var(--bg-hover)';
    return (
        <button
            type="button"
            role="menuitem"
            onClick={onClick}
            style={{ width: '100%', textAlign: 'left', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', outline: 'none', cursor: 'pointer', color, fontSize: '13px', fontFamily: 'var(--font)', transition: '100ms ease', whiteSpace: 'nowrap' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = hoverBg; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
            {icon}{label}
        </button>
    );
}

/**
 * Fixed-position dropdown anchored to a toolbar button rect, kept inside the
 * viewport. `groups` is an array of item arrays; empty groups are skipped and
 * dividers are drawn between the remaining ones. Escape closes it.
 */
export function MessageMoreMenu({ anchor, groups, onClose }) {
    const ref = useRef(null);
    const [pos, setPos] = useState({ top: anchor.bottom + 4, left: Math.max(8, anchor.right - 210), visibility: 'hidden' });

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const { offsetWidth: w, offsetHeight: h } = el;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let top = anchor.bottom + 4;
        if (top + h > vh - 8) top = anchor.top - h - 4;
        top = Math.max(8, Math.min(top, vh - h - 8));
        let left = anchor.right - w;
        left = Math.max(8, Math.min(left, vw - w - 8));
        setPos({ top, left, visibility: 'visible' });
    }, [anchor]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const visible = groups.map(g => g.filter(Boolean)).filter(g => g.length > 0);

    return createPortal(
        <div
            ref={ref}
            role="menu"
            style={{
                position: 'fixed', zIndex: 999, minWidth: '210px',
                maxHeight: 'calc(100vh - 16px)', overflowY: 'auto',
                backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-accent)',
                borderRadius: '2px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                paddingTop: '4px', paddingBottom: '4px', fontSize: '13px',
                ...pos,
            }}
        >
            {visible.map((group, gi) => (
                <React.Fragment key={gi}>
                    {gi > 0 && <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '4px 0' }} />}
                    {group.map(item => <MenuItem key={item.label} {...item} />)}
                </React.Fragment>
            ))}
        </div>,
        document.body
    );
}

/* ------------------------------------------------------------------ */
/* Small inline pieces                                                 */
/* ------------------------------------------------------------------ */

/** Small status chips: the thread was marked resolved, a task was made from the message. */
export function MessageBadges({ msg }) {
    if (!msg?.resolvedThreadAt && !msg?.linkedTaskId) return null;
    const chip = { display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 6, padding: '0 6px', fontSize: 10, fontWeight: 600, borderRadius: 2, lineHeight: '16px' };
    return (
        <>
            {msg.resolvedThreadAt && (
                <span data-testid="resolved-badge" title="Thread marked resolved" style={{ ...chip, color: 'var(--state-success)', background: 'rgba(90,186,138,0.1)' }}>✓ Resolved</span>
            )}
            {msg.linkedTaskId && (
                <span data-testid="linked-task-badge" title="A task was created from this message" style={{ ...chip, color: 'var(--accent)', background: 'rgba(184,149,106,0.12)' }}>☑ Task</span>
            )}
        </>
    );
}

export function EditedBadge({ msg, onOpen }) {
    const restored = msg.restoredFromVersion;
    const when = msg.editedAt ? new Date(msg.editedAt).toLocaleString() : '';
    return (
        <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpen?.(msg); }}
            title={onOpen ? `Edited ${when} · view edit history` : `Edited ${when}`}
            style={{
                fontSize: '11px', fontStyle: 'italic', marginLeft: '4px',
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                background: 'none', border: 'none', outline: 'none', padding: 0,
                color: onOpen ? 'var(--accent)' : 'var(--text-muted)',
                cursor: onOpen ? 'pointer' : 'default', fontFamily: 'var(--font)',
            }}
        >
            <History size={10} />
            {restored ? `(edited · restored v${restored})` : '(edited)'}
        </button>
    );
}

export function TranslationBlock({ state, onClear, onRetry }) {
    if (!state) return null;
    if (state.status === 'loading') {
        return (
            <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <Loader2 size={11} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} /> Translating…
            </div>
        );
    }
    if (state.status === 'error') {
        return (
            <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--state-danger)' }}>
                {state.error || 'Translation failed.'}
                <button type="button" onClick={onRetry} style={{ marginLeft: '6px', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 'inherit', outline: 'none', padding: 0 }}>Retry</button>
                <button type="button" onClick={onClear} style={{ marginLeft: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 'inherit', outline: 'none', padding: 0 }}>Dismiss</button>
            </div>
        );
    }
    if (state.status !== 'done' || !state.translatedText) return null;
    // Auto-translation of a message already in the target language: nothing to show.
    if (isSameLanguage(state.detectedLang, state.language)) return null;
    return (
        <div style={{ marginTop: '6px', maxWidth: '60%' }}>
            <div style={{ padding: '8px 12px', borderRadius: '2px', backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-accent)', fontSize: '13px', lineHeight: 1.65, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {state.translatedText}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    Translated{state.language ? ` to ${state.language.toUpperCase()}` : ''}
                    {state.detectedLang ? ` · from ${state.detectedLang.toUpperCase()}` : ''}
                </span>
                <button type="button" onClick={onClear} style={{ fontSize: '11px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, outline: 'none' }}>Show original</button>
            </div>
        </div>
    );
}

export function InlineMessageEditor({ initialText, onSave, onCancel }) {
    const [text, setText] = useState(initialText || '');
    const [saving, setSaving] = useState(false);

    const save = async () => {
        if (saving) return;
        const trimmed = text.trim();
        if (!trimmed) return;
        if (trimmed === (initialText || '').trim()) { onCancel(); return; }
        setSaving(true);
        const ok = await onSave(trimmed);
        setSaving(false);
        if (ok) onCancel();
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', maxWidth: '480px' }}>
            <textarea
                style={{ width: '100%', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-accent)', borderRadius: '2px', padding: '8px 12px', fontSize: '14px', color: 'var(--text-primary)', outline: 'none', resize: 'none', minHeight: '60px', fontFamily: 'var(--font)', boxSizing: 'border-box', lineHeight: 1.6 }}
                value={text}
                disabled={saving}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
                    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
                }}
                autoFocus
                onFocus={(e) => { const l = e.target.value.length; e.target.setSelectionRange(l, l); }}
                rows={Math.min(6, (text.match(/\n/g) || []).length + 2)}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button type="button" onClick={save} disabled={saving || !text.trim()} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 12px', backgroundColor: 'var(--accent)', color: '#0c0c0c', fontSize: '12px', fontWeight: 600, border: 'none', borderRadius: '2px', cursor: saving ? 'wait' : 'pointer', fontFamily: 'var(--font)', outline: 'none', opacity: saving || !text.trim() ? 0.6 : 1 }}>
                    {saving ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={11} />} Save
                </button>
                <button type="button" onClick={onCancel} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 12px', backgroundColor: 'var(--bg-active)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500, border: '1px solid var(--border-default)', borderRadius: '2px', cursor: 'pointer', fontFamily: 'var(--font)', outline: 'none' }}>
                    <X size={11} /> Cancel
                </button>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Enter to save · Esc to cancel</span>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Shared toolbar state + menu composition                             */
/* ------------------------------------------------------------------ */

const closeMenuEvent = { stopPropagation: () => {} };

/**
 * State and menu model shared by ChannelMessageItem and DMMessageItem so the
 * two stay at feature parity. `toolbar` is the chat window's action set
 * (copyText, togglePin, toggleBookmark, onRemind, onConvertToTask,
 * onSummarizeThread, onShowHistory, infoMessage, editMessage, deleteMessage,
 * isChannelAdmin).
 */
// Code in a message: a fenced block, or inline code that looks like code.
const CODE_IN_MESSAGE = /```[\s\S]*?```|`[^`\n]*(?:\(|\)|=|;|=>|\{|\})[^`\n]*`/;

/** Ask Oruinwan AI (side panel) to review the code in a message. */
function reviewCodeWithAI(text) {
    const prompt = `Review this code. Point out bugs, security risks and edge cases, and suggest improvements:\n\n${text}`;
    window.dispatchEvent(new CustomEvent('chttrix-ai:open', { detail: { prompt } }));
}

export function useMessageToolbar({
    msg, isMe, currentUserId, toolbar = {}, threadCount = 0,
    openMsgMenuId, toggleMsgMenu, onOpenThread, replyToMessage, forwardMessage,
    translationState, onTranslate, onClearTranslation,
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState(null);
    const [translatePopover, setTranslatePopover] = useState(null);
    const [lastLangCode, setLastLangCode] = useState(null);

    const msgId = msg._id || msg.id;
    const text = getMessageText(msg);
    const menuOpen = openMsgMenuId === msg.id && !!menuAnchor;

    const closeMenu = useCallback(() => {
        if (openMsgMenuId === msg.id) toggleMsgMenu?.(closeMenuEvent, msg.id);
    }, [openMsgMenuId, msg.id, toggleMsgMenu]);

    const openMenu = (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setMenuAnchor({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
        toggleMsgMenu?.(e, msg.id);
    };

    const translate = (langCode) => {
        if (!langCode || !text) return;
        setLastLangCode(langCode);
        onTranslate?.(msgId, text, langCode);
    };

    const bookmarked = isBookmarkedBy(msg.bookmarkedBy, currentUserId);
    const isAdmin = !!toolbar.isChannelAdmin;
    const deleted = msg.isDeleted || msg.isDeletedUniversally;
    const hasReplies = threadCount > 0 || msg.replyCount > 0;
    const translationDone = translationState?.status === 'done';

    // Every handler runs, then the menu closes (the document click listener in
    // ConversationStream also closes it, this is just belt and braces).
    const act = (fn) => (e) => { closeMenu(); fn(e); };

    const groups = deleted ? [] : [
        [
            replyToMessage && { label: 'Reply', icon: <Reply size={13} />, onClick: act(() => replyToMessage(msg.id)) },
            onOpenThread && { label: hasReplies ? 'Open thread' : 'Reply in thread', icon: <MessageSquare size={13} />, onClick: act(() => onOpenThread(msg.id)) },
            forwardMessage && { label: 'Forward', icon: <Share size={13} />, onClick: act(() => forwardMessage(msg.id)) },
        ],
        [
            text && { label: 'Copy text', icon: <Copy size={13} />, onClick: act(() => toolbar.copyText?.(msg)) },
            text && onTranslate && {
                label: translationDone ? 'Show original' : 'Translate',
                icon: <Globe size={13} />,
                onClick: (e) => {
                    if (translationDone) { closeMenu(); onClearTranslation?.(msgId); return; }
                    const r = e.currentTarget.getBoundingClientRect();
                    const spaceBelow = window.innerHeight - r.bottom;
                    setTranslatePopover({
                        pos: {
                            right: Math.max(8, window.innerWidth - r.right),
                            ...(spaceBelow < 300 ? { bottom: Math.max(8, window.innerHeight - r.top + 4) } : { top: r.bottom + 4 }),
                        },
                    });
                    closeMenu();
                },
            },
        ],
        [
            toolbar.togglePin && { label: msg.isPinned ? 'Unpin message' : 'Pin message', icon: <Pin size={13} />, onClick: act(() => toolbar.togglePin(msg)), accent: msg.isPinned },
            toolbar.toggleBookmark && {
                label: bookmarked ? 'Remove from saved' : 'Save message',
                icon: <Bookmark size={13} style={{ fill: bookmarked ? 'currentColor' : 'none' }} />,
                onClick: act(() => toolbar.toggleBookmark(msg)),
                accent: bookmarked,
            },
            toolbar.onRemind && { label: 'Remind me', icon: <Bell size={13} />, onClick: act(() => toolbar.onRemind(msg)) },
            toolbar.onConvertToTask && text && { label: 'Convert to task', icon: <CheckSquare size={13} />, onClick: act(() => toolbar.onConvertToTask(msg)) },
            toolbar.onSummarizeThread && hasReplies && { label: 'Summarize thread', icon: <Sparkles size={13} />, onClick: act(() => toolbar.onSummarizeThread(msg)) },
            text && CODE_IN_MESSAGE.test(text) && { label: 'Review code with AI', icon: <Code2 size={13} />, onClick: act(() => reviewCodeWithAI(text)) },
        ],
        [
            toolbar.infoMessage && { label: 'Message info', icon: <Info size={13} />, onClick: act(() => toolbar.infoMessage(msg)) },
            toolbar.editMessage && canEditMessage(msg, isMe) && { label: 'Edit message', icon: <Pencil size={13} />, onClick: act(() => setIsEditing(true)) },
            toolbar.onShowHistory && hasEditHistory(msg) && { label: 'Edit history', icon: <History size={13} />, onClick: act(() => toolbar.onShowHistory(msg)) },
        ],
        [
            toolbar.deleteMessage && { label: 'Delete for me', icon: <Trash2 size={13} />, onClick: act(() => toolbar.deleteMessage(msgId, 'me')), danger: true },
            toolbar.deleteMessage && (isMe || isAdmin) && { label: 'Delete for everyone', icon: <Trash2 size={13} />, onClick: act(() => toolbar.deleteMessage(msgId, 'everyone')), danger: true },
        ],
    ];

    return {
        text,
        isEditing,
        startEdit: () => setIsEditing(true),
        cancelEdit: () => setIsEditing(false),
        saveEdit: (newText) => (toolbar.editMessage ? toolbar.editMessage(msg, newText) : Promise.resolve(false)),
        menuOpen,
        menuAnchor,
        openMenu,
        closeMenu,
        groups,
        translatePopover,
        closeTranslatePopover: () => setTranslatePopover(null),
        selectLanguage: (code) => { setTranslatePopover(null); translate(code); },
        retryTranslation: () => translate(lastLangCode || translationState?.language),
        clearTranslation: () => onClearTranslation?.(msgId),
        showHistory: toolbar.onShowHistory,
        bookmarked,
    };
}
