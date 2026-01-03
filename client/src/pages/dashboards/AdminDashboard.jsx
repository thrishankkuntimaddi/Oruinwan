// client/src/pages/dashboards/AdminDashboard.jsx
// TRUE OPERATIONAL DASHBOARD - Present State, Not Trends

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { useToast } from '../../contexts/ToastContext';
import {
    Building, Users, Briefcase, Activity, Plus, Search, Filter, Bell,
    AlertTriangle, CheckCircle2, MessageSquare, Calendar, UserPlus,
    Clock, TrendingUp, Settings, BarChart3, AlertCircle, RefreshCw
} from 'lucide-react';
import {
    DashboardCard, UserCard, ActivityFeed, InviteUserModal
} from '../../components/company';
import AdminSidebar from '../../components/admin/AdminSidebar';
import { getCompanyMetrics, getCompanyMembers } from '../../services/companyService';
import { getAuditLogs } from '../../services/auditService';
import { getDepartments } from '../../services/departmentService';
import { getDashboardMetrics } from '../../services/dashboardService';

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
    const [departments, setDepartments] = useState([]);
    const [recentActivities, setRecentActivities] = useState([]);
    const [workspaces, setWorkspaces] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Today's activity (would come from backend in real implementation)
    const [todayActivity, setTodayActivity] = useState({
        messagesToday: 0,
        tasksCompletedToday: 0,
        meetingsToday: 0
    });

    // Fetch dashboard data
    useEffect(() => {
        if (!user?.companyId) return;

        const fetchDashboardData = async () => {
            try {
                setLoading(true);

                // Convert ObjectId to string - handle both object and string formats
                const companyIdString = typeof user.companyId === 'object' && user.companyId?._id
                    ? String(user.companyId._id)
                    : String(user.companyId);

                // Fetch real dashboard metrics
                const dashMetrics = await getDashboardMetrics(companyIdString);

                // Extract data from API response
                setMetrics(dashMetrics.snapshot || {
                    totalUsers: 0,
                    activeUsers: 0,
                    totalWorkspaces: 0,
                    openTasks: 0
                });

                setTodayActivity(dashMetrics.todayActivity || {
                    messagesToday: 0,
                    tasksCompletedToday: 0,
                    meetingsToday: 0
                });

                // Set workspace health data
                setWorkspaces(dashMetrics.workspaceHealth || []);

                // Fetch members, activities, and departments
                const [membersRes, activityRes, deptsRes] = await Promise.all([
                    getCompanyMembers(companyIdString),
                    getAuditLogs(companyIdString, { limit: 15 }),
                    getDepartments(companyIdString)
                ]);

                setMembers(membersRes.members || []);
                setRecentActivities(activityRes.logs || []);
                setDepartments(deptsRes.departments || []);

            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setRefreshing(false);
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [user?.companyId, showToast]);

    // Polling - refresh every 30 seconds
    useEffect(() => {
        if (!user?.companyId) return;
        const interval = setInterval(async () => {
            if (!refreshing && !loading) {
                try {
                    setRefreshing(true);
                    const companyIdString = typeof user.companyId === 'object' && user.companyId?._id
                        ? String(user.companyId._id)
                        : String(user.companyId);
                    const dashMetrics = await getDashboardMetrics(companyIdString);
                    setMetrics(dashMetrics.snapshot || {});
                    setWorkspaces(dashMetrics.workspaceHealth || []);
                    const [membersRes, deptsRes] = await Promise.all([getCompanyMembers(companyIdString), getDepartments(companyIdString)]);
                    setMembers(membersRes.members || []);
                    setDepartments(deptsRes.departments || []);
                } catch (error) { console.error('Polling error:', error); }
                finally { setRefreshing(false); }
            }
        }, 30000);
        return () => clearInterval(interval);
    }, [user?.companyId, refreshing, loading]);

    // Manual refresh
    const handleRefresh = async () => {
        if (refreshing || loading || !user?.companyId) return;
        try {
            setRefreshing(true);
            const companyIdString = typeof user.companyId === 'object' && user.companyId?._id
                ? String(user.companyId._id)
                : String(user.companyId);
            const dashMetrics = await getDashboardMetrics(companyIdString);
            setMetrics(dashMetrics.snapshot || {});
            setTodayActivity(dashMetrics.todayActivity || {});
            setWorkspaces(dashMetrics.workspaceHealth || []);
            const [membersRes, activityRes, deptsRes] = await Promise.all([getCompanyMembers(companyIdString), getAuditLogs(companyIdString, { limit: 15 }), getDepartments(companyIdString)]);
            setMembers(membersRes.members || []);
            setRecentActivities(activityRes.logs || []);
            setDepartments(deptsRes.departments || []);
            showToast('Dashboard refreshed', 'success');
        } catch (error) { console.error('Error refreshing:', error); showToast('Failed to refresh', 'error'); }
        finally { setRefreshing(false); }
    };

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

    // Filter members
    const filteredMembers = members.filter(member =>
        member.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Get pending invites (from members with pending status)
    const pendingInvites = members.filter(m => m.accountStatus === 'pending' || m.accountStatus === 'invited');

    // Get recently joined (last 7 days)
    const recentlyJoined = members.filter(m => {
        if (!m.createdAt) return false;
        const joinDate = new Date(m.createdAt);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return joinDate >= weekAgo;
    }).slice(0, 5);

    // Identify at-risk workspaces
    const atRiskWorkspaces = workspaces.filter(ws => {
        // Consider workspace at risk if no activity in last 7 days
        // In real implementation, would check lastActivityAt from backend
        return false; // Placeholder
    });

    return (
        <div className="flex h-screen bg-gray-50 font-sans text-slate-900 overflow-hidden">
            <AdminSidebar />

            <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 relative">
                {/* Header */}
                <header className="h-16 px-8 flex items-center justify-between z-10 bg-white border-b border-slate-200">
                    <div>
                        <h2 className="text-xl font-black text-slate-800">Company Dashboard</h2>
                        <p className="text-xs text-slate-500 font-medium">
                            Real-time operational overview · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing || loading}
                            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Refresh dashboard data"
                        >
                            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                            {refreshing ? 'Refreshing...' : 'Refresh'}
                        </button>
                        <button
                            onClick={() => setIsInviteModalOpen(true)}
                            className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2"
                        >
                            <Plus size={16} /> Invite People
                        </button>
                        <button className="w-9 h-9 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-500 hover:text-indigo-600 shadow-sm relative">
                            <Bell size={18} />
                            {(pendingInvites.length > 0 || atRiskWorkspaces.length > 0) && (
                                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                            )}
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto w-full px-8 py-8 z-10 custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* SECTION 1: COMPANY SNAPSHOT - "Is the company active?" */}
                            <section>
                                <div className="mb-4">
                                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Company Snapshot</h3>
                                    <p className="text-xs text-slate-500">Instant health check</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    {/* Simple cards - NO CHARTS */}
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="p-2 bg-blue-50 rounded-lg">
                                                <Users className="w-5 h-5 text-blue-600" />
                                            </div>
                                        </div>
                                        <div className="text-3xl font-black text-slate-900">{metrics.totalUsers || 0}</div>
                                        <div className="text-sm text-slate-500 font-medium mt-1">Total Employees</div>
                                    </div>

                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="p-2 bg-green-50 rounded-lg">
                                                <Activity className="w-5 h-5 text-green-600" />
                                            </div>
                                        </div>
                                        <div className="text-3xl font-black text-slate-900">{metrics.activeUsers || 0}</div>
                                        <div className="text-sm text-slate-500 font-medium mt-1">Active Users (7d)</div>
                                    </div>

                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="p-2 bg-purple-50 rounded-lg">
                                                <Briefcase className="w-5 h-5 text-purple-600" />
                                            </div>
                                        </div>
                                        <div className="text-3xl font-black text-slate-900">{metrics.totalWorkspaces || 0}</div>
                                        <div className="text-sm text-slate-500 font-medium mt-1">Active Workspaces</div>
                                    </div>

                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="p-2 bg-orange-50 rounded-lg">
                                                <CheckCircle2 className="w-5 h-5 text-orange-600" />
                                            </div>
                                        </div>
                                        <div className="text-3xl font-black text-slate-900">-</div>
                                        <div className="text-sm text-slate-500 font-medium mt-1">Open Tasks</div>
                                        <div className="text-xs text-slate-400 mt-1">Coming soon</div>
                                    </div>
                                </div>
                            </section>

                            {/* SECTION 2: ACTIVITY & MOMENTUM - "Is work happening?" */}
                            <section>
                                <div className="mb-4">
                                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Today's Activity</h3>
                                    <p className="text-xs text-slate-500">Is collaboration alive?</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-50 rounded-lg">
                                                <MessageSquare className="w-4 h-4 text-blue-600" />
                                            </div>
                                            <div>
                                                <div className="text-2xl font-black text-slate-900">{todayActivity.messagesToday}</div>
                                                <div className="text-xs text-slate-500 font-medium">Messages Sent</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-green-50 rounded-lg">
                                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                            </div>
                                            <div>
                                                <div className="text-2xl font-black text-slate-900">{todayActivity.tasksCompletedToday}</div>
                                                <div className="text-xs text-slate-500 font-medium">Tasks Completed</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-purple-50 rounded-lg">
                                                <Calendar className="w-4 h-4 text-purple-600" />
                                            </div>
                                            <div>
                                                <div className="text-2xl font-black text-slate-900">{todayActivity.meetingsToday}</div>
                                                <div className="text-xs text-slate-500 font-medium">Meetings Started</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* SECTION 3: WORKSPACE HEALTH - "Are teams collaborating?" */}
                            <section>
                                <div className="mb-4">
                                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Workspace Health</h3>
                                    <p className="text-xs text-slate-500">Monitor team activity</p>
                                </div>
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    {workspaces.length === 0 ? (
                                        <div className="p-8 text-center text-slate-500">
                                            <Briefcase className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                                            <p className="text-sm">No workspaces yet</p>
                                        </div>
                                    ) : (
                                        <table className="w-full">
                                            <thead className="bg-slate-50 border-b border-slate-200">
                                                <tr>
                                                    <th className="text-left py-3 px-6 text-xs font-bold text-slate-500 uppercase">Workspace</th>
                                                    <th className="text-left py-3 px-6 text-xs font-bold text-slate-500 uppercase">Members</th>
                                                    <th className="text-left py-3 px-6 text-xs font-bold text-slate-500 uppercase">Last Activity</th>
                                                    <th className="text-left py-3 px-6 text-xs font-bold text-slate-500 uppercase">Open Tasks</th>
                                                    <th className="text-right py-3 px-6 text-xs font-bold text-slate-500 uppercase">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {workspaces.slice(0, 5).map((ws) => {
                                                    const isInactive = false; // Would check lastActivityAt from backend
                                                    return (
                                                        <tr key={ws._id} className="hover:bg-slate-50/50">
                                                            <td className="py-3 px-6 font-bold text-slate-800">{ws.name}</td>
                                                            <td className="py-3 px-6 text-sm text-slate-600">{ws.members?.length || 0}</td>
                                                            <td className="py-3 px-6 text-sm text-slate-500">
                                                                <Clock className="inline w-3 h-3 mr-1" />
                                                                Just now
                                                            </td>
                                                            <td className="py-3 px-6 text-sm text-slate-600">-</td>
                                                            <td className="py-3 px-6 text-right">
                                                                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${isInactive ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                                                                    }`}>
                                                                    {isInactive ? '⚠️ Inactive' : '✓ Active'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    )}
                                    {workspaces.length > 5 && (
                                        <div className="p-4 bg-slate-50 border-t border-slate-200 text-center">
                                            <button className="text-sm text-indigo-600 font-bold hover:text-indigo-700">
                                                View all {workspaces.length} workspaces
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* SECTION 4: PEOPLE & ACCESS - "What needs attention?" */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Pending Invites */}
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Pending Invites</h3>
                                            <p className="text-xs text-slate-500">Awaiting response</p>
                                        </div>
                                        <div className="p-2 bg-yellow-50 rounded-lg">
                                            <UserPlus className="w-4 h-4 text-yellow-600" />
                                        </div>
                                    </div>
                                    {pendingInvites.length === 0 ? (
                                        <p className="text-sm text-slate-500">No pending invites</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {pendingInvites.slice(0, 3).map((invite) => (
                                                <div key={invite._id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                                                    <div className="text-sm">
                                                        <div className="font-medium text-slate-900">{invite.email}</div>
                                                        <div className="text-xs text-slate-500">Invited {new Date(invite.createdAt).toLocaleDateString()}</div>
                                                    </div>
                                                    <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full font-bold">Pending</span>
                                                </div>
                                            ))}
                                            {pendingInvites.length > 3 && (
                                                <p className="text-xs text-slate-500 text-center pt-2">
                                                    +{pendingInvites.length - 3} more
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Recently Joined */}
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Recently Joined</h3>
                                            <p className="text-xs text-slate-500">Last 7 days</p>
                                        </div>
                                        <div className="p-2 bg-green-50 rounded-lg">
                                            <TrendingUp className="w-4 h-4 text-green-600" />
                                        </div>
                                    </div>
                                    {recentlyJoined.length === 0 ? (
                                        <p className="text-sm text-slate-500">No new members this week</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {recentlyJoined.map((member) => (
                                                <div key={member._id} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                                                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-600">
                                                        {member.username?.[0]?.toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium text-slate-900 truncate">{member.username}</div>
                                                        <div className="text-xs text-slate-500">{new Date(member.createdAt).toLocaleDateString()}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* SECTION 5: RECENT STRUCTURAL ACTIVITY - "What changed?" */}
                            <section>
                                <div className="mb-4">
                                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Recent Changes</h3>
                                    <p className="text-xs text-slate-500">Governance awareness - structural activity only</p>
                                </div>
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                        <ActivityFeed
                                            activities={recentActivities}
                                            emptyMessage="No recent structural changes"
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* SECTION 6: QUICK ACTIONS - Simple action buttons */}
                            <section>
                                <div className="mb-4">
                                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Quick Actions</h3>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <button
                                        onClick={() => setIsInviteModalOpen(true)}
                                        className="bg-white hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-300 rounded-xl p-4 text-left transition-all group"
                                    >
                                        <UserPlus className="w-5 h-5 text-slate-600 group-hover:text-indigo-600 mb-2" />
                                        <div className="text-sm font-bold text-slate-900">Invite Users</div>
                                    </button>
                                    <button
                                        onClick={() => navigate('/admin/departments')}
                                        className="bg-white hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-300 rounded-xl p-4 text-left transition-all group"
                                    >
                                        <Briefcase className="w-5 h-5 text-slate-600 group-hover:text-indigo-600 mb-2" />
                                        <div className="text-sm font-bold text-slate-900">Manage Departments</div>
                                    </button>
                                    <button
                                        onClick={() => navigate('/admin/analytics')}
                                        className="bg-white hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-300 rounded-xl p-4 text-left transition-all group"
                                    >
                                        <BarChart3 className="w-5 h-5 text-slate-600 group-hover:text-indigo-600 mb-2" />
                                        <div className="text-sm font-bold text-slate-900">View Analytics</div>
                                    </button>
                                    <button
                                        onClick={() => navigate('/admin/settings')}
                                        className="bg-white hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-300 rounded-xl p-4 text-left transition-all group"
                                    >
                                        <Settings className="w-5 h-5 text-slate-600 group-hover:text-indigo-600 mb-2" />
                                        <div className="text-sm font-bold text-slate-900">Settings</div>
                                    </button>
                                </div>
                            </section>
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
