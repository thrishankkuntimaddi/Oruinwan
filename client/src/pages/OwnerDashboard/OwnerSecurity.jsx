import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Shield, AlertTriangle, CheckCircle, XCircle, Lock,
    Key, Users, Activity, RefreshCw, Crown, Eye, Settings,
    Globe, Monitor, Clock, Download, TrendingUp,
    AlertCircle, UserCheck, FileText
} from 'lucide-react';
import { useCompany } from '../../contexts/CompanyContext';
import { useToast } from '../../contexts/ToastContext';
import { getSecurityRisk } from '../../services/ownerDashboardService';
import api from '../../services/api';

const OwnerSecurity = () => {
    const { isCompanyOwner } = useCompany();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [securityData, setSecurityData] = useState(null);
    const [activeSessions, setActiveSessions] = useState([]);
    const [securityEvents, setSecurityEvents] = useState([]);

    const fetchData = useCallback(async () => {
        try {
            const [security, sessionsRes, eventsRes] = await Promise.all([
                getSecurityRisk(),
                api.get('/api/owner-dashboard/active-sessions'),
                api.get('/api/owner-dashboard/security-events?limit=50')
            ]);

            setSecurityData(security);
            setActiveSessions(sessionsRes.data.sessions || []);
            setSecurityEvents(eventsRes.data.events || []);
        } catch (error) {
            console.error("Error fetching security data:", error);
            showToast("Failed to load security data", "error");
            // Set defaults on error
            setActiveSessions([]);
            setSecurityEvents([]);
        }
    }, [showToast]);

    useEffect(() => {
        if (!isCompanyOwner()) return;

        const loadInitialData = async () => {
            setLoading(true);
            await fetchData();
            setLoading(false);
        };

        loadInitialData();
    }, [isCompanyOwner, fetchData]);

    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
        showToast("Security data refreshed", "success");
    };

    const getEventIcon = (type) => {
        switch (type) {
            case 'success':
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'warning':
                return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
            case 'critical':
                return <XCircle className="w-5 h-5 text-red-500" />;
            default:
                return <AlertCircle className="w-5 h-5 text-blue-500" />;
        }
    };

    const getEventBadge = (type) => {
        const styles = {
            success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
            critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
            info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
        };
        return styles[type] || styles.info;
    };

    if (!isCompanyOwner()) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
                <div className="text-center">
                    <Crown className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">Only the Company Owner can view security information.</p>
                    <button
                        onClick={() => navigate('/admin/dashboard')}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        Go to Admin Dashboard
                    </button>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            {/* Header */}
            <header className="h-16 px-8 flex items-center justify-between z-10 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 shadow-sm">
                <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <Shield className="text-indigo-500" size={24} />
                        Security & Risk Management
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-gray-400 font-medium ml-8">
                        Monitor access, sessions, and security events
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="px-4 py-2 bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-gray-600 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto w-full px-8 py-8 z-10 custom-scrollbar">
                <div className="space-y-8 max-w-7xl mx-auto">
                    {/* Security Score & Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white shadow-xl">
                            <div className="flex items-center justify-between mb-4">
                                <Shield className="w-8 h-8 opacity-80" />
                                <span className="text-xs font-bold bg-white/20 px-2 py-1 rounded-full">SCORE</span>
                            </div>
                            <p className="text-sm opacity-90 mb-2">Compliance Score</p>
                            <p className="text-4xl font-black">{securityData?.complianceScore || 95}%</p>
                            <p className="text-xs opacity-75 mt-2">Excellent security posture</p>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                                    <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Sessions</p>
                            </div>
                            <p className="text-3xl font-black text-gray-900 dark:text-white">{securityData?.activeSessions || 0}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Users logged in (24h)</p>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
                                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                                </div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Security Alerts</p>
                            </div>
                            <p className="text-3xl font-black text-gray-900 dark:text-white">
                                {securityData?.auditSummary?.critical || 0}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Require attention</p>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                </div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Audit Events</p>
                            </div>
                            <p className="text-3xl font-black text-gray-900 dark:text-white">
                                {securityData?.auditSummary?.lastWeek || 0}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Last 7 days</p>
                        </div>
                    </div>

                    {/* Active Sessions */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Monitor className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                Active Sessions
                            </h3>
                            <button className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                                View All
                            </button>
                        </div>

                        <div className="space-y-4">
                            {activeSessions.length > 0 ? (
                                activeSessions.map((session) => {
                                    // Calculate relative time
                                    const lastActiveTime = session.lastActive
                                        ? new Date(session.lastActive).toLocaleString()
                                        : 'Unknown';

                                    return (
                                        <div key={session.id} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold">
                                                {session.user?.charAt(0) || 'U'}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-gray-900 dark:text-white">{session.user || 'Unknown'}</p>
                                                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                    <span className="flex items-center gap-1">
                                                        <Monitor size={12} />
                                                        {session.device || 'Unknown Device'}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Globe size={12} />
                                                        {session.location || 'Unknown Location'}
                                                    </span>
                                                    <span>IP: {session.ip || 'N/A'}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                    <Activity size={12} />
                                                    Active
                                                </span>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{lastActiveTime}</p>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                    No active sessions in the last 24 hours
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recent Security Events */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                Recent Security Events
                            </h3>
                            <button className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium flex items-center gap-1">
                                <Download size={14} />
                                Export
                            </button>
                        </div>

                        <div className="space-y-3">
                            {securityEvents.length > 0 ? (
                                securityEvents.map((event) => {
                                    // Format timestamp
                                    const eventTime = event.timestamp
                                        ? new Date(event.timestamp).toLocaleString()
                                        : 'Unknown time';

                                    return (
                                        <div key={event.id} className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                            <div className="mt-1">
                                                {getEventIcon(event.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-4 mb-2">
                                                    <div>
                                                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">{event.event}</h4>
                                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">by {event.user}</p>
                                                    </div>
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getEventBadge(event.type)}`}>
                                                        {event.type}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{event.details}</p>
                                                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                                    <Clock size={12} />
                                                    {eventTime}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                    No security events in the last 7 days
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Security Settings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                Authentication Settings
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <Lock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">Two-Factor Authentication</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Enabled for all admins</p>
                                        </div>
                                    </div>
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                </div>

                                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <Key className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">Password Policy</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Minimum 8 characters, 1 special</p>
                                        </div>
                                    </div>
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                </div>

                                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">Session Timeout</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">30 minutes of inactivity</p>
                                        </div>
                                    </div>
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <UserCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                Access Control
                            </h3>
                            <div className="space-y-4">
                                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">Role-Based Access (RBAC)</p>
                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                        <Users size={12} />
                                        <span>4 roles defined</span>
                                    </div>
                                </div>

                                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">IP Whitelisting</p>
                                        <XCircle className="w-5 h-5 text-gray-400" />
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                        <Globe size={12} />
                                        <span>Not configured</span>
                                    </div>
                                </div>

                                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">Domain Restriction</p>
                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                        <Eye size={12} />
                                        <span>@techcorp.com only</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Security Recommendations */}
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl p-6 border border-amber-200 dark:border-amber-800">
                        <div className="flex gap-4">
                            <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-1" />
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-amber-900 dark:text-amber-300 mb-2">Security Recommendations</h3>
                                <ul className="space-y-2 text-sm text-amber-800 dark:text-amber-400">
                                    <li className="flex items-start gap-2">
                                        <TrendingUp size={16} className="flex-shrink-0 mt-0.5" />
                                        <span>Enable IP whitelisting for admin accounts to restrict access from trusted locations</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <TrendingUp size={16} className="flex-shrink-0 mt-0.5" />
                                        <span>Review and update password policies to require rotation every 90 days</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <TrendingUp size={16} className="flex-shrink-0 mt-0.5" />
                                        <span>Configure automated security alerts for suspicious login attempts</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OwnerSecurity;
