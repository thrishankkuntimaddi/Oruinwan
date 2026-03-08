import React, { useState } from 'react';
import { Search, Grid, List as ListIcon, Plus, FileText, Clock } from 'lucide-react';
import CanvasCard from '../CanvasCard.jsx';

const COVER_COLORS = [
    '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B',
    '#10B981', '#06B6D4', '#3B82F6', '#84CC16', '#F97316'
];

function CreateModal({ onClose, onCreate, tabCount }) {
    const [name, setName] = useState('');
    const [color, setColor] = useState(COVER_COLORS[0]);
    const ref = React.useRef(null);
    React.useEffect(() => ref.current?.focus(), []);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-white rounded-2xl shadow-2xl w-[400px] p-6 mx-4"
                style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
                <h3 className="text-lg font-bold text-gray-900 mb-1">New Canvas</h3>
                <p className="text-sm text-gray-400 mb-5">Create a shared document for your team.</p>

                <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Title</label>
                    <input ref={ref} value={name} onChange={e => setName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && name.trim() && onCreate(name.trim(), color)}
                        placeholder="Untitled canvas…"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all" />
                </div>

                <div className="mb-6">
                    <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Cover Color</label>
                    <div className="flex gap-2 flex-wrap">
                        {COVER_COLORS.map(c => (
                            <button key={c} onClick={() => setColor(c)}
                                className="w-7 h-7 rounded-full transition-transform hover:scale-110 flex-shrink-0"
                                style={{
                                    background: c,
                                    outline: color === c ? `3px solid ${c}` : 'none',
                                    outlineOffset: '2px'
                                }} />
                        ))}
                    </div>
                </div>

                <div className="flex gap-2">
                    <button onClick={onClose}
                        className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                        Cancel
                    </button>
                    <button onClick={() => name.trim() && onCreate(name.trim(), color)}
                        disabled={!name.trim()}
                        className="flex-1 px-4 py-2.5 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-40"
                        style={{ background: color }}>
                        Create Canvas
                    </button>
                </div>
            </div>
        </div>
    );
}

const CanvasDashboardView = ({
    tabs,
    dashboardView,
    dashboardSearch,
    onViewChange,
    onSearchChange,
    onCreate,
    onOpen,
    onDelete,
    onRename,
    onShare,
    channelName
}) => {
    const [showCreate, setShowCreate] = useState(false);
    const filtered = tabs.filter(t => t.name.toLowerCase().includes(dashboardSearch.toLowerCase()));

    const handleCreate = (name, coverColor) => {
        setShowCreate(false);
        onCreate(name, coverColor);
    };

    return (
        <div className="flex-1 bg-gray-50 overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <FileText size={18} className="text-indigo-500" />
                        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Canvas</h1>
                        {channelName && (
                            <span className="text-sm font-medium text-gray-400 ml-1">
                                · #{(channelName || '').replace(/^#/, '')}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                        {tabs.length} document{tabs.length !== 1 ? 's' : ''}
                        {tabs.length >= 5 && <span className="ml-1 text-amber-500">· Max 5 reached</span>}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {/* Search */}
                    <div className="relative flex items-center">
                        <Search size={14} className="absolute left-3 text-gray-400 pointer-events-none" />
                        <input type="text" placeholder="Search…" value={dashboardSearch}
                            onChange={e => onSearchChange(e.target.value)}
                            className="pl-9 pr-4 py-2 w-44 text-sm bg-gray-100 border border-transparent rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-gray-200 transition-all" />
                    </div>

                    {/* View toggle */}
                    <div className="flex items-center bg-gray-100 rounded-xl p-0.5">
                        <button onClick={() => onViewChange('grid')}
                            className={`p-2 rounded-lg transition-all ${dashboardView === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
                            <Grid size={15} />
                        </button>
                        <button onClick={() => onViewChange('list')}
                            className={`p-2 rounded-lg transition-all ${dashboardView === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
                            <ListIcon size={15} />
                        </button>
                    </div>

                    {/* Create button */}
                    {tabs.length < 5 && (
                        <button onClick={() => setShowCreate(true)}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-all hover:opacity-90 hover:shadow-lg hover:shadow-indigo-500/30"
                            style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                            <Plus size={15} strokeWidth={2.5} />
                            New Canvas
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="p-8">
                {tabs.length === 0 ? (
                    /* Empty state */
                    <div className="flex flex-col items-center justify-center py-24">
                        <div className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl mb-6"
                            style={{ background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)' }}>
                            📄
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">No canvases yet</h3>
                        <p className="text-sm text-gray-400 text-center max-w-xs mb-8">
                            Create a shared document to brainstorm, plan projects,
                            or document ideas with your team.
                        </p>
                        <button onClick={() => setShowCreate(true)}
                            className="flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white rounded-xl transition-all hover:opacity-90 hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5"
                            style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                            <Plus size={16} strokeWidth={2.5} />
                            Create First Canvas
                        </button>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Search size={32} className="text-gray-200 mb-3" />
                        <p className="text-sm text-gray-400">No canvases match "{dashboardSearch}"</p>
                    </div>
                ) : (
                    <div className={dashboardView === 'grid'
                        ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
                        : 'flex flex-col gap-2'}>
                        {filtered.map(tab => (
                            <CanvasCard
                                key={tab._id}
                                tab={tab}
                                view={dashboardView}
                                onClick={() => onOpen(tab._id)}
                                onDelete={id => onDelete(id)}
                                onRename={(id, name) => onRename(id, name)}
                                onShare={id => onShare(id)}
                            />
                        ))}
                        {/* Add new card in grid (when space remains) */}
                        {dashboardView === 'grid' && tabs.length < 5 && (
                            <button onClick={() => setShowCreate(true)}
                                className="flex flex-col items-center justify-center min-h-[200px] bg-white rounded-2xl border-2 border-dashed border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all group">
                                <div className="w-10 h-10 rounded-xl bg-gray-100 group-hover:bg-indigo-100 flex items-center justify-center mb-2 transition-colors">
                                    <Plus size={20} className="text-gray-400 group-hover:text-indigo-600" />
                                </div>
                                <span className="text-sm font-semibold text-gray-400 group-hover:text-indigo-600 transition-colors">New Canvas</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {showCreate && (
                <CreateModal
                    onClose={() => setShowCreate(false)}
                    onCreate={handleCreate}
                    tabCount={tabs.length}
                />
            )}
        </div>
    );
};

export default CanvasDashboardView;
