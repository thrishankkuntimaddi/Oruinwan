import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useUpdates } from "../../contexts/UpdatesContext";
import { useAuth } from "../../contexts/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import { useToast } from "../../contexts/ToastContext";
import {
    Heart, MessageCircle, MoreHorizontal, Send, User, Flag,
    Link as LinkIcon, Trash2, Megaphone, Lock, RefreshCw,
    Pin, Filter, Search, ChevronDown, Bookmark, Star,
    Plus, X, Clock
} from "lucide-react";

// ─── Design tokens (match MyTasks Jira-style palette) ─────────────────────

const TYPE_META = {
    general:     { label: "General",     color: "#0052CC", bg: "#DEEBFF" },
    achievement: { label: "Achievement", color: "#00875A", bg: "#E3FCEF" },
    announcement:{ label: "Announcement", color: "#6554C0", bg: "#EAE6FF" },
    project:     { label: "Project",     color: "#FF5630", bg: "#FFEBE6" },
    milestone:   { label: "Milestone",   color: "#FF991F", bg: "#FFF1CC" },
};

const PRIORITY_META = {
    urgent: { label: "Urgent", color: "#CD1317" },
    high:   { label: "High",   color: "#E97F33" },
    normal: { label: "Normal", color: "#7A869A" },
    low:    { label: "Low",    color: "#3E7FC1" },
};

const SIDEBAR_FILTERS = [
    { key: "all",     label: "All Updates", icon: <Megaphone size={14} /> },
    { key: "pinned",  label: "Pinned",      icon: <Pin size={14} /> },
    { key: "mine",    label: "My Posts",    icon: <Star size={14} /> },
];

const TYPE_FILTERS = [
    { key: "all",         label: "All" },
    { key: "general",     label: "General" },
    { key: "achievement", label: "Achievements" },
    { key: "announcement",label: "Announcements" },
    { key: "project",     label: "Projects" },
    { key: "milestone",   label: "Milestones" },
];

// ─── Helper: avatar color from string ────────────────────────────────────────
function avatarColor(name) {
    const colors = ["#6554C0", "#0052CC", "#00875A", "#FF5630", "#FF991F", "#36B37E", "#00B8D9", "#8777D9"];
    if (!name) return colors[0];
    return colors[name.charCodeAt(0) % colors.length];
}
function initials(name) {
    if (!name) return "?";
    return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}
function formatTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diff = (now - date) / 1000;
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Post Card Component ─────────────────────────────────────────────────────
function PostCard({ post, currentUserId, companyRole, canPostUpdates, onLike, onDelete, onDiscuss, onCopyLink }) {
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef(null);

    const isOwner = post.author.id === currentUserId;
    const canDelete = isOwner || ["admin", "owner"].includes(companyRole);
    const typeMeta = TYPE_META[post.context?.toLowerCase()] || TYPE_META.general;
    const userReacted = post.reactions?.some(r => r.userId === currentUserId || r.userId?._id === currentUserId);

    useEffect(() => {
        function handleClickOutside(e) {
            if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="group bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/80 transition-colors relative">
            {/* Priority strip — left edge */}
            <div
                className="absolute left-0 top-0 bottom-0 w-0.5"
                style={{ background: PRIORITY_META[post.tags?.[0]]?.color || "#DFE1E6" }}
            />

            <div className="px-5 py-4 pl-6">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm"
                            style={{ background: avatarColor(post.author.name) }}
                        >
                            {post.author.avatar
                                ? <img src={post.author.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                                : initials(post.author.name)
                            }
                        </div>
                        {/* Author info */}
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-gray-900 dark:text-white">{post.author.name}</span>
                                <span
                                    className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                                    style={{ background: typeMeta.bg, color: typeMeta.color }}
                                >
                                    {typeMeta.label}
                                </span>
                                {post.isPinned && (
                                    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 flex items-center gap-1">
                                        <Pin size={8} /> Pinned
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                <span className="capitalize">{post.author.role}</span>
                                <span>·</span>
                                <Clock size={10} />
                                <span>{formatTime(post.timestamp)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Actions: menu */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowMenu(p => !p); }}
                                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <MoreHorizontal size={15} />
                            </button>
                            {showMenu && (
                                <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 py-1 z-30">
                                    <button
                                        onClick={() => { onDiscuss(post); setShowMenu(false); }}
                                        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2"
                                    >
                                        <MessageCircle size={13} className="text-gray-400" /> Discuss in DM
                                    </button>
                                    <button
                                        onClick={() => { onCopyLink(post.id); setShowMenu(false); }}
                                        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2"
                                    >
                                        <LinkIcon size={13} className="text-gray-400" /> Copy Link
                                    </button>
                                    {canDelete && (
                                        <>
                                            <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
                                            <button
                                                onClick={() => { onDelete(post.id); setShowMenu(false); }}
                                                className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                            >
                                                <Trash2 size={13} /> Delete
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="pl-12">
                    {post.title && (
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1.5">{post.title}</h4>
                    )}
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                        {post.content}
                    </p>

                    {/* Tags */}
                    {post.tags?.filter(t => t !== "normal").length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                            {post.tags.filter(t => t !== "normal").map(tag => (
                                <span key={tag} className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">#{tag}</span>
                            ))}
                        </div>
                    )}

                    {/* Reaction count */}
                    {post.likes > 0 && (
                        <div className="flex items-center gap-1.5 mt-3">
                            <span className="text-base">👍</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{post.likes} appreciation{post.likes !== 1 ? "s" : ""}</span>
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 mt-3 -ml-2">
                        <button
                            onClick={() => onLike(post.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${userReacted
                                ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20"
                                : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                            }`}
                        >
                            <Heart size={13} className={userReacted ? "fill-current" : ""} />
                            {userReacted ? "Appreciated" : "Appreciate"}
                        </button>
                        <button
                            onClick={() => onDiscuss(post)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <MessageCircle size={13} />
                            Discuss
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Create Post Panel ────────────────────────────────────────────────────────
function CreatePostPanel({ companyRole, onPost }) {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [type, setType] = useState("general");
    const [isPosting, setIsPosting] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const { showToast } = useToast();

    const handleSubmit = async () => {
        if (!content.trim()) return;
        setIsPosting(true);
        try {
            await onPost({ title, content, context: type });
            setTitle("");
            setContent("");
            setType("general");
            setExpanded(false);
            showToast("Update posted successfully!", "success");
        } finally {
            setIsPosting(false);
        }
    };

    return (
        <div className="border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
            {!expanded ? (
                <button
                    onClick={() => setExpanded(true)}
                    className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                    <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ background: avatarColor(companyRole) }}
                    >
                        {companyRole?.[0]?.toUpperCase() || "U"}
                    </div>
                    <span className="text-sm text-gray-400 dark:text-gray-500 flex-1">Share an update, achievement or announcement...</span>
                    <Plus size={16} className="text-gray-400 flex-shrink-0" />
                </button>
            ) : (
                <div className="px-5 py-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-800 dark:text-white">New Update</span>
                        <button onClick={() => setExpanded(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                            <X size={15} />
                        </button>
                    </div>

                    {/* Type selector */}
                    <div className="flex gap-2 flex-wrap">
                        {Object.entries(TYPE_META).map(([key, meta]) => (
                            <button
                                key={key}
                                onClick={() => setType(key)}
                                className="text-[11px] font-bold px-2.5 py-1 rounded-full transition-all border"
                                style={{
                                    background: type === key ? meta.bg : "transparent",
                                    color: type === key ? meta.color : "#7A869A",
                                    borderColor: type === key ? meta.color : "#DFE1E6",
                                }}
                            >
                                {meta.label}
                            </button>
                        ))}
                    </div>

                    <input
                        type="text"
                        placeholder="Title (optional)"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        className="w-full text-sm font-semibold bg-transparent border-b border-gray-200 dark:border-gray-700 pb-2 outline-none text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
                    />
                    <textarea
                        placeholder="What would you like to share with your team?"
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        rows={4}
                        className="w-full text-sm bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2.5 outline-none resize-none text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 border border-gray-200 dark:border-gray-700 focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"
                    />
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={() => setExpanded(false)}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!content.trim() || isPosting}
                            className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-1.5"
                        >
                            {isPosting ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
                            {isPosting ? "Posting..." : "Post Update"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Updates Component ───────────────────────────────────────────────────
const Updates = () => {
    const navigate = useNavigate();
    const { workspaceId } = useParams();
    const { posts, addPost, likePost, deletePost, loading, refreshUpdates } = useUpdates();
    const { user } = useAuth();
    const { showToast } = useToast();
    const { canPostUpdates, companyRole } = usePermissions();

    const [activeFilter, setActiveFilter] = useState("all");
    const [activeType, setActiveType] = useState("all");
    const [search, setSearch] = useState("");
    const [postToDelete, setPostToDelete] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const currentUserId = user?._id || user?.id || user?.sub;

    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        await refreshUpdates();
        setRefreshing(false);
    };

    const handlePost = useCallback(async (data) => {
        await addPost(data);
    }, [addPost]);

    const handleLike = (id) => likePost(id);

    const handleDelete = (id) => setPostToDelete(id);

    const confirmDelete = () => {
        if (postToDelete) {
            deletePost(postToDelete);
            showToast("Update deleted", "success");
            setPostToDelete(null);
        }
    };

    const handleDiscuss = (post) => {
        const titleContext = post.title || post.content.substring(0, 30) + (post.content.length > 30 ? "..." : "");
        navigate(`/workspace/${workspaceId}/dm/${post.author.id}?initialMessage=RE: "${titleContext}"`);
    };

    const handleCopyLink = (postId) => {
        navigator.clipboard.writeText(`${window.location.origin}/workspace/${workspaceId}/updates/${postId}`);
        showToast("Link copied to clipboard", "success");
    };

    // Filter posts
    const filteredPosts = posts.filter(post => {
        if (activeFilter === "mine" && post.author.id !== currentUserId) return false;
        if (activeFilter === "pinned" && !post.isPinned) return false;
        if (activeType !== "all" && post.context?.toLowerCase() !== activeType) return false;
        if (search.trim()) {
            const q = search.toLowerCase();
            if (!post.title?.toLowerCase().includes(q) && !post.content?.toLowerCase().includes(q)) return false;
        }
        return true;
    });

    // Counts for sidebar badges
    const allCount = posts.length;
    const pinnedCount = posts.filter(p => p.isPinned).length;
    const mineCount = posts.filter(p => p.author.id === currentUserId).length;

    const sidebarCounts = { all: allCount, pinned: pinnedCount, mine: mineCount };

    return (
        <div className="flex h-full overflow-hidden bg-gray-50 dark:bg-gray-900">

            {/* ── Left Sidebar ── */}
            <div className="w-52 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-y-auto">
                <div className="px-3 py-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-3 px-2 text-gray-400 dark:text-gray-500">
                        Updates
                    </p>
                    <nav className="space-y-0.5">
                        {SIDEBAR_FILTERS.map(f => (
                            <button
                                key={f.key}
                                onClick={() => setActiveFilter(f.key)}
                                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-sm font-medium transition-all"
                                style={{
                                    background: activeFilter === f.key ? "#DEEBFF" : "transparent",
                                    color: activeFilter === f.key ? "#0052CC" : "#42526E",
                                    fontWeight: activeFilter === f.key ? 700 : 500,
                                }}
                            >
                                <span style={{ color: activeFilter === f.key ? "#0052CC" : "#7A869A" }}>
                                    {f.icon}
                                </span>
                                {f.label}
                                {sidebarCounts[f.key] > 0 && (
                                    <span
                                        className="ml-auto text-[10px] font-bold tabular-nums"
                                        style={{ color: activeFilter === f.key ? "#0052CC" : "#7A869A" }}
                                    >
                                        {sidebarCounts[f.key]}
                                    </span>
                                )}
                            </button>
                        ))}
                    </nav>

                    {/* Type filters */}
                    <div className="mt-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-2 px-2 text-gray-400 dark:text-gray-500">
                            By Type
                        </p>
                        <div className="space-y-0.5">
                            {TYPE_FILTERS.map(f => (
                                <button
                                    key={f.key}
                                    onClick={() => setActiveType(f.key)}
                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs transition-all"
                                    style={{
                                        background: activeType === f.key ? "#DEEBFF" : "transparent",
                                        color: activeType === f.key ? "#0052CC" : "#42526E",
                                    }}
                                >
                                    <div
                                        className="w-2 h-2 rounded-full flex-shrink-0"
                                        style={{ background: TYPE_META[f.key]?.color || "#DFE1E6" }}
                                    />
                                    <span className="flex-1 text-left">{f.label}</span>
                                    {f.key !== "all" && (
                                        <span className="text-[10px] font-bold tabular-nums" style={{ color: activeType === f.key ? "#0052CC" : "#7A869A" }}>
                                            {posts.filter(p => p.context?.toLowerCase() === f.key).length || ""}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Main Content ── */}
            <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">

                {/* Toolbar */}
                <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-5 py-3">
                    <div className="flex items-center gap-3">
                        <div>
                            <h1 className="text-sm font-bold text-gray-800 dark:text-white">
                                {SIDEBAR_FILTERS.find(f => f.key === activeFilter)?.label || "Updates"}
                            </h1>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {filteredPosts.length} update{filteredPosts.length !== 1 ? "s" : ""}
                                {activeType !== "all" ? ` · ${TYPE_META[activeType]?.label}` : ""}
                            </p>
                        </div>
                        <div className="flex-1" />

                        {/* Search */}
                        <div className="relative">
                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search updates..."
                                className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-indigo-400 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 w-40 transition-colors"
                            />
                        </div>

                        {/* Refresh */}
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing || loading}
                            className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                            title="Refresh"
                        >
                            <RefreshCw size={14} className={(refreshing || loading) ? "animate-spin" : ""} />
                        </button>
                    </div>
                </div>

                {/* Feed */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50 dark:bg-gray-900">

                    {/* Create post — only for managers+ */}
                    {canPostUpdates ? (
                        <CreatePostPanel companyRole={companyRole} onPost={handlePost} />
                    ) : (
                        <div className="flex items-center gap-3 px-5 py-3 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                                <Lock size={13} className="text-gray-400" />
                            </div>
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                                Only managers and above can post company updates.
                            </p>
                        </div>
                    )}

                    {/* Loading skeleton */}
                    {loading && filteredPosts.length === 0 && (
                        <div className="animate-pulse">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="px-5 py-4 pl-6 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                                    <div className="flex gap-3 mb-3">
                                        <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                                        <div className="flex-1 space-y-1.5 pt-1">
                                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-28" />
                                            <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded w-44" />
                                        </div>
                                    </div>
                                    <div className="space-y-2 pl-12">
                                        <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                                        <div className="h-3 bg-gray-100 dark:bg-gray-600 rounded w-full" />
                                        <div className="h-3 bg-gray-100 dark:bg-gray-600 rounded w-4/5" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Posts */}
                    {filteredPosts.map(post => (
                        <PostCard
                            key={post.id}
                            post={post}
                            currentUserId={currentUserId}
                            companyRole={companyRole}
                            canPostUpdates={canPostUpdates}
                            onLike={handleLike}
                            onDelete={handleDelete}
                            onDiscuss={handleDiscuss}
                            onCopyLink={handleCopyLink}
                        />
                    ))}

                    {/* Empty state */}
                    {filteredPosts.length === 0 && !loading && (
                        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                            <div
                                className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 shadow-sm"
                                style={{ background: "#DEEBFF" }}
                            >
                                <Megaphone size={24} style={{ color: "#0052CC" }} />
                            </div>
                            <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">No updates yet</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs">
                                {search ? "No updates match your search." : activeFilter === "pinned" ? "No pinned updates." : "Be the first to share a company update."}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {postToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">Delete Update?</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                            This update will be permanently removed from the feed.
                        </p>
                        <div className="flex justify-end gap-2">
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
