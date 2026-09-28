import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { BookOpen, Plus, ChevronRight, ChevronDown, Network, Search, Book } from 'lucide-react';
import { useKnowledge } from '../../../hooks/useKnowledge';
import WorkspacePanel, { PanelSection, PanelEmpty } from '../WorkspacePanel';
import '../../../styles/gloss-x-panels.css';

function PageTreeItem({ page, depth = 0, workspaceId, allPages, onNavigate, activePath }) {
    const children = allPages.filter(p => p.parentId === page._id || p.parentId?.toString?.() === page._id?.toString?.());
    const [open, setOpen] = useState(depth === 0 && children.length > 0);
    const isActive = activePath?.includes(page._id);

    return (
        <div>
            <button type="button"
                onClick={() => onNavigate(page._id)}
                className={`gl-item gl-x-indent${isActive ? ' is-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                style={{ '--gl-x-depth': depth, gap: '6px' }}>
                {children.length > 0 ? (
                    <span className="gl-x-caret" role="button" aria-label={open ? 'Collapse' : 'Expand'}
                        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
                        style={{ cursor: 'pointer' }}>
                        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    </span>
                ) : <span className="gl-x-caret" />}
                <span className="gl-x-emoji">{page.icon || '📄'}</span>
                <span className="gl-x-item-title">{page.title}</span>
            </button>
            {open && children.map(child => (
                <PageTreeItem
                    key={child._id}
                    page={child}
                    depth={depth + 1}
                    workspaceId={workspaceId}
                    allPages={allPages}
                    onNavigate={onNavigate}
                    activePath={activePath}
                />
            ))}
        </div>
    );
}

const KnowledgePanel = ({ title }) => {
    const { workspaceId, id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { pages, loading, listPages, createPage } = useKnowledge();
    const [search, setSearch] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (workspaceId) listPages(workspaceId);
    }, [workspaceId, listPages]);

    const handleCreatePage = async () => {
        if (creating) return;
        setCreating(true);
        try {
            const page = await createPage(workspaceId, { title: 'Untitled Page', content: '' });
            navigate(`/workspace/${workspaceId}/knowledge/${page._id}`);
        } finally {
            setCreating(false);
        }
    };

    const rootPages = pages.filter(p => !p.parentId);
    const filtered = search
        ? pages.filter(p => p.title.toLowerCase().includes(search.toLowerCase()))
        : rootPages;
    const onGraph = location.pathname.endsWith('/knowledge/graph');
    const onHandbook = location.pathname.endsWith('/knowledge/handbook');

    return (
        <WorkspacePanel
            icon={BookOpen}
            title="Knowledge"
            subtitle={title}
            actions={(
                <>
                    <button type="button" className={`gl-icon-btn${onGraph ? ' is-active' : ''}`} onClick={() => navigate(`/workspace/${workspaceId}/knowledge/graph`)}
                        title="Knowledge Graph" aria-label="Knowledge Graph">
                        <Network size={14} />
                    </button>
                    <button type="button" className="gl-icon-btn" onClick={handleCreatePage} disabled={creating} title="New page" aria-label="New page">
                        <Plus size={15} />
                    </button>
                </>
            )}
            tools={(
                <div className="gl-search">
                    <Search size={12} />
                    <input className="gl-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Find page…" aria-label="Find page" />
                </div>
            )}
            footer={(
                <button type="button" className="gl-btn gl-btn--ghost gl-btn--sm gl-btn--block" onClick={handleCreatePage} disabled={creating}>
                    <Plus size={12} />{creating ? 'Creating…' : 'New page'}
                </button>
            )}
        >
            <button type="button" className={`gl-item${onHandbook ? ' is-active' : ''}`} aria-current={onHandbook ? 'page' : undefined}
                onClick={() => navigate(`/workspace/${workspaceId}/knowledge/handbook`)}>
                <Book size={13} className="gl-x-accent" style={{ flexShrink: 0 }} />
                <span className="gl-x-item-title">Company Handbook</span>
            </button>

            <PanelSection label={search ? 'Results' : 'Pages'}>
                {loading && <div className="gl-x-center"><div className="gl-x-spinner" /></div>}
                {!loading && filtered.length === 0 && (
                    <PanelEmpty
                        icon={BookOpen}
                        title={search ? 'No matching pages' : 'No pages yet'}
                        text={search ? 'Try a different title.' : 'Write down how your team works — pages can nest.'}
                        action={!search && (
                            <button type="button" className="gl-btn gl-btn--primary gl-btn--sm" onClick={handleCreatePage} disabled={creating}>
                                <Plus size={12} /> Create first page
                            </button>
                        )}
                    />
                )}
                {search
                    ? filtered.map(page => (
                        <button key={page._id} type="button" className={`gl-item${id === page._id ? ' is-active' : ''}`}
                            onClick={() => navigate(`/workspace/${workspaceId}/knowledge/${page._id}`)}>
                            <span className="gl-x-emoji">{page.icon || '📄'}</span>
                            <span className="gl-x-item-title">{page.title}</span>
                        </button>
                    ))
                    : filtered.map(page => (
                        <PageTreeItem key={page._id} page={page} depth={0} workspaceId={workspaceId} allPages={pages}
                            onNavigate={(pid) => navigate(`/workspace/${workspaceId}/knowledge/${pid}`)} activePath={id} />
                    ))
                }
            </PanelSection>
        </WorkspacePanel>
    );
};

export default KnowledgePanel;
