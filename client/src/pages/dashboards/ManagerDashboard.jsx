
import React from 'react'; // Removed unused useState, useEffect imports
import {
  Users, Briefcase, Hash, Calendar, Plus, MessageSquare
} from 'lucide-react';
// import { useDepartment } from '../../contexts/DepartmentContext';

const ManagerDashboard = () => {
  // In real implementation, these would come from context/API
  // const { user } = useAuth();
  // const { managedDepartments } = useDepartment();

  // Mock Data
  const managedDept = "Engineering";
  const stats = {
    members: 45,
    workspaces: 3,
    activeTasks: 128,
    meetings: 4
  };

  const workspaces = [
    { id: 1, name: "Engineering Workflow", members: 45, channels: 12 },
    { id: 2, name: "Backend Squad", members: 18, channels: 8 },
    { id: 3, name: "Frontend Squad", members: 22, channels: 6 },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">{managedDept} Overview</h1>
        <p className="text-slate-500">Manage your department's workspaces, members, and resources.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 hover:-translate-y-0.5 hover:shadow-md transition-all">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-50 text-blue-500">
            <Users size={24} />
          </div>
          <div>
            <h3 className="text-sm text-slate-500 mb-1">Team Members</h3>
            <p className="text-2xl font-bold text-slate-900">{stats.members}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 hover:-translate-y-0.5 hover:shadow-md transition-all">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-500">
            <Briefcase size={24} />
          </div>
          <div>
            <h3 className="text-sm text-slate-500 mb-1">Workspaces</h3>
            <p className="text-2xl font-bold text-slate-900">{stats.workspaces}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 hover:-translate-y-0.5 hover:shadow-md transition-all">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-violet-50 text-violet-500">
            <Hash size={24} />
          </div>
          <div>
            <h3 className="text-sm text-slate-500 mb-1">Active Tasks</h3>
            <p className="text-2xl font-bold text-slate-900">{stats.activeTasks}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 hover:-translate-y-0.5 hover:shadow-md transition-all">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-50 text-amber-500">
            <Calendar size={24} />
          </div>
          <div>
            <h3 className="text-sm text-slate-500 mb-1">Meetings Today</h3>
            <p className="text-2xl font-bold text-slate-900">{stats.meetings}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-slate-800">Department Workspaces</h2>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors">
            <Plus size={16} /> New Workspace
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map(ws => (
            <div key={ws.id} className="p-6 bg-white border border-slate-200 rounded-xl hover:border-blue-500 hover:shadow-md cursor-pointer transition-all">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">{ws.name}</h3>
              <p className="text-sm text-slate-500 mb-4">Active workspace for {managedDept}</p>
              <div className="flex gap-4 text-xs font-medium text-slate-400">
                <span className="flex items-center gap-1"><Users size={14} /> {ws.members}</span>
                <span className="flex items-center gap-1"><MessageSquare size={14} /> {ws.channels} Channels</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-slate-800">Team Management</h2>
          <button className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-50 hover:text-slate-900 transition-colors">
            View All Members
          </button>
        </div>
        <div className="p-8 bg-slate-50 rounded-lg text-center text-slate-500 animate-pulse">
          Team members list would appear here...
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
