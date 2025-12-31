import React from 'react';
import { Server, Activity, Database, Cloud, Wifi, CheckCircle, AlertCircle } from 'lucide-react';

const SystemHealth = () => {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white">System Health</h2>
                    <p className="text-gray-500 dark:text-gray-400">Real-time infrastructure monitoring</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-bold text-sm">
                    <Activity size={16} /> All Systems Operational
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Resources */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-6">Server Resources</h3>
                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between mb-2 text-sm font-bold text-gray-600 dark:text-gray-400">
                                <span>CPU Usage</span>
                                <span className="text-gray-900 dark:text-white">42%</span>
                            </div>
                            <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 w-[42%] rounded-full"></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between mb-2 text-sm font-bold text-gray-600 dark:text-gray-400">
                                <span>Memory Usage</span>
                                <span className="text-gray-900 dark:text-white">68%</span>
                            </div>
                            <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-purple-500 w-[68%] rounded-full"></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between mb-2 text-sm font-bold text-gray-600 dark:text-gray-400">
                                <span>Storage</span>
                                <span className="text-gray-900 dark:text-white">24%</span>
                            </div>
                            <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 w-[24%] rounded-full"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Services Status */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-6">Services Status</h3>
                    <div className="space-y-4">
                        {[
                            { name: "API Gateway", icon: Cloud, status: "operational" },
                            { name: "Database Cluster", icon: Database, status: "operational" },
                            { name: "Real-time Socket", icon: Wifi, status: "operational" },
                            { name: "Storage Service", icon: Server, status: "degraded" },
                        ].map((s, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${s.status === 'operational' ? 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'}`}>
                                        <s.icon size={18} />
                                    </div>
                                    <span className="font-bold text-gray-700 dark:text-gray-200">{s.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {s.status === 'operational' ? (
                                        <span className="flex items-center gap-1 text-xs font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-lg uppercase"><CheckCircle size={10} /> Online</span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-xs font-bold text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded-lg uppercase"><AlertCircle size={10} /> Degraded</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemHealth;
