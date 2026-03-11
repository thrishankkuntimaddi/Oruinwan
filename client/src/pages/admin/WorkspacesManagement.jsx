import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Globe, Users, Calendar, MoreVertical, Plus, Search, Filter, Rocket, Briefcase, Zap, Palette, Trophy, Target, Flame, Microscope, Shield, Lightbulb, Sparkles, UserPlus, X, EyeOff } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import CreateWorkspaceModal from '../workspaceSelectComponents/CreateWorkspaceModal';
import WorkspaceMembersModal from './WorkspaceMembersModal';
import { usePermissions } from '../../hooks/usePermissions';

// ── Icon helper — same pattern used in WorkspaceSelect.jsx ──────────────────
const ICON_MAP = {
    rocket: Rocket,
    briefcase: Briefcase,
    zap: Zap,
    palette: Palette,
    globe: Globe,
    trophy: Trophy,
    target: Target,
    flame: Flame,
    microscope: Microscope,
    shield: Shield,
    lightbulb: Lightbulb,
    sparkles: Sparkles,
};

function getIconComponent(name) {
    return ICON_MAP[name] || Globe;
}

// ── Default form state ───────────────────────────────────────────────────────
const DEFAULT_CREATE_DATA = {
    name: '',
    rules: '',
    icon: 'rocket',
    color: '#4f46e5',
    invites: '',
};

// ── Component ────────────────────────────────────────────────────────────────
const WorkspacesManagement = () => {
    const { showToast } = useToast();
    const { user } = useAuth();
    const { canManageWorkspace } = usePermissions();

    // List state
    const [workspaces, setWorkspaces] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [createStep, setCreateStep] = useState(1);
    const [createData, setCreateData] = useState(DEFAULT_CREATE_DATA);
    const [nameError, setNameError] = useState('');
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [creating, setCreating] = useState(false);

    // ⋮ Dropdown state
    const [openMenuId, setOpenMenuId] = useState(null);
    const menuRef = useRef(null);

    // Member management state
    const [membersWorkspace, setMembersWorkspace] = useState(null);

    // Close menu on outside click
    useEffect(() => {
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Fetch workspaces ─────────────────────────────────────────────────────
    const fetchWorkspaces = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/admin-dashboard/workspaces');
            setWorkspaces(response.data.workspaces || []);
        } catch (error) {
            console.error('Error fetching workspaces:', error);
            showToast('Failed to load workspaces', 'error');
            setWorkspaces([]);
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchWorkspaces();
    }, [fetchWorkspaces]);

    // ── Open / close modal ───────────────────────────────────────────────────
    const handleOpenModal = () => {
        setCreateStep(1);
        setCreateData(DEFAULT_CREATE_DATA);
        setNameError('');
        setTermsAccepted(false);
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        // Reset after animation
        setTimeout(() => {
            setCreateStep(1);
            setCreateData(DEFAULT_CREATE_DATA);
            setNameError('');
            setTermsAccepted(false);
        }, 300);
    };

    // ── Submit handler ───────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (creating) return;

        if (!createData.name.trim()) {
            setNameError('Workspace name is required');
            setCreateStep(1);
            return;
        }

        try {
            setCreating(true);
            const payload = {
                name: createData.name.trim(),
                description: createData.rules?.trim() || '',
                icon: createData.icon,
                color: createData.color,
                type: 'general',
                settings: { isPrivate: false, allowMemberInvite: true },
            };

            await api.post('/api/workspaces', payload);
            showToast(`Workspace "${payload.name}" created!`, 'success');
            handleCloseModal();
            fetchWorkspaces(); // Refresh the list
        } catch (err) {
            console.error('Create workspace error:', err);
            const message = err.response?.data?.message || 'Failed to create workspace';
            showToast(message, 'error');
        } finally {
            setCreating(false);
        }
    };

    // ── Filtered list ────────────────────────────────────────────────────────
    const filteredWorkspaces = workspaces.filter(workspace => {
        const matchesSearch =
            workspace.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            workspace.description?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterStatus === 'all' || workspace.status === filterStatus;
        return matchesSearch && matchesFilter;
    });

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            {/* Header */}
            <header className="h-16 px-8 flex items-center justify-between z-10 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 shadow-sm">
                <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        Workspaces Management
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-gray-400 font-medium ml-8">
                        {canManageWorkspace ? 'Manage all company workspaces' : 'View-only — contact an admin to make changes'}
                    </p>
                </div>
                {canManageWorkspace ? (
                    <button
                        onClick={handleOpenModal}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-md hover:shadow-lg flex items-center gap-2"
                    >
                        <Plus size={16} />
                        Create Workspace
                    </button>
                ) : (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400">
                        <EyeOff size={13} /> View Only
                    </span>
                )}
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
                            <p className="text-gray-500 dark:text-gray-400 mb-6">
                                {searchTerm ? 'Try a different search term' : 'Create your first workspace to get started'}
                            </p>
                            {!searchTerm && (
                                <button
                                    onClick={handleOpenModal}
                                    className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors inline-flex items-center gap-2"
                                >
                                    <Plus size={18} />
                                    Create Workspace
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredWorkspaces.map((workspace) => {
                                const IconCmp = getIconComponent(workspace.icon);
                                return (
                                    <div
                                        key={workspace._id}
                                        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-all duration-200 hover:border-indigo-300 dark:hover:border-indigo-600 cursor-pointer group"
                                    >
                                        {/* Header */}
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-12 h-12 rounded-xl flex items-center justify-center shadow-md"
                                                    style={{ backgroundColor: workspace.color || '#4f46e5' }}
                                                >
                                                    <IconCmp className="w-6 h-6 text-white" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                        {workspace.name}
                                                    </h3>
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${workspace.status === 'active'
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                                                        }`}>
                                                        {workspace.status || 'active'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* ⋮ Dropdown Menu */}
                                            <div className="relative" ref={openMenuId === workspace._id ? menuRef : null}>
                                                <button
                                                    onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === workspace._id ? null : workspace._id); }}
                                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                                >
                                                    <MoreVertical size={18} className="text-gray-400" />
                                                </button>
                                                {openMenuId === workspace._id && (
                                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
                                                        {canManageWorkspace ? (
                                                            <button
                                                                onClick={e => { e.stopPropagation(); setMembersWorkspace(workspace); setOpenMenuId(null); }}
                                                                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                                            >
                                                                <UserPlus size={15} />
                                                                Manage Members
                                                            </button>
                                                        ) : (
                                                            <p className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 italic">
                                                                No actions available
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Description */}
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                                            {workspace.description || 'No description'}
                                        </p>

                                        {/* Stats */}
                                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
                                            <div className="flex items-center gap-1">
                                                <Users size={16} />
                                                <span>{workspace.memberCount ?? workspace.members?.length ?? 0} members</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Globe size={16} />
                                                <span>{workspace.channelCount ?? 0} channels</span>
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
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Create Workspace Modal */}
            <CreateWorkspaceModal
                isOpen={modalOpen}
                onClose={handleCloseModal}
                createStep={createStep}
                setCreateStep={setCreateStep}
                createData={createData}
                setCreateData={setCreateData}
                nameError={nameError}
                setNameError={setNameError}
                termsAccepted={termsAccepted}
                setTermsAccepted={setTermsAccepted}
                onSubmit={handleSubmit}
                getIconComponent={getIconComponent}
                user={user}
            />

            {/* Manage Members Modal */}
            {membersWorkspace && (
                <WorkspaceMembersModal
                    workspace={membersWorkspace}
                    onClose={() => setMembersWorkspace(null)}
                    onMemberCountChange={(count) => {
                        setWorkspaces(prev => prev.map(w =>
                            String(w._id) === String(membersWorkspace._id)
                                ? { ...w, memberCount: count }
                                : w
                        ));
                    }}
                />
            )}
        </div>
    );
};

export default WorkspacesManagement;
