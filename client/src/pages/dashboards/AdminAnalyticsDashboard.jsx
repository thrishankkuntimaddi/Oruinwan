
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import {
  TrendingUp, MessageSquare, CheckCircle, Shield, CreditCard,
  Users, AlertTriangle, Calendar, Activity, Zap
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, Cell, LineChart, Line
} from 'recharts';
import AdminSidebar from '../../components/admin/AdminSidebar';
import { getCompanyMetrics } from '../../services/companyService';

const AdminAnalyticsDashboard = () => {
  const { user } = useAuth();
  const { company, isCompanyAdmin } = useCompany();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [metrics, setMetrics] = useState(null);

  // --- MOCK DATA FOR CHARTS --- (Simulating backend history)

  // 1. Growth Data
  const growthData = [
    { name: 'Week 1', users: 12, active: 8, workspaces: 2 },
    { name: 'Week 2', users: 15, active: 10, workspaces: 3 },
    { name: 'Week 3', users: 18, active: 14, workspaces: 3 },
    { name: 'Week 4', users: 24, active: 20, workspaces: 4 },
  ];

  // 2. Collaboration Volume
  const collaborationData = [
    { name: 'Mon', messages: 450, tasks: 24 },
    { name: 'Tue', messages: 520, tasks: 30 },
    { name: 'Wed', messages: 480, tasks: 45 },
    { name: 'Thu', messages: 610, tasks: 38 },
    { name: 'Fri', messages: 550, tasks: 50 },
    { name: 'Sat', messages: 120, tasks: 10 },
    { name: 'Sun', messages: 80, tasks: 5 },
  ];

  // 3. Workspace Health Status
  const workspaceHealth = [
    { name: 'Engineering', members: 12, activeRate: 92, lastActive: '2m ago', completion: 85, status: 'Healthy' },
    { name: 'Marketing', members: 8, activeRate: 88, lastActive: '1h ago', completion: 78, status: 'Healthy' },
    { name: 'Sales', members: 15, activeRate: 65, lastActive: '5h ago', completion: 60, status: 'At Risk' },
    { name: 'Design', members: 5, activeRate: 20, lastActive: '2d ago', completion: 30, status: 'Inactive' },
  ];

  useEffect(() => {
    if (!user?.companyId) return;
    const fetchData = async () => {
      try {
        const res = await getCompanyMetrics(user.companyId);
        setMetrics(res.metrics);
        setLoading(false);
      } catch (error) {
        console.error("Error loading analytics:", error);
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.companyId]);

  if (!isCompanyAdmin()) return null;

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <AdminSidebar />

      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 relative">
        <header className="h-16 px-8 flex items-center justify-between z-10 bg-white border-b border-slate-200">
          <div>
            <h2 className="text-xl font-black text-slate-800">Analytics & Insights Hub</h2>
            <p className="text-xs text-slate-500 font-medium">Trends & Deep Dive</p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            {['7d', '30d', '90d'].map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${timeRange === range
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                Last {range}
              </button>
            ))}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto w-full px-8 py-8 z-10 custom-scrollbar space-y-10 pb-20">

          {/* SECTION 1: GROWTH ANALYTICS */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><TrendingUp size={20} /></div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Growth Analytics</h3>
                <p className="text-sm text-slate-500">User adoption and workspace expansion over time.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-80">
                <h4 className="text-sm font-bold text-slate-700 mb-6">User Growth (Active vs Total)</h4>
                <ResponsiveContainer width="100%" height="85%">
                  <AreaChart data={growthData}>
                    <defs>
                      <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Area type="monotone" dataKey="users" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" name="Total Users" />
                    <Area type="monotone" dataKey="active" stroke="#10B981" strokeWidth={3} fill="none" name="Active Users" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-80">
                <h4 className="text-sm font-bold text-slate-700 mb-6">Workspace Expansion</h4>
                <ResponsiveContainer width="100%" height="85%">
                  <BarChart data={growthData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                    <Tooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="workspaces" fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={40} name="Workspaces" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* SECTION 2: COLLABORATION ANALYTICS */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><Activity size={20} /></div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Collaboration Intensity</h3>
                <p className="text-sm text-slate-500">Volume of interactions across the platform.</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-96">
              <h4 className="text-sm font-bold text-slate-700 mb-6">Messages vs Tasks Completed</h4>
              <ResponsiveContainer width="100%" height="85%">
                <LineChart data={collaborationData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Legend />
                  <Line type="monotone" dataKey="messages" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4 }} name="Messages Sent" />
                  <Line type="monotone" dataKey="tasks" stroke="#F59E0B" strokeWidth={3} dot={{ r: 4 }} name="Tasks Completed" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* SECTION 3: WORKSPACE HEALTH */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-green-100 rounded-lg text-green-600"><CheckCircle size={20} /></div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Workspace Health</h3>
                <p className="text-sm text-slate-500">Identifying healthy and at-risk teams.</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase">Workspace</th>
                    <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase">Active Members</th>
                    <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase">Last Activity</th>
                    <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase">Task Completion</th>
                    <th className="text-right py-4 px-6 text-xs font-bold text-slate-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workspaceHealth.map((ws, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="py-4 px-6 font-bold text-slate-800">{ws.name}</td>
                      <td className="py-4 px-6 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${ws.activeRate > 80 ? 'bg-green-500' : ws.activeRate > 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${ws.activeRate}%` }}></div>
                          </div>
                          <span>{ws.activeRate}%</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm text-slate-500">{ws.lastActive}</td>
                      <td className="py-4 px-6 text-sm font-bold text-slate-700">{ws.completion}%</td>
                      <td className="py-4 px-6 text-right">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${ws.status === 'Healthy' ? 'bg-green-100 text-green-700' :
                            ws.status === 'At Risk' ? 'bg-orange-100 text-orange-700' :
                              'bg-slate-100 text-slate-500'
                          }`}>
                          {ws.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* SECTION 4: Culture & Updates */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-pink-100 rounded-lg text-pink-600"><Zap size={20} /></div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Culture & Engagement</h3>
                  <p className="text-sm text-slate-500">How teams are connecting.</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
                  <div className="text-3xl font-black text-slate-800 mb-1">12</div>
                  <div className="text-xs font-bold text-slate-500 uppercase">Updates Posted</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
                  <div className="text-3xl font-black text-pink-600 mb-1">5</div>
                  <div className="text-xs font-bold text-slate-500 uppercase">Priority Updates</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
                  <div className="text-3xl font-black text-slate-800 mb-1">4.2</div>
                  <div className="text-xs font-bold text-slate-500 uppercase">Avg Reactions</div>
                </div>
              </div>
            </div>

            {/* SECTION 5: Security & Access */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-slate-100 rounded-lg text-slate-600"><Shield size={20} /></div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Security</h3>
                  <p className="text-sm text-slate-500">Access health.</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                  <span className="text-sm font-bold text-slate-600">2FA Enabled</span>
                  <span className="text-sm font-bold text-green-600">Enabled</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                  <span className="text-sm font-bold text-slate-600">SSO Status</span>
                  <span className="text-sm font-bold text-slate-400">Not Configured</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-600">Login Anomalies</span>
                  <span className="text-sm font-bold text-slate-800">0</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 6: Plan & Limits */}
          <section>
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white relative overflow-hidden">
              <div className="relative z-10 flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-black mb-2 flex items-center gap-2">
                    <CreditCard /> Pro Plan
                  </h3>
                  <p className="text-indigo-100 max-w-md">
                    You are currently on the Pro Plan. Unlock Enterprise features like SSO, Audit Logs, and Unlimited History.
                  </p>
                </div>
                <button className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors shadow-lg">
                  Upgrade to Enterprise
                </button>
              </div>
              {/* Decorative background circles */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl"></div>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
};

export default AdminAnalyticsDashboard;
