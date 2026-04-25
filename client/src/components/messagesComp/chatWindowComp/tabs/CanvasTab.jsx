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

function EmojiPicker({ onSelect, onClose }) {
    const ref = useRef(null);
    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);
    return (
        <div ref={ref}
            style={{
                position: 'absolute', top: 'calc(100% + 8px)', left: 0,
                width: '240px', backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-accent)', borderRadius: '2px',
                zIndex: 50, padding: '12px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}>
            <p style={{
                fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.14em',
                marginBottom: '8px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            }}>Choose icon</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '4px' }}>
                {EMOJIS.map(e => (
                    <button key={e} onClick={() => { onSelect(e); onClose(); }}
                        style={{
                            width: 32, height: 32, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: '16px',
                            borderRadius: '2px', background: 'none', border: 'none',
                            cursor: 'pointer', transition: 'background-color 150ms ease',
                        }}
                        onMouseEnter={e2 => e2.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                        onMouseLeave={e2 => e2.currentTarget.style.backgroundColor = 'transparent'}>
                        {e}
                    </button>
                ))}
            </div>
        </div>
    );
}

function CoverPicker({ current, onSelect, onClose }) {
    const ref = useRef(null);
    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);
    return (
        <div ref={ref}
            style={{
                position: 'absolute', top: 'calc(100% + 8px)', left: 0,
                width: '200px', backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-accent)', borderRadius: '2px',
                zIndex: 50, padding: '12px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}>
            <p style={{
                fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.14em',
                marginBottom: '8px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            }}>Cover color</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                {COVER_COLORS.map(c => (
                    <button key={c.value} onClick={() => { onSelect(c.value); onClose(); }}
                        style={{
                            width: 28, height: 28, borderRadius: '2px',
                            background: c.value, border: 'none', cursor: 'pointer',
                            outline: current === c.value ? `2px solid ${c.value}` : '2px solid transparent',
                            outlineOffset: 2, transition: 'transform 150ms ease',
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                        title={c.label} />
                ))}
            </div>
        </div>
    );
}

function TBtn({ icon: Icon, onClick, title, active }) {
    const [hovered, setHovered] = React.useState(false);
    return (
        <button onClick={onClick} title={title}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                padding: '5px', borderRadius: '2px', background: 'none', border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                color: active ? 'var(--accent)' : (hovered ? 'var(--text-primary)' : 'var(--text-muted)'),
                backgroundColor: active ? 'rgba(184,149,106,0.1)' : 'transparent',
                transition: 'color 150ms ease, background-color 150ms ease',
            }}>
            <Icon size={14} strokeWidth={2} />
        </button>
    );
}

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
        <div style={{
            display: 'flex', flexDirection: 'column', height: '100%',
            backgroundColor: 'var(--bg-surface)', borderLeft: '1px solid var(--border-default)',
            width: '200px', flexShrink: 0, overflowY: 'auto',
        }}>
            {}
            <div style={{ padding: '16px 12px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <Users size={12} style={{ color: 'var(--text-muted)' }} />
                    <span style={{
                        fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.14em',
                        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    }}>Members</span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
                    {members.length} in channel
                </p>
            </div>

            {}
            {viewingNow.length > 0 && (
                <div style={{ padding: '12px 12px 4px' }}>
                    <p style={{
                        fontSize: '9px', fontWeight: 700, color: 'var(--accent)',
                        textTransform: 'uppercase', letterSpacing: '0.14em',
                        marginBottom: '8px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    }}>Viewing · {viewingNow.length}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {viewingNow.map(m => (
                            <MemberRow key={m.userId} member={m} status="viewing"
                                isSelf={m.userId === currentUserId} accent={coverColor} />
                        ))}
                    </div>
                </div>
            )}

            {}
            {onlineRest.length > 0 && (
                <div style={{ padding: '12px 12px 4px' }}>
                    <p style={{
                        fontSize: '9px', fontWeight: 700, color: 'var(--state-success)',
                        textTransform: 'uppercase', letterSpacing: '0.14em',
                        marginBottom: '8px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    }}>Online · {onlineRest.length}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {onlineRest.map(m => (
                            <MemberRow key={m.userId} member={m} status="online"
                                isSelf={m.userId === currentUserId} />
                        ))}
                    </div>
                </div>
            )}

            {}
            {offlineRest.length > 0 && (
                <div style={{ padding: '12px 12px 12px' }}>
                    <p style={{
                        fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.14em',
                        marginBottom: '8px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    }}>Offline · {offlineRest.length}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {offlineRest.map(m => (
                            <MemberRow key={m.userId} member={m} status="offline"
                                isSelf={m.userId === currentUserId} />
                        ))}
                    </div>
                </div>
            )}

            {}
            {lastEditedUser && (
                <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-subtle)', padding: '12px' }}>
                    <p style={{
                        fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400,
                        marginBottom: '6px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    }}>Last edited</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Avatar name={lastEditedUser.username || '?'} src={lastEditedUser.profilePicture} size={22} />
                        <div>
                            <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', margin: 0, fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>{lastEditedUser.username}</p>
                            {lastEdited && <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>{timeAgo(lastEdited)}</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function MemberRow({ member, status, isSelf, accent }) {
    const dotColor = status === 'viewing' ? (accent || 'var(--accent)')
        : status === 'online' ? 'var(--state-success)'
            : 'var(--bg-hover)';

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '6px 8px', borderRadius: '2px',
            backgroundColor: status === 'viewing' ? 'rgba(184,149,106,0.06)' : 'transparent',
        }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
                <Avatar name={member.username} src={member.profilePic} size={24} />
                <span style={{
                    position: 'absolute', bottom: '-1px', right: '-1px',
                    width: '8px', height: '8px', borderRadius: '50%',
                    border: '1.5px solid var(--bg-surface)',
                    backgroundColor: dotColor,
                }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{
                    fontSize: '12px', fontWeight: 400, color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    margin: 0, lineHeight: 1.2,
                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                }}>
                    {member.username}{isSelf && <span style={{ color: 'var(--text-muted)' }}> (you)</span>}
                </p>
                <p style={{
                    fontSize: '10px', color: dopColor(status, accent),
                    margin: '1px 0 0', lineHeight: 1,
                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                }}>
                    {status === 'viewing' ? '● Viewing' : status === 'online' ? '● Online' : 'Offline'}
                </p>
            </div>
        </div>
    );
}

function dopColor(status, accent) {
    if (status === 'viewing') return accent || 'var(--accent)';
    if (status === 'online') return 'var(--state-success)';
    return 'var(--text-muted)';
}

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

    
    const [viewers, setViewers] = useState([]);           
    const [onlineUserIds, setOnlineUserIds] = useState(new Set()); 

    const contentRef = useRef(tab.content || '');
    const emojiRef = useRef(tab.emoji || '📄');
    const coverRef = useRef(tab.coverColor || '#6366F1');
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
            setCoverColor(tab.coverColor || '#6366F1');
            coverRef.current = tab.coverColor || '#6366F1';
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
    const insertLink = () => { const url = prompt('Enter URL:'); if (url) execFormat('createLink', url); };

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
        <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, backgroundColor: 'var(--bg-base)', overflow: 'hidden' }}>

            {}
            <div style={{
                flexShrink: 0, backgroundColor: 'var(--bg-surface)',
                borderBottom: '1px solid var(--border-default)',
                padding: '6px 12px', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', gap: '8px', overflowX: 'auto',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1px', flexShrink: 0 }}>
                    {toolbarGroups.map((group, gi) => (
                        <React.Fragment key={gi}>
                            {gi > 0 && <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-default)', margin: '0 4px', flexShrink: 0 }} />}
                            {group.map((btn, bi) => (
                                <TBtn key={bi} icon={btn.icon} title={btn.title}
                                    onClick={() => btn.action ? btn.action() : execFormat(btn.cmd, btn.value)} />
                            ))}
                        </React.Fragment>
                    ))}
                    <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-default)', margin: '0 4px', flexShrink: 0 }} />
                    <TBtn icon={isFullScreen ? Minimize2 : Maximize2} onClick={toggleFullScreen} title="Fullscreen" />
                </div>

                {}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {!connected && (
                        <span style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            fontSize: '11px', color: 'var(--accent)',
                            padding: '2px 8px', border: '1px solid rgba(184,149,106,0.2)', borderRadius: '2px',
                        }}>
                            <WifiOff size={11} /> Offline
                        </span>
                    )}
                    {viewers.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div style={{ display: 'flex' }}>
                                {viewers.slice(0, 4).map(v => (
                                    <Avatar key={v.userId} name={v.username} src={v.profilePicture} size={20}
                                        ring={coverColor} />
                                ))}
                            </div>
                            {viewers.length > 4 && (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>+{viewers.length - 4}</span>
                            )}
                        </div>
                    )}
                    <span style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        fontSize: '11px', fontWeight: 400, padding: '2px 8px',
                        color: saveStatus === 'saving' ? 'var(--text-secondary)' : 'var(--state-success)',
                        border: '1px solid var(--border-subtle)', borderRadius: '2px',
                        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    }}>
                        {saveStatus === 'saving'
                            ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />Saving…</>
                            : <><Check size={11} strokeWidth={3} />Saved</>}
                    </span>
                    <button onClick={() => setShowSidebar(s => !s)}
                        title={showSidebar ? 'Hide members' : 'Show members'}
                        style={{
                            padding: '5px', borderRadius: '2px', background: 'none', border: 'none',
                            cursor: 'pointer', display: 'flex', alignItems: 'center',
                            color: showSidebar ? 'var(--accent)' : 'var(--text-muted)',
                            backgroundColor: showSidebar ? 'rgba(184,149,106,0.1)' : 'transparent',
                            transition: 'color 150ms ease, background-color 150ms ease',
                        }}
                        onMouseEnter={e => { if (!showSidebar) e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { if (!showSidebar) e.currentTarget.style.color = 'var(--text-muted)'; }}>
                        <Users size={14} />
                    </button>
                </div>
            </div>

            {}
            <div className="flex flex-1 min-h-0 overflow-hidden">

                {}
                <div className="flex-1 overflow-y-auto">
                    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 24px' }}>
                        {}
                        <div style={{
                            height: '3px', marginBottom: '24px',
                            background: `linear-gradient(90deg, ${coverColor}, ${coverColor}60)`,
                            transition: 'background 300ms ease',
                        }} />

                        {}
                        <div style={{
                            backgroundColor: 'var(--bg-surface)',
                            border: '1px solid var(--border-default)',
                            borderRadius: '2px', overflow: 'hidden', marginBottom: '32px',
                        }}>

                            {}
                            <div style={{ padding: '32px 40px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', position: 'relative' }}>
                                    <div style={{ position: 'relative' }}>
                                        <button onClick={() => { setShowEmojiPicker(s => !s); setShowCoverPicker(false); }}
                                            style={{
                                                fontSize: '32px', lineHeight: 1, padding: '6px',
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                borderRadius: '2px', transition: 'background-color 150ms ease',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                            title="Change icon">
                                            {emoji}
                                        </button>
                                        {showEmojiPicker && <EmojiPicker onSelect={handleEmojiChange} onClose={() => setShowEmojiPicker(false)} />}
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                        <button onClick={() => { setShowCoverPicker(s => !s); setShowEmojiPicker(false); }}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '6px',
                                                fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)',
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                padding: '4px 8px', borderRadius: '2px',
                                                transition: 'color 150ms ease, background-color 150ms ease',
                                                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}>
                                            <span style={{ width: 10, height: 10, borderRadius: '1px', display: 'inline-block', background: coverColor }} />
                                            Cover
                                        </button>
                                        {showCoverPicker && <CoverPicker current={coverColor} onSelect={handleCoverChange} onClose={() => setShowCoverPicker(false)} />}
                                    </div>
                                </div>

                                <h1 style={{
                                    fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)',
                                    letterSpacing: '-0.015em', lineHeight: '1.2', marginBottom: '8px',
                                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                                }}>{tab.name}</h1>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    {wordCount > 0 && <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>{wordCount} words · {readTime} read</span>}
                                    {lastSaved && <>
                                        <span style={{ color: 'var(--border-default)' }}>·</span>
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>Saved {timeAgo(lastSaved)}</span>
                                    </>}
                                    {viewers.length > 1 && (
                                        <><span style={{ color: 'var(--border-default)' }}>·</span>
                                            <span style={{ fontSize: '12px', color: coverColor, fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>{viewers.length} viewing</span></>
                                    )}
                                </div>
                            </div>

                            {}
                            <div style={{ padding: '32px 40px', minHeight: '500px' }}>
                                <ContentEditable
                                    innerRef={editorRef}
                                    html={content}
                                    onChange={handleChange}
                                    className={`
                                        prose prose-base max-w-none focus:outline-none
                                        prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-gray-200
                                        prose-h1:text-3xl prose-h1:mb-4 prose-h1:mt-8 first:prose-h1:mt-0
                                        prose-h2:text-2xl prose-h2:mb-3 prose-h2:mt-7
                                        prose-h3:text-xl prose-h3:mb-2 prose-h3:mt-5
                                        prose-p:text-gray-300 prose-p:leading-relaxed prose-p:mb-3
                                        prose-a:text-amber-500 prose-a:no-underline hover:prose-a:underline
                                        prose-strong:text-gray-100 prose-strong:font-bold
                                        prose-code:bg-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-amber-400 prose-code:font-mono prose-code:text-sm
                                        prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:p-4 prose-pre:rounded prose-pre:font-mono
                                        prose-blockquote:border-l-2 prose-blockquote:border-amber-600 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:my-4 prose-blockquote:not-italic prose-blockquote:text-gray-400
                                        prose-ul:my-3 prose-ul:list-disc prose-ul:pl-6
                                        prose-ol:my-3 prose-ol:list-decimal prose-ol:pl-6
                                        prose-li:text-gray-300 prose-li:my-1
                                        prose-hr:border-gray-700 prose-hr:my-8
                                        min-h-[400px]
                                    `}
                                    data-placeholder="Start writing…"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {}
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
