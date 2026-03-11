import React, { useState, useEffect } from 'react';
import { Search, Mail, BarChart2, Briefcase } from 'lucide-react';
import { useCompany } from '../../contexts/CompanyContext';
import { getCompanyMembers } from '../../services/companyService';
import { getDepartments, assignUserToDepartment } from '../../services/departmentService';
import { workspaceService } from '../../services/workspaceService';
import { InviteUserModal } from '../../components/company';
import EmployeeActionsMenu from '../../components/company/EmployeeActionsMenu';
import { useToast } from '../../contexts/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#10b981', '#f59e0b'];

const UserManagement = () => {
    const { company } = useCompany();
    const { showToast } = useToast();
    const { canInviteUsers, canSuspendUsers, companyRole } = usePermissions();
    const [allMembers, setAllMembers] = useState([]);
    const [filteredMembers, setFilteredMembers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [workspaces, setWorkspaces] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showStats, setShowStats] = useState(false); // Hidden by default

    // Filters
    const [tab, setTab] = useState('all'); // all, admins, managers, members, guests
    const [searchQuery, setSearchQuery] = useState('');
    const [deptFilter, setDeptFilter] = useState('all');
    const [roleFilter] = useState('all');
    const [workspaceFilter, setWorkspaceFilter] = useState('all');

    // Selection
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

    // Bulk Action Modal
    const [isBulkDeptOpen, setIsBulkDeptOpen] = useState(false);
    const [selectedBulkDept, setSelectedBulkDept] = useState('');
    const [bulkProcessing, setBulkProcessing] = useState(false);

    const fetchData = React.useCallback(async () => {
        if (!company?._id) {
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const [membersRes, deptsRes, workspacesRes] = await Promise.all([
                getCompanyMembers(company._id),
                getDepartments(company._id),
                workspaceService.getWorkspaces(company._id)
            ]);
            setAllMembers(membersRes.members || []);
            setDepartments(deptsRes.departments || []);
            setWorkspaces(Array.isArray(workspacesRes.data?.workspaces) ? workspacesRes.data.workspaces : []);
        } catch (err) {
            console.error("Failed to fetch data", err);
            showToast("Failed to load users", "error");
        } finally {
            setLoading(false);
        }
    }, [company?._id, showToast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Filtering Logic
    useEffect(() => {
        let result = allMembers;

        // 1. Tab Filter
        if (tab === 'admins') {
            result = result.filter(m => ['owner', 'admin'].includes(m.companyRole));
        } else if (tab === 'managers') {
            result = result.filter(m => m.companyRole === 'manager');
        } else if (tab === 'members') {
            result = result.filter(m => m.companyRole === 'member');
        } else if (tab === 'guests') {
            result = result.filter(m => m.companyRole === 'guest');
        }

        // 2. Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(m =>
                m.username?.toLowerCase().includes(q) ||
                m.email?.toLowerCase().includes(q) ||
                m.companyEmail?.toLowerCase().includes(q) ||
                m.jobTitle?.toLowerCase().includes(q)
            );
        }

        // 3. Department Filter
        if (deptFilter !== 'all') {
            result = result.filter(m =>
                m.departments && m.departments.some(d => d._id === deptFilter || d === deptFilter)
            );
        }

        // 4. Workspace Filter
        if (workspaceFilter !== 'all') {
            result = result.filter(m =>
                m.workspaces && m.workspaces.some(ws =>
                    ws.workspace?._id === workspaceFilter || ws.workspace === workspaceFilter
                )
            );
        }

        // 5. Role Filter (Specific)
        if (roleFilter !== 'all') {
            result = result.filter(m => m.companyRole === roleFilter);
        }

        setFilteredMembers(result);
    }, [allMembers, tab, searchQuery, deptFilter, roleFilter, workspaceFilter]);


    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedUsers(filteredMembers.map(m => m._id));
        } else {
            setSelectedUsers([]);
        }
    };

    const handleSelectUser = (id) => {
        if (selectedUsers.includes(id)) {
            setSelectedUsers(selectedUsers.filter(uid => uid !== id));
        } else {
            setSelectedUsers([...selectedUsers, id]);
        }
    };

    const handleBulkAssign = async () => {
        if (!selectedBulkDept) return;

        try {
            setBulkProcessing(true);
            const promises = selectedUsers.map(userId =>
                assignUserToDepartment(userId, selectedBulkDept)
            );
            await Promise.all(promises);
            showToast(`Assigned ${selectedUsers.length} users to department`, 'success');
            setIsBulkDeptOpen(false);
            setSelectedUsers([]);
            fetchData(); // Refresh to show new deps
        } catch (error) {
            console.error(error);
            showToast("Failed to assign users", "error");
        } finally {
            setBulkProcessing(false);
        }
    };

    // --- Statistics Calculations ---
    const roleStats = React.useMemo(() => {
        const stats = {};
        // Use filteredMembers for dynamic updates
        filteredMembers.forEach(m => {
            const role = m.companyRole || 'Unknown';
            stats[role] = (stats[role] || 0) + 1;
        });
        return Object.keys(stats).map(key => ({
            name: key.charAt(0).toUpperCase() + key.slice(1),
            value: stats[key]
        }));
    }, [filteredMembers]);

    // Dynamic Chart: Departments OR Workspaces
    const chartStats = React.useMemo(() => {
        const stats = {};
        const isDeptSelected = deptFilter !== 'all';

        filteredMembers.forEach(m => {
            if (isDeptSelected) {
                // Show Workspaces if Department is selected
                if (m.workspaces && m.workspaces.length > 0) {
                    m.workspaces.forEach(wsItem => {
                        // wsItem = { workspace: { name: 'Foo' }, ... }
                        // Ensure optional chaining/existence
                        const name = wsItem.workspace?.name || 'Unknown';
                        stats[name] = (stats[name] || 0) + 1;
                    });
                } else {
                    stats['No Workspace'] = (stats['No Workspace'] || 0) + 1;
                }
            } else {
                // Show Departments
                if (m.departments && m.departments.length > 0) {
                    m.departments.forEach(d => {
                        const name = d.name || 'Unknown';
                        stats[name] = (stats[name] || 0) + 1;
                    });
                } else {
                    stats['No Dept'] = (stats['No Dept'] || 0) + 1;
                }
            }
        });

        return {
            title: isDeptSelected ? 'Workspace Distribution' : 'Department Breakdown',
            data: Object.keys(stats).map(key => ({
                name: key,
                value: stats[key]
            })).sort((a, b) => b.value - a.value).slice(0, 5) // Top 5
        };
    }, [filteredMembers, deptFilter]);

    return (
        <React.Fragment>
            <header className="h-16 px-8 flex items-center justify-between z-10 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 transition-colors duration-200">
                <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white">People</h2>
                    <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">Team & Access</p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setShowStats(!showStats)}
                        className={`p-2 rounded-lg transition-colors ${showStats
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                            : 'text-slate-400 dark:text-gray-500 hover:bg-slate-50 dark:hover:bg-gray-700'
                            }`}
                        title={showStats ? 'Hide Statistics' : 'Show Statistics'}
                    >
                        <BarChart2 size={20} />
                    </button>
                    {canInviteUsers && (
                        <button
                            onClick={() => setIsInviteModalOpen(true)}
                            className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2"
                        >
                            <Mail size={16} /> Invite People
                        </button>
                    )}
                </div>
            </header>

            <div className="flex-1 overflow-y-auto w-full px-8 py-6 z-10 custom-scrollbar bg-gray-50 dark:bg-gray-900 transition-colors duration-200">

                {/* --- Visual Statistics Section --- */}
                {showStats && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-slideDown">
                        {/* Card 1: Totals */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-slate-100 dark:border-gray-700 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                            <div>
                                <h3 className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Filtered Users</h3>
                                <div className="text-4xl font-black text-slate-800 dark:text-white">{filteredMembers.length}</div>
                                <div className="text-sm text-green-600 dark:text-green-400 font-bold mt-1.5 flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                    {filteredMembers.filter(m => m.isOnline).length} in view are Online
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-50 dark:border-gray-700 space-y-2">
                                <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-gray-400">
                                    <span>Total in Company:</span>
                                    <span className="font-bold text-slate-800 dark:text-white">{allMembers.length}</span>
                                </div>
                                <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-gray-400">
                                    <span>Selected:</span>
                                    <span className={`font-bold ${selectedUsers.length > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-gray-600'}`}>{selectedUsers.length}</span>
                                </div>
                            </div>
                        </div>

                        {/* Card 2: Role Distribution (Dynamic) */}
                        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-slate-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all">
                            <h3 className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Role Distribution</h3>
                            <div className="h-32 flex items-center">
                                <ResponsiveContainer width="40%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={roleStats}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={30}
                                            outerRadius={50}
                                            paddingAngle={5}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {roleStats.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: '#1f2937', color: '#f3f4f6' }}
                                            itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#f3f4f6' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="ml-4 flex-1 flex flex-col gap-1 overflow-y-auto max-h-32 pr-2 custom-scrollbar">
                                    {roleStats.map((entry, index) => (
                                        <div key={index} className="flex items-center justify-between text-xs font-medium w-full">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                                <span className="text-slate-600 dark:text-gray-300">{entry.name}</span>
                                            </div>
                                            <span className="text-slate-400 dark:text-gray-500 font-bold">{entry.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Card 3: Dynamic Context (Dept or Workspace) */}
                        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-slate-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all relative">
                            <h3 className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                                {deptFilter !== 'all' && <Briefcase size={12} />}
                                {chartStats.title}
                            </h3>
                            <div className="h-32">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartStats.data} layout="vertical" margin={{ left: 0, right: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#374151" strokeOpacity={0.1} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10, fill: '#9ca3af' }} interval={0} />
                                        <Tooltip
                                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: '#1f2937', color: '#f3f4f6' }}
                                            itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#f3f4f6' }}
                                        />
                                        <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={15}>
                                            {chartStats.data.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            {deptFilter !== 'all' && (
                                <div className="absolute top-4 right-4 text-[10px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
                                    Filtered by Dept
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Tabs & Actions */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div className="flex p-1 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg transition-colors">
                        {['all', 'admins', 'managers', 'members', 'guests'].map((t) => (
                            <button
                                key={t}
                                onClick={() => setTab(t)}
                                className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${tab === t
                                    ? 'bg-slate-100 dark:bg-gray-700 text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200'
                                    }`}
                            >
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-3">
                        {selectedUsers.length > 0 && canSuspendUsers && (
                            <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg border border-indigo-100 dark:border-indigo-800 animate-fadeIn transition-colors">
                                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400">{selectedUsers.length} selected</span>
                                <button
                                    onClick={() => setIsBulkDeptOpen(true)}
                                    className="text-xs font-bold text-white bg-indigo-600 px-2 py-1 rounded hover:bg-indigo-700"
                                >
                                    Assign Dept
                                </button>
                            </div>
                        )}

                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-48 lg:w-64 transition-colors"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <select
                                value={deptFilter}
                                onChange={(e) => setDeptFilter(e.target.value)}
                                className="px-3 py-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-sm font-medium text-slate-600 dark:text-gray-300 focus:outline-none transition-colors"
                            >
                                <option value="all">All Departments</option>
                                {departments.map(d => (
                                    <option key={d._id} value={d._id}>{d.name}</option>
                                ))}
                            </select>
                            <select
                                value={workspaceFilter}
                                onChange={(e) => setWorkspaceFilter(e.target.value)}
                                className="px-3 py-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-sm font-medium text-slate-600 dark:text-gray-300 focus:outline-none transition-colors"
                            >
                                <option value="all">All Workspaces</option>
                                {workspaces.map(ws => (
                                    <option key={ws._id} value={ws._id}>{ws.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden transition-colors">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-gray-700/50 border-b border-slate-100 dark:border-gray-700">
                                <th className="px-4 py-4 w-12 text-center">
                                    <input
                                        type="checkbox"
                                        className="rounded border-slate-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-gray-700"
                                        onChange={handleSelectAll}
                                        checked={filteredMembers.length > 0 && selectedUsers.length === filteredMembers.length}
                                    />
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Departments</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-gray-700/50">
                            {loading ? (
                                <tr><td colSpan="6" className="text-center py-12 text-slate-500 dark:text-gray-400">Loading members...</td></tr>
                            ) : filteredMembers.length === 0 ? (
                                <tr><td colSpan="6" className="text-center py-12 text-slate-500 dark:text-gray-400">No members found</td></tr>
                            ) : (
                                filteredMembers.map(member => (
                                    <tr key={member._id} className={`hover:bg-slate-50/50 dark:hover:bg-gray-700/30 transition-colors group ${selectedUsers.includes(member._id) ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
                                        <td className="px-4 py-4 text-center">
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-gray-700"
                                                checked={selectedUsers.includes(member._id)}
                                                onChange={() => handleSelectUser(member._id)}
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                {member.profilePicture ? (
                                                    <img src={member.profilePicture} alt="" className="w-8 h-8 rounded-full object-cover" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-gray-700 flex items-center justify-center font-bold text-slate-500 dark:text-gray-400 text-xs">
                                                        {member.username?.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="font-bold text-slate-800 dark:text-white text-sm">{member.username}</div>
                                                    {member.jobTitle && (
                                                        <div className="text-xs text-indigo-500 dark:text-indigo-400 font-medium">{member.jobTitle}</div>
                                                    )}
                                                    {/* Company email = primary; personal email shown below if different */}
                                                    <div className="text-xs text-slate-400 dark:text-gray-500 truncate">
                                                        {member.companyEmail || member.email}
                                                    </div>
                                                    {member.companyEmail && member.email && member.companyEmail !== member.email && (
                                                        <div className="text-xs text-slate-300 dark:text-gray-600 truncate">
                                                            {member.email}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border capitalize ${member.companyRole === 'owner' ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-100 dark:border-purple-900/30' :
                                                member.companyRole === 'admin' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30' :
                                                    member.companyRole === 'manager' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/30' :
                                                        'bg-slate-50 dark:bg-gray-700/50 text-slate-600 dark:text-gray-400 border-slate-100 dark:border-gray-600'
                                                }`}>
                                                {member.companyRole}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {member.departments && member.departments.length > 0 ? (
                                                    member.departments.map((d, i) => (
                                                        <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300">
                                                            {d.name || 'Unknown'}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-slate-300 dark:text-gray-600 text-xs italic">No Dept</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5">
                                                <div className={`w-2 h-2 rounded-full ${member.isOnline ? 'bg-green-500' : 'bg-slate-300 dark:bg-gray-600'}`}></div>
                                                <span className="text-xs text-slate-500 dark:text-gray-400 font-medium">{member.isOnline ? 'Online' : 'Offline'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {canSuspendUsers && (
                                                <EmployeeActionsMenu
                                                    employee={member}
                                                    departments={departments}
                                                    onUpdate={fetchData}
                                                    viewerRole={companyRole}
                                                />
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <InviteUserModal
                isOpen={isInviteModalOpen}
                onClose={() => setIsInviteModalOpen(false)}
                companyId={company?._id}
            />

            {/* Bulk Assign Modal */}
            {isBulkDeptOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-sm p-6 shadow-2xl animate-scaleIn border border-transparent dark:border-gray-700">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Assign Department</h3>
                        <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">
                            Add {selectedUsers.length} selected users to:
                        </p>

                        <select
                            className="w-full p-3 border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg mb-4 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                            value={selectedBulkDept}
                            onChange={(e) => setSelectedBulkDept(e.target.value)}
                        >
                            <option value="">Select Department...</option>
                            {departments.map(d => (
                                <option key={d._id} value={d._id}>{d.name}</option>
                            ))}
                        </select>

                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setIsBulkDeptOpen(false)}
                                className="px-4 py-2 text-slate-600 dark:text-gray-400 text-sm font-bold hover:bg-slate-50 dark:hover:bg-gray-700 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBulkAssign}
                                disabled={!selectedBulkDept || bulkProcessing}
                                className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {bulkProcessing ? 'Assigning...' : 'Confirm Assignment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </React.Fragment>
    );
};

export default UserManagement;
