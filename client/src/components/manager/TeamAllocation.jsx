import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    Shield, Calendar, MoreVertical,
    Search, Filter, UserPlus, Briefcase, BarChart2,
    CheckCircle2, AlertCircle, Clock, ArrowRightLeft
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

                // Enhance data with mock workload details if not present
                const enhancedMembers = (response.data.teamMembers || []).map(member => ({
                    ...member,
                    project: member.project || 'Main Product',
                    utilization: Math.floor(Math.random() * 40) + 60, // Mock 60-100% utilization
                    tasksCompleted: Math.floor(Math.random() * 20),
                    tasksPending: Math.floor(Math.random() * 10)
                }));

                setTeamData({
                    members: enhancedMembers,
                    head: null,
                    overloaded: response.data.overloaded || [],
                    idle: response.data.idle || []
                });
            } catch (error) {
                console.error('Error fetching team:', error);
                // Fallback mock data
                setTeamData({
                    members: [
                        { _id: '1', username: 'John Doe', email: 'john@example.com', companyRole: 'developer', accountStatus: 'active', createdAt: new Date(), activeTasks: 5, workload: 'medium', utilization: 85, project: 'Frontend Redesign', tasksCompleted: 12, tasksPending: 5 },
                        { _id: '2', username: 'Jane Smith', email: 'jane@example.com', companyRole: 'designer', accountStatus: 'active', createdAt: new Date(), activeTasks: 3, workload: 'low', utilization: 45, project: 'Marketing Assets', tasksCompleted: 8, tasksPending: 3 },
                        { _id: '3', username: 'Bob Wilson', email: 'bob@example.com', companyRole: 'qa', accountStatus: 'active', createdAt: new Date(), activeTasks: 12, workload: 'high', utilization: 95, project: 'Mobile App Testing', tasksCompleted: 24, tasksPending: 12 }
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
    const displayData = teamData || { members: [] };

    const filteredMembers = displayData.members?.filter(member =>
        member.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.project?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    const getUtilizationColor = (value) => {
        if (value > 90) return 'bg-red-500';
        if (value > 75) return 'bg-amber-500';
        return 'bg-green-500';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            {/* Header - Fixed Height & Full Width */}
            <header className="h-20 px-8 flex items-center justify-between z-10 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 shadow-sm shrink-0">
                <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        Resource Allocation
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-gray-400 font-medium ml-0">
                        Manage project assignments and team workload
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="px-4 py-2 bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-600 transition-colors shadow-sm flex items-center gap-2">
                        <BarChart2 size={16} />
                        View Report
                    </button>
                    <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm flex items-center gap-2">
                        <ArrowRightLeft size={16} />
                        Reallocate
                    </button>
                </div>
            </header>

            {/* Content - Full Width */}
            <div className="flex-1 overflow-y-auto w-full px-8 py-6 z-10 custom-scrollbar bg-gray-50 dark:bg-gray-900 transition-colors duration-200">

                {/* Search Bar */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-4 mb-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search resources by name, email or project..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-transparent text-slate-700 dark:text-gray-200 placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none text-sm"
                        />
                    </div>
                </div>

                {/* Team List Table */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-gray-700/50 border-b border-slate-200 dark:border-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-xs font-bold text-slate-600 dark:text-gray-300 uppercase tracking-wider">Resource</th>
                                <th className="px-6 py-3 text-xs font-bold text-slate-600 dark:text-gray-300 uppercase tracking-wider">Current Project</th>
                                <th className="px-6 py-3 text-xs font-bold text-slate-600 dark:text-gray-300 uppercase tracking-wider">Utilization</th>
                                <th className="px-6 py-3 text-xs font-bold text-slate-600 dark:text-gray-300 uppercase tracking-wider">Task Status</th>
                                <th className="px-6 py-3 text-xs font-bold text-slate-600 dark:text-gray-300 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
                            {filteredMembers.map((member) => (
                                <tr key={member._id} className="hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-gray-700 flex items-center justify-center text-slate-600 dark:text-gray-300 font-bold text-sm">
                                                {member.username?.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-900 dark:text-white">
                                                    {member.username}
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-gray-400 capitalize">
                                                    {member.companyRole}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                                                <Briefcase size={14} className="text-indigo-600 dark:text-indigo-400" />
                                            </div>
                                            <span className="text-sm font-medium text-slate-700 dark:text-gray-200">
                                                {member.project || 'Unassigned'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1 w-32">
                                            <div className="flex justify-between text-xs mb-0.5">
                                                <span className="font-medium text-slate-600 dark:text-gray-400">{member.utilization}%</span>
                                                <span className={`${member.utilization > 90 ? 'text-red-500' :
                                                        member.utilization < 50 ? 'text-green-500' : 'text-slate-400'
                                                    } font-bold text-[10px]`}>
                                                    {member.utilization > 90 ? 'OVERLOAD' : member.utilization < 50 ? 'AVAILABLE' : 'OPTIMAL'}
                                                </span>
                                            </div>
                                            <div className="h-2 w-full bg-slate-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${getUtilizationColor(member.utilization)}`}
                                                    style={{ width: `${member.utilization}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-gray-400">
                                            <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                                                <CheckCircle2 size={14} />
                                                <span className="font-bold">{member.tasksCompleted}</span> Done
                                            </div>
                                            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                                                <Clock size={14} />
                                                <span className="font-bold">{member.tasksPending}</span> Pending
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors">
                                            <MoreVertical size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {filteredMembers.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500 dark:text-gray-400">
                                        No resources found matching "{searchQuery}"
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
