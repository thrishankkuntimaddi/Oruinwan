// client/src/components/layout/panels/KnowledgePanel.jsx
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
                className={`w-full flex items-center gap-1.5 px-3 py-1.5 text-left transition-colors group rounded-sm mx-1 ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
                style={{ paddingLeft: `${12 + depth * 14}px` }}
            >
                {children.length > 0 ? (
                    <span
                        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    </span>
                ) : (
                    <span className="w-[11px]" />
                )}
                <span className="text-sm mr-1">{page.icon || '📄'}</span>
                <span className="text-xs font-medium truncate">{page.title}</span>
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
        <div className="flex flex-col h-full bg-white dark:bg-gray-900">
            {/* Header */}
            <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        <BookOpen size={13} /> Knowledge
                    </span>
                    <div className="flex gap-1">
                        <button
                            onClick={() => navigate(`/workspace/${workspaceId}/knowledge/graph`)}
                            className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors"
                            title="Knowledge Graph"
                        >
                            <Network size={13} />
                        </button>
                        <button
                            onClick={handleCreatePage}
                            disabled={creating}
                            className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors"
                            title="New page"
                        >
                            <Plus size={13} />
                        </button>
                    </div>
                </div>
                {/* Search */}
                <div className="relative">
                    <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Find page..."
                        className="w-full pl-6 pr-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 rounded border-none outline-none text-gray-800 dark:text-gray-200 placeholder-gray-400"
                    />
                </div>
            </div>

            {/* Special sections */}
            <div className="px-2 py-1.5 border-b border-gray-100 dark:border-gray-800">
                <button
                    onClick={() => navigate(`/workspace/${workspaceId}/knowledge/handbook`)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded transition-colors"
                >
                    <Book size={13} className="text-amber-500" />
                    <span className="font-medium">Company Handbook</span>
                </button>
            </div>

            {/* Page tree */}
            <div className="flex-1 overflow-y-auto py-1">
                {loading && (
                    <div className="flex items-center justify-center py-8">
                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}
                {!loading && filtered.length === 0 && (
                    <div className="flex flex-col items-center py-10 px-4 text-center">
                        <BookOpen size={32} className="text-gray-200 dark:text-gray-700 mb-2" />
                        <p className="text-xs text-gray-400">No pages yet</p>
                        <button onClick={handleCreatePage} className="mt-3 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                            Create first page
                        </button>
                    </div>
                )}
                {search
                    ? filtered.map(page => (
                        <button
                            key={page._id}
                            onClick={() => navigate(`/workspace/${workspaceId}/knowledge/${page._id}`)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                            <span className="text-sm">{page.icon || '📄'}</span>
                            <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{page.title}</span>
                        </button>
                    ))
                    : filtered.map(page => (
                        <PageTreeItem
                            key={page._id}
                            page={page}
                            depth={0}
                            workspaceId={workspaceId}
                            allPages={pages}
                            onNavigate={(pid) => navigate(`/workspace/${workspaceId}/knowledge/${pid}`)}
                            activePath={id}
                        />
                    ))
                }
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-2">
                <button
                    onClick={handleCreatePage}
                    disabled={creating}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded transition-colors"
                >
                    <Plus size={12} />
                    {creating ? 'Creating…' : 'New page'}
                </button>
            </div>
        </div>
    );
};

export default KnowledgePanel;
