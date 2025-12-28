// client/src/pages/dashboards/ManagerDashboard.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Users, CheckSquare, Clock, ArrowLeft, TrendingUp } from 'lucide-react';
import { DashboardCard, StatsWidget, UserCard, ActivityFeed } from '../../components/company';
import { getManagerTeamData } from '../../services/dashboardService';

const ManagerDashboard = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [teamData, setTeamData] = useState({
        teamMembers: [],
        teamTasks: [],
        recentActivity: [],
        stats: {
            totalMembers: 0,
            activeTasks: 0,
            completedTasks: 0,
            pendingApprovals: 0
        }
    });

    useEffect(() => {
        if (!user?._id) return;

        const fetchTeamData = async () => {
            try {
                setLoading(true);
                const data = await getManagerTeamData(user._id);
                setTeamData(data);
            } catch (error) {
                console.error('Error fetching team data:', error);
                showToast('Failed to load team data', 'error');
            } finally {
                setLoading(false);
            }
        };

        fetchTeamData();
    }, [user?._id, showToast]);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/workspaces')}
                                className="p-2 hover:bg-gray-100 rounded-lg"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Team Dashboard</h1>
                                <p className="text-sm text-gray-500">Manage your team</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <StatsWidget
                                icon={Users}
                                label="Team Members"
                                value={teamData.stats?.totalMembers || 0}
                                bgColor="bg-blue-50"
                                iconColor="text-blue-600"
                            />
                            <StatsWidget
                                icon={CheckSquare}
                                label="Active Tasks"
                                value={teamData.stats?.activeTasks || 0}
                                bgColor="bg-green-50"
                                iconColor="text-green-600"
                            />
                            <StatsWidget
                                icon={TrendingUp}
                                label="Completed"
                                value={teamData.stats?.completedTasks || 0}
                                bgColor="bg-purple-50"
                                iconColor="text-purple-600"
                            />
                            <StatsWidget
                                icon={Clock}
                                label="Pending Approvals"
                                value={teamData.stats?.pendingApprovals || 0}
                                bgColor="bg-orange-50"
                                iconColor="text-orange-600"
                            />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Team Members */}
                            <DashboardCard title="Team Members" icon={Users}>
                                {teamData.teamMembers?.length > 0 ? (
                                    <div className="space-y-2">
                                        {teamData.teamMembers.map(member => (
                                            <UserCard key={member._id} user={member} showDepartment />
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-center text-gray-500 py-8">No team members assigned</p>
                                )}
                            </DashboardCard>

                            {/* Recent Activity */}
                            <DashboardCard title="Team Activity" icon={Users}>
                                <ActivityFeed
                                    activities={teamData.recentActivity || []}
                                    emptyMessage="No recent team activity"
                                />
                            </DashboardCard>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManagerDashboard;
