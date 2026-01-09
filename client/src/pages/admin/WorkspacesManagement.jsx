// client/src/pages/admin/WorkspacesManagement.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Globe, Users, Calendar, MoreVertical, Plus, Search, Filter } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import api from '../../services/api';

const WorkspacesManagement = () => {
    const { showToast } = useToast();
    const [workspaces, setWorkspaces] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all'); // all, active, archived

    const fetchWorkspaces = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/admin-dashboard/workspaces');
            setWorkspaces(response.data.workspaces || []);
        } catch (error) {
            console.error('Error fetching workspaces:', error);
            showToast('Failed to load workspaces', 'error');
            setWorkspaces([]); // Set empty array on error
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchWorkspaces();
    }, [fetchWorkspaces]);

    const filteredWorkspaces = workspaces.filter(workspace => {
        const matchesSearch = workspace.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            workspace.description?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterStatus === 'all' || workspace.status === filterStatus;
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            {/* Header */}
            <header className="h-16 px-8 flex items-center justify-between z-10 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 shadow-sm">
                <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                    
                        Workspaces Management
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-gray-400 font-medium ml-8">
                        Manage all company workspaces
                    </p>
                </div>
                <button
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-md hover:shadow-lg flex items-center gap-2"
                >
                    <Plus size={16} />
                    Create Workspace
                </button>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto w-full px-8 py-8 z-10 custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Search and Filter Bar */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                            {/* Search */}
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search workspaces..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                />
                            </div>

                            {/* Filter */}
                            <div className="flex items-center gap-2">
                                <Filter size={18} className="text-gray-400" />
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                >
                                    <option value="all">All Status</option>
                                    <option value="active">Active</option>
                                    <option value="archived">Archived</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Workspaces Grid */}
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : filteredWorkspaces.length === 0 ? (
                        <div className="text-center py-20">
                            <Globe className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No workspaces found</h3>
                            <p className="text-gray-500 dark:text-gray-400">
                                {searchTerm ? 'Try a different search term' : 'Create your first workspace to get started'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredWorkspaces.map((workspace) => (
                                <div
                                    key={workspace._id}
                                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-all duration-200 hover:border-indigo-300 dark:hover:border-indigo-600 cursor-pointer group"
                                >
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                                                <Globe className="w-6 h-6 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                    {workspace.name}
                                                </h3>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${workspace.status === 'active'
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                                                    }`}>
                                                    {workspace.status}
                                                </span>
                                            </div>
                                        </div>
                                        <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                                            <MoreVertical size={18} className="text-gray-400" />
                                        </button>
                                    </div>

                                    {/* Description */}
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                                        {workspace.description || 'No description'}
                                    </p>

                                    {/* Stats */}
                                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
                                        <div className="flex items-center gap-1">
                                            <Users size={16} />
                                            <span>{workspace.memberCount} members</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Globe size={16} />
                                            <span>{workspace.channelCount} channels</span>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                            <Calendar size={14} />
                                            Created {new Date(workspace.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WorkspacesManagement;
