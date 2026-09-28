import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useUpdates } from "../../contexts/UpdatesContext";
import { useAuth } from "../../contexts/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import { useToast } from "../../contexts/ToastContext";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import WorkspacePanel, { PanelSection, PanelEmpty } from "../../components/layout/WorkspacePanel";
import "../../styles/gloss-x-panels.css";
import {
    MessageCircle, MessageSquare, MoreHorizontal, Send,
    Link as LinkIcon, Trash2, Megaphone, RefreshCw,
    Pin, Search, Star, Award, Layers, Flag,
    X, Clock, ThumbsUp, Share2, TrendingUp, Zap,
    Image, Smile
} from "lucide-react";

const TYPE_META = {
    general:      { label: "General",      color: "var(--accent)",  bg: "var(--gl-accent-soft)",  Icon: MessageSquare },
    achievement:  { label: "Achievement",  color: "#34d399",  bg: "rgba(52,211,153,0.1)",   Icon: Award         },
    announcement: { label: "Announcement", color: "#a78bfa",  bg: "rgba(167,139,250,0.1)",  Icon: Megaphone     },
    project:      { label: "Project",      color: "var(--state-danger)",  bg: "rgba(248,113,113,0.1)",  Icon: Layers        },
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

function avatarColor(name) {
    const palette = ["var(--accent)", "#8a7055", "#6b7280", "#9ca3af", "#d97706", "#64748b", "#78716c", "#a16207"];
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

function Avatar({ name, src, size = 40 }) {
    return (
        <div
            className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
            style={{ width: size, height: size, fontSize: size * 0.35, background: avatarColor(name), border: '1px solid var(--border-accent)' }}
        >
            {src
                ? <img src={src} alt="" className="w-full h-full rounded-full object-cover" />
                : initials(name)
            }
        </div>
    );
}

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
        <article style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', overflow: 'hidden', transition: 'border-color 150ms ease' }} onMouseEnter={e=>e.currentTarget.style.borderColor='var(--border-accent)'} onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border-default)'}>

            {}
            <div className="p-5 pb-0">
                <div className="flex items-start justify-between gap-3">
                    {}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                        <Avatar name={post.author.name} src={post.author.avatar} size={44} />
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <span style={{fontSize:'13px',fontWeight:700,color:'var(--text-primary)',fontFamily:'Inter,system-ui,sans-serif'}}>
                                    {post.author.name}
                                </span>
                                <TypeBadge type={post.context} />
                                {post.isPinned && (
                                    <span style={{display:'inline-flex',alignItems:'center',gap:'3px',fontSize:'9px',fontWeight:700,padding:'1px 6px',background:'var(--gl-accent-soft)',border:'1px solid var(--gl-accent-line)',color:'var(--accent)'}}>
                                        <Pin size={8} /> Pinned
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize', fontFamily: 'Inter,system-ui,sans-serif' }}>
                                    {post.author.role}
                                </span>
                                <span style={{ color: 'var(--border-accent)' }}>·</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'monospace' }}>
                                    <Clock size={10} />
                                    {formatTime(post.timestamp)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {}
                    <div className="relative flex-shrink-0" ref={menuRef}>
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowMenu(p => !p); }}
                            style={{padding:'5px',background:'transparent',border:'none',color:'var(--text-secondary)',cursor:'pointer'}}
                        >
                            <MoreHorizontal size={18} />
                        </button>
                        {showMenu && (
                            <div style={{position:'absolute',right:0,marginTop:'4px',width:'180px',background:'#1a1a1a',border:'1px solid var(--border-accent)',zIndex:30,padding:'4px'}}>
                                <button onClick={() => { onDiscuss(post); setShowMenu(false); }} style={{width:'100%',textAlign:'left',padding:'7px 12px',fontSize:'12px',color:'var(--text-secondary)',background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:'8px',fontFamily:'Inter,system-ui,sans-serif'}} onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                    <MessageCircle size={13} style={{color:'#a78bfa'}}/> Discuss in DM
                                </button>
                                <button onClick={() => { onCopyLink(post.id); setShowMenu(false); }} style={{width:'100%',textAlign:'left',padding:'7px 12px',fontSize:'12px',color:'var(--text-secondary)',background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:'8px',fontFamily:'Inter,system-ui,sans-serif'}} onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                    <LinkIcon size={13} style={{color:'var(--text-secondary)'}}/> Copy Link
                                </button>
                                {canDelete && (
                                    <>
                                        <div style={{height:'1px',background:'var(--bg-hover)',margin:'3px 0'}}/>
                                        <button onClick={() => { onDelete(post.id); setShowMenu(false); }} style={{width:'100%',textAlign:'left',padding:'7px 12px',fontSize:'12px',color:'var(--state-danger)',background:'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:'8px',fontFamily:'Inter,system-ui,sans-serif'}} onMouseEnter={e=>e.currentTarget.style.background='rgba(248,113,113,0.08)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                            <Trash2 size={13}/> Delete Post
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {}
            <div className="px-5 pt-4 pb-3">
                {post.title && (
                    <h3 style={{fontSize:'14px',fontWeight:700,color:'var(--text-primary)',marginBottom:'8px',lineHeight:1.3,fontFamily:'Inter,system-ui,sans-serif'}}>
                        {post.title}
                    </h3>
                )}
                <p style={{fontSize:'13px',color:'var(--text-secondary)',lineHeight:1.65,whiteSpace:'pre-wrap',fontFamily:'Inter,system-ui,sans-serif'}}>
                    {displayContent}
                </p>
                {contentIsLong && (
                    <button onClick={() => setExpanded(e => !e)} style={{fontSize:'11px',fontWeight:600,color:'var(--accent)',background:'none',border:'none',cursor:'pointer',marginTop:'4px',padding:0}}>
                        {expanded ? "Show less" : "…see more"}
                    </button>
                )}

                {}
                {post.tags?.filter(t => !["normal", "urgent", "high", "low"].includes(t)).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                        {post.tags.filter(t => !["normal", "urgent", "high", "low"].includes(t)).map(tag => (
                            <span key={tag} style={{fontSize:'11px',fontWeight:600,color:'var(--accent)',cursor:'pointer'}}>
                                #{tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {}
            {post.likes > 0 && (
                <div className="px-5 pb-2 flex items-center gap-1.5">
                    <div className="flex -space-x-1">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{ background: 'var(--accent)', border: '1px solid rgba(0,0,0,0.3)' }}>👍</span>
                        {post.likes > 1 && (
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{ background: 'var(--state-danger)', border: '1px solid rgba(0,0,0,0.3)' }}>❤️</span>
                        )}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Inter,system-ui,sans-serif' }}>
                        {post.likes} {post.likes === 1 ? "appreciation" : "appreciations"}
                    </span>
                </div>
            )}

            {}
            <div style={{margin:'0 20px',height:'1px',background:'var(--bg-hover)'}}/>

            {}
            <div className="px-3 py-1 flex items-center gap-1">
                <button
                    onClick={() => onLike(post.id)}
                    style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',padding:'8px',fontSize:'12px',fontWeight:600,background:userReacted?'var(--gl-accent-soft)':'transparent',color:userReacted?'var(--accent)':'var(--text-secondary)',border:'none',cursor:'pointer',transition:'all 150ms ease',fontFamily:'Inter,system-ui,sans-serif'}}
                >
                    <ThumbsUp size={16} className={userReacted ? "fill-current" : ""} />
                    {userReacted ? "Appreciated" : "Appreciate"}
                </button>
                <button onClick={() => onDiscuss(post)} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',padding:'8px',fontSize:'12px',fontWeight:600,color:'var(--text-secondary)',background:'transparent',border:'none',cursor:'pointer',fontFamily:'Inter,system-ui,sans-serif'}} onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <MessageCircle size={15}/> Discuss
                </button>
                <button onClick={() => onCopyLink(post.id)} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',padding:'8px',fontSize:'12px',fontWeight:600,color:'var(--text-secondary)',background:'transparent',border:'none',cursor:'pointer',fontFamily:'Inter,system-ui,sans-serif'}} onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <Share2 size={16} />
                    Share
                </button>
            </div>
        </article>
    );
}

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
        <div style={{background:'var(--bg-surface)',border:'1px solid var(--border-default)',overflow:'hidden'}}>
            {}
            {!open && (
                <div className="p-4 flex items-center gap-3">
                    <Avatar name={userName} src={user?.avatar} size={42} />
                    <button
                        onClick={() => canPostUpdates && setOpen(true)}
                        disabled={!canPostUpdates}
                        style={{flex:1,textAlign:'left',fontSize:'13px',padding:'8px 16px',background:'var(--bg-surface)',border:'1px solid var(--border-default)',color:'var(--text-secondary)',cursor:canPostUpdates?'pointer':'not-allowed',fontFamily:'Inter,system-ui,sans-serif',transition:'border-color 150ms ease'}}
                    >
                        {canPostUpdates
                            ? "What's happening at the company? Share an update…"
                            : "Only managers and above can post updates."}
                    </button>
                </div>
            )}

            {}
            {open && (
                <div className="p-4 space-y-3">
                    {}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Avatar name={userName} src={user?.avatar} size={42} />
                            <div>
                                <p style={{fontSize:'13px',fontWeight:700,color:'var(--text-primary)',fontFamily:'Inter,system-ui,sans-serif'}}>{userName}</p>
                                <p style={{fontSize:'11px',color:'var(--text-secondary)',textTransform:'capitalize',fontFamily:'Inter,system-ui,sans-serif'}}>{companyRole}</p>
                            </div>
                        </div>
                        <button onClick={() => setOpen(false)} style={{padding:'4px',background:'transparent',border:'none',color:'var(--text-secondary)',cursor:'pointer'}}>
                            <X size={16} />
                        </button>
                    </div>

                    {}
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(TYPE_META).map(([key, meta]) => (
                            <button
                                key={key}
                                onClick={() => setType(key)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px',
                                    fontWeight: 700, padding: '4px 10px', cursor: 'pointer',
                                    background: type === key ? meta.bg : 'transparent',
                                    color: type === key ? meta.color : 'var(--text-secondary)',
                                    border: `1px solid ${type === key ? meta.color + '55' : 'var(--border-accent)'}`,
                                    fontFamily: 'Inter,system-ui,sans-serif', transition: 'all 150ms ease',
                                }}
                                onMouseEnter={e => { if (type !== key) { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                                onMouseLeave={e => { if (type !== key) { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                            >
                                {React.createElement(meta.Icon, { size: 11 })} {meta.label}
                            </button>
                        ))}
                    </div>

                    {}
                    <input
                        type="text"
                        placeholder="Give it a title (optional)"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        style={{width:'100%',fontSize:'13px',fontWeight:600,background:'transparent',borderBottom:'1px solid var(--border-default)',paddingBottom:'8px',outline:'none',color:'var(--text-primary)',fontFamily:'Inter,system-ui,sans-serif'}}
                    />

                    {}
                    <textarea
                        autoFocus
                        placeholder="What would you like to share with your team?"
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        rows={5}
                        style={{width:'100%',fontSize:'13px',background:'var(--bg-surface)',border:'1px solid var(--border-default)',padding:'10px 14px',outline:'none',resize:'none',color:'var(--text-primary)',fontFamily:'Inter,system-ui,sans-serif',lineHeight:1.6,boxSizing:'border-box'}}
                    />

                    {}
                    <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1">
                            <button style={{padding:'5px',background:'transparent',border:'none',color:'var(--text-secondary)',cursor:'pointer'}} title="Add image">
                                <Image size={16}/>
                            </button>
                            <button style={{padding:'5px',background:'transparent',border:'none',color:'var(--text-secondary)',cursor:'pointer'}} title="Add emoji">
                                <Smile size={18} />
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setOpen(false)}
                                style={{padding:'5px 14px',fontSize:'12px',fontWeight:600,color:'var(--text-secondary)',background:'transparent',border:'1px solid var(--border-default)',cursor:'pointer',fontFamily:'Inter,system-ui,sans-serif'}}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePost}
                                disabled={!content.trim() || posting}
                                className="px-5 py-1.5 text-sm font-bold text-[#0c0c0c] bg-[var(--accent)] hover:opacity-85 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center gap-2"
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

function FilterSidebar({ activeFilter, setActiveFilter, activeType, setActiveType, posts, currentUserId, subtitle }) {
    const allCount   = posts.length;
    const pinnedCount = posts.filter(p => p.isPinned).length;
    const mineCount  = posts.filter(p => p.author.id === currentUserId).length;
    const counts     = { all: allCount, pinned: pinnedCount, mine: mineCount };

    return (
        <WorkspacePanel icon={Megaphone} title="Updates" subtitle={subtitle}>
            <PanelSection label="Browse">
                {SIDEBAR_FILTERS.map(f => {
                    const Icon = f.icon;
                    const active = activeFilter === f.key;
                    return (
                        <button key={f.key} type="button" onClick={() => setActiveFilter(f.key)}
                            className={`gl-item${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>
                            <Icon size={14} className="gl-x-item-icon" />
                            <span className="gl-x-item-title">{f.label}</span>
                            {counts[f.key] > 0 && <span className="gl-count">{counts[f.key]}</span>}
                        </button>
                    );
                })}
            </PanelSection>

            <PanelSection label="Filter by type">
                {TYPE_FILTERS.map(f => {
                    const meta = TYPE_META[f.key];
                    const cnt = f.key === "all" ? null : posts.filter(p => p.context?.toLowerCase() === f.key).length;
                    const isActiveType = activeType === f.key;
                    const Icon = meta ? meta.Icon : Zap;
                    return (
                        <button key={f.key} type="button" onClick={() => setActiveType(f.key)}
                            className="gl-item" aria-pressed={isActiveType}>
                            <Icon size={14} className="gl-x-item-icon" style={isActiveType && meta ? { color: meta.color } : undefined} />
                            <span className="gl-x-item-title" style={{ fontSize: '12.5px' }}>{f.label}</span>
                            {cnt !== null && cnt > 0 && <span className="gl-count">{cnt}</span>}
                        </button>
                    );
                })}
            </PanelSection>

            <PanelSection label="Trending" icon={TrendingUp}>
                <div className="gl-x-chips gl-x-chips--wrap" style={{ padding: '4px 14px' }}>
                    {["#Milestone","#Launch","#BugFix","#Design","#Engineering"].map(tag => (
                        <span key={tag} className="gl-x-chip">{tag}</span>
                    ))}
                </div>
            </PanelSection>
        </WorkspacePanel>
    );
}

function PostSkeleton() {
    return (
        <div style={{background:'var(--bg-surface)',border:'1px solid var(--border-default)',padding:'20px'}}>
            <div style={{display:'flex',gap:'12px',marginBottom:'16px'}}>
                <div style={{width:'40px',height:'40px',borderRadius:'50%',background:'var(--bg-active)',flexShrink:0}}/>
                <div style={{flex:1,display:'flex',flexDirection:'column',gap:'6px',paddingTop:'4px'}}>
                    <div style={{height:'10px',background:'var(--bg-active)',width:'40%'}}/>
                    <div style={{height:'8px',background:'var(--bg-hover)',width:'60%'}}/>
                </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'6px',marginBottom:'16px'}}>
                <div style={{height:'10px',background:'var(--bg-active)',width:'75%'}}/>
                <div style={{height:'8px',background:'var(--bg-hover)',width:'100%'}}/>
                <div style={{height:'8px',background:'var(--bg-hover)',width:'85%'}}/>
            </div>
            <div style={{display:'flex',gap:'12px'}}>
                <div style={{height:'28px',background:'var(--bg-hover)',flex:1}}/>
                <div style={{height:'28px',background:'var(--bg-hover)',flex:1}}/>
                <div style={{height:'28px',background:'var(--bg-hover)',flex:1}}/>
            </div>
        </div>
    );
}

const Updates = () => {
    const navigate  = useNavigate();
    const { workspaceId } = useParams();
    const { posts, addPost, likePost, deletePost, loading, refreshUpdates } = useUpdates();
    const { user }  = useAuth();
    const { activeWorkspace } = useWorkspace();
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
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--bg-base)' }}>

            {}
            <div className="gl-x-tasks-side">
                <FilterSidebar
                    activeFilter={activeFilter}
                    setActiveFilter={setActiveFilter}
                    activeType={activeType}
                    setActiveType={setActiveType}
                    posts={posts}
                    currentUserId={currentUserId}
                    subtitle={activeWorkspace?.name}
                />
            </div>

            {}
            <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">

                {}
                <div className="gl-x-tasks-top" style={{flexShrink:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:'8px',minWidth:0}}>
                        <Megaphone size={14} style={{color:'var(--accent)',flexShrink:0}}/>
                        <h1 style={{fontSize:'15px',fontWeight:700,margin:0,color:'var(--text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                            {SIDEBAR_FILTERS.find(f => f.key === activeFilter)?.label ?? "Updates"}
                        </h1>
                        <span style={{fontSize:'12px',color:'var(--text-secondary)',flexShrink:0}}>
                            · {filteredPosts.length} post{filteredPosts.length !== 1 ? "s" : ""}
                        </span>
                    </div>
                    <div className="flex-1" />

                    {}
                    <div className="gl-search" style={{width:'200px'}}>
                        <Search size={12}/>
                        <input
                            className="gl-input"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search updates…"
                            aria-label="Search updates"
                        />
                    </div>

                    <button
                        onClick={handleRefresh}
                        disabled={refreshing || loading}
                        className="gl-icon-btn"
                        title="Refresh feed"
                        aria-label="Refresh feed"
                    >
                        <RefreshCw size={14} className={(refreshing || loading) ? "animate-spin" : ""} />
                    </button>
                </div>

                {}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

                        {}
                        <Composer
                            user={user}
                            companyRole={companyRole}
                            canPostUpdates={canPostUpdates}
                            onPost={handlePost}
                        />

                        {}
                        {loading && filteredPosts.length === 0 && (
                            <>
                                <PostSkeleton />
                                <PostSkeleton />
                                <PostSkeleton />
                            </>
                        )}

                        {}
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

                        {}
                        {filteredPosts.length === 0 && !loading && (
                            <div className="gl-card gl-ambient" style={{padding:'40px 16px'}}>
                                <PanelEmpty icon={Megaphone}
                                    title={search ? "No matching updates" : activeFilter === "pinned" ? "No pinned posts" : "No updates yet"}
                                    text={search ? "Try a different search term." : activeFilter === "pinned" ? "Pin an important post to see it here." : "Be the first to share a company update with your team."} />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {}
            {postToDelete && (
                <div className="gl-x-overlay" style={{zIndex:50}}>
                    <div role="dialog" aria-modal="true" aria-label="Delete this post?" className="gl-card gl-x-dialog" style={{maxWidth:'360px'}}>
                        <h3 style={{marginTop:0}}>Delete this post?</h3>
                        <p>This update will be permanently removed and can't be undone.</p>
                        <div className="gl-x-dialog-actions">
                            <button type="button" className="gl-btn" onClick={() => setPostToDelete(null)}>Cancel</button>
                            <button type="button" className="gl-btn gl-x-danger-solid" onClick={confirmDelete}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Updates;
