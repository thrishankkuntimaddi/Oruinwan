import React, { useState, useEffect } from 'react';
import api from '../../../../../services/api';
import { Activity, Cpu, Database, HardDrive, Zap, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

const SystemHealth = () => {
    const [metrics, setMetrics] = useState({
        server: {
            cpuUsage: 0,
            memoryUsage: 0,
            diskUsage: 0,
            uptime: 0
        },
        database: {
            connections: 0,
            size: 0,
            collections: 0,
            queryPerformance: 0
        },
        api: {
            responseTime: { p50: 0, p95: 0, p99: 0 },
            errorRate: 0,
            requestsPerMinute: 0
        },
        errors: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMetrics();
        const interval = setInterval(fetchMetrics, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const fetchMetrics = async () => {
        try {
            const res = await api.get(`/api/admin/health/metrics`);
            setMetrics(res.data);
            setLoading(false);
        } catch (err) {
            console.error('Failed to fetch system health:', err);
            setLoading(false);
        }
    };

    const GaugeCard = ({ icon: Icon, label, value, max, unit, color, status }) => {
        const percentage = (value / max) * 100;
        const statusColor =
            percentage < 60 ? 'text-green-600 dark:text-green-400' :
                percentage < 80 ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-red-600 dark:text-red-400';

        return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center`}>
                            <Icon className="text-white" size={20} />
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white">{label}</h3>
                    </div>
                    <div className={`flex items-center gap-1 ${statusColor} font-bold text-sm`}>
                        {status || (percentage < 80 ? <CheckCircle size={16} /> : <AlertTriangle size={16} />)}
                    </div>
                </div>

                {/* Circular Gauge */}
                <div className="flex items-center justify-center mb-4">
                    <div className="relative w-32 h-32">
                        <svg className="w-full h-full -rotate-90">
                            {/* Background circle */}
                            <circle
                                cx="64"
                                cy="64"
                                r="56"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="none"
                                className="text-gray-200 dark:text-gray-700"
                            />
                            {/* Progress circle */}
                            <circle
                                cx="64"
                                cy="64"
                                r="56"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="none"
                                strokeDasharray={`${2 * Math.PI * 56}`}
                                strokeDashoffset={`${2 * Math.PI * 56 * (1 - percentage / 100)}`}
                                className={statusColor}
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center flex-col">
                            <p className="text-3xl font-black text-gray-900 dark:text-white">
                                {Math.round(percentage)}%
                            </p>
                        </div>
                    </div>
                </div>

                <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                    {value?.toFixed?.(2) || value} {unit} / {max} {unit}
                </p>
            </div>
        );
    };

    const MetricCard = ({ label, value, unit, icon: Icon, color }) => (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center`}>
                    <Icon className="text-white" size={18} />
                </div>
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">{label}</p>
                    <p className="text-xl font-black text-gray-900 dark:text-white">
                        {value} {unit}
                    </p>
                </div>
            </div>
        </div>
    );

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
            <div>
                <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2 flex items-center gap-3">
                    <Activity size={32} />
                    System Health
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                    Monitor server performance and system metrics
                </p>
            </div>

            {/* Status Banner */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                        <CheckCircle size={28} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold mb-1">All Systems Operational</h2>
                        <p className="text-green-50">All services running smoothly • Last checked: {new Date().toLocaleTimeString()}</p>
                    </div>
                </div>
            </div>

            {/* Server Metrics */}
            <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Server Metrics</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <GaugeCard
                        icon={Cpu}
                        label="CPU Usage"
                        value={metrics.server.cpuUsage}
                        max={100}
                        unit="%"
                        color="from-blue-500 to-blue-600"
                    />
                    <GaugeCard
                        icon={HardDrive}
                        label="Memory Usage"
                        value={metrics.server.memoryUsage}
                        max={100}
                        unit="%"
                        color="from-purple-500 to-purple-600"
                    />
                    <GaugeCard
                        icon={Database}
                        label="Disk Usage"
                        value={metrics.server.diskUsage}
                        max={100}
                        unit="%"
                        color="from-orange-500 to-orange-600"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Database Stats */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Database size={20} />
                        Database Statistics
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <MetricCard
                            label="Active Connections"
                            value={metrics.database.connections}
                            unit=""
                            icon={Zap}
                            color="from-green-500 to-green-600"
                        />
                        <MetricCard
                            label="Database Size"
                            value={metrics.database.size}
                            unit="MB"
                            icon={Database}
                            color="from-blue-500 to-blue-600"
                        />
                        <MetricCard
                            label="Collections"
                            value={metrics.database.collections}
                            unit=""
                            icon={HardDrive}
                            color="from-purple-500 to-purple-600"
                        />
                        <MetricCard
                            label="Avg Query Time"
                            value={metrics.database.queryPerformance}
                            unit="ms"
                            icon={Clock}
                            color="from-orange-500 to-orange-600"
                        />
                    </div>
                </div>

                {/* API Performance */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Zap size={20} />
                        API Performance
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between mb-2">
                                <span className="text-sm text-gray-600 dark:text-gray-400">Response Time (p50)</span>
                                <span className="font-bold text-gray-900 dark:text-white">{metrics.api.responseTime.p50}ms</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min((metrics.api.responseTime.p50 / 200) * 100, 100)}%` }}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between mb-2">
                                <span className="text-sm text-gray-600 dark:text-gray-400">Response Time (p95)</span>
                                <span className="font-bold text-gray-900 dark:text-white">{metrics.api.responseTime.p95}ms</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div className="bg-yellow-500 h-2 rounded-full" style={{ width: `${Math.min((metrics.api.responseTime.p95 / 500) * 100, 100)}%` }}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between mb-2">
                                <span className="text-sm text-gray-600 dark:text-gray-400">Response Time (p99)</span>
                                <span className="font-bold text-gray-900 dark:text-white">{metrics.api.responseTime.p99}ms</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div className="bg-red-500 h-2 rounded-full" style={{ width: `${Math.min((metrics.api.responseTime.p99 / 1000) * 100, 100)}%` }}></div>
                            </div>
                        </div>
                        <div className="pt-4 border-t border-gray-100 dark:border-gray-700 grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-1">Error Rate</p>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">{metrics.api.errorRate}%</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-1">Requests/Min</p>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">{metrics.api.requestsPerMinute}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Database Entities */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Database size={20} />
                        Database Entities
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Real-time entity counts from database
                    </p>
                </div>
                <div className="p-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* Users */}
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
                            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-2">Total Users</p>
                            <p className="text-3xl font-black text-blue-900 dark:text-blue-100">
                                {metrics.entities?.users?.total || 0}
                            </p>
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                {metrics.entities?.users?.active || 0} active
                            </p>
                        </div>

                        {/* Companies */}
                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-4 border border-purple-200 dark:border-purple-700">
                            <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase mb-2">Companies</p>
                            <p className="text-3xl font-black text-purple-900 dark:text-purple-100">
                                {metrics.entities?.companies?.total || 0}
                            </p>
                            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                                {metrics.entities?.companies?.verified || 0} verified, {metrics.entities?.companies?.pending || 0} pending
                            </p>
                        </div>

                        {/* Departments */}
                        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-4 border border-green-200 dark:border-green-700">
                            <p className="text-xs font-bold text-green-600 dark:text-green-400 uppercase mb-2">Departments</p>
                            <p className="text-3xl font-black text-green-900 dark:text-green-100">
                                {metrics.entities?.departments || 0}
                            </p>
                        </div>

                        {/* Workspaces */}
                        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl p-4 border border-orange-200 dark:border-orange-700">
                            <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase mb-2">Workspaces</p>
                            <p className="text-3xl font-black text-orange-900 dark:text-orange-100">
                                {metrics.entities?.workspaces || 0}
                            </p>
                        </div>

                        {/* Channels */}
                        <div className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 rounded-xl p-4 border border-pink-200 dark:border-pink-700">
                            <p className="text-xs font-bold text-pink-600 dark:text-pink-400 uppercase mb-2">Channels</p>
                            <p className="text-3xl font-black text-pink-900 dark:text-pink-100">
                                {metrics.entities?.channels || 0}
                            </p>
                        </div>

                        {/* Messages */}
                        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 rounded-xl p-4 border border-indigo-200 dark:border-indigo-700">
                            <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-2">Messages</p>
                            <p className="text-3xl font-black text-indigo-900 dark:text-indigo-100">
                                {metrics.entities?.messages || 0}
                            </p>
                        </div>

                        {/* Tasks */}
                        <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-800/20 rounded-xl p-4 border border-cyan-200 dark:border-cyan-700">
                            <p className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase mb-2">Tasks</p>
                            <p className="text-3xl font-black text-cyan-900 dark:text-cyan-100">
                                {metrics.entities?.tasks || 0}
                            </p>
                        </div>

                        {/* Notes */}
                        <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 rounded-xl p-4 border border-amber-200 dark:border-amber-700">
                            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase mb-2">Notes</p>
                            <p className="text-3xl font-black text-amber-900 dark:text-amber-100">
                                {metrics.entities?.notes || 0}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Errors */}
            {metrics.errors.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <AlertTriangle size={20} className="text-red-500" />
                            Recent Errors
                        </h3>
                    </div>
                    <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
                        {metrics.errors.map((error, index) => (
                            <div key={index} className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-700 rounded-xl">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <p className="font-bold text-sm text-red-900 dark:text-red-200">{error.message}</p>
                                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error.stack}</p>
                                    </div>
                                    <span className="text-xs text-red-500 shrink-0 ml-4">
                                        {new Date(error.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SystemHealth;
