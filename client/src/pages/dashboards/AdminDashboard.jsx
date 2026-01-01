// client/src/pages/dashboards/AdminDashboard.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { useToast } from '../../contexts/ToastContext';
import {
    Building, Users, Briefcase, Activity, Plus, Search, Filter, Bell
} from 'lucide-react';
import {
    DashboardCard, StatsWidget,
    UserCard, ActivityFeed,
    InviteUserModal
} from '../../components/company';
import PulseWidget from '../../components/company/PulseWidget';
import AdminSidebar from '../../components/admin/AdminSidebar'; // New Sidebar
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
    });
    const [members, setMembers] = useState([]);
    const [recentActivities, setRecentActivities] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [workspaces, setWorkspaces] = useState([]);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

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
        <div className="flex h-screen bg-gray-50 font-sans text-slate-900 overflow-hidden">
            {/* Sidebar */}
            <AdminSidebar />

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 relative">
                {/* Topbar */}
                <header className="h-16 px-8 flex items-center justify-between z-10 bg-white border-b border-slate-200">
                    <div>
                        <h2 className="text-xl font-black text-slate-800">Executive Dashboard</h2>
                        <p className="text-xs text-slate-500 font-medium">Company Snapshot</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                placeholder="Search everything..."
                                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-64 shadow-sm"
                            />
                        </div>
                        <button
                            onClick={() => setIsInviteModalOpen(true)}
                            className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2"
                        >
                            <Plus size={16} /> Invite People
                        </button>
                        <button className="w-9 h-9 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-500 hover:text-indigo-600 shadow-sm relative">
                            <Bell size={18} />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto w-full px-8 py-8 z-10 custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <div className="space-y-8 animate-slideDown">
                            {/* Operational Panels / KPI Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <StatsWidget
                                    icon={Users}
                                    label="Total Employees"
                                    value={metrics.totalUsers || 0}
                                    bgColor="bg-blue-50"
                                    iconColor="text-blue-600"
                                />
                                <StatsWidget
                                    icon={Activity}
                                    label="Active Users (7d)"
                                    value={metrics.activeUsers || 0}
                                    bgColor="bg-green-50"
                                    iconColor="text-green-600"
                                />
                                <StatsWidget
                                    icon={Briefcase}
                                    label="Active Workspaces"
                                    value={metrics.totalWorkspaces || 0}
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

                            {/* Main Content Grid */}
                            <div className="grid grid-cols-12 gap-8">
                                {/* Left Column - Team Members (8 cols) */}
                                <div className="col-span-12 lg:col-span-8 space-y-6">
                                    <DashboardCard
                                        title="Team Members"
                                        icon={Users}
                                        headerActions={
                                            <div className="flex items-center gap-3">
                                                <div className="relative group">
                                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                                    <input
                                                        type="text"
                                                        placeholder="Search members..."
                                                        value={searchQuery}
                                                        onChange={(e) => setSearchQuery(e.target.value)}
                                                        className="pl-9 pr-4 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none w-48 transition-all hover:bg-white"
                                                    />
                                                </div>
                                                <button className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100">
                                                    <Filter className="w-4 h-4" />
                                                </button>
                                            </div>
                                        }
                                    >
                                        {filteredMembers.length === 0 ? (
                                            <div className="text-center py-16 bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
                                                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                                <p className="text-gray-500 font-medium">
                                                    {searchQuery ? 'No members found matching search' : 'No team members yet'}
                                                </p>
                                                {!searchQuery && (
                                                    <button
                                                        onClick={() => setIsInviteModalOpen(true)}
                                                        className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                                                    >
                                                        Invite your first member
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
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
                                                {filteredMembers.length > 10 && (
                                                    <div className="pt-4 text-center border-t border-gray-50">
                                                        <button
                                                            onClick={() => navigate('/admin/users')}
                                                            className="text-sm text-indigo-600 hover:text-indigo-700 font-semibold hover:underline"
                                                        >
                                                            View all {filteredMembers.length} members
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </DashboardCard>
                                </div>

                                {/* Right Column - Pulse & Activity (4 cols) */}
                                <div className="col-span-12 lg:col-span-4 space-y-6">
                                    <PulseWidget />

                                    <DashboardCard
                                        title="Recent Activity"
                                        icon={Activity}
                                    >
                                        <div className="max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                                            <ActivityFeed
                                                activities={recentActivities}
                                                emptyMessage="No recent activity to show"
                                            />
                                        </div>
                                    </DashboardCard>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Modals */}
                <InviteUserModal
                    isOpen={isInviteModalOpen}
                    onClose={() => setIsInviteModalOpen(false)}
                    companyId={user?.companyId}
                    workspaces={workspaces}
                />
            </main>
        </div>
    );
};

export default AdminDashboard;
