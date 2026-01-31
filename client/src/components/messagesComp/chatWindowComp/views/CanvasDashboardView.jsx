import React from 'react';
import { Search, Grid, List as ListIcon, Plus, Layout } from 'lucide-react';
import CanvasCard from '../CanvasCard.jsx';

/**
 * CanvasDashboardView Component
 * Canvas dashboard UI with grid/list views, search, and cards
 */
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
    onShare
}) => {
    return (
        <div className="flex-1 bg-gray-50 dark:bg-gray-900 overflow-y-auto p-8">
            <div className="max-w-5xl mx-auto w-full">
                {/* Dashboard Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2 tracking-tight">Canvas Dashboard</h1>
                        <p className="text-gray-500 dark:text-gray-400 font-medium">
                            Manage your team's whiteboards and documents
                        </p>
                    </div>

                    <div className="flex items-center gap-3 bg-white dark:bg-gray-800 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                <Search size={16} className="text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search canvases..."
                                value={dashboardSearch}
                                onChange={(e) => onSearchChange(e.target.value)}
                                className="pl-10 pr-4 py-2 w-48 md:w-64 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none"
                            />
                        </div>
                        <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>
                        <button
                            onClick={() => onViewChange('grid')}
                            className={`p-2 rounded-lg transition-all ${dashboardView === 'grid' ? 'bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                            title="Grid View"
                        >
                            <Grid size={18} />
                        </button>
                        <button
                            onClick={() => onViewChange('list')}
                            className={`p-2 rounded-lg transition-all ${dashboardView === 'list' ? 'bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                            title="List View"
                        >
                            <ListIcon size={18} />
                        </button>
                    </div>
                </div>

                {tabs.length === 0 ? (
                    /* Empty State */
                    <div className="flex flex-col items-center justify-center p-16 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700 min-h-[500px] shadow-sm">
                        <div className="p-8 bg-blue-50 dark:bg-blue-900/10 rounded-full mb-8 animate-pulse">
                            <Layout size={64} className="text-blue-500/80" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">No canvases yet</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-center max-w-md mb-10 text-lg">
                            Create a blank canvas to brainstorm, sketch, or plan projects with your team.
                        </p>
                        <button
                            onClick={() => onCreate(`Untitled ${tabs.length + 1}`)}
                            className="group flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-semibold transition-all shadow-xl hover:shadow-blue-600/30 hover:-translate-y-1"
                        >
                            <Plus size={22} className="group-hover:rotate-90 transition-transform duration-300" />
                            Create New Canvas
                        </button>
                    </div>
                ) : (
                    /* Canvas Grid/List */
                    <div className={dashboardView === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "flex flex-col gap-3"}>
                        {/* Create New Row (List Only) */}
                        {dashboardView === 'list' && (
                            <button
                                onClick={() => onCreate(`Untitled ${tabs.length + 1}`)}
                                className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 text-gray-500 hover:text-blue-600 transition-colors group"
                            >
                                <div className="p-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20">
                                    <Plus size={20} />
                                </div>
                                <span className="font-semibold">Create New Canvas</span>
                            </button>
                        )}

                        {/* Filtered Tabs */}
                        {tabs.filter(t => t.name.toLowerCase().includes(dashboardSearch.toLowerCase())).map((tab) => (
                            <CanvasCard
                                key={tab._id}
                                tab={tab}
                                view={dashboardView}
                                onClick={() => onOpen(tab._id)}
                                onDelete={(id) => onDelete(id)}
                                onRename={(id, name) => onRename(id, name)}
                                onShare={(id) => onShare(id)}
                            />
                        ))}

                        {/* Create New Card (Grid Only) */}
                        {dashboardView === 'grid' && (
                            <button
                                onClick={() => onCreate(`Untitled ${tabs.length + 1}`)}
                                className="flex flex-col items-center justify-center p-8 bg-gray-100/50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-white dark:hover:bg-gray-800 transition-all group min-h-[240px]"
                            >
                                <div className="p-4 bg-white dark:bg-gray-800 rounded-full mb-4 shadow-sm group-hover:shadow-md group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:scale-110 transition-all">
                                    <Plus size={32} />
                                </div>
                                <span className="font-bold text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 text-lg">Create New</span>
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CanvasDashboardView;
