import React, { useState, useEffect, useCallback } from 'react';
import { useCompany } from '../../contexts/CompanyContext';
import { useToast } from '../../contexts/ToastContext';
import { UserPlus, Shield, BarChart3, Crown, MoreVertical, Lock, FileText, Settings, UserMinus, MessageSquare } from 'lucide-react';
import { getCompanyMembers } from '../../services/companyService';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';


const ROLE_COLORS = {
    owner: '#8b5cf6',
    admin: '#6366f1'
};

const AdminsManagement = () => {
    const { company } = useCompany();
    const { showToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [admins, setAdmins] = useState([]);
    const [filteredAdmins, setFilteredAdmins] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showStats, setShowStats] = useState(false); // Hidden by default
    const [actionMenuOpen, setActionMenuOpen] = useState(null); // Track open menu by admin ID

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setActionMenuOpen(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    const fetchAdmins = useCallback(async () => {
        if (!company?._id) {
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const response = await getCompanyMembers(company._id);
            // Filter for only Owner and Admin roles
            const adminUsers = (response.members || []).filter(
                member => member.companyRole === 'owner' || member.companyRole === 'admin'
            );
            setAdmins(adminUsers);
            setFilteredAdmins(adminUsers);
        } catch (err) {
            console.error('Failed to fetch admins:', err);
            showToast('Failed to load administrators', 'error');
        } finally {
            setLoading(false);
        }
    }, [company?._id, showToast]);

    useEffect(() => {
        fetchAdmins();
    }, [fetchAdmins]);

    // Search filter
    useEffect(() => {
        let result = admins;
        if (searchQuery) {
            result = result.filter(admin =>
                admin.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                admin.email?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        setFilteredAdmins(result);
    }, [admins, searchQuery]);

    // Statistics data
    const roleDistribution = [
        { name: 'Owner', value: admins.filter(a => a.companyRole === 'owner').length, color: ROLE_COLORS.owner },
        { name: 'Admin', value: admins.filter(a => a.companyRole === 'admin').length, color: ROLE_COLORS.admin }
    ];

    const onlineAdmins = filteredAdmins.filter(a => a.isOnline).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 transition-colors">
            {/* Header Section - Matches UserManagement Style */}
            <header className="h-20 px-8 flex items-center justify-between z-10 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 shadow-sm shrink-0">
                <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white">Administrators</h2>
                    <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">Owner & Admin roles management</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Statistics Toggle */}
                    <button
                        onClick={() => setShowStats(!showStats)}
                        className={`p-2 rounded-lg transition-colors ${showStats
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                            : 'text-slate-400 dark:text-gray-500 hover:bg-slate-50 dark:hover:bg-gray-700'
                            }`}
                        title={showStats ? 'Hide Statistics' : 'Show Statistics'}
                    >
                        <BarChart3 size={20} />
                    </button>
                    <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm flex items-center gap-2">
                        <UserPlus size={16} />
                        Invite Admin
                    </button>
                </div>
            </header>

            {/* Scrollable Content - Matches UserManagement Full Width */}
            <div className="flex-1 overflow-y-auto w-full px-8 py-6 z-10 custom-scrollbar bg-gray-50 dark:bg-gray-900 transition-colors duration-200">

                {/* Statistics Section - Toggleable */}
                {showStats && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-slideDown">
                        {/* Filtered Admins Card */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
                            <div className="mb-4">
                                <div className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                    Total Administrators
                                </div>
                            </div>
                            <div className="text-5xl font-black text-slate-900 dark:text-white mb-2">
                                {filteredAdmins.length}
                            </div>
                            <div className="text-sm text-green-600 dark:text-green-400 font-medium">
                                {onlineAdmins} currently online
                            </div>
                            <div className="text-xs text-slate-500 dark:text-gray-400 mt-2">
                                Total in Company: {admins.length}
                            </div>
                        </div>

                        {/* Role Distribution */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
                            <div className="mb-4">
                                <div className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wide">
                                    Role Distribution
                                </div>
                            </div>
                            <ResponsiveContainer width="100%" height={120}>
                                <PieChart>
                                    <Pie
                                        data={roleDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={30}
                                        outerRadius={50}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {roleDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="mt-4 space-y-2">
                                {roleDistribution.map((role) => (
                                    <div key={role.name} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: role.color }}></div>
                                            <span className="text-slate-600 dark:text-gray-300 font-medium">{role.name}</span>
                                        </div>
                                        <span className="text-slate-900 dark:text-white font-bold">{role.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Admin Info */}
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-sm p-6 text-white">
                            <div className="flex items-center gap-3 mb-4">
                                <Crown size={24} />
                                <div className="text-sm font-bold uppercase tracking-wide">Admin Powers</div>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-white/80"></div>
                                    <span>Full system access</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-white/80"></div>
                                    <span>User management</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-white/80"></div>
                                    <span>Department control</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-white/80"></div>
                                    <span>Workspace oversight</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Search Bar */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-4 mb-6">
                    <input
                        type="text"
                        placeholder="Search administrators..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-transparent text-slate-700 dark:text-gray-200 placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none text-sm"
                    />
                </div>

                {/* Admins Table */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-gray-700/50 border-b border-slate-200 dark:border-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-gray-300 uppercase tracking-wider">
                                    Administrator
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-gray-300 uppercase tracking-wider">
                                    Role
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-gray-300 uppercase tracking-wider">
                                    Email
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-gray-300 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-gray-300 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
                            {filteredAdmins.map((admin) => (
                                <tr key={admin._id} className="hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                                                {admin.username?.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-900 dark:text-white">
                                                    {admin.username}
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-gray-400">
                                                    {admin.jobTitle || 'Administrator'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${admin.companyRole === 'owner'
                                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                                            : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                            }`}>
                                            {admin.companyRole === 'owner' ? (
                                                <span className="flex items-center gap-1">
                                                    <Crown size={12} /> Owner
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1">
                                                    <Shield size={12} /> Admin
                                                </span>
                                            )}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-slate-600 dark:text-gray-300">{admin.email}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${admin.isOnline ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-600'
                                                }`}></div>
                                            <span className="text-sm text-slate-600 dark:text-gray-300">
                                                {admin.isOnline ? 'Online' : 'Offline'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="relative">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActionMenuOpen(actionMenuOpen === admin._id ? null : admin._id);
                                                }}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
                                            >
                                                <MoreVertical size={16} />
                                            </button>

                                            {/* Dropdown Menu */}
                                            {actionMenuOpen === admin._id && (
                                                <div
                                                    className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-slate-200 dark:border-gray-700 z-50 overflow-hidden animate-fadeIn"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <div className="p-1">
                                                        <button className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-700 rounded-lg flex items-center gap-2 transition-colors">
                                                            <Lock size={14} className="text-indigo-500" />
                                                            Manage Permissions
                                                        </button>
                                                        <button className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-700 rounded-lg flex items-center gap-2 transition-colors">
                                                            <FileText size={14} className="text-blue-500" />
                                                            View Activity Log
                                                        </button>
                                                        <button className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-700 rounded-lg flex items-center gap-2 transition-colors">
                                                            <Settings size={14} className="text-slate-500" />
                                                            Edit Role
                                                        </button>
                                                        <button className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-700 rounded-lg flex items-center gap-2 transition-colors">
                                                            <MessageSquare size={14} className="text-green-500" />
                                                            Direct Message
                                                        </button>
                                                    </div>

                                                    {/* Destructive Actions */}
                                                    {admin.companyRole !== 'owner' && (
                                                        <div className="p-1 border-t border-slate-100 dark:border-gray-700">
                                                            <button className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex items-center gap-2 transition-colors">
                                                                <UserMinus size={14} />
                                                                Revoke Access
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {filteredAdmins.length === 0 && (
                        <div className="text-center py-12">
                            <Shield className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                            <p className="text-slate-500 dark:text-gray-400">No administrators found</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminsManagement;
