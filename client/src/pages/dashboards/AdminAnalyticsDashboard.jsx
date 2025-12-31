import React, { useState, useEffect } from 'react';
import {
  Users, Briefcase, Hash, TrendingUp,
  Settings, Shield, UserPlus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const AdminAnalyticsDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/admin/analytics/stats`, {
          withCredentials: true
        });
        setStats(res.data.stats);
      } catch (err) {
        console.error("Failed to fetch stats", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const iconMap = {
    'Users': Users,
    'Briefcase': Briefcase,
    'Hash': Hash,
    'TrendingUp': TrendingUp
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Company Overview</h1>
          <p className="text-slate-500">Track your organization's growth and activity.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/workspaces')}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm flex items-center gap-2"
          >
            <Briefcase size={16} /> Go to Personal Workspace
          </button>
          <div className="text-sm font-medium text-gray-500 bg-gray-100 px-4 py-2 rounded-lg">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {loading ? (
          [1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-pulse flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
              <div className="space-y-2">
                <div className="h-4 w-20 bg-gray-200 rounded"></div>
                <div className="h-8 w-12 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))
        ) : (
          stats.map(stat => {
            const Icon = iconMap[stat.icon] || TrendingUp;
            // Map hex color to tailwind class approx or use inline style for icon bg
            return (
              <div key={stat.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 hover:-translate-y-0.5 hover:shadow-md transition-all">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{
                    backgroundColor: `${stat.color}20`,
                    color: stat.color
                  }}
                >
                  <Icon size={24} />
                </div>
                <div>
                  <h3 className="text-sm text-slate-500 mb-1">{stat.title}</h3>
                  <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                  <span className="text-xs text-slate-400">{stat.change}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <h2 className="text-xl font-semibold text-slate-800 mb-6">Quick Actions</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        {[
          { icon: Briefcase, label: "New Department", action: () => navigate('/admin/departments') }, // Assuming this route exists or we create it
          { icon: Settings, label: "Company Settings", action: () => navigate('/admin/settings') },
          { icon: Shield, label: "Manage Roles", action: () => navigate('/admin/users') },
          { icon: UserPlus, label: "Invite Employees", action: () => navigate('/admin/company') } // CompanyAdmin has invite form
        ].map((item, idx) => (
          <button
            key={idx}
            onClick={item.action}
            className="bg-white border border-slate-200 p-6 rounded-xl flex flex-col items-center justify-center gap-4 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all text-slate-600 group"
          >
            <item.icon size={32} className="group-hover:scale-110 transition-transform" />
            <h4 className="font-semibold">{item.label}</h4>
          </button>
        ))}
      </div>
    </div >
  );
};

export default AdminAnalyticsDashboard;
