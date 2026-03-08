import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import ContentEditable from 'react-contenteditable';
import {
    Bold, Italic, Underline, Strikethrough,
    Heading1, Heading2, Heading3, Type,
    List, ListOrdered, Link, Code, Quote, Minus,
    AlignLeft, AlignCenter, AlignRight,
    Undo, Redo, WifiOff, Maximize2, Minimize2,
    Check, Loader2, Users, Circle, PanelRight
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const COVER_COLORS = [
    { label: 'Indigo', value: '#6366F1' },
    { label: 'Violet', value: '#8B5CF6' },
    { label: 'Pink', value: '#EC4899' },
    { label: 'Rose', value: '#EF4444' },
    { label: 'Amber', value: '#F59E0B' },
    { label: 'Emerald', value: '#10B981' },
    { label: 'Cyan', value: '#06B6D4' },
    { label: 'Blue', value: '#3B82F6' },
    { label: 'Lime', value: '#84CC16' },
    { label: 'Orange', value: '#F97316' },
];

// ─── Avatar helper ────────────────────────────────────────────────────────────

function Avatar({ name = '?', src, size = 32, ring, status }) {
    const initials = (name || '?').slice(0, 2).toUpperCase();
    const hue = (name.charCodeAt(0) || 0) * 47 % 360;
    return (
        <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
            {src ? (
                <img src={src} alt={name} className="rounded-full w-full h-full object-cover"
                    style={ring ? { outline: `2px solid ${ring}`, outlineOffset: 1 } : {}} />
            ) : (
                <div className="rounded-full w-full h-full flex items-center justify-center text-white font-bold select-none"
                    style={{
                        fontSize: size * 0.38,
                        background: `hsl(${hue},65%,52%)`,
                        outline: ring ? `2px solid ${ring}` : 'none',
                        outlineOffset: 1
                    }}>
                    {initials}
                </div>
            )}
            {status && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white"
                    style={{ background: status === 'editing' ? '#6366F1' : status === 'viewing' ? '#10B981' : '#9CA3AF' }} />
            )}
        </div>
    );
}

// ─── Emoji Picker ─────────────────────────────────────────────────────────────

function EmojiPicker({ onSelect, onClose }) {
    const ref = useRef(null);
    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);
    return (
        <div ref={ref}
            className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 p-3"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">Choose icon</p>
            <div className="grid grid-cols-8 gap-1">
                {EMOJIS.map(e => (
                    <button key={e} onClick={() => { onSelect(e); onClose(); }}
                        className="w-8 h-8 flex items-center justify-center text-lg rounded-lg hover:bg-gray-100 transition-colors">
                        {e}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ─── Cover Picker ─────────────────────────────────────────────────────────────

function CoverPicker({ current, onSelect, onClose }) {
    const ref = useRef(null);
    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);
    return (
        <div ref={ref}
            className="absolute top-full left-0 mt-2 w-52 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 p-3"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">Cover color</p>
            <div className="grid grid-cols-5 gap-2">
                {COVER_COLORS.map(c => (
                    <button key={c.value} onClick={() => { onSelect(c.value); onClose(); }}
                        className="w-8 h-8 rounded-full transition-transform hover:scale-110"
                        style={{
                            background: c.value,
                            outline: current === c.value ? `3px solid ${c.value}` : 'none',
                            outlineOffset: 2
                        }}
                        title={c.label} />
                ))}
            </div>
        </div>
    );
}

// ─── Toolbar Button ───────────────────────────────────────────────────────────

function TBtn({ icon: Icon, onClick, title, active }) {
    return (
        <button onClick={onClick} title={title}
            className={`p-1.5 rounded-md transition-all ${active ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`}>
            <Icon size={15} strokeWidth={2} />
        </button>
    );
}

// ─── Presence Sidebar ─────────────────────────────────────────────────────────

function PresenceSidebar({ viewers, onlineUserIds, channelMembers, currentUserId, coverColor, lastEditedUser, lastEdited }) {
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

    const viewerIds = new Set(viewers.map(v => v.userId));

    // Sort: viewers first, then online, then rest
    const sorted = [...members].sort((a, b) => {
        const aViewing = viewerIds.has(a.userId);
        const bViewing = viewerIds.has(b.userId);
        const aOnline = onlineUserIds.has(a.userId);
        const bOnline = onlineUserIds.has(b.userId);
        if (aViewing !== bViewing) return aViewing ? -1 : 1;
        if (aOnline !== bOnline) return aOnline ? -1 : 1;
        return 0;
    });

    const viewingNow = sorted.filter(m => viewerIds.has(m.userId));
    const onlineRest = sorted.filter(m => !viewerIds.has(m.userId) && onlineUserIds.has(m.userId));
    const offlineRest = sorted.filter(m => !viewerIds.has(m.userId) && !onlineUserIds.has(m.userId));

    return (
        <div className="flex flex-col h-full bg-white border-l border-gray-100 w-[220px] flex-shrink-0 overflow-y-auto">
            {/* Header */}
            <div className="px-4 pt-5 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <Users size={13} className="text-gray-400" />
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Members</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">{members.length} in channel</p>
            </div>

            {/* Viewing Now */}
            {viewingNow.length > 0 && (
                <div className="px-3 pt-3 pb-1">
                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-2 px-1">
                        👁 Viewing now · {viewingNow.length}
                    </p>
                    <div className="flex flex-col gap-1">
                        {viewingNow.map(m => (
                            <MemberRow key={m.userId} member={m} status="viewing"
                                isSelf={m.userId === currentUserId} accent={coverColor} />
                        ))}
                    </div>
                </div>
            )}

            {/* Online */}
            {onlineRest.length > 0 && (
                <div className="px-3 pt-3 pb-1">
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-2 px-1">
                        Online · {onlineRest.length}
                    </p>
                    <div className="flex flex-col gap-1">
                        {onlineRest.map(m => (
                            <MemberRow key={m.userId} member={m} status="online"
                                isSelf={m.userId === currentUserId} />
                        ))}
                    </div>
                </div>
            )}

            {/* Offline */}
            {offlineRest.length > 0 && (
                <div className="px-3 pt-3 pb-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
                        Offline · {offlineRest.length}
                    </p>
                    <div className="flex flex-col gap-1">
                        {offlineRest.map(m => (
                            <MemberRow key={m.userId} member={m} status="offline"
                                isSelf={m.userId === currentUserId} />
                        ))}
                    </div>
                </div>
            )}

            {/* Last edited */}
            {lastEditedUser && (
                <div className="mt-auto border-t border-gray-100 px-4 py-3">
                    <p className="text-[10px] text-gray-400 font-medium mb-1.5">Last edited</p>
                    <div className="flex items-center gap-2">
                        <Avatar name={lastEditedUser.username || '?'} src={lastEditedUser.profilePicture} size={22} />
                        <div>
                            <p className="text-xs font-semibold text-gray-700 leading-none">{lastEditedUser.username}</p>
                            {lastEdited && <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(lastEdited)}</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function MemberRow({ member, status, isSelf, accent }) {
    const dotColor = status === 'viewing' ? (accent || '#6366F1')
        : status === 'online' ? '#10B981'
            : '#D1D5DB';

    return (
        <div className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors ${status === 'viewing' ? 'bg-indigo-50/60' : 'hover:bg-gray-50'}`}>
            <div className="relative flex-shrink-0">
                <Avatar name={member.username} src={member.profilePic} size={26} />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white"
                    style={{ background: dotColor }} />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-800 truncate leading-none">
                    {member.username}{isSelf && <span className="text-gray-400"> (you)</span>}
                </p>
                <p className="text-[10px] mt-0.5 leading-none"
                    style={{ color: dopColor(status, accent) }}>
                    {status === 'viewing' ? '● Viewing' : status === 'online' ? '● Online' : 'Offline'}
                </p>
            </div>
        </div>
    );
}

function dopColor(status, accent) {
    if (status === 'viewing') return accent || '#6366F1';
    if (status === 'online') return '#10B981';
    return '#9CA3AF';
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

export default function CanvasTab({ tab, onSave, connected, socket, channelId, currentUserId, channelMembers = [] }) {
    const [content, setContent] = useState(tab.content || '');
    const [emoji, setEmoji] = useState(tab.emoji || '📄');
    const [coverColor, setCoverColor] = useState(tab.coverColor || '#6366F1');
    const [saveStatus, setSaveStatus] = useState('saved');
    const [lastSaved, setLastSaved] = useState(tab.lastEditedAt || null);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [showSidebar, setShowSidebar] = useState(true);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showCoverPicker, setShowCoverPicker] = useState(false);

    // Presence state
    const [viewers, setViewers] = useState([]);           // who's viewing this tab
    const [onlineUserIds, setOnlineUserIds] = useState(new Set()); // globally online

    const contentRef = useRef(tab.content || '');
    const emojiRef = useRef(tab.emoji || '📄');
    const coverRef = useRef(tab.coverColor || '#6366F1');
    const saveTimeoutRef = useRef(null);
    const editorRef = useRef(null);
    const containerRef = useRef(null);
    const isRemoteUpdate = useRef(false);

    const wordCount = useMemo(() => countWords(content), [content]);
    const readTime = wordCount > 0 ? `${Math.max(1, Math.round(wordCount / 200))} min` : null;

    // ── Fullscreen ──
    const toggleFullScreen = useCallback(() => {
        if (!document.fullscreenElement) containerRef.current?.requestFullscreen().catch(() => { });
        else document.exitFullscreen();
    }, []);
    useEffect(() => {
        const h = () => setIsFullScreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', h);
        return () => document.removeEventListener('fullscreenchange', h);
    }, []);

    // ── Canvas join/leave emit ──
    useEffect(() => {
        if (!socket || !tab._id || !channelId) return;
        socket.emit('canvas:join', { tabId: tab._id, channelId });
        return () => {
            socket.emit('canvas:leave', { tabId: tab._id, channelId });
        };
    }, [socket, tab._id, channelId]);

    // ── Socket event listeners ──
    useEffect(() => {
        if (!socket) return;

        // Canvas viewer list updates
        const handleViewers = ({ tabId, viewers: v }) => {
            if (tabId === tab._id) setViewers(v || []);
        };

        // Global presence
        const handleOnline = ({ userId }) => {
            setOnlineUserIds(prev => { const s = new Set(prev); s.add(userId); return s; });
        };
        const handleOffline = ({ userId }) => {
            setOnlineUserIds(prev => { const s = new Set(prev); s.delete(userId); return s; });
        };

        // Tab content updates from other users
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

    // ── Sync when tab prop changes ──
    useEffect(() => {
        if (!isRemoteUpdate.current) {
            setContent(tab.content || '');
            contentRef.current = tab.content || '';
            setEmoji(tab.emoji || '📄');
            emojiRef.current = tab.emoji || '📄';
            setCoverColor(tab.coverColor || '#6366F1');
            coverRef.current = tab.coverColor || '#6366F1';
            setLastSaved(tab.lastEditedAt || null);
        }
        isRemoteUpdate.current = false;
    }, [tab._id, tab.content, tab.emoji, tab.coverColor]);

    // ── Save ──
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
    const insertLink = () => { const url = prompt('Enter URL:'); if (url) execFormat('createLink', url); };

    useEffect(() => () => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            onSave({ content: contentRef.current, emoji: emojiRef.current, coverColor: coverRef.current, wordCount: countWords(contentRef.current) });
        }
    }, []); // eslint-disable-line

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
            { icon: List, cmd: 'insertUnorderedList', title: 'Bullet List' },
            { icon: ListOrdered, cmd: 'insertOrderedList', title: 'Numbered List' },
        ],
        [
            { icon: AlignLeft, cmd: 'justifyLeft', title: 'Align Left' },
            { icon: AlignCenter, cmd: 'justifyCenter', title: 'Align Center' },
            { icon: AlignRight, cmd: 'justifyRight', title: 'Align Right' },
        ],
        [
            { icon: Link, action: insertLink, title: 'Insert Link' },
            { icon: Code, cmd: 'formatBlock', value: '<PRE>', title: 'Code Block' },
            { icon: Quote, cmd: 'formatBlock', value: '<BLOCKQUOTE>', title: 'Blockquote' },
            { icon: Minus, cmd: 'insertHorizontalRule', title: 'Divider' },
        ],
        [
            { icon: Undo, cmd: 'undo', title: 'Undo' },
            { icon: Redo, cmd: 'redo', title: 'Redo' },
        ],
    ];

    const lastEditedUser = tab.lastEditedBy || null;

    return (
        <div ref={containerRef} className="flex flex-col flex-1 min-w-0 bg-gray-50 overflow-hidden">

            {/* ── Toolbar ── */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200 px-3 py-2 flex items-center justify-between gap-2 overflow-x-auto">
                <div className="flex items-center gap-0.5 flex-shrink-0">
                    {toolbarGroups.map((group, gi) => (
                        <React.Fragment key={gi}>
                            {gi > 0 && <div className="w-px h-5 bg-gray-200 mx-1 flex-shrink-0" />}
                            {group.map((btn, bi) => (
                                <TBtn key={bi} icon={btn.icon} title={btn.title}
                                    onClick={() => btn.action ? btn.action() : execFormat(btn.cmd, btn.value)} />
                            ))}
                        </React.Fragment>
                    ))}
                    <div className="w-px h-5 bg-gray-200 mx-1 flex-shrink-0" />
                    <TBtn icon={isFullScreen ? Minimize2 : Maximize2} onClick={toggleFullScreen} title="Fullscreen" />
                </div>

                {/* Right: status + sidebar toggle */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {!connected && (
                        <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                            <WifiOff size={11} /> Offline
                        </span>
                    )}
                    {/* Live viewer avatars */}
                    {viewers.length > 0 && (
                        <div className="flex items-center">
                            <div className="flex -space-x-1.5">
                                {viewers.slice(0, 4).map(v => (
                                    <Avatar key={v.userId} name={v.username} src={v.profilePicture} size={22}
                                        ring={coverColor} />
                                ))}
                            </div>
                            {viewers.length > 4 && (
                                <span className="text-xs text-gray-400 ml-1.5">+{viewers.length - 4}</span>
                            )}
                        </div>
                    )}
                    <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${saveStatus === 'saving' ? 'text-blue-600 bg-blue-50' : 'text-emerald-600 bg-emerald-50'}`}>
                        {saveStatus === 'saving'
                            ? <><Loader2 size={11} className="animate-spin" />Saving…</>
                            : <><Check size={11} strokeWidth={3} />Saved</>}
                    </span>
                    {/* Sidebar toggle */}
                    <button onClick={() => setShowSidebar(s => !s)}
                        title={showSidebar ? 'Hide members' : 'Show members'}
                        className={`p-1.5 rounded-lg transition-all ${showSidebar ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}>
                        <Users size={15} />
                    </button>
                </div>
            </div>

            {/* ── Main layout: Editor + Sidebar ── */}
            <div className="flex flex-1 min-h-0 overflow-hidden">

                {/* ── Editor area ── */}
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-3xl mx-auto px-6 py-10">
                        {/* Cover color strip */}
                        <div className="h-2 rounded-t-xl mb-8 transition-colors duration-300"
                            style={{ background: `linear-gradient(90deg, ${coverColor}, ${coverColor}99)` }} />

                        {/* Paper */}
                        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-10"
                            style={{ boxShadow: '0 1px 20px rgba(0,0,0,0.06)' }}>

                            {/* Doc header */}
                            <div className="px-10 pt-10 pb-6 border-b border-gray-100">
                                <div className="flex items-center gap-2 mb-4 relative">
                                    <div className="relative">
                                        <button onClick={() => { setShowEmojiPicker(s => !s); setShowCoverPicker(false); }}
                                            className="text-4xl hover:bg-gray-100 rounded-xl p-1.5 transition-colors leading-none" title="Change icon">
                                            {emoji}
                                        </button>
                                        {showEmojiPicker && <EmojiPicker onSelect={handleEmojiChange} onClose={() => setShowEmojiPicker(false)} />}
                                    </div>
                                    <div className="relative">
                                        <button onClick={() => { setShowCoverPicker(s => !s); setShowEmojiPicker(false); }}
                                            className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-700 hover:bg-gray-100 px-2 py-1.5 rounded-lg transition-colors">
                                            <span className="w-3 h-3 rounded-full inline-block" style={{ background: coverColor }} />
                                            Cover
                                        </button>
                                        {showCoverPicker && <CoverPicker current={coverColor} onSelect={handleCoverChange} onClose={() => setShowCoverPicker(false)} />}
                                    </div>
                                </div>

                                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight leading-tight mb-2">{tab.name}</h1>

                                <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                                    {wordCount > 0 && <span>{wordCount} words · {readTime} read</span>}
                                    {lastSaved && <><span className="text-gray-200">·</span><span>Saved {timeAgo(lastSaved)}</span></>}
                                    {viewers.length > 1 && (
                                        <><span className="text-gray-200">·</span>
                                            <span style={{ color: coverColor }}>{viewers.length} viewing</span></>
                                    )}
                                </div>
                            </div>

                            {/* Editor body */}
                            <div className="px-10 py-8 min-h-[500px]">
                                <ContentEditable
                                    innerRef={editorRef}
                                    html={content}
                                    onChange={handleChange}
                                    className={`
                                        prose prose-base max-w-none focus:outline-none
                                        prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-gray-900
                                        prose-h1:text-3xl prose-h1:mb-4 prose-h1:mt-8 first:prose-h1:mt-0
                                        prose-h2:text-2xl prose-h2:mb-3 prose-h2:mt-7
                                        prose-h3:text-xl prose-h3:mb-2 prose-h3:mt-5
                                        prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-3
                                        prose-a:text-indigo-600 prose-a:no-underline hover:prose-a:underline
                                        prose-strong:text-gray-900 prose-strong:font-bold
                                        prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-indigo-600 prose-code:font-mono prose-code:text-sm
                                        prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:p-4 prose-pre:rounded-xl prose-pre:shadow-lg prose-pre:font-mono
                                        prose-blockquote:border-l-4 prose-blockquote:bg-indigo-50/60 prose-blockquote:py-3 prose-blockquote:px-5 prose-blockquote:my-5 prose-blockquote:rounded-r-xl prose-blockquote:not-italic
                                        prose-ul:my-3 prose-ul:list-disc prose-ul:pl-6
                                        prose-ol:my-3 prose-ol:list-decimal prose-ol:pl-6
                                        prose-li:text-gray-700 prose-li:my-1
                                        prose-hr:border-gray-200 prose-hr:my-8
                                        selection:bg-indigo-100 selection:text-indigo-900
                                        min-h-[400px]
                                    `}
                                    data-placeholder="Start writing…"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Presence Sidebar ── */}
                {showSidebar && (
                    <PresenceSidebar
                        viewers={viewers}
                        onlineUserIds={onlineUserIds}
                        channelMembers={channelMembers}
                        currentUserId={currentUserId}
                        coverColor={coverColor}
                        lastEditedUser={lastEditedUser}
                        lastEdited={lastSaved}
                    />
                )}
            </div>
        </div>
    );
}
