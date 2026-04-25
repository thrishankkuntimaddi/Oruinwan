import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { BookOpen, Plus, ChevronRight, ChevronDown, Network, RefreshCw, Search, Book } from 'lucide-react';
import { useKnowledge } from '../../../hooks/useKnowledge';

function PageTreeItem({ page, depth = 0, workspaceId, allPages, onNavigate, activePath }) {
    const children = allPages.filter(p => p.parentId === page._id || p.parentId?.toString?.() === page._id?.toString?.());
    const [open, setOpen] = useState(depth === 0 && children.length > 0);
    const isActive = activePath?.includes(page._id);

    return (
        <div>
            <button
                onClick={() => onNavigate(page._id)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '6px', paddingBottom: '6px', paddingRight: '12px', textAlign: 'left', background: isActive ? 'rgba(184,149,106,0.1)' : 'transparent', borderLeft: isActive ? '2px solid #b8956a' : '2px solid transparent', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 150ms ease', paddingLeft: `${12 + depth * 14}px` }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                {children.length > 0 ? (
                    <span onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
                        style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>
                        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    </span>
                ) : <span style={{ width: '11px', display: 'inline-block' }} />}
                <span style={{ fontSize: '13px', marginRight: '2px' }}>{page.icon || '📄'}</span>
                <span style={{ fontSize: '12px', fontWeight: isActive ? 600 : 400, color: isActive ? '#e4e4e4' : 'rgba(228,228,228,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{page.title}</span>
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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)' }}>
            {}
            <div style={{ padding: '12px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                        <BookOpen size={12} /> Knowledge
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => navigate(`/workspace/${workspaceId}/knowledge/graph`)}
                            style={{ padding: '4px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', transition: 'color 150ms ease' }}
                            title="Knowledge Graph"
                            onMouseEnter={e => e.currentTarget.style.color = '#b8956a'}
                            onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.35)'}>
                            <Network size={13} />
                        </button>
                        <button onClick={handleCreatePage} disabled={creating}
                            style={{ padding: '4px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', transition: 'color 150ms ease' }}
                            title="New page"
                            onMouseEnter={e => e.currentTarget.style.color = '#b8956a'}
                            onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.35)'}>
                            <Plus size={13} />
                        </button>
                    </div>
                </div>
                <div style={{ position: 'relative' }}>
                    <Search size={11} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find page..."
                        style={{ width: '100%', paddingLeft: '26px', paddingRight: '8px', paddingTop: '5px', paddingBottom: '5px', fontSize: '12px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }} />
                </div>
            </div>

            {}
            <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
                <button onClick={() => navigate(`/workspace/${workspaceId}/knowledge/handbook`)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 8px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'background 150ms ease' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <Book size={13} style={{ color: '#b8956a', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, sans-serif' }}>Company Handbook</span>
                </button>
            </div>

            {}
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                {loading && (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                        <div style={{ width: '16px', height: '16px', border: '2px solid #b8956a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    </div>
                )}
                {!loading && filtered.length === 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 16px', textAlign: 'center' }}>
                        <BookOpen size={28} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, sans-serif' }}>No pages yet</p>
                        <button onClick={handleCreatePage}
                            style={{ marginTop: '10px', fontSize: '12px', color: '#b8956a', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>Create first page</button>
                    </div>
                )}
                {search
                    ? filtered.map(page => (
                        <button key={page._id} onClick={() => navigate(`/workspace/${workspaceId}/knowledge/${page._id}`)}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, system-ui, sans-serif', transition: 'background 150ms ease' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <span style={{ fontSize: '13px' }}>{page.icon || '📄'}</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{page.title}</span>
                        </button>
                    ))
                    : filtered.map(page => (
                        <PageTreeItem key={page._id} page={page} depth={0} workspaceId={workspaceId} allPages={pages}
                            onNavigate={(pid) => navigate(`/workspace/${workspaceId}/knowledge/${pid}`)} activePath={id} />
                    ))
                }
            </div>

            {}
            <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '8px 12px' }}>
                <button onClick={handleCreatePage} disabled={creating}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '6px', background: 'transparent', border: 'none', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'color 150ms ease' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#b8956a'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.35)'}>
                    <Plus size={12} />{creating ? 'Creating…' : 'New page'}
                </button>
            </div>
        </div>
    );
};

export default KnowledgePanel;
