// client/src/pages/admin/WorkspaceMembersModal.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    X, Users, UserPlus, Search, Shield, Crown,
    UserMinus, ChevronDown, Check, Loader2, Circle
} from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

// ── Role badge ────────────────────────────────────────────────────────────────
const RoleBadge = ({ role, type = 'workspace' }) => {
    const cfg = {
        owner:   { bg: 'bg-yellow-900/40', text: 'text-yellow-400', label: 'Owner' },
        admin:   { bg: 'bg-purple-900/40', text: 'text-purple-400', label: 'Admin' },
        member:  { bg: 'bg-blue-900/40',   text: 'text-blue-400',   label: 'Member' },
        manager: { bg: 'bg-green-900/40',  text: 'text-green-400',  label: 'Manager' },
        guest:   { bg: 'bg-gray-700/40',   text: 'text-gray-400',   label: 'Guest' },
    };
    const c = cfg[role] || cfg.member;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
            {role === 'owner' && <Crown size={10} />}
            {role === 'admin' && <Shield size={10} />}
            {c.label}
        </span>
    );
};

// ── Avatar ────────────────────────────────────────────────────────────────────
const Avatar = ({ user, size = 'md' }) => {
    const sz = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
    if (user.profilePicture) {
        return <img src={user.profilePicture} alt={user.username} className={`${sz} rounded-full object-cover flex-shrink-0`} />;
    }
    const initials = (user.username || '?').charAt(0).toUpperCase();
    const colors = ['bg-indigo-600', 'bg-violet-600', 'bg-pink-600', 'bg-sky-600', 'bg-emerald-600'];
    const color = colors[initials.charCodeAt(0) % colors.length];
    return (
        <div className={`${sz} ${color} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0`}>
            {initials}
        </div>
    );
};

// ── Role selector dropdown ────────────────────────────────────────────────────
const RoleSelector = ({ value, onChange }) => {
    const [open, setOpen] = useState(false);
    const roles = [
        { value: 'member', label: 'Member' },
        { value: 'admin',  label: 'Admin'  },
    ];
    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-1 px-2.5 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-semibold text-gray-200 transition-colors"
            >
                {roles.find(r => r.value === value)?.label}
                <ChevronDown size={12} />
            </button>
            {open && (
                <div className="absolute right-0 top-full mt-1 w-28 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
                    {roles.map(r => (
                        <button
                            key={r.value}
                            type="button"
                            onClick={() => { onChange(r.value); setOpen(false); }}
                            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-gray-700 transition-colors"
                        >
                            {r.label}
                            {value === r.value && <Check size={12} className="text-indigo-400" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ── Main Modal ────────────────────────────────────────────────────────────────
const WorkspaceMembersModal = ({ workspace, onClose, onMemberCountChange }) => {
    const { showToast } = useToast();

    const [tab, setTab] = useState('members'); // 'members' | 'add'
    const [members,        setMembers]        = useState([]);
    const [companyMembers, setCompanyMembers] = useState([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [loadingCompany, setLoadingCompany] = useState(false);
    const [search,         setSearch]         = useState('');
    const [addSearch,      setAddSearch]      = useState('');
    const [addingId,       setAddingId]       = useState(null);
    const [removingId,     setRemovingId]     = useState(null);
    const [roleMap,        setRoleMap]        = useState({}); // { userId: 'member'|'admin' }

    // ── Fetch current workspace members ──────────────────────────────────────
    const fetchMembers = useCallback(async () => {
        setLoadingMembers(true);
        try {
            const res = await api.get(`/api/admin-dashboard/workspaces/${workspace._id}/members`);
            setMembers(res.data.members || []);
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to load members', 'error');
        } finally {
            setLoadingMembers(false);
        }
    }, [workspace._id, showToast]);

    // ── Fetch company-wide members ────────────────────────────────────────────
    const fetchCompanyMembers = useCallback(async () => {
        setLoadingCompany(true);
        try {
            const res = await api.get('/api/admin-dashboard/company-members');
            setCompanyMembers(res.data.members || []);
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to load company members', 'error');
        } finally {
            setLoadingCompany(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchMembers();
        fetchCompanyMembers();
    }, [fetchMembers, fetchCompanyMembers]);

    // ── Add member ────────────────────────────────────────────────────────────
    const handleAdd = async (userId) => {
        setAddingId(userId);
        try {
            const role = roleMap[userId] || 'member';
            const res = await api.post(`/api/admin-dashboard/workspaces/${workspace._id}/members`, { userId, role });
            setMembers(prev => [...prev, res.data.member]);
            showToast(res.data.message, 'success');
            onMemberCountChange?.(members.length + 1);
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to add member', 'error');
        } finally {
            setAddingId(null);
        }
    };

    // ── Remove member ─────────────────────────────────────────────────────────
    const handleRemove = async (userId) => {
        setRemovingId(userId);
        try {
            await api.delete(`/api/admin-dashboard/workspaces/${workspace._id}/members/${userId}`);
            setMembers(prev => prev.filter(m => String(m._id) !== String(userId)));
            showToast('Member removed', 'success');
            onMemberCountChange?.(members.length - 1);
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to remove member', 'error');
        } finally {
            setRemovingId(null);
        }
    };

    // ── Computed: company members NOT yet in this workspace ───────────────────
    const memberIds = new Set(members.map(m => String(m._id)));
    const addableMembers = companyMembers.filter(m => !memberIds.has(String(m._id)));

    const filteredMembers  = members.filter(m =>
        m.username?.toLowerCase().includes(search.toLowerCase()) ||
        m.email?.toLowerCase().includes(search.toLowerCase())
    );
    const filteredAddable  = addableMembers.filter(m =>
        m.username?.toLowerCase().includes(addSearch.toLowerCase()) ||
        m.email?.toLowerCase().includes(addSearch.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-end bg-black/60 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

            {/* Panel */}
            <div className="w-full max-w-lg h-full bg-gray-900 border-l border-gray-700/80 flex flex-col shadow-2xl animate-slideInRight">

                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-700/80 flex items-center justify-between flex-shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: workspace.color || '#4f46e5' }}>
                                <Users size={16} className="text-white" />
                            </div>
                            {workspace.name}
                        </h2>
                        <p className="text-xs text-gray-400 mt-0.5 ml-10">Workspace Members · {members.length} total</p>
                    </div>
                    <button onClick={onClose}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white">
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-700/80 flex-shrink-0">
                    {[
                        { key: 'members', label: 'Members', icon: Users,    count: members.length },
                        { key: 'add',     label: 'Add Members', icon: UserPlus, count: addableMembers.length },
                    ].map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-colors border-b-2 ${
                                tab === t.key
                                    ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                            }`}
                        >
                            <t.icon size={16} />
                            {t.label}
                            <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                                tab === t.key ? 'bg-indigo-500/20 text-indigo-400' : 'bg-gray-700 text-gray-400'
                            }`}>{t.count}</span>
                        </button>
                    ))}
                </div>

                {/* ── Tab: Members ──────────────────────────────────────────── */}
                {tab === 'members' && (
                    <div className="flex flex-col flex-1 min-h-0">
                        {/* Search */}
                        <div className="px-4 py-3 border-b border-gray-700/50 flex-shrink-0">
                            <div className="relative">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Search members…"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                />
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1 custom-scrollbar">
                            {loadingMembers ? (
                                <div className="flex items-center justify-center py-16">
                                    <Loader2 size={28} className="animate-spin text-indigo-500" />
                                </div>
                            ) : filteredMembers.length === 0 ? (
                                <div className="text-center py-16 text-gray-500">
                                    <Users size={36} className="mx-auto mb-3 opacity-40" />
                                    <p className="text-sm">{search ? 'No members match your search' : 'No members yet'}</p>
                                </div>
                            ) : filteredMembers.map(m => (
                                <div key={m._id}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-800/60 transition-colors group">
                                    <div className="relative">
                                        <Avatar user={m} />
                                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-gray-900 ${m.isOnline ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-semibold text-gray-200 truncate">{m.username}</p>
                                            <RoleBadge role={m.workspaceRole} type="workspace" />
                                        </div>
                                        <p className="text-xs text-gray-400 truncate">{m.companyEmail || m.email}</p>
                                        {m.companyEmail && m.email && m.companyEmail !== m.email && (
                                            <p className="text-xs text-gray-600 truncate">{m.email}</p>
                                        )}
                                    </div>
                                    {m.workspaceRole !== 'owner' && (
                                        <button
                                            onClick={() => handleRemove(m._id)}
                                            disabled={removingId === m._id}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                                            title="Remove from workspace"
                                        >
                                            {removingId === m._id
                                                ? <Loader2 size={14} className="animate-spin" />
                                                : <UserMinus size={14} />
                                            }
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Tab: Add Members ──────────────────────────────────────── */}
                {tab === 'add' && (
                    <div className="flex flex-col flex-1 min-h-0">
                        {/* Info banner */}
                        <div className="mx-4 mt-3 px-3 py-2 bg-indigo-900/20 border border-indigo-700/30 rounded-xl flex items-start gap-2 flex-shrink-0">
                            <Shield size={14} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-indigo-300">
                                Only <strong>company members</strong> can be added. External users are never shown.
                            </p>
                        </div>

                        {/* Search */}
                        <div className="px-4 py-3 flex-shrink-0">
                            <div className="relative">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Search company members…"
                                    value={addSearch}
                                    onChange={e => setAddSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                />
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto px-4 space-y-1 pb-4 custom-scrollbar">
                            {loadingCompany ? (
                                <div className="flex items-center justify-center py-16">
                                    <Loader2 size={28} className="animate-spin text-indigo-500" />
                                </div>
                            ) : filteredAddable.length === 0 ? (
                                <div className="text-center py-16 text-gray-500">
                                    <UserPlus size={36} className="mx-auto mb-3 opacity-40" />
                                    <p className="text-sm font-medium text-gray-400">
                                        {addSearch ? 'No company members match your search' : 'All company members are already in this workspace'}
                                    </p>
                                </div>
                            ) : filteredAddable.map(m => (
                                <div key={m._id}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-800/60 transition-colors">
                                    <Avatar user={m} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-semibold text-gray-200 truncate">{m.username}</p>
                                            <RoleBadge role={m.companyRole} />
                                        </div>
                                        <p className="text-xs text-gray-400 truncate">{m.companyEmail || m.jobTitle || m.email}</p>
                                        {m.companyEmail && m.email && m.companyEmail !== m.email && (
                                            <p className="text-xs text-gray-600 truncate">{m.email}</p>
                                        )}
                                    </div>

                                    {/* Role selector + Add button */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <RoleSelector
                                            value={roleMap[m._id] || 'member'}
                                            onChange={role => setRoleMap(prev => ({ ...prev, [m._id]: role }))}
                                        />
                                        <button
                                            onClick={() => handleAdd(m._id)}
                                            disabled={addingId === m._id}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-60"
                                        >
                                            {addingId === m._id
                                                ? <Loader2 size={12} className="animate-spin" />
                                                : <UserPlus size={12} />
                                            }
                                            Add
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorkspaceMembersModal;
