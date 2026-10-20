import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useUpdates } from "../../contexts/UpdatesContext";
import { useAuth } from "../../contexts/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import { useToast } from "../../contexts/ToastContext";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import WorkspacePanel, { PanelSection } from "../../components/layout/WorkspacePanel";
import "../../styles/gloss-x-panels.css";
import {
    MessageCircle, MessageSquare, MoreHorizontal, Send, Link as LinkIcon, Trash2, Megaphone, RefreshCw,
    Pin, Star, Award, Layers, Flag, X, Clock, ThumbsUp, Share2, Zap, PenSquare, Lock,
} from "lucide-react";
import {
    DashPage, PageHead, Panel, Toolbar, SearchBox, FilterTabs, SelectBox, Btn, IconBtn, Chip, Avatar, Confirm, EmptyState, Field,
} from "../../components/ui/page";
import "../toolkit/toolkit.css";

// Tones come from the kit's chip tones, so every type reads in light and dark.
const TYPE_META = {
    general:      { label: "General",      tone: undefined,  Icon: MessageSquare },
    achievement:  { label: "Achievement",  tone: "success",  Icon: Award         },
    announcement: { label: "Announcement", tone: "accent",   Icon: Megaphone     },
    project:      { label: "Project",      tone: undefined,  Icon: Layers        },
    milestone:    { label: "Milestone",    tone: "warning",  Icon: Flag          },
};

const SIDEBAR_FILTERS = [
    { key: "all",    label: "All updates",  icon: Zap },
    { key: "pinned", label: "Pinned",       icon: Pin },
    { key: "mine",   label: "My posts",     icon: Star },
];

const TYPE_FILTERS = [
    { key: "all",          label: "All types" },
    { key: "general",      label: "General" },
    { key: "achievement",  label: "Achievements" },
    { key: "announcement", label: "Announcements" },
    { key: "project",      label: "Projects" },
    { key: "milestone",    label: "Milestones" },
];

function formatTime(isoString) {
    const date = new Date(isoString);
    const diff = (Date.now() - date) / 1000;
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function TypeBadge({ type }) {
    const meta = TYPE_META[type?.toLowerCase()] || TYPE_META.general;
    const Icon = meta.Icon;
    return <Chip tone={meta.tone}><Icon size={11} />{meta.label}</Chip>;
}

const menuItem = { width: '100%', textAlign: 'left', padding: '7px 10px', fontSize: 12.5, color: 'var(--text-secondary)', background: 'transparent', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font)', borderRadius: 'var(--gl-radius)' };

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
    const tags = (post.tags || []).filter(t => !["normal", "urgent", "high", "low"].includes(t));

    useEffect(() => {
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    return (
        <article className="gl-card tk-post">
            <header style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 16px 0' }}>
                <Avatar name={post.author.name} src={post.author.avatar} size="lg" />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{post.author.name}</span>
                        <TypeBadge type={post.context} />
                        {post.isPinned && <Chip tone="accent"><Pin size={10} />Pinned</Chip>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, fontSize: 11.5, color: 'var(--text-muted)' }}>
                        <span style={{ textTransform: 'capitalize' }}>{post.author.role}</span>
                        <span aria-hidden="true">·</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={11} />{formatTime(post.timestamp)}</span>
                    </div>
                </div>
                <div style={{ position: 'relative', flexShrink: 0 }} ref={menuRef}>
                    <IconBtn label="More actions" onClick={(e) => { e.stopPropagation(); setShowMenu(p => !p); }} aria-expanded={showMenu}>
                        <MoreHorizontal size={16} />
                    </IconBtn>
                    {showMenu && (
                        <div role="menu" className="tk-menu">
                            <button type="button" role="menuitem" className="tk-menu-item" style={menuItem} onClick={() => { onDiscuss(post); setShowMenu(false); }}>
                                <MessageCircle size={13} /> Discuss in a DM
                            </button>
                            <button type="button" role="menuitem" className="tk-menu-item" style={menuItem} onClick={() => { onCopyLink(post.id); setShowMenu(false); }}>
                                <LinkIcon size={13} /> Copy link
                            </button>
                            {canDelete && (
                                <>
                                    <div style={{ height: 1, background: 'var(--border-subtle)', margin: '3px 0' }} />
                                    <button type="button" role="menuitem" className="tk-menu-item" style={{ ...menuItem, color: 'var(--state-danger)' }} onClick={() => { onDelete(post.id); setShowMenu(false); }}>
                                        <Trash2 size={13} /> Delete post
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </header>

            <div style={{ padding: '12px 16px 10px' }}>
                {post.title && (
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px', lineHeight: 1.35 }}>{post.title}</h3>
                )}
                <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.65, whiteSpace: 'pre-wrap', margin: 0, overflowWrap: 'anywhere' }}>
                    {displayContent}
                </p>
                {contentIsLong && (
                    <button type="button" onClick={() => setExpanded(e => !e)} style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 0, cursor: 'pointer', marginTop: 4, padding: 0, fontFamily: 'var(--font)' }}>
                        {expanded ? "Show less" : "Read more"}
                    </button>
                )}
                {tags.length > 0 && (
                    <div className="tk-tags" style={{ marginTop: 10 }}>
                        {tags.map(tag => <span key={tag} style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>#{tag}</span>)}
                    </div>
                )}
                {post.likes > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 11.5, color: 'var(--text-muted)' }}>
                        <ThumbsUp size={12} style={{ color: 'var(--accent)' }} />
                        {post.likes} {post.likes === 1 ? "appreciation" : "appreciations"}
                    </div>
                )}
            </div>

            <div className="tk-post-actions">
                <button type="button" onClick={() => onLike(post.id)} aria-pressed={!!userReacted}>
                    <ThumbsUp size={15} style={userReacted ? { fill: 'currentColor' } : undefined} />
                    {userReacted ? "Appreciated" : "Appreciate"}
                </button>
                <button type="button" onClick={() => onDiscuss(post)}><MessageCircle size={15} />Discuss</button>
                <button type="button" onClick={() => onCopyLink(post.id)}><Share2 size={15} />Share</button>
            </div>
        </article>
    );
}

function Composer({ user, companyRole, onPost, onClose }) {
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
            setTitle(""); setContent(""); setType("general"); onClose();
            showToast("Update posted", "success");
        } finally {
            setPosting(false);
        }
    };

    const userName = user?.name || user?.fullName || "You";

    return (
        <Panel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={userName} src={user?.avatar} size="lg" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{userName}</p>
                        <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', textTransform: 'capitalize', margin: 0 }}>Posting as {companyRole || 'member'}</p>
                    </div>
                    <IconBtn label="Close" onClick={onClose}><X size={16} /></IconBtn>
                </div>

                <div className="tk-tags" role="group" aria-label="Type of update">
                    {Object.entries(TYPE_META).map(([key, meta]) => (
                        <button key={key} type="button" className="tk-choice" aria-pressed={type === key} onClick={() => setType(key)}
                            style={{ minHeight: 30, padding: '4px 10px', fontSize: 12 }}>
                            {React.createElement(meta.Icon, { size: 13 })}{meta.label}
                        </button>
                    ))}
                </div>

                <Field label="Title" hint="Optional" htmlFor="update-title">
                    <input id="update-title" className="gl-input" type="text" placeholder="e.g. We shipped the new onboarding" value={title} onChange={e => setTitle(e.target.value)} />
                </Field>
                <Field label="Update" htmlFor="update-body">
                    <textarea id="update-body" className="gl-input" autoFocus placeholder="What would you like the company to know?" value={content} onChange={e => setContent(e.target.value)} rows={5} />
                </Field>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
                    <Btn variant="primary" icon={Send} loading={posting} disabled={!content.trim()} onClick={handlePost}>{posting ? "Posting…" : "Post update"}</Btn>
                </div>
            </div>
        </Panel>
    );
}

function FilterSidebar({ activeFilter, setActiveFilter, activeType, setActiveType, posts, currentUserId, subtitle }) {
    const counts = {
        all: posts.length,
        pinned: posts.filter(p => p.isPinned).length,
        mine: posts.filter(p => p.author.id === currentUserId).length,
    };

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

            <PanelSection label="Type">
                {TYPE_FILTERS.map(f => {
                    const meta = TYPE_META[f.key];
                    const cnt = f.key === "all" ? null : posts.filter(p => p.context?.toLowerCase() === f.key).length;
                    const isActiveType = activeType === f.key;
                    const Icon = meta ? meta.Icon : Zap;
                    return (
                        <button key={f.key} type="button" onClick={() => setActiveType(f.key)}
                            className={`gl-item${isActiveType ? ' is-active' : ''}`} aria-pressed={isActiveType}>
                            <Icon size={14} className="gl-x-item-icon" />
                            <span className="gl-x-item-title" style={{ fontSize: '12.5px' }}>{f.label}</span>
                            {cnt !== null && cnt > 0 && <span className="gl-count">{cnt}</span>}
                        </button>
                    );
                })}
            </PanelSection>
        </WorkspacePanel>
    );
}

function PostSkeleton() {
    return (
        <div className="gl-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 12 }}>
                <span className="cd-skel" style={{ width: 40, height: 40, borderRadius: '50%' }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
                    <span className="cd-skel" style={{ height: 10, width: '40%' }} />
                    <span className="cd-skel" style={{ height: 8, width: '25%' }} />
                </div>
            </div>
            <span className="cd-skel" style={{ height: 10, width: '80%' }} />
            <span className="cd-skel" style={{ height: 10, width: '95%' }} />
        </div>
    );
}

/** Company updates: news, wins and milestones posted by managers and above. */
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
    const [composing,    setComposing]    = useState(false);

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
        showToast("Link copied", "success");
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

    const filterLabel = SIDEBAR_FILTERS.find(f => f.key === activeFilter)?.label ?? "Updates";
    const filtering = search.trim() || activeFilter !== 'all' || activeType !== 'all';

    return (
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--bg-base)' }}>
            <div className="gl-x-tasks-side tk-updates-side">
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

            <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <DashPage
                    head={(
                        <PageHead
                            eyebrow={activeWorkspace?.name ? `${activeWorkspace.name} · Updates` : 'Updates'}
                            title={filterLabel}
                            icon={Megaphone}
                            lead="Company news, wins and milestones in one feed, so everyone knows what’s happening."
                            actions={(
                                <>
                                    <IconBtn label="Refresh feed" onClick={handleRefresh} disabled={refreshing || loading}>
                                        <RefreshCw size={14} className={(refreshing || loading) ? "cd-spin" : ""} />
                                    </IconBtn>
                                    {canPostUpdates && !composing && <Btn variant="primary" icon={PenSquare} onClick={() => setComposing(true)}>Post an update</Btn>}
                                </>
                            )}
                        />
                    )}
                >
                    <div className="tk-feed">
                        <Toolbar>
                            <SearchBox value={search} onChange={setSearch} placeholder="Search updates" label="Search updates" />
                            <span className="tk-narrow-only" style={{ display: 'contents' }}>
                                <FilterTabs value={activeFilter} onChange={setActiveFilter} label="Show"
                                    options={SIDEBAR_FILTERS.map(f => ({ value: f.key, label: f.label }))} />
                                <SelectBox value={activeType} onChange={setActiveType} label="Type">
                                    {TYPE_FILTERS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                                </SelectBox>
                            </span>
                            <span className="cd-hint">{filteredPosts.length} post{filteredPosts.length !== 1 ? "s" : ""}</span>
                        </Toolbar>

                        {composing && canPostUpdates && (
                            <Composer user={user} companyRole={companyRole} onPost={handlePost} onClose={() => setComposing(false)} />
                        )}

                        {!canPostUpdates && posts.length > 0 && (
                            <div className="tk-notice"><Lock size={14} />Only managers and above can post updates. You can still appreciate and discuss them.</div>
                        )}

                        {loading && filteredPosts.length === 0 && (
                            <>
                                <PostSkeleton />
                                <PostSkeleton />
                            </>
                        )}

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

                        {filteredPosts.length === 0 && !loading && (
                            <Panel>
                                {filtering ? (
                                    <EmptyState icon={Megaphone}
                                        title={search ? "No matching updates" : activeFilter === "pinned" ? "No pinned posts" : activeFilter === "mine" ? "You haven’t posted yet" : "Nothing of this type yet"}
                                        text={search ? "Try a different word." : activeFilter === "pinned" ? "Important posts that get pinned show up here." : "Try another filter."} />
                                ) : (
                                    <EmptyState icon={Megaphone} title="No updates yet"
                                        text={canPostUpdates
                                            ? "Share a win, a launch or a milestone so everyone knows what’s happening."
                                            : "When managers share news, wins or milestones, they show up here."}
                                        action={canPostUpdates && !composing ? <Btn variant="primary" icon={PenSquare} onClick={() => setComposing(true)}>Post the first update</Btn> : null} />
                                )}
                            </Panel>
                        )}
                    </div>
                </DashPage>
            </div>

            <Confirm
                open={Boolean(postToDelete)}
                title="Delete this post?"
                confirmLabel="Delete post"
                tone="danger"
                onConfirm={confirmDelete}
                onClose={() => setPostToDelete(null)}
            >
                The update is removed for everyone. This can’t be undone.
            </Confirm>
        </div>
    );
};

export default Updates;
