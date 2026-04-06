import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useUpdates } from "../../contexts/UpdatesContext";
import { useAuth } from "../../contexts/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import { useToast } from "../../contexts/ToastContext";
import {
    MessageCircle, MessageSquare, MoreHorizontal, Send,
    Link as LinkIcon, Trash2, Megaphone, RefreshCw,
    Pin, Search, Star, Award, Layers, Flag,
    X, Clock, ThumbsUp, Share2, TrendingUp, Zap,
    Image, Smile
} from "lucide-react";

// ─── Type metadata ────────────────────────────────────────────────────────────
const TYPE_META = {
    general:      { label: "General",      color: "#b8956a",  bg: "rgba(184,149,106,0.1)",  Icon: MessageSquare },
    achievement:  { label: "Achievement",  color: "#34d399",  bg: "rgba(52,211,153,0.1)",   Icon: Award         },
    announcement: { label: "Announcement", color: "#a78bfa",  bg: "rgba(167,139,250,0.1)",  Icon: Megaphone     },
    project:      { label: "Project",      color: "#f87171",  bg: "rgba(248,113,113,0.1)",  Icon: Layers        },
    milestone:    { label: "Milestone",    color: "#fbbf24",  bg: "rgba(251,191,36,0.1)",   Icon: Flag          },
};

const SIDEBAR_FILTERS = [
    { key: "all",    label: "All Updates",  icon: Zap },
    { key: "pinned", label: "Pinned",       icon: Pin },
    { key: "mine",   label: "My Posts",     icon: Star },
];

const TYPE_FILTERS = [
    { key: "all",          label: "All" },
    { key: "general",      label: "General" },
    { key: "achievement",  label: "Achievements" },
    { key: "announcement", label: "Announcements" },
    { key: "project",      label: "Projects" },
    { key: "milestone",    label: "Milestones" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function avatarColor(name) {
    const palette = ["#b8956a", "#8a7055", "#6b7280", "#9ca3af", "#d97706", "#64748b", "#78716c", "#a16207"];
    if (!name) return palette[0];
    return palette[name.charCodeAt(0) % palette.length];
}
function initials(name) {
    if (!name) return "?";
    return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}
function formatTime(isoString) {
    const date = new Date(isoString);
    const diff = (Date.now() - date) / 1000;
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Avatar Component ─────────────────────────────────────────────────────────
function Avatar({ name, src, size = 40 }) {
    return (
        <div
            className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
            style={{ width: size, height: size, fontSize: size * 0.35, background: avatarColor(name), border: '1px solid rgba(255,255,255,0.1)' }}
        >
            {src
                ? <img src={src} alt="" className="w-full h-full rounded-full object-cover" />
                : initials(name)
            }
        </div>
    );
}

// ─── TypeBadge ───────────────────────────────────────────────────────────────
function TypeBadge({ type }) {
    const meta = TYPE_META[type?.toLowerCase()] || TYPE_META.general;
    const Icon = meta.Icon;
    return (
        <span
            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5"
            style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}33` }}
        >
            <Icon size={10} />
            {meta.label}
        </span>
    );
}

// ─── PostCard (LinkedIn-style) ────────────────────────────────────────────────
function PostCard({ post, currentUserId, companyRole, onLike, onDelete, onDiscuss, onCopyLink }) {
    const [showMenu, setShowMenu] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const menuRef = useRef(null);

    const isOwner = post.author.id === currentUserId;
    const canDelete = isOwner || ["admin", "owner"].includes(companyRole);
    const userReacted = post.reactions?.some(r => r.userId === currentUserId || r.userId?._id === currentUserId);
    const contentIsLong = post.content?.length > 280;
    const displayContent = contentIsLong && !expanded
        ? post.content.slice(0, 280) + "…"
        : post.content;

    useEffect(() => {
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    return (
        <article style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', transition: 'border-color 150ms ease' }} onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(255,255,255,0.12)'} onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'}>

            {/* Card Header */}
            <div className="p-5 pb-0">
                <div className="flex items-start justify-between gap-3">
                    {/* Author Info */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                        <Avatar name={post.author.name} src={post.author.avatar} size={44} />
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <span style={{fontSize:'13px',fontWeight:700,color:'#e4e4e4',fontFamily:'Inter,system-ui,sans-serif'}}>
                                    {post.author.name}
                                </span>
                                <TypeBadge type={post.context} />
                                {post.isPinned && (
                                    <span style={{display:'inline-flex',alignItems:'center',gap:'3px',fontSize:'9px',fontWeight:700,padding:'1px 6px',background:'rgba(184,149,106,0.1)',border:'1px solid rgba(184,149,106,0.25)',color:'#b8956a'}}>
                                        <Pin size={8} /> Pinned
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span style={{ fontSize: '11px', color: 'rgba(228,228,228,0.3)', textTransform: 'capitalize', fontFamily: 'Inter,system-ui,sans-serif' }}>
                                    {post.author.role}
                                </span>
                                <span style={{ color: 'rgba(255,255,255,0.12)' }}>·</span>
                                <span style={{ fontSize: '11px', color: 'rgba(228,228,228,0.3)', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'monospace' }}>
                                    <Clock size={10} />
                                    {formatTime(post.timestamp)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Menu */}
                    <div className="relative flex-shrink-0" ref={menuRef}>
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowMenu(p => !p); }}
                            style={{padding:'5px',background:'transparent',border:'none',color:'rgba(228,228,228,0.4)',cursor:'pointer'}}
                        >
                            <MoreHorizontal size={18} />
                        </button>
                        {showMenu && (
                            <div style={{position:'absolute',right:0,marginTop:'4px',width:'180px',background:'#1a1a1a',border:'1px solid rgba(255,255,255,0.1)',zIndex:30,padding:'4px'}}>
                                <button onClick={() => { onDiscuss(post); setShowMenu(false); }} style={{width:'100%',textAlign:'left',padding:'7px 12px',fontSize:'12px',color:'rgba(228,228,228,0.7)',background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:'8px',fontFamily:'Inter,system-ui,sans-serif'}} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.05)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                    <MessageCircle size={13} style={{color:'#a78bfa'}}/> Discuss in DM
                                </button>
                                <button onClick={() => { onCopyLink(post.id); setShowMenu(false); }} style={{width:'100%',textAlign:'left',padding:'7px 12px',fontSize:'12px',color:'rgba(228,228,228,0.7)',background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:'8px',fontFamily:'Inter,system-ui,sans-serif'}} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.05)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                    <LinkIcon size={13} style={{color:'rgba(228,228,228,0.4)'}}/> Copy Link
                                </button>
                                {canDelete && (
                                    <>
                                        <div style={{height:'1px',background:'rgba(255,255,255,0.06)',margin:'3px 0'}}/>
                                        <button onClick={() => { onDelete(post.id); setShowMenu(false); }} style={{width:'100%',textAlign:'left',padding:'7px 12px',fontSize:'12px',color:'#f87171',background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:'8px',fontFamily:'Inter,system-ui,sans-serif'}} onMouseEnter={e=>e.currentTarget.style.background='rgba(248,113,113,0.08)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                            <Trash2 size={13}/> Delete Post
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="px-5 pt-4 pb-3">
                {post.title && (
                    <h3 style={{fontSize:'14px',fontWeight:700,color:'#e4e4e4',marginBottom:'8px',lineHeight:1.3,fontFamily:'Inter,system-ui,sans-serif'}}>
                        {post.title}
                    </h3>
                )}
                <p style={{fontSize:'13px',color:'rgba(228,228,228,0.7)',lineHeight:1.65,whiteSpace:'pre-wrap',fontFamily:'Inter,system-ui,sans-serif'}}>
                    {displayContent}
                </p>
                {contentIsLong && (
                    <button onClick={() => setExpanded(e => !e)} style={{fontSize:'11px',fontWeight:600,color:'#b8956a',background:'none',border:'none',cursor:'pointer',marginTop:'4px',padding:0}}>
                        {expanded ? "Show less" : "…see more"}
                    </button>
                )}

                {/* Hashtags */}
                {post.tags?.filter(t => !["normal", "urgent", "high", "low"].includes(t)).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                        {post.tags.filter(t => !["normal", "urgent", "high", "low"].includes(t)).map(tag => (
                            <span key={tag} style={{fontSize:'11px',fontWeight:600,color:'#b8956a',cursor:'pointer'}}>
                                #{tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Reaction tally */}
            {post.likes > 0 && (
                <div className="px-5 pb-2 flex items-center gap-1.5">
                    <div className="flex -space-x-1">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{ background: '#b8956a', border: '1px solid rgba(0,0,0,0.3)' }}>👍</span>
                        {post.likes > 1 && (
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{ background: '#f87171', border: '1px solid rgba(0,0,0,0.3)' }}>❤️</span>
                        )}
                    </div>
                    <span style={{ fontSize: '11px', color: 'rgba(228,228,228,0.4)', fontFamily: 'Inter,system-ui,sans-serif' }}>
                        {post.likes} {post.likes === 1 ? "appreciation" : "appreciations"}
                    </span>
                </div>
            )}

            {/* Divider */}
            <div style={{margin:'0 20px',height:'1px',background:'rgba(255,255,255,0.06)'}}/>

            {/* Action bar */}
            <div className="px-3 py-1 flex items-center gap-1">
                <button
                    onClick={() => onLike(post.id)}
                    style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',padding:'8px',fontSize:'12px',fontWeight:600,background:userReacted?'rgba(184,149,106,0.1)':'transparent',color:userReacted?'#b8956a':'rgba(228,228,228,0.45)',border:'none',cursor:'pointer',transition:'all 150ms ease',fontFamily:'Inter,system-ui,sans-serif'}}
                >
                    <ThumbsUp size={16} className={userReacted ? "fill-current" : ""} />
                    {userReacted ? "Appreciated" : "Appreciate"}
                </button>
                <button onClick={() => onDiscuss(post)} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',padding:'8px',fontSize:'12px',fontWeight:600,color:'rgba(228,228,228,0.45)',background:'transparent',border:'none',cursor:'pointer',fontFamily:'Inter,system-ui,sans-serif'}} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.04)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <MessageCircle size={15}/> Discuss
                </button>
                <button onClick={() => onCopyLink(post.id)} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',padding:'8px',fontSize:'12px',fontWeight:600,color:'rgba(228,228,228,0.45)',background:'transparent',border:'none',cursor:'pointer',fontFamily:'Inter,system-ui,sans-serif'}} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.04)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <Share2 size={16} />
                    Share
                </button>
            </div>
        </article>
    );
}

// ─── Composer / Create Post ───────────────────────────────────────────────────
function Composer({ user, companyRole, canPostUpdates, onPost }) {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [type, setType] = useState("general");
    const [posting, setPosting] = useState(false);
    const { showToast } = useToast();

    const handlePost = async () => {
        if (!content.trim()) return;
        setPosting(true);
        try {
            await onPost({ title, content, context: type });
            setTitle(""); setContent(""); setType("general"); setOpen(false);
            showToast("Update posted!", "success");
        } finally {
            setPosting(false);
        }
    };

    const userName = user?.name || user?.fullName || "You";

    return (
        <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',overflow:'hidden'}}>
            {/* Collapsed prompt */}
            {!open && (
                <div className="p-4 flex items-center gap-3">
                    <Avatar name={userName} src={user?.avatar} size={42} />
                    <button
                        onClick={() => canPostUpdates && setOpen(true)}
                        disabled={!canPostUpdates}
                        style={{flex:1,textAlign:'left',fontSize:'13px',padding:'8px 16px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',color:'rgba(228,228,228,0.35)',cursor:canPostUpdates?'pointer':'not-allowed',fontFamily:'Inter,system-ui,sans-serif',transition:'border-color 150ms ease'}}
                    >
                        {canPostUpdates
                            ? "What's happening at the company? Share an update…"
                            : "Only managers and above can post updates."}
                    </button>
                </div>
            )}

            {/* Expanded composer */}
            {open && (
                <div className="p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Avatar name={userName} src={user?.avatar} size={42} />
                            <div>
                                <p style={{fontSize:'13px',fontWeight:700,color:'#e4e4e4',fontFamily:'Inter,system-ui,sans-serif'}}>{userName}</p>
                                <p style={{fontSize:'11px',color:'rgba(228,228,228,0.4)',textTransform:'capitalize',fontFamily:'Inter,system-ui,sans-serif'}}>{companyRole}</p>
                            </div>
                        </div>
                        <button onClick={() => setOpen(false)} style={{padding:'4px',background:'transparent',border:'none',color:'rgba(228,228,228,0.4)',cursor:'pointer'}}>
                            <X size={16} />
                        </button>
                    </div>

                    {/* Type pills */}
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(TYPE_META).map(([key, meta]) => (
                            <button
                                key={key}
                                onClick={() => setType(key)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px',
                                    fontWeight: 700, padding: '4px 10px', cursor: 'pointer',
                                    background: type === key ? meta.bg : 'transparent',
                                    color: type === key ? meta.color : 'rgba(228,228,228,0.4)',
                                    border: `1px solid ${type === key ? meta.color + '55' : 'rgba(255,255,255,0.1)'}`,
                                    fontFamily: 'Inter,system-ui,sans-serif', transition: 'all 150ms ease',
                                }}
                                onMouseEnter={e => { if (type !== key) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = 'rgba(228,228,228,0.7)'; } }}
                                onMouseLeave={e => { if (type !== key) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(228,228,228,0.4)'; } }}
                            >
                                {React.createElement(meta.Icon, { size: 11 })} {meta.label}
                            </button>
                        ))}
                    </div>

                    {/* Title */}
                    <input
                        type="text"
                        placeholder="Give it a title (optional)"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        style={{width:'100%',fontSize:'13px',fontWeight:600,background:'transparent',borderBottom:'1px solid rgba(255,255,255,0.08)',paddingBottom:'8px',outline:'none',color:'#e4e4e4',fontFamily:'Inter,system-ui,sans-serif'}}
                    />

                    {/* Content */}
                    <textarea
                        autoFocus
                        placeholder="What would you like to share with your team?"
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        rows={5}
                        style={{width:'100%',fontSize:'13px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',padding:'10px 14px',outline:'none',resize:'none',color:'#e4e4e4',fontFamily:'Inter,system-ui,sans-serif',lineHeight:1.6,boxSizing:'border-box'}}
                    />

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1">
                            <button style={{padding:'5px',background:'transparent',border:'none',color:'rgba(228,228,228,0.35)',cursor:'pointer'}} title="Add image">
                                <Image size={16}/>
                            </button>
                            <button style={{padding:'5px',background:'transparent',border:'none',color:'rgba(228,228,228,0.35)',cursor:'pointer'}} title="Add emoji">
                                <Smile size={18} />
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setOpen(false)}
                                style={{padding:'5px 14px',fontSize:'12px',fontWeight:600,color:'rgba(228,228,228,0.4)',background:'transparent',border:'1px solid rgba(255,255,255,0.08)',cursor:'pointer',fontFamily:'Inter,system-ui,sans-serif'}}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePost}
                                disabled={!content.trim() || posting}
                                className="px-5 py-1.5 text-sm font-bold text-[#0c0c0c] bg-[#b8956a] hover:opacity-85 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center gap-2"
                            >
                                {posting ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                                {posting ? "Posting…" : "Post"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Left Sidebar ─────────────────────────────────────────────────────────────
function FilterSidebar({ activeFilter, setActiveFilter, activeType, setActiveType, posts, currentUserId }) {
    const allCount   = posts.length;
    const pinnedCount = posts.filter(p => p.isPinned).length;
    const mineCount  = posts.filter(p => p.author.id === currentUserId).length;
    const counts     = { all: allCount, pinned: pinnedCount, mine: mineCount };

    return (
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            <div style={{height:'56px',display:'flex',alignItems:'center',paddingLeft:'4px',marginBottom:'4px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                    <div style={{width:'30px',height:'30px',background:'rgba(184,149,106,0.1)',border:'1px solid rgba(184,149,106,0.2)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        <Megaphone size={14} style={{color:'#b8956a'}}/>
                    </div>
                    <h1 style={{fontSize:'16px',fontWeight:700,color:'#e4e4e4',fontFamily:'Inter,system-ui,sans-serif',letterSpacing:'-0.02em'}}>Updates</h1>
                </div>
            </div>
            <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',overflow:'hidden'}}>
                <div className="px-4 pt-4 pb-1">
                    <p style={{fontSize:'9px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em',color:'rgba(228,228,228,0.3)',padding:'0 4px',marginBottom:'6px',fontFamily:'Inter,system-ui,sans-serif'}}>Browse</p>
                    <nav style={{display:'flex',flexDirection:'column',gap:'2px'}}>
                        {SIDEBAR_FILTERS.map(f => {
                            const Icon = f.icon;
                            const active = activeFilter === f.key;
                            return (
                                <button
                                    key={f.key}
                                    onClick={() => setActiveFilter(f.key)}
                                    style={{width:'100%',display:'flex',alignItems:'center',gap:'10px',padding:'7px 10px',background:active?'rgba(184,149,106,0.1)':'transparent',border:`1px solid ${active?'rgba(184,149,106,0.2)':'transparent'}`,color:active?'#b8956a':'rgba(228,228,228,0.5)',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'Inter,system-ui,sans-serif',transition:'all 150ms ease',borderLeft:active?'2px solid #b8956a':'2px solid transparent'}}
                                >
                                    <Icon size={16} style={{ color: active ? '#b8956a' : 'rgba(228,228,228,0.3)', flexShrink: 0 }} />
                                    <span className="flex-1 text-left">{f.label}</span>
                                    {counts[f.key] > 0 && (
                                        <span style={{fontSize:'10px',fontWeight:700,color:active?'#b8956a':'rgba(228,228,228,0.3)',marginLeft:'auto'}}>{counts[f.key]}</span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                <div style={{padding:'10px 14px 14px'}}>
                    <p style={{fontSize:'9px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em',color:'rgba(228,228,228,0.3)',marginBottom:'6px',fontFamily:'Inter,system-ui,sans-serif'}}>Filter by type</p>
                    <div style={{display:'flex',flexDirection:'column',gap:'2px'}}>
                        {TYPE_FILTERS.map(f => {
                            const meta = TYPE_META[f.key];
                            const cnt = f.key === "all" ? null : posts.filter(p => p.context?.toLowerCase() === f.key).length;
                            const isActiveType = activeType === f.key;
                            return (
                                <button
                                    key={f.key}
                                    onClick={() => setActiveType(f.key)}
                                    style={{width:'100%',display:'flex',alignItems:'center',gap:'8px',padding:'6px 10px',background:isActiveType?'rgba(184,149,106,0.08)':'transparent',border:'none',color:isActiveType?'#b8956a':'rgba(228,228,228,0.45)',fontSize:'12px',fontWeight:isActiveType?600:400,cursor:'pointer',fontFamily:'Inter,system-ui,sans-serif',transition:'all 150ms ease',textAlign:'left'}}
                                    onMouseEnter={e=>{if(!isActiveType)e.currentTarget.style.background='rgba(255,255,255,0.04)';}}
                                    onMouseLeave={e=>{if(!isActiveType)e.currentTarget.style.background='transparent';}}
                                >
                                    {meta ? (
                                        <meta.Icon size={15} className="flex-shrink-0" style={{ color: activeType === f.key ? meta.color : 'rgba(228,228,228,0.3)' }} />
                                    ) : (
                                        <Zap size={15} style={{ flexShrink: 0, color: activeType === f.key ? '#b8956a' : 'rgba(228,228,228,0.3)' }} />
                                    )}
                                    <span className="flex-1 text-left">{f.label}</span>
                                    {cnt !== null && cnt > 0 && (
                                        <span className="text-xs font-bold text-gray-400 tabular-nums">{cnt}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',padding:'14px'}}>
                <p style={{fontSize:'9px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em',color:'rgba(228,228,228,0.3)',marginBottom:'10px',display:'flex',alignItems:'center',gap:'5px',fontFamily:'Inter,system-ui,sans-serif'}}>
                    <TrendingUp size={10}/> Trending
                </p>
                <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
                    {["#Milestone","#Launch","#BugFix","#Design","#Engineering"].map(tag=>(
                        <span key={tag} style={{padding:'2px 8px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',fontSize:'11px',color:'rgba(228,228,228,0.4)',cursor:'pointer',fontFamily:'Inter,system-ui,sans-serif',transition:'all 150ms ease'}} onMouseEnter={e=>{e.currentTarget.style.color='#b8956a';e.currentTarget.style.borderColor='rgba(184,149,106,0.3)';}} onMouseLeave={e=>{e.currentTarget.style.color='rgba(228,228,228,0.4)';e.currentTarget.style.borderColor='rgba(255,255,255,0.08)';}}>{tag}</span>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function PostSkeleton() {
    return (
        <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',padding:'20px'}}>
            <div style={{display:'flex',gap:'12px',marginBottom:'16px'}}>
                <div style={{width:'40px',height:'40px',borderRadius:'50%',background:'rgba(255,255,255,0.08)',flexShrink:0}}/>
                <div style={{flex:1,display:'flex',flexDirection:'column',gap:'6px',paddingTop:'4px'}}>
                    <div style={{height:'10px',background:'rgba(255,255,255,0.08)',width:'40%'}}/>
                    <div style={{height:'8px',background:'rgba(255,255,255,0.05)',width:'60%'}}/>
                </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'6px',marginBottom:'16px'}}>
                <div style={{height:'10px',background:'rgba(255,255,255,0.08)',width:'75%'}}/>
                <div style={{height:'8px',background:'rgba(255,255,255,0.05)',width:'100%'}}/>
                <div style={{height:'8px',background:'rgba(255,255,255,0.05)',width:'85%'}}/>
            </div>
            <div style={{display:'flex',gap:'12px'}}>
                <div style={{height:'28px',background:'rgba(255,255,255,0.05)',flex:1}}/>
                <div style={{height:'28px',background:'rgba(255,255,255,0.05)',flex:1}}/>
                <div style={{height:'28px',background:'rgba(255,255,255,0.05)',flex:1}}/>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const Updates = () => {
    const navigate  = useNavigate();
    const { workspaceId } = useParams();
    const { posts, addPost, likePost, deletePost, loading, refreshUpdates } = useUpdates();
    const { user }  = useAuth();
    const { showToast } = useToast();
    const { canPostUpdates, companyRole } = usePermissions();

    const [activeFilter, setActiveFilter] = useState("all");
    const [activeType,   setActiveType]   = useState("all");
    const [search,       setSearch]       = useState("");
    const [postToDelete, setPostToDelete] = useState(null);
    const [refreshing,   setRefreshing]   = useState(false);

    const currentUserId = user?._id || user?.id || user?.sub;

    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        await refreshUpdates();
        setRefreshing(false);
    };

    const handlePost   = useCallback(data => addPost(data), [addPost]);
    const handleLike   = id => likePost(id);
    const handleDelete = id => setPostToDelete(id);

    const confirmDelete = () => {
        if (postToDelete) {
            deletePost(postToDelete);
            showToast("Post deleted", "success");
            setPostToDelete(null);
        }
    };

    const handleDiscuss = (post) => {
        const ctx = post.title || post.content.slice(0, 30) + (post.content.length > 30 ? "…" : "");
        navigate(`/workspace/${workspaceId}/dm/${post.author.id}?initialMessage=RE: "${ctx}"`);
    };

    const handleCopyLink = (postId) => {
        navigator.clipboard.writeText(`${window.location.origin}/workspace/${workspaceId}/updates/${postId}`);
        showToast("Link copied!", "success");
    };

    const filteredPosts = posts.filter(post => {
        if (activeFilter === "mine"   && post.author.id !== currentUserId)   return false;
        if (activeFilter === "pinned" && !post.isPinned)                     return false;
        if (activeType  !== "all"     && post.context?.toLowerCase() !== activeType) return false;
        if (search.trim()) {
            const q = search.toLowerCase();
            if (!post.title?.toLowerCase().includes(q) && !post.content?.toLowerCase().includes(q)) return false;
        }
        return true;
    });

    return (
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: '#0c0c0c' }}>

            {/* ── Left Filter Sidebar ─────────────────────────────────────── */}
            <div style={{ width: '256px', flexShrink: 0, overflowY: 'auto', padding: '16px', borderRight: '1px solid rgba(255,255,255,0.06)', background: '#0c0c0c' }}>
                <FilterSidebar
                    activeFilter={activeFilter}
                    setActiveFilter={setActiveFilter}
                    activeType={activeType}
                    setActiveType={setActiveType}
                    posts={posts}
                    currentUserId={currentUserId}
                />
            </div>

            {/* ── Main Feed ──────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">

                {/* Top bar */}
                <div style={{flexShrink:0,height:'48px',background:'#0c0c0c',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',gap:'10px',padding:'0 20px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'8px',minWidth:0}}>
                        <Megaphone size={14} style={{color:'#b8956a',flexShrink:0}}/>
                        <h1 style={{fontSize:'13px',fontWeight:700,color:'#e4e4e4',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:'Inter,system-ui,sans-serif'}}>
                            {SIDEBAR_FILTERS.find(f => f.key === activeFilter)?.label ?? "Updates"}
                        </h1>
                        <span style={{fontSize:'11px',color:'rgba(228,228,228,0.35)',flexShrink:0,fontFamily:'Inter,system-ui,sans-serif'}}>
                            · {filteredPosts.length} post{filteredPosts.length !== 1 ? "s" : ""}
                        </span>
                    </div>
                    <div className="flex-1" />

                    {/* Search */}
                    <div style={{position:'relative'}}>
                        <Search size={12} style={{position:'absolute',left:'8px',top:'50%',transform:'translateY(-50%)',color:'rgba(228,228,228,0.3)'}}/>
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search updates…"
                            style={{paddingLeft:'26px',paddingRight:'10px',paddingTop:'5px',paddingBottom:'5px',fontSize:'11px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',color:'#e4e4e4',outline:'none',fontFamily:'Inter,system-ui,sans-serif',width:'140px'}}
                        />
                    </div>

                    <button
                        onClick={handleRefresh}
                        disabled={refreshing || loading}
                        style={{padding:'5px',background:'transparent',border:'none',color:'rgba(228,228,228,0.4)',cursor:'pointer',opacity:refreshing||loading?0.4:1}}
                        title="Refresh feed"
                    >
                        <RefreshCw size={14} className={(refreshing || loading) ? "animate-spin" : ""} />
                    </button>
                </div>

                {/* Scrollable feed */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

                        {/* Composer */}
                        <Composer
                            user={user}
                            companyRole={companyRole}
                            canPostUpdates={canPostUpdates}
                            onPost={handlePost}
                        />

                        {/* Skeletons */}
                        {loading && filteredPosts.length === 0 && (
                            <>
                                <PostSkeleton />
                                <PostSkeleton />
                                <PostSkeleton />
                            </>
                        )}

                        {/* Posts */}
                        {filteredPosts.map(post => (
                            <PostCard
                                key={post.id}
                                post={post}
                                currentUserId={currentUserId}
                                companyRole={companyRole}
                                onLike={handleLike}
                                onDelete={handleDelete}
                                onDiscuss={handleDiscuss}
                                onCopyLink={handleCopyLink}
                            />
                        ))}

                        {/* Empty state */}
                        {filteredPosts.length === 0 && !loading && (
                            <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',display:'flex',flexDirection:'column',alignItems:'center',padding:'64px 24px',textAlign:'center'}}>
                                <div style={{width:'48px',height:'48px',background:'rgba(184,149,106,0.08)',border:'1px solid rgba(184,149,106,0.2)',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:'16px'}}>
                                    <Megaphone size={20} style={{color:'#b8956a'}}/>
                                </div>
                                <p style={{fontSize:'13px',fontWeight:700,color:'#e4e4e4',marginBottom:'6px',fontFamily:'Inter,system-ui,sans-serif'}}>
                                    {search ? "No matching updates" : activeFilter === "pinned" ? "No pinned posts" : "No updates yet"}
                                </p>
                                <p style={{fontSize:'12px',color:'rgba(228,228,228,0.4)',maxWidth:'260px',fontFamily:'Inter,system-ui,sans-serif',lineHeight:1.6}}>
                                    {search ? "Try a different search term." : activeFilter === "pinned" ? "Pin an important post to see it here." : "Be the first to share a company update with your team."}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Delete Confirmation Modal ──────────────────────────────── */}
            {postToDelete && (
                <div style={{position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)'}}>
                    <div style={{background:'#111111',border:'1px solid rgba(255,255,255,0.1)',padding:'24px',width:'100%',maxWidth:'360px',margin:'0 16px'}}>
                        <h3 style={{fontSize:'14px',fontWeight:700,color:'#e4e4e4',marginBottom:'8px',fontFamily:'Inter,system-ui,sans-serif'}}>Delete this post?</h3>
                        <p style={{fontSize:'12px',color:'rgba(228,228,228,0.5)',marginBottom:'24px',fontFamily:'Inter,system-ui,sans-serif',lineHeight:1.6}}>
                            This update will be permanently removed and can't be undone.
                        </p>
                        <div style={{display:'flex',justifyContent:'flex-end',gap:'8px'}}>
                            <button onClick={() => setPostToDelete(null)} style={{padding:'6px 14px',fontSize:'12px',fontWeight:600,color:'rgba(228,228,228,0.5)',background:'transparent',border:'1px solid rgba(255,255,255,0.1)',cursor:'pointer',fontFamily:'Inter,system-ui,sans-serif'}}>
                                Cancel
                            </button>
                            <button onClick={confirmDelete} style={{padding:'6px 14px',fontSize:'12px',fontWeight:700,color:'#fff',background:'#dc2626',border:'none',cursor:'pointer',fontFamily:'Inter,system-ui,sans-serif'}}>
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Updates;
