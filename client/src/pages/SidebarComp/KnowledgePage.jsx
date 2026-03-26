// client/src/pages/SidebarComp/KnowledgePage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Sparkles, Link2, ArrowLeft, Trash2, Save, Eye, Edit3,
    Network, Tag, Plus, X, Clock, ChevronRight, Loader2, BookOpen
} from 'lucide-react';
import { useKnowledge } from '../../hooks/useKnowledge';
import { useToast } from '../../contexts/ToastContext';

// ── Simple markdown preview renderer ─────────────────────────────────────────
function MarkdownPreview({ content }) {
    const html = content
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold mt-4 mb-1 text-gray-900 dark:text-white">$1</h3>')
        .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-5 mb-2 text-gray-900 dark:text-white">$1</h2>')
        .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-3 text-gray-900 dark:text-white">$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>')
        .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
        .replace(/`(.+?)`/g, '<code class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-mono text-sm text-rose-600 dark:text-rose-400">$1</code>')
        .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-indigo-400 pl-4 text-gray-600 dark:text-gray-400 italic my-2">$1</blockquote>')
        .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-gray-700 dark:text-gray-300">$1</li>')
        .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal text-gray-700 dark:text-gray-300">$2</li>')
        .replace(/\n\n/g, '</p><p class="mb-3 text-gray-700 dark:text-gray-300">')
        .replace(/\n/g, '<br/>');
    return (
        <div
            className="prose prose-sm max-w-none leading-relaxed"
            dangerouslySetInnerHTML={{ __html: `<p class="mb-3 text-gray-700 dark:text-gray-300">${html}</p>` }}
        />
    );
}

// ── Link page modal ───────────────────────────────────────────────────────────
function LinkPageModal({ workspaceId, currentPageId, onLink, onClose, allPages }) {
    const [search, setSearch] = useState('');
    const options = allPages.filter(p => p._id !== currentPageId && (!search || p.title.toLowerCase().includes(search.toLowerCase())));
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Link a Page</h3>
                </div>
                <div className="p-4">
                    <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search pages..." className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg border-none outline-none text-gray-800 dark:text-gray-200 mb-3" />
                    <div className="space-y-1 max-h-52 overflow-y-auto">
                        {options.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No pages found</p>}
                        {options.map(p => (
                            <button key={p._id} onClick={() => onLink(p._id)} className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
                                <span>{p.icon || '📄'}</span> {p.title}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                    <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Cancel</button>
                </div>
            </div>
        </div>
    );
}

// ── Handbook section view ────────────────────────────────────────────────────
function HandbookView({ pages, workspaceId, navigate, onCreate, creating }) {
    const handbookPages = pages.filter(p => p.isHandbook);
    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900">
            <div className="h-14 px-6 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 shrink-0">
                <h1 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span className="text-lg">📘</span> Company Handbook
                </h1>
                <button
                    onClick={onCreate}
                    disabled={creating}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
                >
                    {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                    New handbook page
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
                {handbookPages.length === 0 ? (
                    <div className="flex flex-col items-center py-16">
                        <span className="text-5xl mb-4">📘</span>
                        <p className="text-gray-400 text-sm mb-4 text-center max-w-xs">No handbook pages yet. Create the first page to start documenting your company processes.</p>
                        <button onClick={onCreate} disabled={creating} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors">
                            {creating ? 'Creating…' : 'Create first handbook page'}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {handbookPages.map(p => (
                            <button
                                key={p._id}
                                onClick={() => navigate(`/workspace/${workspaceId}/knowledge/${p._id}`)}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-all text-left group"
                            >
                                <span className="text-xl">{p.icon || '📄'}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{p.title}</p>
                                    {p.tags?.length > 0 && (
                                        <p className="text-[10px] text-gray-400 mt-0.5">{p.tags.map(t => `#${t}`).join(' ')}</p>
                                    )}
                                </div>
                                <ChevronRight size={14} className="text-gray-300 group-hover:text-indigo-400 shrink-0 transition-colors" />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyKnowledge({ onCreate, loading }) {
    return (
        <div className="flex flex-col items-center justify-center h-full py-20">
            <BookOpen size={56} className="text-gray-200 dark:text-gray-700 mb-4" />
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">Knowledge Base</h2>
            <p className="text-sm text-gray-400 mb-6 text-center max-w-xs">Create pages, link ideas, and let AI summarize your team's knowledge.</p>
            {loading ? (
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            ) : (
                <button onClick={onCreate} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-md">
                    Create first page
                </button>
            )}
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────
const KnowledgePage = () => {
    const { workspaceId, id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { pages, loading, listPages, createPage, getPage, updatePage, deletePage, linkPages, getBacklinks, generateSummary: summarizePage } = useKnowledge();

    const [pageData, setPageData] = useState(null);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [tags, setTags] = useState([]);
    const [tagInput, setTagInput] = useState('');
    const [showTagInput, setShowTagInput] = useState(false);
    const [viewMode, setViewMode] = useState('edit'); // 'edit' | 'preview'
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [backlinks, setBacklinks] = useState([]);
    const [summary, setSummary] = useState('');
    const [summarizing, setSummarizing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [creating, setCreating] = useState(false);
    const saveTimer = useRef(null);

    useEffect(() => {
        if (workspaceId) listPages(workspaceId);
    }, [workspaceId, listPages]);

    useEffect(() => {
        if (!id) { setPageData(null); return; }
        getPage(id).then(p => {
            setPageData(p);
            setTitle(p.title || '');
            setContent(p.content || '');
            setTags(p.tags || []);
            setSummary(p.summary || '');
        }).catch(() => showToast('Page not found', 'error'));
    }, [id, getPage, showToast]);

    useEffect(() => {
        if (id) {
            getBacklinks(id).then(setBacklinks).catch(() => { });
        }
    }, [id, getBacklinks]);

    // Debounced auto-save
    const autoSave = useCallback((newTitle, newContent, newTags) => {
        if (!id) return;
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
            setSaving(true);
            await updatePage(id, { title: newTitle, content: newContent, tags: newTags }).catch(() => { });
            setSaving(false);
        }, 1200);
    }, [id, updatePage]);

    const handleTitleChange = (e) => {
        setTitle(e.target.value);
        autoSave(e.target.value, content, tags);
    };

    const handleContentChange = (e) => {
        setContent(e.target.value);
        autoSave(title, e.target.value, tags);
    };

    const addTag = () => {
        const t = tagInput.trim().replace(/^#/, '').toLowerCase();
        if (t && !tags.includes(t)) {
            const newTags = [...tags, t];
            setTags(newTags);
            autoSave(title, content, newTags);
        }
        setTagInput('');
        setShowTagInput(false);
    };

    const removeTag = (tag) => {
        const newTags = tags.filter(t => t !== tag);
        setTags(newTags);
        autoSave(title, content, newTags);
    };

    const handleCreate = async () => {
        setCreating(true);
        try {
            const p = await createPage(workspaceId, { title: 'Untitled Page', content: '' });
            navigate(`/workspace/${workspaceId}/knowledge/${p._id}`);
        } finally { setCreating(false); }
    };

    const handleDelete = async () => {
        if (!window.confirm('Delete this page?')) return;
        await deletePage(id);
        showToast('Page deleted', 'success');
        navigate(`/workspace/${workspaceId}/knowledge`);
    };

    const handleSummarize = async () => {
        setSummarizing(true);
        try {
            const s = await summarizePage(id);
            setSummary(s);
            showToast('Summary generated', 'success');
        } catch { showToast('Summary failed', 'error'); }
        finally { setSummarizing(false); }
    };

    const handleLink = async (toPageId) => {
        try {
            await linkPages(id, toPageId, workspaceId);
            showToast('Pages linked', 'success');
        } catch { showToast('Link failed', 'error'); }
        setShowLinkModal(false);
    };

    // ── Render ────────────────────────────────────────────────────────────────
    // Handbook virtual route — no real page ID
    if (id === 'handbook') {
        const handleCreateHandbook = async () => {
            setCreating(true);
            try {
                const p = await createPage(workspaceId, { title: 'Untitled Handbook Page', content: '', isHandbook: true });
                navigate(`/workspace/${workspaceId}/knowledge/${p._id}`);
            } finally { setCreating(false); }
        };
        return (
            <HandbookView
                pages={pages}
                workspaceId={workspaceId}
                navigate={navigate}
                onCreate={handleCreateHandbook}
                creating={creating}
            />
        );
    }

    if (!id && !loading) {
        return <EmptyKnowledge onCreate={handleCreate} loading={creating} />;
    }

    if (!pageData && loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!pageData) return null;

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900">
            {/* Toolbar */}
            <div className="h-14 px-6 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 shrink-0">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{pageData.icon || '📄'}</span>
                    <div className="flex items-center gap-1.5">
                        {/* Edit / Preview toggle */}
                        <button
                            onClick={() => setViewMode(v => v === 'edit' ? 'preview' : 'edit')}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewMode === 'preview' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                        >
                            {viewMode === 'edit' ? <Eye size={13} /> : <Edit3 size={13} />}
                            {viewMode === 'edit' ? 'Preview' : 'Edit'}
                        </button>

                        {/* AI Summarize */}
                        <button
                            onClick={handleSummarize}
                            disabled={summarizing}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm hover:shadow-md transition-all disabled:opacity-60"
                        >
                            {summarizing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                            AI Summary
                        </button>

                        {/* Link */}
                        <button
                            onClick={() => setShowLinkModal(true)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                        >
                            <Link2 size={13} /> Link page
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {saving && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Loader2 size={11} className="animate-spin" /> Saving…
                        </span>
                    )}
                    <button
                        onClick={handleDelete}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                        <Trash2 size={15} />
                    </button>
                </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-10 py-8">
                    {/* Title */}
                    <input
                        type="text"
                        value={title}
                        onChange={handleTitleChange}
                        placeholder="Untitled Page"
                        className="text-4xl font-bold text-gray-900 dark:text-white placeholder-gray-200 dark:placeholder-gray-700 border-none focus:ring-0 p-0 mb-3 w-full bg-transparent outline-none"
                    />

                    {/* Tags */}
                    <div className="flex flex-wrap items-center gap-2 mb-6 min-h-[28px]">
                        {tags.map(tag => (
                            <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-medium">
                                #{tag}
                                <button onClick={() => removeTag(tag)} className="ml-0.5 hover:text-red-500 transition-colors"><X size={10} /></button>
                            </span>
                        ))}
                        {showTagInput ? (
                            <input
                                autoFocus
                                value={tagInput}
                                onChange={e => setTagInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') addTag(); if (e.key === 'Escape') { setShowTagInput(false); setTagInput(''); } }}
                                onBlur={addTag}
                                placeholder="tag name…"
                                className="px-2 py-0.5 border border-indigo-300 dark:border-indigo-600 rounded-full text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 outline-none focus:ring-1 focus:ring-indigo-400 w-28"
                            />
                        ) : (
                            <button onClick={() => setShowTagInput(true)} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-full transition-colors">
                                <Tag size={10} /><Plus size={9} /> tag
                            </button>
                        )}
                    </div>

                    {/* AI Summary box */}
                    {summary && (
                        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/10 dark:to-indigo-900/10 border border-violet-200 dark:border-violet-800">
                            <div className="flex items-center gap-1.5 mb-2">
                                <Sparkles size={13} className="text-violet-600 dark:text-violet-400" />
                                <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">AI Summary</span>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{summary}</p>
                        </div>
                    )}

                    {/* Editor / Preview */}
                    {viewMode === 'edit' ? (
                        <textarea
                            value={content}
                            onChange={handleContentChange}
                            placeholder="Start typing… Use Markdown: # Heading, **bold**, *italic*, - list item, > quote"
                            className="w-full min-h-[400px] text-sm text-gray-800 dark:text-gray-200 bg-transparent border-none outline-none resize-none leading-relaxed placeholder-gray-300 dark:placeholder-gray-600"
                        />
                    ) : (
                        <div className="min-h-[400px]">
                            {content ? <MarkdownPreview content={content} /> : (
                                <p className="text-gray-300 dark:text-gray-600 text-sm">Nothing to preview yet.</p>
                            )}
                        </div>
                    )}

                    {/* Markdown hint */}
                    {viewMode === 'edit' && (
                        <p className="text-xs text-gray-300 dark:text-gray-600 mt-4">
                            Supports Markdown: <code className="font-mono"># H1</code> <code className="font-mono">**bold**</code> <code className="font-mono">*italic*</code> <code className="font-mono">`code`</code> <code className="font-mono">&gt; quote</code>
                        </p>
                    )}

                    {/* Backlinks */}
                    {backlinks.length > 0 && (
                        <div className="mt-10 pt-6 border-t border-gray-100 dark:border-gray-800">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <Link2 size={11} /> Linked from {backlinks.length} page{backlinks.length > 1 ? 's' : ''}
                            </h3>
                            <div className="space-y-2">
                                {backlinks.map(bl => (
                                    <button
                                        key={bl._id}
                                        onClick={() => navigate(`/workspace/${workspaceId}/knowledge/${bl._id}`)}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors w-full text-left"
                                    >
                                        <span className="text-sm">{bl.icon || '📄'}</span>
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{bl.title}</span>
                                        <ChevronRight size={13} className="ml-auto text-gray-400" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Link modal */}
            {showLinkModal && (
                <LinkPageModal
                    workspaceId={workspaceId}
                    currentPageId={id}
                    allPages={pages}
                    onLink={handleLink}
                    onClose={() => setShowLinkModal(false)}
                />
            )}
        </div>
    );
};

export default KnowledgePage;
