// client/src/components/manager/ManagerReports.jsx
// Limited Visibility - Basic department info for managers

import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Users, Building, Shield, Eye, EyeOff, AlertCircle } from 'lucide-react';
import api from '../../services/api';

const ManagerReports = () => {
    const { selectedDepartment } = useOutletContext();
    const [deptInfo, setDeptInfo] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDeptInfo = async () => {
            if (!selectedDepartment?._id) return;

            try {
                setLoading(true);
                const response = await api.get(`/api/manager/dashboard/metrics/${selectedDepartment._id}`);
                setDeptInfo(response.data);
            } catch (error) {
                console.error('Error fetching department info:', error);
                // Fallback
                setDeptInfo({
                    department: {
                        name: selectedDepartment?.name || 'Department',
                        description: 'Demo data - Limited visibility',
                        head: { username: 'Department Head', email: 'head@example.com' },
                        createdAt: new Date()
                    },
                    team: { total: 15, active: 12, pending: 2, managers: 1 }
                });
            } finally {
                setLoading(false);
            }
        };

        if (selectedDepartment) {
            fetchDeptInfo();
        }
    }, [selectedDepartment]);

    const displayInfo = deptInfo || {
        department: {
            name: 'Department',
            description: 'Demo data',
            head: { username: 'Department Head', email: 'head@example.com' },
            createdAt: new Date()
        },
        team: { total: 15, active: 12, pending: 2, managers: 1 }
    };

    if (loading) {
        return (
            <div className="h-full bg-gray-50 dark:bg-gray-900 p-6 animate-pulse">
                <div className="grid grid-cols-3 gap-4 mb-6">
                    {[1,2,3].map(i => (
                        <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 space-y-3">
                            <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                            <div className="h-10 w-16 bg-gray-300 dark:bg-gray-600 rounded-xl" />
                            <div className="h-2 w-28 bg-gray-100 dark:bg-gray-700/50 rounded" />
                        </div>
                    ))}
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
                    {[70,50,85,55,75].map((w,i) => (
                        <div key={i} className="flex items-center gap-4">
                            <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                            <div className="flex-1 space-y-1.5">
                                <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded" style={{width:`${w}%`}} />
                                <div className="h-2 bg-gray-100 dark:bg-gray-700/50 rounded" style={{width:`${w-20}%`}} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="h-full bg-gray-50 dark:bg-gray-900 overflow-y-auto">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Limited Visibility</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Basic department information • View-only access
                </p>
            </div>

            <div className="p-8 space-y-6">
                {/* Permission Notice */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-bold text-blue-900 dark:text-blue-300 mb-1">Manager Permissions</h3>
                            <p className="text-sm text-blue-700 dark:text-blue-400">
                                As a manager, you have limited visibility into department settings. Contact an admin or owner for billing, security settings, or organizational changes.
                            </p>
                        </div>
                    </div>
                </div>

                {/* What You Can See */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Eye className="w-5 h-5 text-green-600 dark:text-green-400" />
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">What You Can See</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                            <Building className="w-5 h-5 text-green-600 dark:text-green-400" />
                            <span className="text-sm text-green-900 dark:text-green-300">Department name and description</span>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                            <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
                            <span className="text-sm text-green-900 dark:text-green-300">Department team members</span>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                            <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
                            <span className="text-sm text-green-900 dark:text-green-300">Your managed workspaces</span>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                            <Eye className="w-5 h-5 text-green-600 dark:text-green-400" />
                            <span className="text-sm text-green-900 dark:text-green-300">Basic team metrics</span>
                        </div>
                    </div>
                </div>

                {/* What You Cannot See */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <EyeOff className="w-5 h-5 text-red-600 dark:text-red-400" />
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">What You Cannot Change</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                            <EyeOff className="w-5 h-5 text-red-600 dark:text-red-400" />
                            <span className="text-sm text-red-900 dark:text-red-300">Department structure</span>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                            <EyeOff className="w-5 h-5 text-red-600 dark:text-red-400" />
                            <span className="text-sm text-red-900 dark:text-red-300">Billing & subscriptions</span>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                            <EyeOff className="w-5 h-5 text-red-600 dark:text-red-400" />
                            <span className="text-sm text-red-900 dark:text-red-300">Security settings</span>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                            <EyeOff className="w-5 h-5 text-red-600 dark:text-red-400" />
                            <span className="text-sm text-red-900 dark:text-red-300">Admin configurations</span>
                        </div>
                    </div>
                </div>

                {/* Department Info - Read Only */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Department Information (Read-Only)</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Department Name</label>
                            <p className="text-base font-medium text-gray-900 dark:text-white mt-1">{displayInfo.department?.name}</p>
                        </div>

                        {displayInfo.department?.description && (
                            <div>
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Description</label>
                                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{displayInfo.department.description}</p>
                            </div>
                        )}

                        <div>
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Department Head</label>
                            <div className="flex items-center gap-3 mt-2">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                                    {displayInfo.department?.head?.username?.charAt(0)?.toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white">{displayInfo.department?.head?.username}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{displayInfo.department?.head?.email}</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <div>
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Total Members</label>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{displayInfo.team?.total || 0}</p>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Active</label>
                                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{displayInfo.team?.active || 0}</p>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Pending</label>
                                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">{displayInfo.team?.pending || 0}</p>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Managers</label>
                                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{displayInfo.team?.managers || 0}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Contact Admin */}
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800 p-6 text-center">
                    <h3 className="font-bold text-indigo-900 dark:text-indigo-300 mb-2">Need More Access?</h3>
                    <p className="text-sm text-indigo-700 dark:text-indigo-400 mb-4">
                        Contact your admin or owner to request additional permissions or changes to department settings.
                    </p>
                    <button className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors">
                        Contact Admin
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ManagerReports;
