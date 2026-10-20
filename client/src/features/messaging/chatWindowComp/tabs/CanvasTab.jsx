import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import ContentEditable from 'react-contenteditable';
import { Avatar, Btn, Dialog, Field } from '../../../../components/ui/page';
import '../../messagingUi.css';
import { Bold, Italic, Underline, Strikethrough, Heading1, Heading2, Heading3, Type, List, ListOrdered, Link, Code, Quote, Minus, AlignLeft, AlignCenter, AlignRight, Undo, Redo, WifiOff, Maximize2, Minimize2, Check, Loader2, Users } from 'lucide-react';

function countWords(html) {
    const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length === 0 ? 0 : text.split(' ').filter(Boolean).length;
}

function timeAgo(date) {
    if (!date) return null;
    const diff = Math.floor((Date.now() - new Date(date)) / 1000);
    if (diff < 10) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(date).toLocaleDateString();
}

const EMOJIS = ['📄', '📝', '✍️', '📊', '🗒️', '💡', '🎨', '📐', '🔖', '⚡', '🚀', '🎯', '📌', '💬', '🔥', '✅', '📅', '🧩', '💎', '🌟', '📋', '🖊️', '🗂️', '🏷️', '💼', '🎪', '🌈', '⭐', '🔑', '🎁'];

// Stored on the canvas (user-chosen data). The first one is the theme's gold, also the default.
const DEFAULT_COVER = '#b8956a';
const COVER_COLORS = [
    { label: 'Gold', value: DEFAULT_COVER },
    { label: 'Violet', value: '#8B5CF6' },
    { label: 'Pink', value: '#EC4899' },
    { label: 'Red', value: '#EF4444' },
    { label: 'Amber', value: '#F59E0B' },
    { label: 'Green', value: '#10B981' },
    { label: 'Cyan', value: '#06B6D4' },
    { label: 'Blue', value: '#3B82F6' },
    { label: 'Lime', value: '#84CC16' },
    { label: 'Orange', value: '#F97316' },
];

function useOutsideClose(onClose) {
    const ref = useRef(null);
    useEffect(() => {
        const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
    }, [onClose]);
    return ref;
}

function EmojiPicker({ onSelect, onClose }) {
    const ref = useOutsideClose(onClose);
    return (
        <div ref={ref} className="mx-pop cv-pop" role="dialog" aria-label="Choose an icon">
            <span className="mx-label">Icon</span>
            <div className="cv-emoji-grid">
                {EMOJIS.map(e => (
                    <button key={e} type="button" onClick={() => { onSelect(e); onClose(); }} aria-label={`Use ${e}`}>
                        {e}
                    </button>
                ))}
            </div>
        </div>
    );
}

function CoverPicker({ current, onSelect, onClose }) {
    const ref = useOutsideClose(onClose);
    return (
        <div ref={ref} className="mx-pop cv-pop" role="dialog" aria-label="Choose a cover colour" style={{ width: 196 }}>
            <span className="mx-label">Cover colour</span>
            <div className="cv-swatches">
                {COVER_COLORS.map(c => (
                    <button
                        key={c.value}
                        type="button"
                        className="cv-swatch"
                        style={{ background: c.value }}
                        aria-pressed={current === c.value}
                        aria-label={c.label}
                        title={c.label}
                        onClick={() => { onSelect(c.value); onClose(); }}
                    />
                ))}
            </div>
        </div>
    );
}

function TBtn({ icon: Icon, onClick, title, active }) {
    return (
        <button type="button" className="cv-tbtn" onClick={onClick} title={title} aria-label={title} aria-pressed={active ? 'true' : undefined}
            // Keep the selection in the editor while formatting.
            onMouseDown={(e) => e.preventDefault()}>
            <Icon size={14} strokeWidth={2} />
        </button>
    );
}

function PresenceSidebar({ viewers, onlineUserIds, channelMembers, currentUserId, lastEditedUser, lastEdited }) {
    const members = useMemo(() => {
        if (!channelMembers?.length) return [];
        return channelMembers.map(m => {
            const user = m.user || m;
            const userId = user?._id || user?.id || String(user);
            const username = user?.username || user?.name || 'Member';
            const profilePic = user?.profilePicture || user?.avatar || null;
            return { userId, username, profilePic };
        });
    }, [channelMembers]);

    // You are looking at it, even before the server's viewer list arrives.
    const viewerIds = new Set([...viewers.map(v => v.userId), currentUserId].filter(Boolean).map(String));
    const viewingNow = members.filter(m => viewerIds.has(String(m.userId)));
    const onlineRest = members.filter(m => !viewerIds.has(String(m.userId)) && onlineUserIds.has(m.userId));
    const offlineRest = members.filter(m => !viewerIds.has(String(m.userId)) && !onlineUserIds.has(m.userId));

    const group = (label, list, status, tone) => list.length > 0 && (
        <div className="cv-side-group">
            <span className="mx-label" data-tone={tone}>{label} · {list.length}</span>
            {list.map(m => <MemberRow key={m.userId} member={m} status={status} isSelf={String(m.userId) === String(currentUserId)} />)}
        </div>
    );

    return (
        <aside className="cv-side" aria-label="People in this channel">
            <div className="cv-side-head">
                <span className="mx-label"><Users size={12} aria-hidden="true" /> People</span>
                <p>{members.length} in this channel</p>
            </div>
            {group('Viewing', viewingNow, 'viewing', 'accent')}
            {group('Online', onlineRest, 'online', 'success')}
            {group('Offline', offlineRest, 'offline')}
            {lastEditedUser && (
                <div className="cv-side-foot">
                    <span className="mx-label">Last edited</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={lastEditedUser.username || '?'} src={lastEditedUser.profilePicture} size="sm" />
                        <div style={{ minWidth: 0 }}>
                            <p className="cv-member-name">{lastEditedUser.username}</p>
                            {lastEdited && <p className="cv-member-state">{timeAgo(lastEdited)}</p>}
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
}

const STATUS_LABEL = { viewing: 'Viewing now', online: 'Online', offline: 'Offline' };

function MemberRow({ member, status, isSelf }) {
    return (
        <div className="cv-member" data-status={status}>
            <span className="cv-member-av">
                <Avatar name={member.username} src={member.profilePic} size="sm" />
                <span className="cv-member-dot" aria-hidden="true" />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
                <p className="cv-member-name">{member.username}{isSelf && <em> (you)</em>}</p>
                <p className="cv-member-state">{STATUS_LABEL[status]}</p>
            </div>
        </div>
    );
}

export default function CanvasTab({ tab, onSave, connected, socket, channelId, currentUserId, channelMembers = [] }) {
    const [content, setContent] = useState(tab.content || '');
    const [emoji, setEmoji] = useState(tab.emoji || '📄');
    const [coverColor, setCoverColor] = useState(tab.coverColor || DEFAULT_COVER);
    const [saveStatus, setSaveStatus] = useState('saved');
    const [lastSaved, setLastSaved] = useState(tab.lastEditedAt || null);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [showSidebar, setShowSidebar] = useState(() => typeof window === 'undefined' || window.innerWidth > 1100);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showCoverPicker, setShowCoverPicker] = useState(false);

    
    const [viewers, setViewers] = useState([]);           
    const [onlineUserIds, setOnlineUserIds] = useState(new Set()); 

    const contentRef = useRef(tab.content || '');
    const emojiRef = useRef(tab.emoji || '📄');
    const coverRef = useRef(tab.coverColor || DEFAULT_COVER);
    const saveTimeoutRef = useRef(null);
    const editorRef = useRef(null);
    const containerRef = useRef(null);
    const isRemoteUpdate = useRef(false);

    const wordCount = useMemo(() => countWords(content), [content]);
    const readTime = wordCount > 0 ? `${Math.max(1, Math.round(wordCount / 200))} min` : null;

    
    const toggleFullScreen = useCallback(() => {
        if (!document.fullscreenElement) containerRef.current?.requestFullscreen().catch(() => { });
        else document.exitFullscreen();
    }, []);
    useEffect(() => {
        const h = () => setIsFullScreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', h);
        return () => document.removeEventListener('fullscreenchange', h);
    }, []);

    
    useEffect(() => {
        if (!socket || !tab._id || !channelId) return;
        socket.emit('canvas:join', { tabId: tab._id, channelId });
        return () => {
            socket.emit('canvas:leave', { tabId: tab._id, channelId });
        };
    }, [socket, tab._id, channelId]);

    
    useEffect(() => {
        if (!socket) return;

        
        const handleViewers = ({ tabId, viewers: v }) => {
            if (tabId === tab._id) setViewers(v || []);
        };

        
        const handleOnline = ({ userId }) => {
            setOnlineUserIds(prev => { const s = new Set(prev); s.add(userId); return s; });
        };
        const handleOffline = ({ userId }) => {
            setOnlineUserIds(prev => { const s = new Set(prev); s.delete(userId); return s; });
        };

        
        const handleTabUpdate = (data) => {
            if (data.tabId !== tab._id || data.updatedBy === currentUserId) return;
            isRemoteUpdate.current = true;
            if (data.content !== undefined) { setContent(data.content || ''); contentRef.current = data.content || ''; }
            if (data.emoji !== undefined) { setEmoji(data.emoji); emojiRef.current = data.emoji; }
            if (data.coverColor !== undefined) { setCoverColor(data.coverColor); coverRef.current = data.coverColor; }
            if (data.lastEditedAt) setLastSaved(data.lastEditedAt);
            setSaveStatus('saved');
        };

        socket.on('canvas:viewers', handleViewers);
        socket.on('user:online', handleOnline);
        socket.on('user:offline', handleOffline);
        socket.on('tab-updated', handleTabUpdate);

        return () => {
            socket.off('canvas:viewers', handleViewers);
            socket.off('user:online', handleOnline);
            socket.off('user:offline', handleOffline);
            socket.off('tab-updated', handleTabUpdate);
        };
    }, [socket, tab._id, currentUserId]);

    
    useEffect(() => {
        if (!isRemoteUpdate.current) {
            setContent(tab.content || '');
            contentRef.current = tab.content || '';
            setEmoji(tab.emoji || '📄');
            emojiRef.current = tab.emoji || '📄';
            setCoverColor(tab.coverColor || DEFAULT_COVER);
            coverRef.current = tab.coverColor || DEFAULT_COVER;
            setLastSaved(tab.lastEditedAt || null);
        }
        isRemoteUpdate.current = false;
    }, [tab._id, tab.content, tab.emoji, tab.coverColor]);

    
    const triggerSave = useCallback((updates = {}) => {
        setSaveStatus('saving');
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            onSave({
                content: contentRef.current,
                emoji: emojiRef.current,
                coverColor: coverRef.current,
                wordCount: countWords(contentRef.current),
                ...updates
            });
            setSaveStatus('saved');
            setLastSaved(new Date().toISOString());
        }, 1500);
    }, [onSave]);

    const handleChange = (evt) => {
        const val = evt.target.value;
        setContent(val);
        contentRef.current = val;
        triggerSave({ content: val });
    };

    const handleEmojiChange = (e) => { setEmoji(e); emojiRef.current = e; triggerSave({ emoji: e }); };
    const handleCoverChange = (c) => { setCoverColor(c); coverRef.current = c; triggerSave({ coverColor: c }); };

    const execFormat = (cmd, value = null) => { document.execCommand(cmd, false, value); editorRef.current?.focus(); };
    // Link dialog: remember the selection, since the dialog's input takes focus.
    const savedRange = useRef(null);
    const [linkOpen, setLinkOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const insertLink = () => {
        const sel = window.getSelection();
        savedRange.current = sel && sel.rangeCount && editorRef.current?.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
        setLinkUrl('');
        setLinkOpen(true);
    };
    const applyLink = () => {
        let url = linkUrl.trim();
        if (!url) return;
        if (!/^(https?:|mailto:)/i.test(url)) url = `https://${url}`;
        setLinkOpen(false);
        editorRef.current?.focus();
        const sel = window.getSelection();
        if (savedRange.current && sel) { sel.removeAllRanges(); sel.addRange(savedRange.current); }
        if (!savedRange.current || savedRange.current.collapsed) {
            const safe = url.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
            document.execCommand('insertHTML', false, `<a href="${safe}">${safe}</a>`);
        } else {
            document.execCommand('createLink', false, url);
        }
    };

    useEffect(() => () => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            onSave({ content: contentRef.current, emoji: emojiRef.current, coverColor: coverRef.current, wordCount: countWords(contentRef.current) });
        }
    }, []); 

    const toolbarGroups = [
        [
            { icon: Bold, cmd: 'bold', title: 'Bold' },
            { icon: Italic, cmd: 'italic', title: 'Italic' },
            { icon: Underline, cmd: 'underline', title: 'Underline' },
            { icon: Strikethrough, cmd: 'strikeThrough', title: 'Strikethrough' },
        ],
        [
            { icon: Heading1, cmd: 'formatBlock', value: '<H1>', title: 'Heading 1' },
            { icon: Heading2, cmd: 'formatBlock', value: '<H2>', title: 'Heading 2' },
            { icon: Heading3, cmd: 'formatBlock', value: '<H3>', title: 'Heading 3' },
            { icon: Type, cmd: 'formatBlock', value: '<P>', title: 'Paragraph' },
        ],
        [
            { icon: List, cmd: 'insertUnorderedList', title: 'Bulleted list' },
            { icon: ListOrdered, cmd: 'insertOrderedList', title: 'Numbered list' },
        ],
        [
            { icon: AlignLeft, cmd: 'justifyLeft', title: 'Align left' },
            { icon: AlignCenter, cmd: 'justifyCenter', title: 'Align centre' },
            { icon: AlignRight, cmd: 'justifyRight', title: 'Align right' },
        ],
        [
            { icon: Link, action: insertLink, title: 'Link' },
            { icon: Code, cmd: 'formatBlock', value: '<PRE>', title: 'Code block' },
            { icon: Quote, cmd: 'formatBlock', value: '<BLOCKQUOTE>', title: 'Quote' },
            { icon: Minus, cmd: 'insertHorizontalRule', title: 'Divider' },
        ],
        [
            { icon: Undo, cmd: 'undo', title: 'Undo' },
            { icon: Redo, cmd: 'redo', title: 'Redo' },
        ],
    ];

    // lastEditedBy can be a bare id; find the person among the channel's members.
    const lastEditedUser = useMemo(() => {
        const by = tab.lastEditedBy;
        if (!by) return null;
        if (typeof by === 'object' && by.username) return by;
        const id = String(typeof by === 'object' ? (by._id || by.id) : by);
        const m = channelMembers.map(x => x.user || x).find(u => String(u?._id || u?.id) === id);
        return m ? { username: m.username || m.name, profilePicture: m.profilePicture } : null;
    }, [tab.lastEditedBy, channelMembers]);

    return (
        <div ref={containerRef} className="cv">
            <div className="cv-bar">
                <div className="cv-tools" role="toolbar" aria-label="Formatting">
                    {toolbarGroups.map((group, gi) => (
                        <React.Fragment key={gi}>
                            {gi > 0 && <span className="cv-sep" aria-hidden="true" />}
                            {group.map((btn, bi) => (
                                <TBtn key={bi} icon={btn.icon} title={btn.title}
                                    onClick={() => btn.action ? btn.action() : execFormat(btn.cmd, btn.value)} />
                            ))}
                        </React.Fragment>
                    ))}
                </div>

                <div className="cv-status">
                    {!connected && (
                        <span className="cv-pill" data-tone="accent" title="Changes will sync when you are back online">
                            <WifiOff size={11} /> Offline
                        </span>
                    )}
                    {viewers.length > 0 && (
                        <span className="cv-stack" title={viewers.map(v => v.username).join(', ')} data-hide-sm="true">
                            {viewers.slice(0, 4).map(v => (
                                <Avatar key={v.userId} name={v.username} src={v.profilePicture} size="sm" />
                            ))}
                            {viewers.length > 4 && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>+{viewers.length - 4}</span>}
                        </span>
                    )}
                    <span className="cv-pill" data-tone={saveStatus === 'saving' ? undefined : 'success'} role="status">
                        {saveStatus === 'saving'
                            ? <><Loader2 size={11} className="mx-spin" />Saving…</>
                            : <><Check size={11} strokeWidth={3} />Saved</>}
                    </span>
                    <TBtn icon={isFullScreen ? Minimize2 : Maximize2} onClick={toggleFullScreen} title={isFullScreen ? 'Exit full screen' : 'Full screen'} />
                    <TBtn icon={Users} onClick={() => setShowSidebar(s => !s)} title={showSidebar ? 'Hide people' : 'Show people'} active={showSidebar} />
                </div>
            </div>

            <div className="cv-body">
                <div className="cv-scroll">
                    <div className="cv-page">
                        <div className="cv-cover" style={{ background: `linear-gradient(90deg, ${coverColor}, color-mix(in srgb, ${coverColor} 35%, transparent))` }} />

                        <article className="cv-doc">
                            <div className="cv-doc-head">
                                <div className="cv-doc-tools">
                                    <div style={{ position: 'relative' }}>
                                        <button type="button" className="cv-emoji" title="Change icon" aria-label="Change icon"
                                            onClick={() => { setShowEmojiPicker(s => !s); setShowCoverPicker(false); }}>
                                            {emoji}
                                        </button>
                                        {showEmojiPicker && <EmojiPicker onSelect={handleEmojiChange} onClose={() => setShowEmojiPicker(false)} />}
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                        <button type="button" className="cv-chipbtn"
                                            onClick={() => { setShowCoverPicker(s => !s); setShowEmojiPicker(false); }}>
                                            <span className="cv-dot" style={{ background: coverColor }} aria-hidden="true" />
                                            Cover colour
                                        </button>
                                        {showCoverPicker && <CoverPicker current={coverColor} onSelect={handleCoverChange} onClose={() => setShowCoverPicker(false)} />}
                                    </div>
                                </div>

                                <h1 className="cv-title">{tab.name}</h1>

                                <div className="cv-meta">
                                    <span>{wordCount > 0 ? `${wordCount} ${wordCount === 1 ? 'word' : 'words'} · ${readTime} read` : 'Empty'}</span>
                                    {lastSaved && <><i aria-hidden="true">·</i><span>Saved {timeAgo(lastSaved)}</span></>}
                                    {viewers.length > 1 && <><i aria-hidden="true">·</i><span style={{ color: 'var(--accent)' }}>{viewers.length} people here</span></>}
                                </div>
                            </div>

                            <div className="cv-editor-wrap">
                                <ContentEditable
                                    innerRef={editorRef}
                                    html={content}
                                    onChange={handleChange}
                                    className="cv-prose"
                                    data-placeholder="Start writing… use the toolbar for headings, lists and links."
                                    aria-label={`${tab.name} canvas`}
                                    role="textbox"
                                    aria-multiline="true"
                                />
                            </div>
                        </article>
                    </div>
                </div>

                {showSidebar && (
                    <PresenceSidebar
                        viewers={viewers}
                        onlineUserIds={onlineUserIds}
                        channelMembers={channelMembers}
                        currentUserId={currentUserId}
                        lastEditedUser={lastEditedUser}
                        lastEdited={lastSaved}
                    />
                )}
            </div>

            <Dialog
                open={linkOpen}
                title="Add a link"
                lead="Selected text becomes the link. With nothing selected, the address is inserted."
                onClose={() => setLinkOpen(false)}
                size="sm"
                footer={(
                    <>
                        <Btn variant="ghost" onClick={() => setLinkOpen(false)}>Cancel</Btn>
                        <Btn variant="primary" icon={Link} onClick={applyLink} disabled={!linkUrl.trim()}>Add link</Btn>
                    </>
                )}
            >
                <Field label="Address" htmlFor="cv-link-url">
                    <input
                        id="cv-link-url"
                        className="gl-input"
                        type="url"
                        inputMode="url"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') applyLink(); }}
                        placeholder="https://"
                    />
                </Field>
            </Dialog>
        </div>
    );
}
