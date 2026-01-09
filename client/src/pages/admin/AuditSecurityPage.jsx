// client/src/pages/admin/AuditSecurityPage.jsx
import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, Clock, Download, Filter, Search, Calendar } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

const AuditSecurityPage = () => {
    const { showToast } = useToast();
    const [auditLogs, setAuditLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all'); // all, login, access, changes, security
    const [dateRange, setDateRange] = useState('7days'); // 24h, 7days, 30days, all

    useEffect(() => {
        fetchAuditLogs();
    }, []);

    const fetchAuditLogs = async () => {
        try {
            setLoading(true);
            // TODO: Replace with actual API call
            const response = await fetch('/api/admin/audit-logs', {
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const data = await response.json();
                setAuditLogs(data.logs || []);
            } else {
                // Mock data for now
                setAuditLogs([
                    {
                        _id: '1',
                        type: 'login',
                        action: 'User Login',
                        user: { username: 'john.doe', email: 'john@example.com' },
                        details: 'Successful login from 192.168.1.100',
                        status: 'success',
                        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                        ipAddress: '192.168.1.100',
                        device: 'Chrome on MacOS'
                    },
                    {
                        _id: '2',
                        type: 'security',
                        action: 'Failed Login Attempt',
                        user: { username: 'unknown', email: 'unknown@example.com' },
                        details: 'Multiple failed login attempts detected',
                        status: 'warning',
                        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
                        ipAddress: '192.168.1.101',
                        device: 'Firefox on Windows'
                    },
                    {
                        _id: '3',
                        type: 'access',
                        action: 'Admin Role Assigned',
                        user: { username: 'jane.smith', email: 'jane@example.com' },
                        details: 'User promoted to admin by owner',
                        status: 'info',
                        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                        ipAddress: '192.168.1.102',
                        device: 'Safari on iOS'
                    },
                    {
                        _id: '4',
                        type: 'changes',
                        action: 'Department Created',
                        user: { username: 'admin.user', email: 'admin@example.com' },
                        details: 'New department "Marketing" created',
                        status: 'success',
                        timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
                        ipAddress: '192.168.1.103',
                        device: 'Chrome on Linux'
                    }
                ]);
            }
        } catch (error) {
            console.error('Error fetching audit logs:', error);
            showToast('Failed to load audit logs', 'error');
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'success':
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'warning':
                return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
            case 'error':
                return <XCircle className="w-5 h-5 text-red-500" />;
            default:
                return <Clock className="w-5 h-5 text-blue-500" />;
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
            error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
            info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
        };
        return styles[status] || styles.info;
    };

    const getTypeBadge = (type) => {
        const styles = {
            login: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
            security: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
            access: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
            changes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
        };
        return styles[type] || styles.changes;
    };

    const filteredLogs = auditLogs.filter(log => {
        const matchesSearch = log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.details.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterType === 'all' || log.type === filterType;
        return matchesSearch && matchesFilter;
    });

    const exportLogs = () => {
        showToast('Exporting audit logs...', 'info');
        // TODO: Implement export functionality
    };

    return (
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            {/* Header */}
            <header className="h-16 px-8 flex items-center justify-between z-10 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 shadow-sm">
                <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <Shield className="text-indigo-600 dark:text-indigo-400" size={24} />
                        Audit & Security
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-gray-400 font-medium ml-8">
                        Monitor security events and access logs
                    </p>
                </div>
                <button
                    onClick={exportLogs}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-md hover:shadow-lg flex items-center gap-2"
                >
                    <Download size={16} />
                    Export Logs
                </button>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto w-full px-8 py-8 z-10 custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Events</span>
                                <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <p className="text-3xl font-black text-gray-900 dark:text-white">{auditLogs.length}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Last 7 days</p>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Logins</span>
                                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                            </div>
                            <p className="text-3xl font-black text-gray-900 dark:text-white">
                                {auditLogs.filter(l => l.type === 'login').length}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Successful attempts</p>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Security Alerts</span>
                                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                            </div>
                            <p className="text-3xl font-black text-gray-900 dark:text-white">
                                {auditLogs.filter(l => l.status === 'warning' || l.status === 'error').length}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Requires attention</p>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Access Changes</span>
                                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <p className="text-3xl font-black text-gray-900 dark:text-white">
                                {auditLogs.filter(l => l.type === 'access').length}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Role modifications</p>
                        </div>
                    </div>

                    {/* Search and Filter Bar */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                            {/* Search */}
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search events, users, or actions..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                />
                            </div>

                            {/* Filters */}
                            <div className="flex items-center gap-2">
                                <Filter size={18} className="text-gray-400" />
                                <select
                                    value={filterType}
                                    onChange={(e) => setFilterType(e.target.value)}
                                    className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                >
                                    <option value="all">All Types</option>
                                    <option value="login">Login</option>
                                    <option value="security">Security</option>
                                    <option value="access">Access</option>
                                    <option value="changes">Changes</option>
                                </select>

                                <Calendar size={18} className="text-gray-400" />
                                <select
                                    value={dateRange}
                                    onChange={(e) => setDateRange(e.target.value)}
                                    className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                >
                                    <option value="24h">Last 24 Hours</option>
                                    <option value="7days">Last 7 Days</option>
                                    <option value="30days">Last 30 Days</option>
                                    <option value="all">All Time</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Audit Logs List */}
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                            <Shield className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No audit logs found</h3>
                            <p className="text-gray-500 dark:text-gray-400">
                                {searchTerm ? 'Try a different search term or filter' : 'No security events recorded yet'}
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                {filteredLogs.map((log) => (
                                    <div key={log._id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <div className="flex items-start gap-4">
                                            {/* Status Icon */}
                                            <div className="mt-1">
                                                {getStatusIcon(log.status)}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-4 mb-2">
                                                    <div>
                                                        <h4 className="text-base font-bold text-gray-900 dark:text-white mb-1">
                                                            {log.action}
                                                        </h4>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getTypeBadge(log.type)}`}>
                                                                {log.type}
                                                            </span>
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(log.status)}`}>
                                                                {log.status}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                        {new Date(log.timestamp).toLocaleString()}
                                                    </span>
                                                </div>

                                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                                    {log.details}
                                                </p>

                                                <div className="flex items-center gap-6 text-xs text-gray-500 dark:text-gray-400">
                                                    <span>User: <strong className="text-gray-700 dark:text-gray-300">{log.user.username}</strong></span>
                                                    <span>IP: <strong className="text-gray-700 dark:text-gray-300">{log.ipAddress}</strong></span>
                                                    <span>Device: <strong className="text-gray-700 dark:text-gray-300">{log.device}</strong></span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuditSecurityPage;
