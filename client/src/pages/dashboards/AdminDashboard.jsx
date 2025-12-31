// client/src/pages/dashboards/AdminDashboard.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { useToast } from '../../contexts/ToastContext';
import {
    Building, Users, Briefcase, Activity, Plus, ArrowLeft,
    Search, Filter, TrendingUp, Settings, BarChart3
} from 'lucide-react';
import {
    DashboardCard, StatsWidget,
    UserCard, ActivityFeed,
    DomainSettings, InviteUserModal
} from '../../components/company';
import { getCompanyMetrics, getCompanyMembers } from '../../services/companyService';
import { getAuditLogs } from '../../services/auditService';

const AdminDashboard = () => {
    const { user } = useAuth();
    const { company, isCompanyAdmin } = useCompany();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState({
        totalUsers: 0,
        activeUsers: 0,
        totalWorkspaces: 0,
        totalDepartments: 0,
        userGrowth: 0,
        workspaceGrowth: 0
    });
    const [members, setMembers] = useState([]);
    const [recentActivities, setRecentActivities] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [workspaces, setWorkspaces] = useState([]);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // Fetch dashboard data
    useEffect(() => {
        if (!user?.companyId) return;

        const fetchDashboardData = async () => {
            try {
                setLoading(true);

                // Fetch metrics
                const metricsRes = await getCompanyMetrics(user.companyId);
                setMetrics(metricsRes.metrics || {
                    totalUsers: 0,
                    activeUsers: 0,
                    totalWorkspaces: 0,
                    totalDepartments: 0
                });

                // Fetch members
                const membersRes = await getCompanyMembers(user.companyId);
                setMembers(membersRes.members || []);

                // Fetch recent activity
                const activityRes = await getAuditLogs(user.companyId, { limit: 10 });
                setRecentActivities(activityRes.logs || []);

                // Fetch workspaces for Invite Modal
                try {
                    const wsRes = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/workspaces/${user.companyId}`, {
                        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
                    });
                    const wsData = await wsRes.json();
                    if (wsData.workspaces) setWorkspaces(wsData.workspaces);
                } catch (wsErr) {
                    console.error("Failed to fetch workspaces", wsErr);
                }

            } catch (error) {
                console.error('Error fetching dashboard data:', error);
                showToast('Failed to load dashboard data', 'error');
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [user?.companyId, showToast]);

    // Check admin access
    if (!isCompanyAdmin()) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
                <div className="text-center">
                    <Building className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
                    <p className="text-gray-500 mb-6">You need admin privileges to access this page</p>
                    <button
                        onClick={() => navigate('/workspaces')}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Go to Workspaces
                    </button>
                </div>
            </div>
        );
    }

    // Filter members by search query
    const filteredMembers = members.filter(member =>
        member.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/workspaces')}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                                <p className="text-sm text-gray-500">{company?.name || 'Company Overview'}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className={`px-4 py-2 text-sm font-medium border rounded-lg transition-colors ${showSettings
                                    ? "bg-gray-100 text-gray-900 border-gray-300"
                                    : "text-gray-700 bg-white border-gray-300 hover:bg-gray-50"
                                    }`}
                            >
                                <Settings className="w-4 h-4 inline mr-2" />
                                {showSettings ? "Hide Settings" : "Settings"}
                            </button>
                            <button
                                onClick={() => navigate('/admin/departments')}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                <Building className="w-4 h-4 inline mr-2" />
                                Departments
                            </button>
                            <button
                                onClick={() => setIsInviteModalOpen(true)}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                            >
                                <Plus className="w-4 h-4 inline mr-2" />
                                Invite Users
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-center">
                            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-gray-500">Loading dashboard...</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* SETTINGS AREA */}
                        {showSettings && (
                            <div className="animate-slideDown">
                                <DomainSettings companyId={user?.companyId} />
                            </div>
                        )}

                        {/* Metrics Overview */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatsWidget
                                icon={Users}
                                label="Total Users"
                                value={metrics.totalUsers || 0}
                                trend={metrics.userGrowth}
                                trendLabel="this month"
                                bgColor="bg-blue-50"
                                iconColor="text-blue-600"
                            />
                            <StatsWidget
                                icon={Activity}
                                label="Active Users"
                                value={metrics.activeUsers || 0}
                                bgColor="bg-green-50"
                                iconColor="text-green-600"
                            />
                            <StatsWidget
                                icon={Briefcase}
                                label="Workspaces"
                                value={metrics.totalWorkspaces || 0}
                                trend={metrics.workspaceGrowth}
                                trendLabel="this month"
                                bgColor="bg-purple-50"
                                iconColor="text-purple-600"
                            />
                            <StatsWidget
                                icon={Building}
                                label="Departments"
                                value={metrics.totalDepartments || 0}
                                bgColor="bg-orange-50"
                                iconColor="text-orange-600"
                            />
                        </div>

                        {/* Two-column layout */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Left Column - Team Members */}
                            <div className="lg:col-span-2 space-y-6">
                                <DashboardCard
                                    title="Team Members"
                                    icon={Users}
                                    headerActions={
                                        <div className="flex items-center gap-2">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Search members..."
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-64"
                                                />
                                            </div>
                                            <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                                                <Filter className="w-4 h-4" />
                                            </button>
                                        </div>
                                    }
                                >
                                    {filteredMembers.length === 0 ? (
                                        <div className="text-center py-12">
                                            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                            <p className="text-gray-500">
                                                {searchQuery ? 'No members found' : 'No team members yet'}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2 max-h-96 overflow-y-auto">
                                            {filteredMembers.slice(0, 10).map((member) => (
                                                <UserCard
                                                    key={member._id}
                                                    user={member}
                                                    showDepartment={true}
                                                    showEmail={true}
                                                    onClick={() => navigate(`/admin/users/${member._id}`)}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {filteredMembers.length > 10 && (
                                        <div className="mt-4 text-center">
                                            <button
                                                onClick={() => navigate('/admin/users')}
                                                className="text-sm text-blue-600 hover:underline font-medium"
                                            >
                                                View all {filteredMembers.length} members
                                            </button>
                                        </div>
                                    )}
                                </DashboardCard>

                                {/* Quick Stats */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
                                        <TrendingUp className="w-8 h-8 mb-3 opacity-80" />
                                        <p className="text-sm opacity-90 mb-1">Avg. Response Time</p>
                                        <p className="text-3xl font-bold">2.4h</p>
                                    </div>
                                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
                                        <Users className="w-8 h-8 mb-3 opacity-80" />
                                        <p className="text-sm opacity-90 mb-1">Team Satisfaction</p>
                                        <p className="text-3xl font-bold">94%</p>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column - Recent Activity */}
                            <div className="lg:col-span-1">
                                <DashboardCard
                                    title="Recent Activity"
                                    icon={Activity}
                                    headerActions={
                                        <button
                                            onClick={() => navigate('/admin/audit-logs')}
                                            className="text-sm text-blue-600 hover:underline font-medium"
                                        >
                                            View all
                                        </button>
                                    }
                                >
                                    <ActivityFeed
                                        activities={recentActivities}
                                        emptyMessage="No recent activity"
                                    />
                                </DashboardCard>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <DashboardCard title="Quick Actions">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <button
                                    onClick={() => navigate('/admin/company')}
                                    className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-xl text-left transition-all group"
                                >
                                    <Users className="w-8 h-8 text-blue-600 mb-3 group-hover:scale-110 transition-transform" />
                                    <p className="font-semibold text-gray-900">Invite Users</p>
                                    <p className="text-sm text-gray-600 mt-1">Add team members</p>
                                </button>

                                <button
                                    onClick={() => navigate('/admin/departments')}
                                    className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 rounded-xl text-left transition-all group"
                                >
                                    <Building className="w-8 h-8 text-purple-600 mb-3 group-hover:scale-110 transition-transform" />
                                    <p className="font-semibold text-gray-900">Departments</p>
                                    <p className="text-sm text-gray-600 mt-1">Manage structure</p>
                                </button>

                                <button
                                    onClick={() => navigate('/admin/workspaces')}
                                    className="p-6 bg-gradient-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 rounded-xl text-left transition-all group"
                                >
                                    <Briefcase className="w-8 h-8 text-green-600 mb-3 group-hover:scale-110 transition-transform" />
                                    <p className="font-semibold text-gray-900">Workspaces</p>
                                    <p className="text-sm text-gray-600 mt-1">Create & manage</p>
                                </button>

                                <button
                                    onClick={() => navigate('/admin/analytics')}
                                    className="p-6 bg-gradient-to-br from-indigo-50 to-indigo-100 hover:from-indigo-100 hover:to-indigo-200 rounded-xl text-left transition-all group"
                                >
                                    <BarChart3 className="w-8 h-8 text-indigo-600 mb-3 group-hover:scale-110 transition-transform" />
                                    <p className="font-semibold text-gray-900">Analytics</p>
                                    <p className="text-sm text-gray-600 mt-1">View insights</p>
                                </button>

                                <button
                                    onClick={() => navigate('/admin/settings')}
                                    className="p-6 bg-gradient-to-br from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 rounded-xl text-left transition-all group"
                                >
                                    <Settings className="w-8 h-8 text-orange-600 mb-3 group-hover:scale-110 transition-transform" />
                                    <p className="font-semibold text-gray-900">Settings</p>
                                    <p className="text-sm text-gray-600 mt-1">Company config</p>
                                </button>
                            </div>
                        </DashboardCard>
                    </div>
                )}

                {/* MODALS */}
                <InviteUserModal
                    isOpen={isInviteModalOpen}
                    onClose={() => setIsInviteModalOpen(false)}
                    companyId={user?.companyId}
                    workspaces={workspaces}
                />
            </div>
        </div>
    );
};

export default AdminDashboard;
