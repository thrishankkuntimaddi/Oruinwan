
import React, { useState, useEffect } from 'react';
import ManagerSidebar from '../../components/manager/ManagerSidebar';
import ScopeSelector from '../../components/manager/ScopeSelector';
import TeamAllocation from '../../components/manager/TeamAllocation';
import { StatsWidget, DashboardCard } from '../../components/company';
import { Users, CheckSquare, Clock, AlertCircle, HelpCircle, Search, Filter, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ManagerDashboard = () => {
  const [scope, setScope] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // overview, allocation, tasks, reports
  const [searchQuery, setSearchQuery] = useState('');

  // New state for communication
  const [companyContact, setCompanyContact] = useState(null);
  const [chatWorkspaceId, setChatWorkspaceId] = useState(null);

  const navigate = useNavigate();
  const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  // Handle data load from ScopeSelector
  const handleScopeDataLoad = (data) => {
    if (data.companyContact) setCompanyContact(data.companyContact);
    if (data.chatWorkspaceId) setChatWorkspaceId(data.chatWorkspaceId);
  };

  const handleContactAdmin = () => {
    if (!chatWorkspaceId || !companyContact) {
      alert("Admin contact info not available yet. Please try again in a moment.");
      return;
    }
    // Navigate to DM creation route
    navigate(`/workspace/${chatWorkspaceId}/dm/new/${companyContact._id}`);
  };

  // Fetch data when scope changes
  useEffect(() => {
    if (!scope) return;

    const fetchData = async () => {
      setLoading(true);
      console.log("Fetching dashboard data for scope:", scope);
      try {
        const token = localStorage.getItem('accessToken');
        const headers = { Authorization: `Bearer ${token}` };
        const params = `?scopeType=${scope.type}&scopeId=${scope.id}`;

        // Parallel Fetch
        const [metricsRes, tasksRes] = await Promise.all([
          fetch(`${API_BASE}/api/managers/metrics${params}`, { headers }),
          fetch(`${API_BASE}/api/managers/tasks${params}`, { headers })
        ]);

        const metricsData = await metricsRes.json();
        const tasksData = await tasksRes.json();

        console.log("Metrics Data:", metricsData);
        console.log("Tasks Data:", tasksData);

        setMetrics(metricsData);
        setTasks(tasksData);

      } catch (err) {
        console.error("Dashboard fetch error", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [scope]);

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-slate-900 overflow-hidden">
      {/* Sidebar - Shared component style */}
      <ManagerSidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 relative">
        {/* Topbar - Matches AdminDashboard Header */}
        <header className="h-16 px-8 flex items-center justify-between z-40 bg-white border-b border-slate-200">
          <div>
            <h2 className="text-xl font-black text-slate-800">Manager Console</h2>
            <p className="text-xs text-slate-500 font-medium">Execution & Delivery</p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleContactAdmin}
              className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-indigo-600 transition-colors mr-2 px-3 py-2 rounded-lg hover:bg-slate-50"
              title={companyContact ? `Contact ${companyContact.username}` : 'Contact Admin'}
            >
              <HelpCircle size={18} />
              <span className="hidden lg:inline">Contact Admin</span>
            </button>
            <div className="h-6 w-px bg-slate-200"></div>

            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                placeholder="Search tasks, members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-64 shadow-sm"
              />
            </div>

            <ScopeSelector onScopeChange={setScope} onLoad={handleScopeDataLoad} />

            <button className="w-9 h-9 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-500 hover:text-indigo-600 shadow-sm relative">
              <Bell size={18} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
            </button>
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto w-full px-8 py-8 z-10 custom-scrollbar">
          {loading || !metrics ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="space-y-8 animate-slideDown max-w-[1600px] mx-auto">

              {/* Overview Tab Content */}
              {activeTab === 'overview' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatsWidget icon={Users} label="Team Size" value={metrics.teamSize || 0} bgColor="bg-blue-50" iconColor="text-blue-600" />
                    <StatsWidget icon={Users} label="Active Users" value={metrics.activeUsers || 0} bgColor="bg-green-50" iconColor="text-green-600" />
                    <StatsWidget icon={CheckSquare} label="Open Tasks" value={metrics.openTasks || 0} bgColor="bg-purple-50" iconColor="text-purple-600" />
                    <StatsWidget icon={AlertCircle} label="Overdue" value={metrics.overdueTasks || 0} bgColor="bg-red-50" iconColor="text-red-600" />
                  </div>

                  <div className="grid grid-cols-12 gap-8">
                    {/* Left Column - Allocations (8 cols) */}
                    <div className="col-span-12 lg:col-span-8">
                      <DashboardCard
                        title="Team Allocation"
                        icon={Users}
                        headerActions={
                          <button onClick={() => setActiveTab('allocation')} className="text-sm text-indigo-600 font-bold hover:underline">Manage Matrix &rarr;</button>
                        }
                      >
                        <div className="h-64 flex flex-col items-center justify-center text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                          <Users className="w-12 h-12 mb-3 opacity-20" />
                          <p className="text-sm font-medium">Quick snapshot of team assignments</p>
                          <button onClick={() => setActiveTab('allocation')} className="mt-4 px-4 py-2 bg-white border border-slate-200 shadow-sm rounded-lg text-sm font-bold text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all">
                            Open Allocation Matrix
                          </button>
                        </div>
                      </DashboardCard>
                    </div>

                    {/* Right Column - Tasks (4 cols) */}
                    <div className="col-span-12 lg:col-span-4 space-y-6">
                      <DashboardCard title="Urgent Tasks" icon={CheckSquare}>
                        <div className="space-y-3">
                          {tasks.slice(0, 5).map(t => (
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
                          {tasks.length === 0 && <p className="text-sm text-slate-400 italic text-center py-4">No urgent tasks.</p>}
                        </div>
                        <button onClick={() => setActiveTab('tasks')} className="w-full mt-4 py-2 text-xs font-bold text-slate-500 hover:text-indigo-600 border-t border-slate-50 transition-colors">
                          View All Tasks
                        </button>
                      </DashboardCard>
                    </div>
                  </div>
                </>
              )}

              {/* Allocation Tab */}
              {activeTab === 'allocation' && (
                <div className="animate-slideDown">
                  <TeamAllocation />
                </div>
              )}

              {/* Tasks Tab */}
              {activeTab === 'tasks' && (
                <DashboardCard title="Task Execution List" icon={CheckSquare}>
                  <div className="divide-y divide-slate-100">
                    <div className="grid grid-cols-12 px-4 py-3 bg-slate-50/50 text-xs font-bold text-slate-400 uppercase tracking-wider rounded-t-lg">
                      <div className="col-span-5">Task Name</div>
                      <div className="col-span-2">Priority</div>
                      <div className="col-span-2">Due Date</div>
                      <div className="col-span-3">Assigned To</div>
                    </div>
                    {tasks.map(task => (
                      <div key={task._id} className="grid grid-cols-12 items-center px-4 py-4 hover:bg-slate-50 transition-colors group">
                        <div className="col-span-5 pr-4">
                          <p className="text-sm font-bold text-slate-700 truncate group-hover:text-indigo-600 transition-colors">{task.title}</p>
                        </div>
                        <div className="col-span-2">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${task.priority === 'urgent' ? 'bg-red-50 text-red-600' :
                            task.priority === 'high' ? 'bg-orange-50 text-orange-600' :
                              'bg-slate-100 text-slate-500'
                            }`}>{task.priority}</span>
                        </div>
                        <div className="col-span-2 text-xs text-slate-500 font-medium">
                          {new Date(task.dueDate).toLocaleDateString()}
                        </div>
                        <div className="col-span-3 flex -space-x-2">
                          {task.assignedTo?.slice(0, 3).map((u, i) => (
                            <div key={i} title={u.username} className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-xs font-bold text-slate-600 ring-2 ring-transparent group-hover:ring-indigo-100 transition-all">
                              {u.username?.[0]}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {tasks.length === 0 && (
                      <div className="p-12 text-center text-slate-400">
                        <CheckSquare size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No tasks found in this scope.</p>
                      </div>
                    )}
                  </div>
                </DashboardCard>
              )}

              {/* Reports Tab */}
              {activeTab === 'reports' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 text-center max-w-2xl mx-auto mt-10">
                  <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                    <Users size={32} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-2">Performance Reports</h3>
                  <p className="text-slate-500 mb-8 max-w-md mx-auto">
                    Detailed analytics and downloadable reports for team performance and velocity are currently under development.
                  </p>
                  <button className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-0.5">
                    Notify Me When Ready
                  </button>
                </div>
              )}

            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ManagerDashboard;

