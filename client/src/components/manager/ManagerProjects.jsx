// client/src/components/manager/ManagerProjects.jsx
// Projects management for Manager Dashboard

import React, { useState, useEffect } from 'react';
import { Folder, Users, Clock, AlertCircle, CheckCircle, Plus, Search } from 'lucide-react';
import axios from 'axios';

const ManagerProjects = () => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            setLoading(true);
            // This endpoint doesn't exist yet, so we'll use fallback data
            const response = await axios.get(
                `${process.env.REACT_APP_BACKEND_URL}/api/manager-dashboard/projects`,
                { withCredentials: true }
            );
            setProjects(response.data.projects || []);
        } catch (error) {
            console.error('Error fetching projects:', error);
            // Fallback demo data
            setProjects([
                { _id: '1', name: 'Mobile App Redesign', workspace: 'Design System', status: 'in_progress', progress: 65, members: 5, blockers: 1, dueDate: '2026-02-15' },
                { _id: '2', name: 'Payment Integration', workspace: 'Payments', status: 'in_progress', progress: 40, members: 3, blockers: 0, dueDate: '2026-01-30' },
                { _id: '3', name: 'API Documentation', workspace: 'Engineering', status: 'review', progress: 90, members: 2, blockers: 0, dueDate: '2026-01-20' },
                { _id: '4', name: 'User Testing Round 2', workspace: 'Design System', status: 'planning', progress: 10, members: 4, blockers: 2, dueDate: '2026-03-01' }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const filteredProjects = projects.filter(project =>
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.workspace?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getStatusColor = (status) => {
        switch (status) {
            case 'in_progress': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'review': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
            case 'completed': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case 'planning': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
            default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="h-full bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-6 mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Projects</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Active projects across managed workspaces • {projects.length} total
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative w-80">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="Search projects..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors">
                            <Plus size={18} />
                            New Project
                        </button>
                    </div>
                </div>
            </div>

            {/* Projects Grid */}
            <div className="px-8">
                {filteredProjects.length === 0 ? (
                    <div className="text-center py-16">
                        <Folder className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                            {searchQuery ? 'No projects found' : 'No projects yet'}
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400">
                            {searchQuery ? 'Try adjusting your search' : 'Create your first project to get started'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {filteredProjects.map((project) => (
                            <div
                                key={project._id}
                                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-600 transition-all cursor-pointer"
                            >
                                {/* Project Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1">
                                            {project.name}
                                        </h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {project.workspace}
                                        </p>
                                    </div>
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                                        {project.status.replace('_', ' ')}
                                    </span>
                                </div>

                                {/* Progress Bar */}
                                <div className="mb-4">
                                    <div className="flex items-center justify-between text-sm mb-2">
                                        <span className="text-gray-600 dark:text-gray-400">Progress</span>
                                        <span className="font-bold text-gray-900 dark:text-white">{project.progress}%</span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all"
                                            style={{ width: `${project.progress}%` }}
                                        ></div>
                                    </div>
                                </div>

                                {/* Project Stats */}
                                <div className="grid grid-cols-3 gap-4 mb-4">
                                    <div className="flex items-center gap-2 text-sm">
                                        <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                                            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">Members</div>
                                            <div className="font-bold text-gray-900 dark:text-white">{project.members}</div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 text-sm">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${project.blockers > 0
                                                ? 'bg-red-50 dark:bg-red-900/20'
                                                : 'bg-green-50 dark:bg-green-900/20'
                                            }`}>
                                            {project.blockers > 0 ? (
                                                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                                            ) : (
                                                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">Blockers</div>
                                            <div className={`font-bold ${project.blockers > 0
                                                    ? 'text-red-600 dark:text-red-400'
                                                    : 'text-green-600 dark:text-green-400'
                                                }`}>{project.blockers}</div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 text-sm">
                                        <div className="w-8 h-8 bg-purple-50 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                                            <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">Due</div>
                                            <div className="font-bold text-gray-900 dark:text-white text-xs">
                                                {new Date(project.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Project Actions */}
                                <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                                    <button className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium">
                                        View Details
                                    </button>
                                    <button className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium">
                                        Manage Team
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManagerProjects;
