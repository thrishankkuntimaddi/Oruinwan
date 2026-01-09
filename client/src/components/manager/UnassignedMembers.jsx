import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    UserPlus, Search, Filter, AlertTriangle, CheckCircle2, MoreVertical, Shield, Briefcase
} from 'lucide-react';
import { getUnassignedEmployees } from '../../services/managerDashboardService';

const UnassignedMembers = () => {
    const { selectedDepartment } = useOutletContext();
    const [unassignedData, setUnassignedData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                // Note: The service might need arguments if we filter by department, but currently fetches generic unassigned
                const response = await getUnassignedEmployees();
                setUnassignedData(response.unassigned || []);
            } catch (error) {
                console.error("Error fetching unassigned members:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [selectedDepartment]); // Re-fetch if department context changes, though unassigned might be global or valid for dept

    const filteredMembers = unassignedData.filter(member =>
        member.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            {/* Header */}
            <header className="h-20 px-8 flex items-center justify-between z-10 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 shadow-sm shrink-0">
                <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        Unassigned Members
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-gray-400 font-medium ml-0">
                        Employees needing workspace assignment
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm flex items-center gap-2">
                        <UserPlus size={16} />
                        Assign All
                    </button>
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto w-full px-8 py-6 z-10 custom-scrollbar bg-gray-50 dark:bg-gray-900 transition-colors duration-200">

                {/* Summary Card */}
                <div className="mb-6">
                    {unassignedData.length > 0 ? (
                        <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30 rounded-xl p-4 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center shrink-0">
                                <AlertTriangle className="text-yellow-600 dark:text-yellow-400" size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-yellow-800 dark:text-yellow-200">Action Required</h3>
                                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                    There are {unassignedData.length} team members who are not assigned to any workspace. They cannot access project tools until assigned.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded-xl p-4 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                                <CheckCircle2 className="text-green-600 dark:text-green-400" size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-green-800 dark:text-green-200">All Clear</h3>
                                <p className="text-xs text-green-700 dark:text-green-300">
                                    All team members are currently assigned to workspaces.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Search Bar */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-4 mb-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search unassigned members..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-transparent text-slate-700 dark:text-gray-200 placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none text-sm"
                        />
                    </div>
                </div>

                {/* Members Table */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-gray-700/50 border-b border-slate-200 dark:border-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-gray-300 uppercase tracking-wider">
                                    Member
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-gray-300 uppercase tracking-wider">
                                    Departments
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
                            {filteredMembers.map((member) => (
                                <tr key={member._id} className="hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-gray-700 flex items-center justify-center text-slate-600 dark:text-gray-300 font-bold text-sm">
                                                {member.username?.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-900 dark:text-white">
                                                    {member.username}
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-gray-400">
                                                    {member.email}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-wrap gap-1">
                                            {member.departments?.map((dept, idx) => (
                                                <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300">
                                                    <Briefcase size={10} className="mr-1" />
                                                    {dept.name}
                                                </span>
                                            )) || <span className="text-xs text-slate-400 italic">No Department</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400">
                                            Unassigned
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <button className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors text-xs font-bold">
                                            <UserPlus size={14} />
                                            Assign to Workspace
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {filteredMembers.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-slate-500 dark:text-gray-400">
                                        {searchQuery ? 'No members found matching your search.' : 'No unassigned members found.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default UnassignedMembers;
