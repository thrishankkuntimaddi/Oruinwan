import React from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Users, CheckSquare, AlertCircle, Clock } from 'lucide-react';
import { StatsWidget, DashboardCard } from '../../components/company';

const ManagerOverview = () => {
    const navigate = useNavigate();
    // Context from ManagerDashboard Layout
    const { metrics, tasks, setActiveTab } = useOutletContext();

    return (
        <div className="space-y-8 animate-slideDown max-w-[1600px] mx-auto">
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsWidget
                    icon={Users}
                    label="Team Size"
                    value={metrics?.teamSize || 0}
                    bgColor="bg-blue-50"
                    iconColor="text-blue-600"
                />
                <StatsWidget
                    icon={Users}
                    label="Active Users"
                    value={metrics?.activeUsers || 0}
                    bgColor="bg-green-50"
                    iconColor="text-green-600"
                />
                <StatsWidget
                    icon={CheckSquare}
                    label="Open Tasks"
                    value={metrics?.openTasks || 0}
                    bgColor="bg-purple-50"
                    iconColor="text-purple-600"
                />
                <StatsWidget
                    icon={AlertCircle}
                    label="Overdue"
                    value={metrics?.overdueTasks || 0}
                    bgColor="bg-red-50"
                    iconColor="text-red-600"
                />
            </div>

            <div className="grid grid-cols-12 gap-8">
                {/* Left Column - Allocations (8 cols) */}
                <div className="col-span-12 lg:col-span-8">
                    <DashboardCard
                        title="Team Allocation"
                        icon={Users}
                        headerActions={
                            <button
                                onClick={() => navigate('/manager/dashboard/allocation')}
                                className="text-sm text-indigo-600 font-bold hover:underline"
                            >
                                Manage Matrix &rarr;
                            </button>
                        }
                    >
                        <div className="h-64 flex flex-col items-center justify-center text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                            <Users className="w-12 h-12 mb-3 opacity-20" />
                            <p className="text-sm font-medium">Quick snapshot of team assignments</p>
                            <button
                                onClick={() => navigate('/manager/dashboard/allocation')}
                                className="mt-4 px-4 py-2 bg-white border border-slate-200 shadow-sm rounded-lg text-sm font-bold text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all"
                            >
                                Open Allocation Matrix
                            </button>
                        </div>
                    </DashboardCard>
                </div>

                {/* Right Column - Tasks (4 cols) */}
                <div className="col-span-12 lg:col-span-4 space-y-6">
                    <DashboardCard title="Urgent Tasks" icon={CheckSquare}>
                        <div className="space-y-3">
                            {tasks?.slice(0, 5).map(t => (
                                <div key={t._id} className="flex items-start gap-3 p-3 bg-white border border-slate-100 rounded-xl hover:border-indigo-100 hover:shadow-sm transition-all cursor-pointer group">
                                    <div className={`mt-1 w-2 h-2 rounded-full ${t.priority === 'urgent' ? 'bg-red-500' : 'bg-slate-300'}`}></div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-700 truncate group-hover:text-indigo-600 transition-colors">{t.title}</p>
                                        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                            <Clock size={10} /> {new Date(t.dueDate).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {(!tasks || tasks.length === 0) && <p className="text-sm text-slate-400 italic text-center py-4">No urgent tasks.</p>}
                        </div>
                        <button
                            onClick={() => navigate('/manager/dashboard/tasks')}
                            className="w-full mt-4 py-2 text-xs font-bold text-slate-500 hover:text-indigo-600 border-t border-slate-50 transition-colors"
                        >
                            View All Tasks
                        </button>
                    </DashboardCard>
                </div>
            </div>
        </div>
    );
};

export default ManagerOverview;
