import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
    Sparkles, Link2, Trash2, Tag, Plus, X, ChevronRight, ChevronLeft, Loader2, BookOpen, Book, FileText,
    Network, Check, Users, Workflow, GraduationCap, Folder, Upload,
} from 'lucide-react';
import { useKnowledge } from '../../hooks/useKnowledge';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useToast } from '../../contexts/ToastContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import {
    DashPage, PageHead, Section, Panel, Toolbar, SearchBox, FilterTabs, Btn, IconBtn, Chip, Grid,
    LoadingState, EmptyState, ErrorState, Dialog, Confirm, SelectBox, timeAgo,
} from '../../components/ui/page';
import { IMPORT_ACCEPT, readImportFiles } from './knowledgeImport';
import KnowledgeCategoriesDialog, { KB_CATEGORY_CSS, categoryErrorMessage } from './KnowledgeCategoriesDialog';
import { UNCATEGORISED, catKey, filterByCategory, countByCategory } from './knowledgeCategories';
import useCollabDoc from '../../lib/collab/useCollabDoc';
import CollabPresence, { PeerMarks } from '../../lib/collab/CollabPresence';
import { applyTextDiff, transformIndexByDelta } from '../../lib/collab/textDiff';
import { LOCAL_ORIGIN } from '../../lib/collab/noteBlocks';

/** Other knowledge views (side panel, list) reload when a page is created, renamed or deleted. */
const KNOWLEDGE_CHANGED = 'oruinwan:knowledge-changed';
const announceChange = () => window.dispatchEvent(new Event(KNOWLEDGE_CHANGED));

/** A page's own emoji, or a plain document mark when it still has the default one. */
function PageMark({ icon, size = 15 }) {
    if (icon && icon !== '📄') return <span aria-hidden="true" style={{ fontSize: size, lineHeight: 1 }}>{icon}</span>;
    return <FileText size={size} style={{ color: 'var(--accent)' }} aria-hidden="true" />;
}

// Starter pages: each one is created with real headings so the team only fills in the blanks.
const TEMPLATES = [
    {
        Icon: Users, title: 'Team handbook', text: 'Who does what, how to reach each other and the tools you use.',
        content: '# Team handbook\n\n## Who we are\nOne paragraph on what this team does and why.\n\n## People and roles\n- Name: role, what to ask them about\n\n## How to reach us\n- Urgent: \n- Everything else: \n\n## Tools we use\n- ',
        tags: ['handbook'],
    },
    {
        Icon: Workflow, title: 'How we work', text: 'Your process for planning, reviews and shipping, in one place.',
        content: '# How we work\n\n## Planning\nWhen we plan and who joins.\n\n## Doing the work\n- How tasks are picked up\n- Where updates go\n\n## Reviews\nWhat a good review looks like.\n\n## Shipping\n1. Checklist step\n2. Checklist step',
        tags: ['process'],
    },
    {
        Icon: GraduationCap, title: 'Onboarding guide', text: 'Everything a new teammate needs in their first week.',
        content: '# Onboarding guide\n\n> Welcome! Start here on your first day.\n\n## Day one\n- Get access to: \n- Meet: \n\n## First week\n- Read: \n- Ship a small change\n\n## Who to ask\n- ',
        tags: ['onboarding'],
    },
];

function MarkdownPreview({ content }) {
    const html = content
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
        .replace(/^- (.+)$/gm, '<li class="kb-ul">$1</li>')
        .replace(/^(\d+)\. (.+)$/gm, '<li class="kb-ol">$2</li>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br/>');
    return <div className="kb-md" dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }} />;
}

/** One clickable page row inside a <Panel flush>. */
function PageRow({ page, first, onOpen, meta, categoryName }) {
    return (
        <li style={{ borderTop: first ? 'none' : '1px solid var(--border-subtle)' }}>
            <button type="button" className="kb-row" onClick={onOpen}>
                <span className="gl-empty-mark" style={{ margin: 0 }}><PageMark icon={page.icon} size={16} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <strong className="kb-row-title">{page.title || 'Untitled page'}</strong>
                        {categoryName && <Chip tone="accent"><Folder size={10} style={{ marginRight: 3, verticalAlign: '-1px' }} />{categoryName}</Chip>}
                        {(page.tags || []).slice(0, 3).map((t) => <Chip key={t}>#{t}</Chip>)}
                    </span>
                    {meta && <span className="kb-row-meta">{meta}</span>}
                </span>
                <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </button>
        </li>
    );
}

function LinkPageModal({ currentPageId, onLink, onClose, allPages }) {
    const [search, setSearch] = useState('');
    const options = allPages.filter(p => p._id !== currentPageId && (!search || p.title.toLowerCase().includes(search.toLowerCase())));
    return (
        <Dialog open title="Link a page" lead="The page you pick shows this one under “Linked from”." onClose={onClose}
            footer={<Btn variant="ghost" onClick={onClose}>Cancel</Btn>}>
            <SearchBox value={search} onChange={setSearch} placeholder="Find a page" label="Find a page" />
            <div className="gl-card" style={{ marginTop: 10, maxHeight: 260, overflowY: 'auto', padding: 0 }}>
                {options.length === 0 ? (
                    <EmptyState icon={FileText} title={search ? 'No pages match' : 'No other pages yet'}
                        text={search ? 'Try a different title.' : 'Create another page first, then link the two.'} />
                ) : (
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                        {options.map((p, i) => (
                            <PageRow key={p._id} page={p} first={i === 0} onOpen={() => onLink(p._id)} />
                        ))}
                    </ul>
                )}
            </div>
        </Dialog>
    );
}

const pageMeta = (p, childCount) => [
    p.updatedAt ? `Updated ${timeAgo(p.updatedAt)}` : null,
    p.createdBy?.username ? `by ${p.createdBy.username}` : null,
    childCount ? `${childCount} sub-page${childCount === 1 ? '' : 's'}` : null,
].filter(Boolean).join(' · ');

/** First visit: what Knowledge is for and three ways to start (write, import, organise). */
function KnowledgeWelcome({ onCreate, onImport, onManageCategories, creating, importing, categoryCount }) {
    return (
        <Panel className="kb-welcome">
            <EmptyState
                icon={BookOpen}
                title="Start your team’s knowledge base"
                text="Knowledge is where the answers live: how you work, decisions you made, onboarding and the handbook. Write it once, link pages together and find it from search or Oruinwan AI."
                action={(
                    <div className="kb-welcome-actions">
                        <Btn variant="primary" icon={Plus} loading={creating} disabled={importing} onClick={onCreate}>Write a page</Btn>
                        <Btn icon={Upload} loading={importing} disabled={creating} onClick={onImport}>Import Markdown or text</Btn>
                        <Btn variant="ghost" icon={Folder} onClick={onManageCategories}>{categoryCount ? `Categories (${categoryCount})` : 'Set up categories'}</Btn>
                    </div>
                )}
            />
            <ul className="kb-welcome-steps" aria-label="How Knowledge works">
                <li><FileText size={14} aria-hidden="true" /><span><strong>Pages</strong> are written in Markdown and save as you type. Teammates can edit together live.</span></li>
                <li><Folder size={14} aria-hidden="true" /><span><strong>Categories</strong> group pages, like Engineering, People or Sales.</span></li>
                <li><Link2 size={14} aria-hidden="true" /><span><strong>Links</strong> between pages build the knowledge graph, so nothing gets lost.</span></li>
            </ul>
        </Panel>
    );
}

function KnowledgeHome({ pages, loading, loaded = true, error, onRetry, wsName, onCreate, onCreateTemplate, onImport, creating, importing, openPage, openGraph, openHandbook, categories = [], category = '', setCategory, onManageCategories }) {
    const [query, setQuery] = useState('');
    const catCounts = useMemo(() => countByCategory(pages), [pages]);
    const catNames = useMemo(() => Object.fromEntries(categories.map((c) => [String(c._id), c.name])), [categories]);
    const activeCat = category && category !== UNCATEGORISED ? categories.find((c) => String(c._id) === category) : null;
    const childCounts = useMemo(() => {
        const m = {};
        pages.forEach((p) => { if (p.parentId) m[String(p.parentId)] = (m[String(p.parentId)] || 0) + 1; });
        return m;
    }, [pages]);
    const handbookCount = pages.filter(p => p.isHandbook).length;
    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return [...filterByCategory(pages, category)]
            .filter(p => !q || `${p.title} ${(p.tags || []).join(' ')}`.toLowerCase().includes(q))
            .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    }, [pages, query, category]);
    const hasAny = pages.length > 0;

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow={wsName ? `${wsName} · Knowledge` : 'Knowledge'}
                    title="Knowledge"
                    icon={BookOpen}
                    lead="Your team’s shared pages: how you work, what you decided and where things live."
                    actions={hasAny && (
                        <>
                            <Btn variant="ghost" icon={Folder} onClick={onManageCategories}>Categories</Btn>
                            <Btn variant="ghost" icon={Network} onClick={openGraph}>Graph</Btn>
                            <Btn variant="ghost" icon={Upload} loading={importing} onClick={onImport}>Import</Btn>
                            <Btn variant="primary" icon={Plus} loading={creating} onClick={onCreate}>New page</Btn>
                        </>
                    )}
                />
            )}
        >
            {!hasAny && (loading || !loaded) ? (
                <LoadingState label="Loading pages…" />
            ) : !hasAny && error ? (
                <Panel>
                    <ErrorState title="Couldn’t load the knowledge base" message={error} onRetry={onRetry} />
                </Panel>
            ) : !hasAny ? (
                <>
                    <KnowledgeWelcome
                        onCreate={onCreate}
                        onImport={onImport}
                        onManageCategories={onManageCategories}
                        creating={creating}
                        importing={importing}
                        categoryCount={categories.length}
                    />
                    <TemplateCards onPick={onCreateTemplate} creating={creating} />
                </>
            ) : (
                <>
                    <Toolbar>
                        <SearchBox value={query} onChange={setQuery} placeholder="Find a page or #tag" label="Find a page" />
                        {categories.length > 0 && (
                            <FilterTabs value={category} onChange={setCategory} label="Category" options={[
                                { value: '', label: 'All', count: pages.length },
                                ...categories.map((c) => ({ value: String(c._id), label: c.name, count: catCounts[String(c._id)] || 0 })),
                                ...(catCounts[UNCATEGORISED] ? [{ value: UNCATEGORISED, label: 'No category', count: catCounts[UNCATEGORISED] }] : []),
                            ]} />
                        )}
                    </Toolbar>
                    <Section
                        title={activeCat ? activeCat.name : category === UNCATEGORISED ? 'Pages without a category' : 'All pages'}
                        lead="Most recently updated first."
                    >
                        <Panel flush>
                            {shown.length === 0 ? (
                                activeCat && !query.trim()
                                    ? <EmptyState icon={Folder} title={`No pages in ${activeCat.name} yet`} text="Open a page and choose this category from its Category menu." />
                                    : <EmptyState title="No pages match" text="Try a different title or tag." />
                            ) : (
                                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                                    {shown.map((p, i) => (
                                        <PageRow key={p._id} page={p} first={i === 0} onOpen={() => openPage(p._id)} meta={pageMeta(p, childCounts[String(p._id)])} categoryName={!category && p.categoryId ? catNames[catKey(p)] : null} />
                                    ))}
                                </ul>
                            )}
                        </Panel>
                    </Section>
                    <Section title="More places">
                        <Grid min={240}>
                            <button type="button" className="gl-card gl-card--interactive kb-card" onClick={openHandbook}>
                                <span className="gl-empty-mark" style={{ marginBottom: 0 }}><Book size={16} /></span>
                                <strong>Company handbook</strong>
                                <span>{handbookCount ? `${handbookCount} page${handbookCount === 1 ? '' : 's'} on policies and processes.` : 'Policies and processes everyone should know.'}</span>
                            </button>
                            <button type="button" className="gl-card gl-card--interactive kb-card" onClick={openGraph}>
                                <span className="gl-empty-mark" style={{ marginBottom: 0 }}><Network size={16} /></span>
                                <strong>Knowledge graph</strong>
                                <span>See how pages link to each other and spot the ones nothing points to.</span>
                            </button>
                        </Grid>
                    </Section>
                </>
            )}
            <KbStyles />
        </DashPage>
    );
}

function TemplateCards({ onPick, creating }) {
    return (
        <Section title="Start from a template" lead="Each one creates a page with the headings already in place.">
            <Grid min={220}>
                {TEMPLATES.map((t) => (
                    <button key={t.title} type="button" className="gl-card gl-card--interactive kb-card" disabled={creating} onClick={() => onPick(t)}>
                        <span className="gl-empty-mark" style={{ marginBottom: 0 }}><t.Icon size={16} /></span>
                        <strong>{t.title}</strong>
                        <span>{t.text}</span>
                    </button>
                ))}
            </Grid>
        </Section>
    );
}

function HandbookView({ pages, loading, wsName, openPage, onCreate, creating }) {
    const handbookPages = pages.filter(p => p.isHandbook);
    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow={wsName ? `${wsName} · Knowledge` : 'Knowledge'}
                    title="Company handbook"
                    icon={Book}
                    lead="Policies, processes and answers everyone in the workspace should be able to find."
                    actions={handbookPages.length > 0 && <Btn variant="primary" icon={Plus} loading={creating} onClick={onCreate}>New handbook page</Btn>}
                />
            )}
        >
            {loading && !pages.length ? (
                <LoadingState label="Loading the handbook…" />
            ) : (
                <Panel flush>
                    {handbookPages.length === 0 ? (
                        <EmptyState
                            icon={Book}
                            title="No handbook pages yet"
                            text="Start with the questions new people ask most: time off, expenses, who to ask for what."
                            action={<Btn variant="primary" icon={Plus} loading={creating} onClick={onCreate}>Write the first handbook page</Btn>}
                        />
                    ) : (
                        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                            {handbookPages.map((p, i) => (
                                <PageRow key={p._id} page={p} first={i === 0} onOpen={() => openPage(p._id)} meta={pageMeta(p)} />
                            ))}
                        </ul>
                    )}
                </Panel>
            )}
            <KbStyles />
        </DashPage>
    );
}

const NEW_CATEGORY = '__manage__';

const KnowledgePage = () => {
    const isPhone = useIsMobile(); // phones already show the shell's Back button
    const { workspaceId, id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { activeWorkspace } = useWorkspace();
    const wsName = activeWorkspace?.name;
    const {
        pages, loading, loaded, error: listError, listPages, createPage, getPage, updatePage, deletePage, linkPages, getBacklinks, summarizePage,
        categories, listCategories, createCategory, updateCategory, deleteCategory,
    } = useKnowledge();
    const [searchParams, setSearchParams] = useSearchParams();
    const category = searchParams.get('category') || '';
    const setCategory = useCallback((v) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (v) next.set('category', v); else next.delete('category');
            return next;
        }, { replace: true });
    }, [setSearchParams]);
    const [manageCats, setManageCats] = useState(false);
    const [pageCategory, setPageCategory] = useState('');

    const [pageData, setPageData] = useState(null);
    const [pageError, setPageError] = useState(false);
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
    const [savedOnce, setSavedOnce] = useState(false);
    const [creating, setCreating] = useState(false);
    const [importing, setImporting] = useState(false);
    const importRef = useRef(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const saveTimer = useRef(null);
    const editorRef = useRef(null);
    const pendingSel = useRef(null);

    // Live co-editing (docs/api/collab.md): the page markdown is a shared Y.Text once
    // synced; title, tags and category stay REST fields.
    const collab = useCollabDoc('knowledge', id, { enabled: !!id && id !== 'handbook' && !!pageData && !pageError });
    const live = collab.live;
    const liveRef = useRef(live);
    liveRef.current = live;
    const collabDoc = collab.doc;
    const setPresence = collab.setPresence;

    const restDirty = useRef(false); // content typed before going live, not yet sent
    const latest = useRef({ title, content, tags });
    latest.current = { title, content, tags };

    useEffect(() => {
        if (!live || !collabDoc) return undefined;
        if (restDirty.current && id) {
            // Typed while connecting: send it once over REST; the server merges it into
            // the live doc and it comes back as an ordinary update.
            restDirty.current = false;
            clearTimeout(saveTimer.current);
            const { title: t, content: c, tags: tg } = latest.current;
            updatePage(id, { title: t, content: c, tags: tg }).catch(() => showToast('Could not save the page', 'error'));
        }
        const ytext = collabDoc.getText('content');
        setContent(ytext.toString());
        const onChange = (event, tx) => {
            if (tx.origin === LOCAL_ORIGIN) return;
            const el = editorRef.current;
            if (el && typeof document !== 'undefined' && document.activeElement === el) {
                const delta = event.changes.delta;
                pendingSel.current = {
                    start: transformIndexByDelta(el.selectionStart, delta),
                    end: transformIndexByDelta(el.selectionEnd, delta),
                };
            }
            setContent(ytext.toString());
        };
        ytext.observe(onChange);
        return () => ytext.unobserve(onChange);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [live, collabDoc]);

    // Keep the caret where it was in the text when someone else's edit lands.
    useLayoutEffect(() => {
        const sel = pendingSel.current;
        const el = editorRef.current;
        if (!sel || !el) return;
        pendingSel.current = null;
        try { el.setSelectionRange(sel.start, sel.end); } catch { /* not focused */ }
    }, [content]);

    const shareCursor = (e) => {
        if (!liveRef.current) return;
        const el = e.currentTarget;
        const line = el.value.slice(0, el.selectionStart).split('\n').length;
        setPresence({ cursor: { line, index: el.selectionStart } });
    };

    useEffect(() => {
        if (workspaceId) listCategories(workspaceId).catch(() => { });
    }, [workspaceId, listCategories]);

    useEffect(() => {
        if (!workspaceId) return undefined;
        listPages(workspaceId);
        const reload = () => listPages(workspaceId);
        window.addEventListener(KNOWLEDGE_CHANGED, reload);
        return () => window.removeEventListener(KNOWLEDGE_CHANGED, reload);
    }, [workspaceId, listPages]);

    useEffect(() => {
        setPageError(false);
        setSavedOnce(false);
        if (!id || id === 'handbook') { setPageData(null); return; }
        getPage(id).then(p => {
            setPageData(p);
            setTitle(p.title || '');
            setContent(p.content || '');
            setTags(p.tags || []);
            setPageCategory(p.categoryId ? catKey(p) : '');
            setSummary(p.summary || '');
        }).catch(() => { setPageError(true); showToast('Page not found', 'error'); });
    }, [id, getPage, showToast]);

    useEffect(() => {
        if (id && id !== 'handbook') {
            getBacklinks(id).then(setBacklinks).catch(() => { });
        }
    }, [id, getBacklinks]);

    const autoSave = useCallback((newTitle, newContent, newTags) => {
        if (!id) return;
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
            setSaving(true);
            // While live the server saves the content from the shared doc: never PUT it too.
            const data = liveRef.current ? { title: newTitle, tags: newTags } : { title: newTitle, content: newContent, tags: newTags };
            if (!liveRef.current) restDirty.current = false;
            const ok = await updatePage(id, data).then(() => true).catch(() => false);
            setSaving(false);
            if (ok) { setSavedOnce(true); announceChange(); } else showToast('Could not save the page', 'error');
        }, 1200);
    }, [id, updatePage, showToast]);

    const handleTitleChange = (e) => {
        setTitle(e.target.value);
        autoSave(e.target.value, content, tags);
    };

    const handleContentChange = (e) => {
        const value = e.target.value;
        setContent(value);
        if (liveRef.current && collabDoc) {
            collabDoc.transact(() => applyTextDiff(collabDoc.getText('content'), value), LOCAL_ORIGIN);
            shareCursor(e);
            return;
        }
        restDirty.current = true;
        autoSave(title, value, tags);
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

    const create = async (data) => {
        setCreating(true);
        try {
            const p = await createPage(workspaceId, data);
            announceChange();
            navigate(`/workspace/${workspaceId}/knowledge/${p._id}`);
        } catch {
            showToast('Could not create the page', 'error');
        } finally { setCreating(false); }
    };
    const handleCreate = () => create({ title: 'Untitled page', content: '' });
    const handleCreateTemplate = (t) => create({ title: t.title, content: t.content, tags: t.tags });
    const handleCreateHandbook = () => create({ title: 'Untitled handbook page', content: '', isHandbook: true });

    // Import: each Markdown / text file becomes a page (in the category being viewed, if any).
    const pickImport = () => importRef.current?.click();
    const handleImport = async (fileList) => {
        const files = [...(fileList || [])];
        if (!files.length) return;
        setImporting(true);
        try {
            const { pages: drafts, problems } = await readImportFiles(files);
            problems.forEach((p) => showToast(p, 'error'));
            const categoryId = category && category !== UNCATEGORISED ? category : undefined;
            let created = 0;
            let last = null;
            for (const d of drafts) {
                try {
                    last = await createPage(workspaceId, { ...d, ...(categoryId ? { categoryId } : {}) });
                    created += 1;
                } catch {
                    showToast(`Couldn’t import “${d.title}”`, 'error');
                }
            }
            if (created) {
                announceChange();
                showToast(created === 1 ? `Imported “${last.title}”` : `Imported ${created} pages`, 'success');
                if (created === 1 && last?._id) navigate(`/workspace/${workspaceId}/knowledge/${last._id}`);
            }
        } finally {
            setImporting(false);
        }
    };
    const importInput = (
        <input ref={importRef} type="file" accept={IMPORT_ACCEPT} multiple hidden data-testid="kb-import-input"
            onChange={(e) => { handleImport(e.target.files); e.target.value = ''; }} />
    );

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await deletePage(id);
            announceChange();
            showToast('Page deleted', 'success');
            setConfirmDelete(false);
            navigate(`/workspace/${workspaceId}/knowledge`);
        } catch {
            showToast('Could not delete the page', 'error');
        } finally { setDeleting(false); }
    };

    const handleSummarize = async () => {
        setSummarizing(true);
        try {
            const s = await summarizePage(id);
            setSummary(s);
            showToast('Summary ready', 'success');
        } catch { showToast('Could not write a summary', 'error'); }
        finally { setSummarizing(false); }
    };

    const handleLink = async (toPageId) => {
        try {
            await linkPages(id, toPageId, workspaceId);
            showToast('Pages linked', 'success');
        } catch { showToast('Could not link the pages', 'error'); }
        setShowLinkModal(false);
    };

    const catCounts = useMemo(() => countByCategory(pages), [pages]);

    const handleCreateCategory = async (name) => {
        const c = await createCategory(workspaceId, { name });
        showToast(`Added “${c?.name || name}”`, 'success');
        return c;
    };
    const handleRenameCategory = async (catId, name) => {
        await updateCategory(catId, { name });
        showToast('Category renamed', 'success');
    };
    const handleDeleteCategory = async (catId) => {
        await deleteCategory(catId);
        if (category === String(catId)) setCategory('');
        if (pageCategory === String(catId)) setPageCategory('');
        announceChange();
        showToast('Category deleted', 'success');
    };

    const handlePageCategory = async (value) => {
        if (value === NEW_CATEGORY) { setManageCats(true); return; }
        const before = pageCategory;
        setPageCategory(value);
        try {
            await updatePage(id, { categoryId: value || null });
            announceChange();
        } catch (err) {
            setPageCategory(before);
            showToast(categoryErrorMessage(err, 'assign'), 'error');
        }
    };

    const categoriesDialog = (
        <KnowledgeCategoriesDialog
            open={manageCats}
            onClose={() => setManageCats(false)}
            categories={categories}
            counts={catCounts}
            onCreate={handleCreateCategory}
            onRename={handleRenameCategory}
            onDelete={handleDeleteCategory}
            showToast={showToast}
        />
    );

    const openPage = (pid) => navigate(`/workspace/${workspaceId}/knowledge/${pid}`);
    const backToList = () => navigate(`/workspace/${workspaceId}/knowledge`);

    if (id === 'handbook') {
        return <HandbookView pages={pages} loading={loading} wsName={wsName} openPage={openPage} onCreate={handleCreateHandbook} creating={creating} />;
    }

    if (!id) {
        return (
            <>
                {importInput}
                <KnowledgeHome
                loaded={loaded}
                error={listError}
                onRetry={() => listPages(workspaceId)}
                onImport={pickImport}
                importing={importing}
                categories={categories}
                category={category}
                setCategory={setCategory}
                onManageCategories={() => setManageCats(true)}
                pages={pages}
                loading={loading}
                wsName={wsName}
                creating={creating}
                onCreate={handleCreate}
                onCreateTemplate={handleCreateTemplate}
                openPage={openPage}
                openGraph={() => navigate(`/workspace/${workspaceId}/knowledge/graph`)}
                openHandbook={() => navigate(`/workspace/${workspaceId}/knowledge/handbook`)}
                />
                {categoriesDialog}
            </>
        );
    }

    if (pageError) {
        return (
            <DashPage>
                <Panel>
                    <EmptyState icon={FileText} title="Page not found" text="It may have been deleted, or the link is wrong."
                        action={<Btn icon={ChevronLeft} onClick={backToList}>Back to knowledge</Btn>} />
                </Panel>
            </DashPage>
        );
    }

    if (!pageData) return <div style={{ height: '100%', background: 'var(--bg-base)' }}><LoadingState label="Opening page…" /></div>;

    return (
        <div className="kb-doc">
            <div className="kb-bar">
                <div className="kb-bar-group">
                    {!isPhone && <IconBtn label="All pages" onClick={backToList}><ChevronLeft size={16} /></IconBtn>}
                    <span className="kb-bar-mark"><PageMark icon={pageData.icon} size={15} /></span>
                    <FilterTabs value={viewMode} onChange={setViewMode} label="Mode" options={[
                        { value: 'edit', label: 'Write' },
                        { value: 'preview', label: 'Preview' },
                    ]} />
                </div>
                <div className="kb-bar-group">
                    {live || collab.closedText ? <CollabPresence collab={collab} /> : (
                        <span className="kb-save" aria-live="polite">
                            {saving ? <><Loader2 size={11} className="cd-spin" /> Saving…</> : savedOnce ? <><Check size={11} /> Saved</> : null}
                        </span>
                    )}
                    <SelectBox value={pageCategory} onChange={handlePageCategory} label="Category" style={{ height: 30, fontSize: 12, maxWidth: 170 }}>
                        <option value="">No category</option>
                        {categories.map((c) => <option key={c._id} value={String(c._id)}>{c.name}</option>)}
                        <option value={NEW_CATEGORY}>Manage categories…</option>
                    </SelectBox>
                    <Btn size="sm" variant="ghost" icon={Sparkles} loading={summarizing} onClick={handleSummarize}>
                        {summary ? 'Refresh summary' : 'Summarize'}
                    </Btn>
                    <Btn size="sm" variant="ghost" icon={Link2} onClick={() => setShowLinkModal(true)}>Link page</Btn>
                    <IconBtn label="Delete page" onClick={() => setConfirmDelete(true)}><Trash2 size={14} /></IconBtn>
                </div>
            </div>

            <div className="kb-scroll">
                <div className="kb-paper">
                    <input
                        type="text"
                        value={title}
                        onChange={handleTitleChange}
                        placeholder="Untitled page"
                        aria-label="Page title"
                        className="kb-title"
                    />

                    <div className="kb-tags">
                        {tags.map(tag => (
                            <span key={tag} className="kb-tag">
                                #{tag}
                                <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove #${tag}`} title={`Remove #${tag}`}><X size={10} /></button>
                            </span>
                        ))}
                        {showTagInput ? (
                            <input
                                autoFocus
                                value={tagInput}
                                onChange={e => setTagInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') addTag(); if (e.key === 'Escape') { setShowTagInput(false); setTagInput(''); } }}
                                onBlur={addTag}
                                placeholder="tag name"
                                aria-label="New tag"
                                className="gl-input kb-tag-input"
                            />
                        ) : (
                            <button type="button" className="kb-tag-add" onClick={() => setShowTagInput(true)}>
                                <Tag size={11} /> Add tag
                            </button>
                        )}
                    </div>

                    {summary && (
                        <div className="kb-summary">
                            <div className="kb-summary-head"><Sparkles size={13} /> AI summary</div>
                            <p>{summary}</p>
                        </div>
                    )}

                    {viewMode === 'edit' ? (
                        <>
                            {live && collab.peers.some((p) => p.cursor) && (
                                <div className="kb-peers" aria-label="Who is editing where">
                                    {collab.peers.filter((p) => p.cursor).map((p) => (
                                        <PeerMarks key={p.key} peers={[p]} label={`on line ${p.cursor.line}`} detail={`line ${p.cursor.line}`} />
                                    ))}
                                </div>
                            )}
                            <textarea
                                ref={editorRef}
                                value={content}
                                onChange={handleContentChange}
                                onSelect={shareCursor}
                                onBlur={() => { if (liveRef.current) setPresence({ cursor: null }); }}
                                readOnly={live && collab.readOnly}
                                aria-label="Page content"
                                placeholder="Start writing. Markdown works: # heading, **bold**, *italic*, - list, > quote"
                                className="kb-editor"
                            />
                            <p className="kb-hint">
                                Markdown: <code># Heading</code> <code>**bold**</code> <code>*italic*</code> <code>`code`</code> <code>&gt; quote</code> <code>- list</code>
                            </p>
                        </>
                    ) : (
                        <div style={{ minHeight: 320 }}>
                            {content ? <MarkdownPreview content={content} /> : (
                                <p className="kb-hint">Nothing to preview yet. Switch to Write to add content.</p>
                            )}
                        </div>
                    )}

                    <div style={{ marginTop: 40 }}>
                        <Section
                            title={backlinks.length ? `Linked from ${backlinks.length} page${backlinks.length > 1 ? 's' : ''}` : 'Linked from'}
                            action={<Btn size="sm" variant="ghost" icon={Link2} onClick={() => setShowLinkModal(true)}>Link page</Btn>}
                        >
                            <Panel flush>
                                {backlinks.length === 0 ? (
                                    <EmptyState icon={Link2} title="No links yet" text="Link a related page so readers can move between them." />
                                ) : (
                                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                                        {backlinks.map((bl, i) => (
                                            <PageRow key={bl._id} page={bl} first={i === 0} onOpen={() => openPage(bl._id)} />
                                        ))}
                                    </ul>
                                )}
                            </Panel>
                        </Section>
                    </div>
                </div>
            </div>

            {showLinkModal && (
                <LinkPageModal
                    currentPageId={id}
                    allPages={pages}
                    onLink={handleLink}
                    onClose={() => setShowLinkModal(false)}
                />
            )}
            <Confirm
                open={confirmDelete}
                title={`Delete “${title || 'Untitled page'}”?`}
                confirmLabel="Delete page"
                tone="danger"
                busy={deleting}
                onConfirm={handleDelete}
                onClose={() => setConfirmDelete(false)}
            >
                The page and its links are removed for everyone in the workspace.
            </Confirm>
            {categoriesDialog}
            <KbStyles />
        </div>
    );
};

function KbStyles() {
    return (
        <style>{`
        .kb-row { width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 16px 12px 12px; background: none; border: 0; text-align: left; cursor: pointer; font-family: var(--font); color: inherit; }
        .kb-row:hover, .kb-row:focus-visible { background: var(--bg-hover); }
        .kb-row-title { font-size: 14px; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
        .kb-row-meta { display: block; margin-top: 3px; font-size: 11.5px; color: var(--text-secondary); }
        .kb-welcome { padding-bottom: 8px; }
        .kb-welcome-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 4px; }
        .kb-welcome-steps { list-style: none; margin: 4px auto 8px; padding: 14px 16px 0; max-width: 560px; display: grid; gap: 10px; border-top: 1px solid var(--border-subtle); }
        .kb-welcome-steps li { display: flex; align-items: flex-start; gap: 10px; font-size: 12.5px; line-height: 1.5; color: var(--text-secondary); }
        .kb-welcome-steps li svg { flex-shrink: 0; margin-top: 2px; color: var(--accent); }
        .kb-welcome-steps strong { color: var(--text-primary); font-weight: 600; }
        .kb-card { padding: 16px; text-align: left; display: flex; flex-direction: column; gap: 8px; font-family: var(--font); }
        .kb-card strong { font-size: 14px; color: var(--text-primary); }
        .kb-card > span:last-child { font-size: 12.5px; line-height: 1.5; color: var(--text-secondary); }
        .kb-doc { display: flex; flex-direction: column; height: 100%; background: var(--bg-base); font-family: var(--font); }
        .kb-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px 12px; flex-wrap: wrap; padding: 8px 24px; min-height: 52px; box-sizing: border-box; border-bottom: 1px solid var(--border-subtle); flex-shrink: 0; }
        .kb-bar-group { display: flex; align-items: center; gap: 6px; min-width: 0; }
        .kb-bar-mark { display: inline-flex; align-items: center; justify-content: center; width: 24px; }
        .kb-peers { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
        .kb-save { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--text-muted); margin-right: 4px; }
        .kb-scroll { flex: 1; overflow-y: auto; }
        .kb-paper { max-width: 760px; margin: 0 auto; padding: 32px 40px 64px; }
        .kb-title { font-size: 2.25rem; font-weight: 800; line-height: 1.15; color: var(--text-primary); border: 0; outline: none; padding: 0; margin-bottom: 12px; width: 100%; background: transparent; font-family: var(--font); }
        .kb-title::placeholder { color: var(--text-muted); }
        .kb-tags { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 24px; min-height: 26px; }
        .kb-tag { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; font-size: 11px; font-weight: 600; color: var(--accent); background: var(--gl-accent-soft); border: 1px solid var(--gl-accent-line); border-radius: var(--gl-radius); }
        .kb-tag button { display: flex; padding: 0; background: none; border: 0; color: var(--text-muted); cursor: pointer; }
        .kb-tag button:hover { color: var(--state-danger); }
        .kb-tag-input { width: 120px; height: 24px; padding: 2px 8px; font-size: 11px; }
        .kb-tag-add { display: inline-flex; align-items: center; gap: 4px; padding: 3px 6px; font-size: 11px; color: var(--text-muted); background: none; border: 0; cursor: pointer; font-family: var(--font); }
        .kb-tag-add:hover { color: var(--accent); }
        .kb-summary { margin-bottom: 24px; padding: 14px 16px; background: var(--gl-accent-soft); border: 1px solid var(--gl-accent-line); border-radius: var(--gl-radius); }
        .kb-summary-head { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; font-size: 12px; font-weight: 700; color: var(--accent); }
        .kb-summary p { margin: 0; font-size: 13.5px; line-height: 1.65; color: var(--text-primary); white-space: pre-wrap; }
        .kb-editor { width: 100%; min-height: 360px; font-size: 14.5px; line-height: 1.75; color: var(--text-primary); background: transparent; border: 0; outline: none; resize: vertical; font-family: var(--font); padding: 0; }
        .kb-editor::placeholder { color: var(--text-muted); }
        .kb-hint { margin-top: 12px; font-size: 11.5px; color: var(--text-muted); line-height: 1.8; }
        .kb-hint code { padding: 1px 5px; margin-right: 2px; background: var(--bg-hover); border: 1px solid var(--border-subtle); border-radius: var(--gl-radius); font-size: 11px; }
        .kb-md { font-size: 14.5px; line-height: 1.75; color: var(--text-primary); }
        .kb-md p { margin: 0 0 12px; }
        .kb-md h1 { font-size: 22px; font-weight: 800; margin: 24px 0 12px; }
        .kb-md h2 { font-size: 17px; font-weight: 700; margin: 20px 0 8px; }
        .kb-md h3 { font-size: 14.5px; font-weight: 700; margin: 16px 0 4px; }
        .kb-md strong { font-weight: 700; }
        .kb-md code { padding: 1px 6px; background: var(--bg-hover); border: 1px solid var(--border-subtle); font-family: ui-monospace, Menlo, monospace; font-size: 12.5px; color: var(--accent); }
        .kb-md blockquote { border-left: 3px solid var(--gl-accent-line); padding-left: 12px; margin: 8px 0; color: var(--text-secondary); font-style: italic; }
        .kb-md li { margin-left: 18px; color: var(--text-primary); }
        .kb-md li.kb-ul { list-style: disc; }
        .kb-md li.kb-ol { list-style: decimal; }
        ${KB_CATEGORY_CSS}
        @media (max-width: 640px) {
            .kb-bar { padding: 8px 12px; }
            .kb-paper { padding: 20px 16px 48px; }
            .kb-title { font-size: 1.75rem; }
        }
        `}</style>
    );
}

export default KnowledgePage;
