import React from 'react';
import { Users, Briefcase, Building, TrendingUp } from 'lucide-react';

const OrganizationOverview = ({ data }) => {
    // Default values if data is loading or missing
    const stats = data || {
        totalUsers: 0,
        activeUsers: 0,
        workspaceCount: 0,
        departmentCount: 0,
        growthRate: { users: 0, workspaces: 0 }
    };

    const StatCard = ({ icon: Icon, colorClass, bgClass, value, label, trend, trendLabel }) => (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6 transition-colors">
            <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg ${bgClass}`}>
                    <Icon className={`w-5 h-5 ${colorClass}`} />
                </div>
                {trend !== undefined && (
                    <div className="flex items-center gap-1 text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-full">
                        <TrendingUp size={12} />
                        +{trend}
                    </div>
                )}
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white">{value}</div>
            <div className="text-sm text-slate-500 dark:text-gray-400 font-medium mt-1">{label}</div>
            {trendLabel && (
                <div className="text-xs text-slate-400 dark:text-gray-500 mt-2">
                    {trendLabel}
                </div>
            )}
        </div>
    );

    return (
        <section>
            <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wide">Organization Overview</h3>
                <p className="text-xs text-slate-500 dark:text-gray-500">High-level growth & scale metrics</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    icon={Users}
                    colorClass="text-blue-600 dark:text-blue-400"
                    bgClass="bg-blue-50 dark:bg-blue-900/30"
                    value={stats.totalUsers}
                    label="Total Employees"
                    trend={stats.growthRate?.users}
                    trendLabel="New in last 30 days"
                />
                <StatCard
                    icon={Users}
                    colorClass="text-green-600 dark:text-green-400"
                    bgClass="bg-green-50 dark:bg-green-900/30"
                    value={stats.activeUsers}
                    label="Active Users"
                    trendLabel="Currently active"
                />
                <StatCard
                    icon={Briefcase}
                    colorClass="text-purple-600 dark:text-purple-400"
                    bgClass="bg-purple-50 dark:bg-purple-900/30"
                    value={stats.workspaceCount}
                    label="Total Workspaces"
                    trend={stats.growthRate?.workspaces}
                    trendLabel="New in last 30 days"
                />
                <StatCard
                    icon={Building}
                    colorClass="text-orange-600 dark:text-orange-400"
                    bgClass="bg-orange-50 dark:bg-orange-900/30"
                    value={stats.departmentCount}
                    label="Departments"
                    trendLabel="Structural units"
                />
            </div>
        </section>
    );
};

export default OrganizationOverview;
