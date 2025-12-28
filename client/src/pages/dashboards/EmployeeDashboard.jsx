// client/src/pages/dashboards/EmployeeDashboard.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { CheckSquare, FileText, Activity, ArrowLeft, Plus } from 'lucide-react';
import { DashboardCard, StatsWidget } from '../../components/company';
import { getEmployeePersonalData } from '../../services/dashboardService';

const EmployeeDashboard = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [personalData, setPersonalData] = useState({
        myTasks: [],
        myNotes: [],
        recentUpdates: [],
        stats: {
            totalTasks: 0,
            completedTasks: 0,
            totalNotes: 0
        }
    });

    useEffect(() => {
        if (!user?._id) return;

        const fetchPersonalData = async () => {
            try {
                setLoading(true);
                const data = await getEmployeePersonalData(user._id);
                setPersonalData(data);
            } catch (error) {
                console.error('Error fetching personal data:', error);
                showToast('Failed to load dashboard', 'error');
            } finally {
                setLoading(false);
            }
        };

        fetchPersonalData();
    }, [user?._id, showToast]);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/workspaces')}
                                className="p-2 hover:bg-gray-100 rounded-lg"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">My Dashboard</h1>
                                <p className="text-sm text-gray-500">Welcome back, {user?.username}!</p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/workspace/:workspaceId/tasks')}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            <Plus className="w-4 h-4 inline mr-2" />
                            New Task
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <StatsWidget
                                icon={CheckSquare}
                                label="My Tasks"
                                value={personalData.stats?.totalTasks || 0}
                                bgColor="bg-blue-50"
                                iconColor="text-blue-600"
                            />
                            <StatsWidget
                                icon={FileText}
                                label="My Notes"
                                value={personalData.stats?.totalNotes || 0}
                                bgColor="bg-purple-50"
                                iconColor="text-purple-600"
                            />
                            <StatsWidget
                                icon={Activity}
                                label="Completed"
                                value={personalData.stats?.completedTasks || 0}
                                bgColor="bg-green-50"
                                iconColor="text-green-600"
                            />
                        </div>

                        {/* My Work */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <DashboardCard title="My Tasks" icon={CheckSquare}>
                                {personalData.myTasks?.length > 0 ? (
                                    <div className="space-y-2">
                                        {personalData.myTasks.slice(0, 5).map(task => (
                                            <div key={task._id} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
                                                <p className="font-medium text-gray-900">{task.title}</p>
                                                <p className="text-sm text-gray-500 mt-1">{task.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <CheckSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                        <p className="text-gray-500">No tasks assigned</p>
                                        <button
                                            onClick={() => navigate('/workspace/:workspaceId/tasks')}
                                            className="mt-4 text-blue-600 hover:underline text-sm font-medium"
                                        >
                                            Create your first task
                                        </button>
                                    </div>
                                )}
                            </DashboardCard>

                            <DashboardCard title="My Notes" icon={FileText}>
                                {personalData.myNotes?.length > 0 ? (
                                    <div className="space-y-2">
                                        {personalData.myNotes.slice(0, 5).map(note => (
                                            <div key={note._id} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
                                                <p className="font-medium text-gray-900">{note.title}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                        <p className="text-gray-500">No notes yet</p>
                                    </div>
                                )}
                            </DashboardCard>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EmployeeDashboard;
