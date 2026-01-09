// client/src/components/manager/TeamAllocation.jsx
// Team tab for Manager Dashboard - Manage department members

import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    Shield, Calendar, MoreVertical,
    Search, Filter, UserPlus
} from 'lucide-react';
import axios from 'axios';

const TeamAllocation = () => {
    const { selectedDepartment } = useOutletContext();
    const [teamData, setTeamData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchTeam = async () => {
            try {
                setLoading(true);
                const response = await axios.get(
                    `${process.env.REACT_APP_BACKEND_URL}/api/manager-dashboard/team-load`,
                    { withCredentials: true }
                );
                setTeamData({
                    members: response.data.teamMembers || [],
                    head: null, // Will be determined from members
                    overloaded: response.data.overloaded || [],
                    idle: response.data.idle || []
                });
            } catch (error) {
                console.error('Error fetching team:', error);
                // Use fallback demo data
                setTeamData({
                    members: [
                        { _id: '1', username: 'John Doe', email: 'john@example.com', companyRole: 'developer', accountStatus: 'active', createdAt: new Date(), activeTasks: 5, workload: 'medium' },
                        { _id: '2', username: 'Jane Smith', email: 'jane@example.com', companyRole: 'designer', accountStatus: 'active', createdAt: new Date(), activeTasks: 3, workload: 'low' },
                        { _id: '3', username: 'Bob Wilson', email: 'bob@example.com', companyRole: 'qa', accountStatus: 'active', createdAt: new Date(), activeTasks: 12, workload: 'high' }
                    ],
                    head: null,
                    overloaded: [],
                    idle: []
                });
            } finally {
                setLoading(false);
            }
        };

        fetchTeam();
    }, [selectedDepartment]);

    // Use demo data if teamData is null
    const displayData = teamData || {
        members: [
            { _id: '1', username: 'John Doe', email: 'john@example.com', companyRole: 'developer', accountStatus: 'active', createdAt: new Date(), activeTasks: 5, workload: 'medium' },
            { _id: '2', username: 'Jane Smith', email: 'jane@example.com', companyRole: 'designer', accountStatus: 'active', createdAt: new Date(), activeTasks: 3, workload: 'low' },
            { _id: '3', username: 'Bob Wilson', email: 'bob@example.com', companyRole: 'qa', accountStatus: 'active', createdAt: new Date(), activeTasks: 12, workload: 'high' }
        ],
        head: null,
        overloaded: [],
        idle: []
    };

    const filteredMembers = displayData.members?.filter(member =>
        member.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="h-full bg-gray-50 dark:bg-gray-900 flex flex-col transition-colors duration-200">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Team Load</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Workload across all managed workspaces • {displayData.members?.length || 0} members
                        </p>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors">
                        <UserPlus size={18} />
                        Add to Workspace
                    </button>
                </div>

                {/* Search & Filter */}
                <div className="mt-6 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search members..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white placeholder-gray-400"
                        />
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 font-medium text-gray-700 dark:text-gray-200 transition-colors">
                        <Filter size={18} />
                        Filter
                    </button>
                </div>
            </div>

            {/* Team List */}
            <div className="flex-1 overflow-y-auto p-8">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Member</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Role</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Workload</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {/* Department Head */}
                            {displayData.head && (
                                <tr className="bg-indigo-50/30 dark:bg-indigo-900/10">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                                                {teamData.head.username?.charAt(0)?.toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 dark:text-white">{teamData.head.username} <span className="text-xs font-normal text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 rounded-full ml-1">Head</span></p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">{teamData.head.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                            <Shield size={16} className="text-indigo-600 dark:text-indigo-400" />
                                            <span className="text-sm font-medium capitalize">Manager</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                                            Active
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                        -
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                            <MoreVertical size={18} />
                                        </button>
                                    </td>
                                </tr>
                            )}

                            {filteredMembers.map((member) => {
                                if (member._id === teamData.head?._id) return null; // Skip head if in listing
                                return (
                                    <tr key={member._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold">
                                                    {member.username?.charAt(0)?.toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900 dark:text-white">{member.username}</p>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">{member.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                                <Shield size={16} className="text-gray-400" />
                                                <span className="text-sm capitalize">{member.companyRole}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${member.accountStatus === 'active'
                                                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                                                : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400'
                                                }`}>
                                                {member.accountStatus || 'Unknown'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={14} />
                                                {new Date(member.createdAt).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                                <MoreVertical size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}

                            {filteredMembers.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                                        No team members found matching "{searchQuery}"
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

export default TeamAllocation;
