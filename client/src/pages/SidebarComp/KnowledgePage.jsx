import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Sparkles, Link2, ArrowLeft, Trash2, Save, Eye, Edit3,
    Network, Tag, Plus, X, Clock, ChevronRight, Loader2, BookOpen
} from 'lucide-react';
import { useKnowledge } from '../../hooks/useKnowledge';
import { useToast } from '../../contexts/ToastContext';

function MarkdownPreview({ content }) {
    const html = content
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/^### (.+)$/gm, '<h3 style="font-size:14px;font-weight:700;margin:16px 0 4px;color:#e4e4e4;font-family:Inter,system-ui,sans-serif">$1</h3>')
        .replace(/^## (.+)$/gm, '<h2 style="font-size:16px;font-weight:700;margin:20px 0 8px;color:#e4e4e4;font-family:Inter,system-ui,sans-serif">$1</h2>')
        .replace(/^# (.+)$/gm, '<h1 style="font-size:22px;font-weight:800;margin:24px 0 12px;color:#e4e4e4;font-family:Inter,system-ui,sans-serif">$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:700">$1</strong>')
        .replace(/\*(.+?)\*/g, '<em style="font-style:italic">$1</em>')
        .replace(/`(.+?)`/g, '<code style="padding:1px 6px;background:rgba(255,255,255,0.08);font-family:monospace;font-size:12px;color:#b8956a">$1</code>')
        .replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid rgba(184,149,106,0.4);padding-left:12px;color:rgba(228,228,228,0.55);font-style:italic;margin:8px 0">$1</blockquote>')
        .replace(/^- (.+)$/gm, '<li style="margin-left:16px;list-style:disc;color:rgba(228,228,228,0.8)">$1</li>')
        .replace(/^(\d+)\. (.+)$/gm, '<li style="margin-left:16px;list-style:decimal;color:rgba(228,228,228,0.8)">$2</li>')
        .replace(/\n\n/g, '</p><p style="margin-bottom:12px;color:rgba(228,228,228,0.8);font-family:Inter,system-ui,sans-serif;font-size:14px;line-height:1.7">')
        .replace(/\n/g, '<br/>');
    return (
        <div
            style={{ lineHeight: 1.7, fontFamily: 'Inter, system-ui, sans-serif', fontSize: '14px', color: 'var(--text-muted)' }}
            dangerouslySetInnerHTML={{ __html: `<p style="margin-bottom:12px;color:rgba(228,228,228,0.8);font-family:Inter,system-ui,sans-serif;font-size:14px;line-height:1.7">${html}</p>` }}
        />
    );
}

function LinkPageModal({ workspaceId, currentPageId, onLink, onClose, allPages }) {
    const [search, setSearch] = useState('');
    const options = allPages.filter(p => p._id !== currentPageId && (!search || p.title.toLowerCase().includes(search.toLowerCase())));
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
            <div style={{ background: 'var(--bg-hover)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 80px rgba(0,0,0,0.7)', width: '100%', maxWidth: '360px', margin: '0 16px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Inter, system-ui, sans-serif' }}>Link a Page</h3>
                </div>
                <div style={{ padding: '14px 18px' }}>
                    <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search pages..."
                        style={{ width: '100%', padding: '8px 12px', fontSize: '12px', background: '#111', border: '1px solid var(--border-default)', color: 'var(--text-primary)', outline: 'none', marginBottom: '10px', boxSizing: 'border-box', fontFamily: 'Inter, system-ui, sans-serif', colorScheme: 'dark' }}
                        onFocus={e => e.target.style.borderColor = 'rgba(184,149,106,0.4)'}
                        onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                    />
                    <div style={{ maxHeight: '210px', overflowY: 'auto' }}>
                        {options.length === 0 && <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0', fontFamily: 'monospace' }}>No pages found</p>}
                        {options.map(p => (
                            <button key={p._id} onClick={() => onLink(p._id)}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', textAlign: 'left', fontSize: '12px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'background 150ms ease', fontFamily: 'Inter, system-ui, sans-serif' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <span>{p.icon || '📄'}</span> {p.title}
                            </button>
                        ))}
                    </div>
                </div>
                <div style={{ padding: '10px 18px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={onClose}
                        style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'color 150ms ease', fontFamily: 'Inter, system-ui, sans-serif' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#e4e4e4'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.45)'}
                    >Cancel</button>
                </div>
            </div>
        </div>
    );
}

function HandbookView({ pages, workspaceId, navigate, onCreate, creating }) {
    const handbookPages = pages.filter(p => p.isHandbook);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)' }}>
            <div style={{ height: '52px', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
                <h1 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>📘</span> Company Handbook
                </h1>
                <button
                    onClick={onCreate}
                    disabled={creating}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', background: '#b8956a', border: 'none', color: '#0c0c0c', fontSize: '11px', fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.6 : 1, fontFamily: 'Inter,system-ui,sans-serif', transition: 'opacity 150ms ease' }}
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
                        <button onClick={onCreate} disabled={creating} style={{ padding: '7px 20px', background: '#b8956a', border: 'none', color: '#0c0c0c', fontSize: '13px', fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.6 : 1, fontFamily: 'Inter,system-ui,sans-serif' }}>
                            {creating ? 'Creating…' : 'Create first handbook page'}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {handbookPages.map(p => (
                            <button
                                key={p._id}
                                onClick={() => navigate(`/workspace/${workspaceId}/knowledge/${p._id}`)}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', cursor: 'pointer', textAlign: 'left', transition: 'border-color 150ms ease' }} onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(184,149,106,0.3)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
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

function EmptyKnowledge({ onCreate, loading }) {
    return (
        <div className="flex flex-col items-center justify-center h-full py-20">
            <BookOpen size={56} className="text-gray-200 dark:text-gray-700 mb-4" />
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">Knowledge Base</h2>
            <p className="text-sm text-gray-400 mb-6 text-center max-w-xs">Create pages, link ideas, and let AI summarize your team's knowledge.</p>
            {loading ? (
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            ) : (
                <button onClick={onCreate} style={{ padding: '8px 24px', background: '#b8956a', border: 'none', color: '#0c0c0c', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,system-ui,sans-serif' }}>
                    Create first page
                </button>
            )}
        </div>
    );
}

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
    const [viewMode, setViewMode] = useState('edit'); 
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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)' }}>
            {}
            <div className="h-14 px-6 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 shrink-0">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{pageData.icon || '📄'}</span>
                    <div className="flex items-center gap-1.5">
                        {}
                        <button
                            onClick={() => setViewMode(v => v === 'edit' ? 'preview' : 'edit')}
                            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', fontSize: '11px', fontWeight: 600, background: viewMode === 'preview' ? 'rgba(184,149,106,0.1)' : 'transparent', border: `1px solid ${viewMode === 'preview' ? 'rgba(184,149,106,0.25)' : 'transparent'}`, color: viewMode === 'preview' ? '#b8956a' : 'rgba(228,228,228,0.4)', cursor: 'pointer', fontFamily: 'Inter,system-ui,sans-serif', transition: 'all 150ms ease' }}
                        >
                            {viewMode === 'edit' ? <Eye size={13} /> : <Edit3 size={13} />}
                            {viewMode === 'edit' ? 'Preview' : 'Edit'}
                        </button>

                        {}
                        <button
                            onClick={handleSummarize}
                            disabled={summarizing}
                            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', fontSize: '11px', fontWeight: 700, background: '#b8956a', border: 'none', color: '#0c0c0c', cursor: 'pointer', fontFamily: 'Inter,system-ui,sans-serif', opacity: 1, transition: 'opacity 150ms ease' }} onMouseEnter={e => e.currentTarget.style.opacity = '0.85'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                        >
                            {summarizing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                            AI Summary
                        </button>

                        {}
                        <button
                            onClick={() => setShowLinkModal(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Inter,system-ui,sans-serif' }} onMouseEnter={e => e.currentTarget.style.color = '#b8956a'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.4)'}
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

            {}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-10 py-8">
                    {}
                    <input
                        type="text"
                        value={title}
                        onChange={handleTitleChange}
                        placeholder="Untitled Page"
                        style={{
                            fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)',
                            border: 'none', outline: 'none', padding: 0, marginBottom: '12px',
                            width: '100%', background: 'transparent', fontFamily: 'Inter, system-ui, sans-serif',
                            lineHeight: 1.15,
                        }}
                        className="placeholder-gray-700"
                    />

                    {}
                    <div className="flex flex-wrap items-center gap-2 mb-6 min-h-[28px]">
                        {tags.map(tag => (
                            <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '1px 8px', background: 'rgba(184,149,106,0.1)', border: '1px solid rgba(184,149,106,0.22)', color: '#b8956a', fontSize: '11px', fontWeight: 500, fontFamily: 'Inter,system-ui,sans-serif' }}>
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
                                style={{ padding: '3px 10px', border: '1px solid rgba(184,149,106,0.35)', background: 'rgba(184,149,106,0.08)', color: '#b8956a', fontSize: '11px', fontFamily: 'monospace', outline: 'none', width: '112px', colorScheme: 'dark' }}
                                onFocus={e => e.target.style.borderColor = 'rgba(184,149,106,0.6)'}
                            />
                        ) : (
                            <button onClick={() => setShowTagInput(true)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', fontSize: '11px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'color 150ms ease', fontFamily: 'monospace' }}
                                onMouseEnter={e => e.currentTarget.style.color = '#b8956a'}
                                onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.3)'}
                            >
                                <Tag size={10} /><Plus size={9} /> tag
                            </button>
                        )}
                    </div>

                    {}
                    {summary && (
                        <div style={{ marginBottom: '24px', padding: '14px', background: 'rgba(184,149,106,0.06)', border: '1px solid rgba(184,149,106,0.15)' }}>
                            <div className="flex items-center gap-1.5 mb-2">
                                <Sparkles size={13} className="text-violet-600 dark:text-violet-400" />
                                <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">AI Summary</span>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{summary}</p>
                        </div>
                    )}

                    {}
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

                    {}
                    {viewMode === 'edit' && (
                        <p className="text-xs text-gray-300 dark:text-gray-600 mt-4">
                            Supports Markdown: <code className="font-mono"># H1</code> <code className="font-mono">**bold**</code> <code className="font-mono">*italic*</code> <code className="font-mono">`code`</code> <code className="font-mono">&gt; quote</code>
                        </p>
                    )}

                    {}
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
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--bg-hover)', border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', width: '100%', textAlign: 'left', transition: 'background 150ms ease', marginBottom: '6px' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                        onMouseLeave={e => e.currentTarget.style.background = '#161616'}
                                    >
                                        <span style={{ fontSize: '13px' }}>{bl.icon || '📄'}</span>
                                        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, sans-serif' }}>{bl.title}</span>
                                        <ChevronRight size={11} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {}
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
