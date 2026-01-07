// client/src/components/manager/ManagerReports.jsx
import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import {
    BarChart3, TrendingUp, CheckCircle2, Clock, AlertTriangle,
    Download, Activity, User
} from 'lucide-react';

const ManagerReports = () => {
    const { selectedDepartment } = useOutletContext();
    const [reports, setReports] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReports = async () => {
            if (!selectedDepartment?._id) return;

            try {
                setLoading(true);
                const response = await axios.get(
                    `${process.env.REACT_APP_BACKEND_URL}/api/manager/reports/${selectedDepartment._id}`,
                    { withCredentials: true }
                );
                setReports(response.data.reports);
            } catch (error) {
                console.error('Error fetching reports:', error);
            } finally {
                setLoading(false);
            }
        };

        if (selectedDepartment) {
            fetchReports();
        }
    }, [selectedDepartment]);

    if (loading) return <div className="p-8 text-center text-gray-500">Loading reports...</div>;

    const { productivity } = reports || {};

    return (
        <div className="h-full bg-gray-50 flex flex-col">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-8 py-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900">Reports & Analytics</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Performance insights for {selectedDepartment?.name}
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <select className="bg-white border border-gray-200 text-gray-700 text-sm font-bold rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <option>Last 30 Days</option>
                            <option>Last Quarter</option>
                        </select>
                        <button className="bg-white border border-gray-200 text-gray-700 p-2 rounded-lg hover:bg-gray-50" title="Export">
                            <Download size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-6xl mx-auto space-y-8">

                    {/* Scorecards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex items-center gap-3 mb-2 text-indigo-600">
                                <Activity size={20} />
                                <h3 className="text-sm font-bold uppercase tracking-wide">Completion Rate</h3>
                            </div>
                            <p className="text-3xl font-black text-gray-900">{productivity?.completionRate}%</p>
                            <p className="text-xs text-green-600 font-bold mt-1 flex items-center gap-1">
                                <TrendingUp size={12} /> Based on {productivity?.totalTasks} tasks
                            </p>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex items-center gap-3 mb-2 text-green-600">
                                <CheckCircle2 size={20} />
                                <h3 className="text-sm font-bold uppercase tracking-wide">Completed</h3>
                            </div>
                            <p className="text-3xl font-black text-gray-900">{productivity?.tasksCompleted}</p>
                            <p className="text-xs text-gray-400 mt-1">Total tasks finished</p>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex items-center gap-3 mb-2 text-blue-600">
                                <Clock size={20} />
                                <h3 className="text-sm font-bold uppercase tracking-wide">Avg Time</h3>
                            </div>
                            <p className="text-3xl font-black text-gray-900">{productivity?.avgTaskCompletionTime}</p>
                            <p className="text-xs text-gray-400 mt-1">Per completed task</p>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex items-center gap-3 mb-2 text-orange-600">
                                <AlertTriangle size={20} />
                                <h3 className="text-sm font-bold uppercase tracking-wide">In Progress</h3>
                            </div>
                            <p className="text-3xl font-black text-gray-900">{productivity?.inProgress}</p>
                            <p className="text-xs text-gray-400 mt-1">Currently active tasks</p>
                        </div>
                    </div>

                    {/* Placeholder Distribution Chart Area */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-80 flex flex-col items-center justify-center text-center">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <BarChart3 className="text-gray-400" />
                            </div>
                            <h3 className="font-bold text-gray-900">Task Volume over Time</h3>
                            <p className="text-sm text-gray-500">Chart visualization coming in next update</p>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-80 flex flex-col items-center justify-center text-center">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <User className="text-gray-400" />
                            </div>
                            <h3 className="font-bold text-gray-900">Team Workload Distribution</h3>
                            <p className="text-sm text-gray-500">Chart visualization coming in next update</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManagerReports;
