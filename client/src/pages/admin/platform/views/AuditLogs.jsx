import React, { useState, useEffect, useCallback } from 'react';
import api from '@services/api';
import { Search, Download, User, Activity, AlertCircle, RefreshCw } from 'lucide-react';

const AuditLogs = () => {
    const [logs, setLogs] = useState([]);
    const [filteredLogs, setFilteredLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        search: '',
        action: 'all',
        user: '',
        dateFrom: '',
        dateTo: '',
        resource: 'all'
    });

    const applyFilters = useCallback(() => {
        let filtered = [...logs];

        // Search filter
        if (filters.search) {
            filtered = filtered.filter(log =>
                log.description?.toLowerCase().includes(filters.search.toLowerCase()) ||
                log.action?.toLowerCase().includes(filters.search.toLowerCase())
            );
        }

        // Action type filter
        if (filters.action !== 'all') {
            filtered = filtered.filter(log => log.action === filters.action);
        }

        // Resource filter
        if (filters.resource !== 'all') {
            filtered = filtered.filter(log => log.resource === filters.resource);
        }

        // User filter
        if (filters.user) {
            filtered = filtered.filter(log =>
                log.userId?.username?.toLowerCase().includes(filters.user.toLowerCase())
            );
        }

        // Date range filter
        if (filters.dateFrom) {
            filtered = filtered.filter(log =>
                new Date(log.createdAt) >= new Date(filters.dateFrom)
            );
        }
        if (filters.dateTo) {
            filtered = filtered.filter(log =>
                new Date(log.createdAt) <= new Date(filters.dateTo + 'T23:59:59')
            );
        }

        setFilteredLogs(filtered);
    }, [logs, filters]);

    useEffect(() => {
        fetchLogs();
        // Set up auto-refresh every 10 seconds for real-time feel
        const interval = setInterval(fetchLogs, 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        applyFilters();
    }, [applyFilters]);

    const fetchLogs = async () => {
        try {
            const res = await api.get(`/api/admin/audit-logs`);
            setLogs(res.data);
            setLoading(false);
        } catch (err) {
            console.error('Failed to fetch audit logs:', err);
            setLoading(false);
        }
    }

        ;

    const exportToCSV = () => {
        const headers = ['Timestamp', 'User', 'Action', 'Resource', 'Description'];
        const csvData = filteredLogs.map(log => [
            new Date(log.createdAt).toLocaleString(),
            log.userId?.username || 'System',
            log.action,
            log.resource || 'N/A',
            log.description
        ]);

        const csvContent = [
            headers.join(','),
            ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const exportToJSON = () => {
        const jsonData = JSON.stringify(filteredLogs, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const getActionColor = (action) => {
        if (action.includes('create') || action.includes('register')) return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
        if (action.includes('delete') || action.includes('reject')) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
        if (action.includes('update') || action.includes('edit')) return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
        if (action.includes('approve')) return 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20';
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20';
    };

    const getActionIcon = (action) => {
        if (action.includes('create') || action.includes('register')) return '✨';
        if (action.includes('delete')) return '🗑️';
        if (action.includes('update')) return '✏️';
        if (action.includes('approve')) return '✅';
        if (action.includes('reject')) return '❌';
        return '📝';
    };

    // Get unique actions and resources for filter dropdowns
    const uniqueActions = [...new Set(logs.map(log => log.action))];
    const uniqueResources = [...new Set(logs.filter(log => log.resource).map(log => log.resource))];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2 flex items-center gap-3">
                        <Activity size={32} />
                        Audit Logs
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        Track all system activities and changes
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchLogs}
                        className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center gap-2 text-gray-700 dark:text-gray-200"
                    >
                        <RefreshCw size={16} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                    {/* Search */}
                    <div className="xl:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                            Search
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search logs..."
                                value={filters.search}
                                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 text-gray-900 dark:text-white"
                            />
                        </div>
                    </div>

                    {/* Action Type */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                            Action Type
                        </label>
                        <select
                            value={filters.action}
                            onChange={(e) => setFilters(prev => ({ ...prev, action: e.target.value }))}
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 text-gray-900 dark:text-white"
                        >
                            <option value="all">All Actions</option>
                            {uniqueActions.map(action => (
                                <option key={action} value={action}>{action}</option>
                            ))}
                        </select>
                    </div>

                    {/* Resource */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                            Resource
                        </label>
                        <select
                            value={filters.resource}
                            onChange={(e) => setFilters(prev => ({ ...prev, resource: e.target.value }))}
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 text-gray-900 dark:text-white"
                        >
                            <option value="all">All Resources</option>
                            {uniqueResources.map(resource => (
                                <option key={resource} value={resource}>{resource}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date From */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                            From Date
                        </label>
                        <input
                            type="date"
                            value={filters.dateFrom}
                            onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 text-gray-900 dark:text-white"
                        />
                    </div>

                    {/* Date To */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                            To Date
                        </label>
                        <input
                            type="date"
                            value={filters.dateTo}
                            onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 text-gray-900 dark:text-white"
                        />
                    </div>
                </div>

                {/* Filter Stats & Export */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Showing <span className="font-bold text-gray-900 dark:text-white">{filteredLogs.length}</span> of {logs.length} logs
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={exportToCSV}
                            className="px-4 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all flex items-center gap-2 text-sm"
                        >
                            <Download size={16} />
                            Export CSV
                        </button>
                        <button
                            onClick={exportToJSON}
                            className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center gap-2 text-sm"
                        >
                            <Download size={16} />
                            Export JSON
                        </button>
                    </div>
                </div>
            </div>

            {/* Logs Timeline */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Activity size={20} />
                        Activity Timeline
                    </h2>
                </div>
                <div className="max-h-[600px] overflow-y-auto">
                    {filteredLogs.length > 0 ? (
                        <div className="divide-y divide-gray-50 dark:divide-gray-700">
                            {filteredLogs.map((log, index) => (
                                <div key={index} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <div className="flex items-start gap-4">
                                        {/* Icon */}
                                        <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xl flex-shrink-0">
                                            {getActionIcon(log.action)}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-4 mb-2">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getActionColor(log.action)}`}>
                                                            {log.action}
                                                        </span>
                                                        {log.resource && (
                                                            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs font-bold">
                                                                {log.resource}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-900 dark:text-white font-medium">
                                                        {log.description}
                                                    </p>
                                                </div>
                                                <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                    {new Date(log.createdAt).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                                                <span className="flex items-center gap-1">
                                                    <User size={12} />
                                                    {log.userId?.username || 'System'}
                                                </span>
                                                {log.resourceId && (
                                                    <span className="flex items-center gap-1">
                                                        ID: {log.resourceId.slice(-6)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-12 text-center text-gray-400">
                            <AlertCircle size={48} className="mx-auto mb-4 opacity-20" />
                            <p className="font-bold">No logs found</p>
                            <p className="text-sm mt-1">Try adjusting your filters</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuditLogs;
