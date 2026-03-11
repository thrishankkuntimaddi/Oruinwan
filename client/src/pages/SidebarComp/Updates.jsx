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
    general:      { label: "General",      color: "#0052CC", bg: "#DEEBFF", Icon: MessageSquare },
    achievement:  { label: "Achievement",  color: "#00875A", bg: "#E3FCEF", Icon: Award         },
    announcement: { label: "Announcement", color: "#6554C0", bg: "#EAE6FF", Icon: Megaphone     },
    project:      { label: "Project",      color: "#FF5630", bg: "#FFEBE6", Icon: Layers        },
    milestone:    { label: "Milestone",    color: "#FF991F", bg: "#FFF1CC", Icon: Flag          },
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
    const palette = ["#6554C0", "#0052CC", "#00875A", "#FF5630", "#FF991F", "#36B37E", "#00B8D9", "#8777D9"];
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
            className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ring-2 ring-white dark:ring-gray-800"
            style={{ width: size, height: size, fontSize: size * 0.35, background: avatarColor(name) }}
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
            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
            style={{ background: meta.bg, color: meta.color }}
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
        <article className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow duration-200">

            {/* Card Header */}
            <div className="p-5 pb-0">
                <div className="flex items-start justify-between gap-3">
                    {/* Author Info */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                        <Avatar name={post.author.name} src={post.author.avatar} size={44} />
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-gray-900 dark:text-white">
                                    {post.author.name}
                                </span>
                                <TypeBadge type={post.context} />
                                {post.isPinned && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                        <Pin size={8} /> Pinned
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                                    {post.author.role}
                                </span>
                                <span className="text-gray-300 dark:text-gray-600">·</span>
                                <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
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
                            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                        >
                            <MoreHorizontal size={18} />
                        </button>
                        {showMenu && (
                            <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-1.5 z-30">
                                <button
                                    onClick={() => { onDiscuss(post); setShowMenu(false); }}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/60 flex items-center gap-2.5 transition-colors"
                                >
                                    <MessageCircle size={14} className="text-indigo-500" /> Discuss in DM
                                </button>
                                <button
                                    onClick={() => { onCopyLink(post.id); setShowMenu(false); }}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/60 flex items-center gap-2.5 transition-colors"
                                >
                                    <LinkIcon size={14} className="text-gray-400" /> Copy Link
                                </button>
                                {canDelete && (
                                    <>
                                        <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
                                        <button
                                            onClick={() => { onDelete(post.id); setShowMenu(false); }}
                                            className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2.5 transition-colors"
                                        >
                                            <Trash2 size={14} /> Delete Post
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
                    <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2 leading-snug">
                        {post.title}
                    </h3>
                )}
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {displayContent}
                </p>
                {contentIsLong && (
                    <button
                        onClick={() => setExpanded(e => !e)}
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-1 hover:underline"
                    >
                        {expanded ? "Show less" : "…see more"}
                    </button>
                )}

                {/* Hashtags */}
                {post.tags?.filter(t => !["normal", "urgent", "high", "low"].includes(t)).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                        {post.tags.filter(t => !["normal", "urgent", "high", "low"].includes(t)).map(tag => (
                            <span key={tag} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
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
                        <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[10px] ring-1 ring-white dark:ring-gray-800">👍</span>
                        {post.likes > 1 && (
                            <span className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-[10px] ring-1 ring-white dark:ring-gray-800">❤️</span>
                        )}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {post.likes} {post.likes === 1 ? "appreciation" : "appreciations"}
                    </span>
                </div>
            )}

            {/* Divider */}
            <div className="mx-5 h-px bg-gray-100 dark:bg-gray-700" />

            {/* Action bar */}
            <div className="px-3 py-1 flex items-center gap-1">
                <button
                    onClick={() => onLike(post.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
                        userReacted
                            ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
                            : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                >
                    <ThumbsUp size={16} className={userReacted ? "fill-current" : ""} />
                    {userReacted ? "Appreciated" : "Appreciate"}
                </button>
                <button
                    onClick={() => onDiscuss(post)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                    <MessageCircle size={16} />
                    Discuss
                </button>
                <button
                    onClick={() => onCopyLink(post.id)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
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
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Collapsed prompt */}
            {!open && (
                <div className="p-4 flex items-center gap-3">
                    <Avatar name={userName} src={user?.avatar} size={42} />
                    <button
                        onClick={() => canPostUpdates && setOpen(true)}
                        disabled={!canPostUpdates}
                        className={`flex-1 text-left text-sm px-4 py-2.5 rounded-full border transition-all ${
                            canPostUpdates
                                ? "border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-indigo-400 cursor-pointer"
                                : "border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                        }`}
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
                                <p className="text-sm font-bold text-gray-900 dark:text-white">{userName}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{companyRole}</p>
                            </div>
                        </div>
                        <button onClick={() => setOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                            <X size={16} />
                        </button>
                    </div>

                    {/* Type pills */}
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(TYPE_META).map(([key, meta]) => (
                            <button
                                key={key}
                                onClick={() => setType(key)}
                                className="flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full border transition-all"
                                style={{
                                    background: type === key ? meta.bg : "transparent",
                                    color: type === key ? meta.color : "#9CA3AF",
                                    borderColor: type === key ? meta.color : "#E5E7EB",
                                }}
                            >
                                {React.createElement(meta.Icon, { size: 12 })} {meta.label}
                            </button>
                        ))}
                    </div>

                    {/* Title */}
                    <input
                        type="text"
                        placeholder="Give it a title (optional)"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        className="w-full text-sm font-semibold bg-transparent border-b border-gray-200 dark:border-gray-700 pb-2 outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
                    />

                    {/* Content */}
                    <textarea
                        autoFocus
                        placeholder="What would you like to share with your team?"
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        rows={5}
                        className="w-full text-sm bg-gray-50 dark:bg-gray-700/50 rounded-xl px-4 py-3 outline-none resize-none text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 border border-gray-200 dark:border-gray-700 focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors leading-relaxed"
                    />

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1">
                            <button className="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-full transition-colors" title="Add image (coming soon)">
                                <Image size={18} />
                            </button>
                            <button className="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-full transition-colors" title="Add emoji">
                                <Smile size={18} />
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setOpen(false)}
                                className="px-4 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePost}
                                disabled={!content.trim() || posting}
                                className="px-5 py-1.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 shadow-sm"
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
        <div className="flex flex-col gap-2 sticky top-0">

            {/* ── Page Heading ─────────────────────────────────── */}
            <div className="h-14 flex items-center px-1 mb-1">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                        <Megaphone size={16} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                        Updates
                    </h1>
                </div>
            </div>

            {/* Navigation card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 pt-4 pb-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 px-1 mb-2">
                        Browse
                    </p>
                    <nav className="space-y-0.5">
                        {SIDEBAR_FILTERS.map(f => {
                            const Icon = f.icon;
                            const active = activeFilter === f.key;
                            return (
                                <button
                                    key={f.key}
                                    onClick={() => setActiveFilter(f.key)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                                        active
                                            ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400"
                                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/60"
                                    }`}
                                >
                                    <Icon size={16} className={active ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400"} />
                                    <span className="flex-1 text-left">{f.label}</span>
                                    {counts[f.key] > 0 && (
                                        <span className={`text-xs font-bold tabular-nums ${active ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400"}`}>
                                            {counts[f.key]}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                <div className="px-4 pb-4 pt-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 px-1 mb-2">
                        Filter by type
                    </p>
                    <div className="space-y-0.5">
                        {TYPE_FILTERS.map(f => {
                            const meta = TYPE_META[f.key];
                            const cnt = f.key === "all" ? null : posts.filter(p => p.context?.toLowerCase() === f.key).length;
                            return (
                                <button
                                    key={f.key}
                                    onClick={() => setActiveType(f.key)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                                        activeType === f.key
                                            ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-semibold"
                                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/60"
                                    }`}
                                >
                                    {meta ? (
                                        <meta.Icon size={15} className="flex-shrink-0" style={{ color: activeType === f.key ? "#4F46E5" : "#9CA3AF" }} />
                                    ) : (
                                        <Zap size={15} className={`flex-shrink-0 ${activeType === f.key ? "text-indigo-600" : "text-gray-400"}`} />
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

            {/* Trending topics card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3 flex items-center gap-1.5">
                    <TrendingUp size={11} /> Trending
                </p>
                <div className="flex flex-wrap gap-2">
                    {["#Milestone", "#Launch", "#BugFix", "#Design", "#Engineering"].map(tag => (
                        <span
                            key={tag}
                            className="px-2.5 py-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full text-xs text-gray-600 dark:text-gray-400 hover:border-indigo-300 hover:text-indigo-600 dark:hover:border-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-all font-medium"
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function PostSkeleton() {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse">
            <div className="flex gap-3 mb-4">
                <div className="w-11 h-11 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                    <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-32" />
                    <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-48" />
                </div>
            </div>
            <div className="space-y-2 mb-4">
                <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-full" />
                <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-5/6" />
                <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-2/3" />
            </div>
            <div className="flex gap-4 pt-2">
                <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex-1" />
                <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex-1" />
                <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex-1" />
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
        <div className="flex h-full overflow-hidden bg-gray-50 dark:bg-gray-900">

            {/* ── Left Filter Sidebar ─────────────────────────────────────── */}
            <div className="w-64 flex-shrink-0 overflow-y-auto p-4 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 hidden lg:block">
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
                <div className="flex-shrink-0 h-12 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3 px-5">
                    <div className="flex items-center gap-2 min-w-0">
                        <Megaphone size={15} className="text-indigo-600 flex-shrink-0" />
                        <h1 className="text-sm font-bold text-gray-800 dark:text-white truncate">
                            {SIDEBAR_FILTERS.find(f => f.key === activeFilter)?.label ?? "Updates"}
                        </h1>
                        <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                            · {filteredPosts.length} post{filteredPosts.length !== 1 ? "s" : ""}
                        </span>
                    </div>
                    <div className="flex-1" />

                    {/* Search */}
                    <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search updates…"
                            className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-indigo-400 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 w-40 transition-colors"
                        />
                    </div>

                    <button
                        onClick={handleRefresh}
                        disabled={refreshing || loading}
                        className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-40"
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
                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col items-center py-20 px-6 text-center">
                                <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
                                    <Megaphone size={24} className="text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                    {search ? "No matching updates" : activeFilter === "pinned" ? "No pinned posts" : "No updates yet"}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs">
                                    {search
                                        ? "Try a different search term."
                                        : activeFilter === "pinned"
                                            ? "Pin an important post to see it here."
                                            : "Be the first to share a company update with your team."}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Delete Confirmation Modal ──────────────────────────────── */}
            {postToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">Delete this post?</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                            This update will be permanently removed from the feed and can't be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setPostToDelete(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors"
                            >
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
