import React from 'react';
import { Users, Building2, AlertCircle, FileText } from 'lucide-react';

const StatCard = ({ title, value, change, icon: Icon, color }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-start justify-between hover:shadow-md transition-all">
        <div>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">{title}</p>
            <h3 className="text-3xl font-black text-gray-900 dark:text-white">{value}</h3>
            {change && <p className={`text-xs font-bold mt-2 ${change.includes('+') ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>{change}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color} bg-opacity-10 dark:bg-opacity-20 text-white`}>
            <Icon size={24} className={color.replace('bg-', 'text-')} />
        </div>
    </div>
);

const Overview = () => {
    // Mock stats for now - connect to backend later or pass as props
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-black text-gray-900 dark:text-white">Platform Overview</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Companies"
                    value="12"
                    change="+2 this month"
                    icon={Building2}
                    color="bg-indigo-600 text-indigo-600"
                />
                <StatCard
                    title="Pending Requests"
                    value="3"
                    icon={AlertCircle}
                    color="bg-yellow-500 text-yellow-500"
                />
                <StatCard
                    title="Active Users"
                    value="1,240"
                    change="+12% growth"
                    icon={Users}
                    color="bg-blue-500 text-blue-500"
                />
                <StatCard
                    title="Support Tickets"
                    value="5"
                    change="2 critical"
                    icon={FileText}
                    color="bg-red-500 text-red-500"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-4">Recent Activity</h3>
                    <div className="space-y-4">
                        <p className="text-gray-400 text-sm text-center py-8">Activity chart visualization coming soon</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-4">System Health</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-green-500"></span> API: Operational
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-green-500"></span> DB: Operational
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Overview;
