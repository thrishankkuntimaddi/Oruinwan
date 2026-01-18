
import React, { useState, useEffect, useCallback } from 'react';
import { X, Briefcase, Users, Shield, Trash2, Plus, Edit2, Save, Search, AlertTriangle, Monitor } from 'lucide-react';
import { updateDepartment, addWorkspaceToDepartment, removeWorkspaceFromDepartment, assignUserToDepartment, removeUserFromDepartment, deleteDepartment } from '../../services/departmentService';
import { getCompanyMembers } from '../../services/companyService';
import { workspaceService } from '../../services/workspaceService';
import { useToast } from '../../contexts/ToastContext';

const DepartmentDetailsModal = ({ isOpen, onClose, department, companyId, onUpdate }) => {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(false);

    // Data States
    const [allWorkspaces, setAllWorkspaces] = useState([]);
    const [allUsers, setAllUsers] = useState([]);

    // UI States
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({ name: '', description: '' });

    // Selections
    const [selectedWorkspace, setSelectedWorkspace] = useState('');
    const [userSearch, setUserSearch] = useState('');

    const fetchData = useCallback(async () => {
        try {
            const [wsRes, usrRes] = await Promise.all([
                workspaceService.getWorkspaces(companyId),
                getCompanyMembers(companyId)
            ]);
            // Fix: workspaceService returns axios response, need .data
            setAllWorkspaces(wsRes.data?.workspaces || []);
            setAllUsers(usrRes.members || []);
        } catch (error) {
            console.error("Failed to fetch data", error);
        }
    }, [companyId]);

    useEffect(() => {
        if (isOpen && department) {
            setFormData({ name: department.name, description: department.description || '' });
            fetchData();
        }
    }, [isOpen, department, fetchData]);

    // --- Actions ---

    const handleUpdateDetails = async () => {
        try {
            setLoading(true);
            await updateDepartment(department._id, formData);
            showToast("Department updated", "success");
            setEditMode(false);
            onUpdate();
        } catch (error) {
            showToast("Failed to update", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleSetHead = async (userId) => {
        try {
            setLoading(true);
            await updateDepartment(department._id, { head: userId });
            showToast(userId ? "Manager assigned" : "Manager removed", "success");
            onUpdate();
        } catch (error) {
            showToast("Failed to update manager", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleAddMember = async (userId) => {
        try {
            setLoading(true);
            await assignUserToDepartment(userId, department._id);
            showToast("Member added", "success");
            onUpdate();
            setUserSearch(''); // reset search
        } catch (error) {
            showToast("Failed to add member", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveMember = async (userId) => {
        if (!window.confirm("Remove this member from the department?")) return;
        try {
            setLoading(true);
            await removeUserFromDepartment(userId, department._id);
            showToast("Member removed", "success");
            onUpdate();
        } catch (error) {
            showToast("Failed to remove member", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleAddWorkspace = async () => {
        if (!selectedWorkspace) return;
        try {
            setLoading(true);
            await addWorkspaceToDepartment(department._id, selectedWorkspace);
            showToast("Workspace linked", "success");
            onUpdate();
            setSelectedWorkspace('');
        } catch (error) {
            showToast("Failed to link workspace", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveWorkspace = async (wsId) => {
        if (!window.confirm("Unlink this workspace?")) return;
        try {
            setLoading(true);
            await removeWorkspaceFromDepartment(department._id, wsId);
            showToast("Workspace unlinked", "success");
            onUpdate();
        } catch (error) {
            showToast("Failed to unlink workspace", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteDept = async () => {
        const confirmName = prompt(`To confirm deletion, type "${department.name}"`);
        if (confirmName !== department.name) return;

        try {
            setLoading(true);
            await deleteDepartment(department._id);
            showToast("Department deleted", "success");
            onClose();
            onUpdate();
        } catch (error) {
            showToast("Failed to delete", "error");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !department) return null;

    // Computed Lists
    const currentMemberIds = department.members?.map(m => m._id) || [];
    const availableUsers = allUsers.filter(u =>
        !currentMemberIds.includes(u._id) &&
        (u.username.toLowerCase().includes(userSearch.toLowerCase()) || u.email.includes(userSearch.toLowerCase()))
    );

    const linkedWsIds = department.workspaces?.map(ws => typeof ws === 'object' ? ws._id : ws) || [];
    const availableWorkspaces = allWorkspaces.filter(ws => !linkedWsIds.includes(ws._id));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div className="relative w-full max-w-5xl bg-white max-h-[85vh] shadow-2xl flex flex-col rounded-2xl overflow-hidden animate-scaleIn ring-1 ring-white/20">
                {/* --- Header --- */}
                <div className="p-8 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white relative overflow-hidden shrink-0">
                    <div className="absolute top-0 right-0 p-40 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

                    <div className="flex justify-between items-start relative z-10">
                        <div className="flex-1 mr-8">
                            {editMode ? (
                                <div className="space-y-4 animate-fadeIn max-w-2xl">
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white font-black text-2xl focus:ring-2 focus:ring-indigo-500 outline-none placeholder-white/30"
                                        placeholder="Department Name"
                                    />
                                    <textarea
                                        rows="2"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none placeholder-white/30 resize-none"
                                        placeholder="Description..."
                                    />
                                    <div className="flex gap-3 mt-2">
                                        <button onClick={handleUpdateDetails} disabled={loading} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 shadow-lg shadow-indigo-500/20">
                                            <Save size={16} /> Save Changes
                                        </button>
                                        <button onClick={() => setEditMode(false)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition-colors">
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <div className="flex items-center gap-4 group">
                                        <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md border border-white/10">
                                            <Briefcase size={32} className="text-indigo-300" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <h2 className="text-3xl font-black tracking-tight">{department.name}</h2>
                                                <button onClick={() => setEditMode(true)} className="p-2 hover:bg-white/10 rounded-lg transition-all text-slate-400 hover:text-white flex items-center gap-2">
                                                    <Edit2 size={16} /> <span className="text-xs font-bold uppercase tracking-wider">Edit</span>
                                                </button>
                                            </div>
                                            <p className="text-slate-400 font-medium mt-1 max-w-2xl leading-relaxed">
                                                {department.description || 'No description provided.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors backdrop-blur-md">
                            <X size={24} />
                        </button>
                    </div>

                    {/* Stats */}
                    {!editMode && (
                        <div className="absolute bottom-0 right-0 p-8 flex gap-8 z-10">
                            <div className="text-right">
                                <div className="text-3xl font-black text-white tracking-tight">{department.members?.length || 0}</div>
                                <div className="text-xs uppercase font-bold text-indigo-400 tracking-wider">Members</div>
                            </div>
                            <div className="text-right">
                                <div className="text-3xl font-black text-white tracking-tight">{department.workspaces?.length || 0}</div>
                                <div className="text-xs uppercase font-bold text-emerald-400 tracking-wider">Workspaces</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* --- Body Layout (Sidebar + Content) --- */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Navigation Sidebar */}
                    <div className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col p-4 shrink-0">
                        <nav className="space-y-1">
                            {['overview', 'people', 'workspaces', 'settings'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-3 transition-all ${activeTab === tab
                                        ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200'
                                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                                        }`}
                                >
                                    {tab === 'overview' && <Monitor size={18} />}
                                    {tab === 'people' && <Users size={18} />}
                                    {tab === 'workspaces' && <Briefcase size={18} />}
                                    {tab === 'settings' && <Shield size={18} />}
                                    <span className="capitalize">{tab}</span>
                                </button>
                            ))}
                        </nav>

                        <div className="mt-auto pt-6 border-t border-slate-200">
                            <div className="text-[10px] text-slate-400 uppercase font-black tracking-wider mb-2">Created By</div>
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-200"></div>
                                <span className="text-xs font-bold text-slate-600">Administrator</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1">{new Date(department.createdAt).toLocaleDateString()}</div>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-8 bg-white custom-scrollbar">
                        {/* OVERVIEW TAB */}
                        {activeTab === 'overview' && (
                            <div className="space-y-8 animate-fadeIn max-w-3xl">
                                {/* Leadership Card */}
                                <section>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Department Leadership</h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {department.head ? (
                                            <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-2xl border border-indigo-100 shadow-sm flex flex-col justify-between h-40 group relative overflow-hidden">
                                                <div className="absolute top-0 right-0 p-8 bg-indigo-500/5 rounded-full -mr-4 -mt-4"></div>
                                                <div className="flex items-center gap-4 z-10">
                                                    {department.head.profilePicture ? (
                                                        <img src={department.head.profilePicture} alt="" className="w-14 h-14 rounded-full ring-4 ring-white shadow-md" />
                                                    ) : (
                                                        <div className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-md ring-4 ring-white">
                                                            {department.head.username?.charAt(0)}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-0.5">Manager</div>
                                                        <div className="font-bold text-slate-800 text-lg">{department.head.username}</div>
                                                        <div className="text-xs text-slate-500">{department.head.email}</div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleSetHead(null)}
                                                    className="self-end text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors z-10"
                                                >
                                                    Remove Manager
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setActiveTab('people')}
                                                className="h-40 border-2 border-dashed border-slate-200 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50 transition-all flex flex-col items-center justify-center gap-3 group"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                    <Plus size={20} />
                                                </div>
                                                <span className="font-bold text-slate-500 group-hover:text-indigo-700">Assign Manager</span>
                                            </button>
                                        )}
                                    </div>
                                </section>
                            </div>
                        )}

                        {/* PEOPLE TAB */}
                        {activeTab === 'people' && (
                            <div className="space-y-8 animate-fadeIn max-w-4xl">
                                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <Search size={20} className="text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search to add members..."
                                        className="flex-1 bg-transparent outline-none text-sm font-medium"
                                        value={userSearch}
                                        onChange={(e) => setUserSearch(e.target.value)}
                                    />
                                </div>

                                {userSearch && availableUsers.length > 0 && (
                                    <div className="bg-white border border-slate-100 rounded-xl shadow-lg -mt-4 p-2 animate-slideDown max-h-60 overflow-y-auto z-10 relative">
                                        {availableUsers.map(u => (
                                            <button
                                                key={u._id}
                                                onClick={() => handleAddMember(u._id)}
                                                className="w-full text-left p-3 hover:bg-indigo-50 rounded-lg flex items-center justify-between group transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold">{u.username[0]}</div>
                                                    <span className="font-bold text-slate-700">{u.username}</span>
                                                </div>
                                                <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-1 rounded opacity-0 group-hover:opacity-100">Add to Dept</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {department.members?.map(m => (
                                        <div key={m._id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all group relative">
                                            {department.head?._id === m._id && (
                                                <div className="absolute top-2 right-2 text-indigo-500">
                                                    <Shield size={16} fill="currentColor" />
                                                </div>
                                            )}
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500">
                                                    {m.username.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800 line-clamp-1">{m.username}</div>
                                                    <div className="text-xs text-slate-400 line-clamp-1">{m.email}</div>
                                                </div>
                                            </div>

                                            <div className="flex gap-2 mt-4 pt-3 border-t border-slate-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {department.head?._id !== m._id && (
                                                    <>
                                                        <button onClick={() => handleSetHead(m._id)} className="flex-1 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-bold rounded hover:bg-indigo-100 transition-colors">
                                                            Promote
                                                        </button>
                                                        <button onClick={() => handleRemoveMember(m._id)} className="px-2 py-1.5 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* WORKSPACES TAB */}
                        {activeTab === 'workspaces' && (
                            <div className="space-y-8 animate-fadeIn max-w-4xl">
                                <div className="flex items-end gap-3 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Link New Workspace</label>
                                        <select
                                            className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                                            value={selectedWorkspace}
                                            onChange={(e) => setSelectedWorkspace(e.target.value)}
                                        >
                                            <option value="">Choose a workspace...</option>
                                            {availableWorkspaces.map(ws => (
                                                <option key={ws._id} value={ws._id}>{ws.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        onClick={handleAddWorkspace}
                                        disabled={!selectedWorkspace || loading}
                                        className="h-[46px] px-6 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 font-bold shadow-lg shadow-indigo-500/20"
                                    >
                                        Link Access
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {department.workspaces?.map((ws, idx) => {
                                        const wsName = typeof ws === 'object' ? ws.name : 'Unknown';
                                        const wsDesc = typeof ws === 'object' ? ws.description : '';
                                        const wsId = typeof ws === 'object' ? ws._id : ws;
                                        return (
                                            <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex justify-between items-start group">
                                                <div className="flex gap-4">
                                                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl h-fit">
                                                        <Briefcase size={24} />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-800 text-lg">{wsName}</div>
                                                        <div className="text-xs text-slate-500 mt-1 line-clamp-2">{wsDesc || 'No description'}</div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveWorkspace(wsId)}
                                                    className="text-slate-300 hover:text-white p-2 hover:bg-red-500 rounded-lg transition-all"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* SETTINGS TAB */}
                        {activeTab === 'settings' && (
                            <div className="space-y-6 animate-fadeIn max-w-xl mx-auto mt-8">
                                <div className="bg-red-50 rounded-2xl border border-red-100 p-8 text-center">
                                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <AlertTriangle size={32} />
                                    </div>
                                    <h3 className="text-red-900 font-bold text-lg mb-2">Delete Department</h3>
                                    <p className="text-sm text-red-700/80 mb-8 leading-relaxed">
                                        This action will permanently delete the <strong>{department.name}</strong> department.
                                        All members will be unassigned, and workspace links will be broken.
                                    </p>
                                    <button
                                        onClick={handleDeleteDept}
                                        className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-3"
                                    >
                                        <Trash2 size={20} /> Delete Department
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DepartmentDetailsModal;
