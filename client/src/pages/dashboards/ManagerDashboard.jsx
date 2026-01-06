
import React, { useState, useEffect } from 'react';
import ManagerSidebar from '../../components/manager/ManagerSidebar';
import ScopeSelector from '../../components/manager/ScopeSelector';
import { HelpCircle, Search, Bell } from 'lucide-react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';

const ManagerDashboard = () => {
  const [scope, setScope] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // New state for communication
  const [companyContact, setCompanyContact] = useState(null);
  const [chatWorkspaceId, setChatWorkspaceId] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();
  const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  // Determine active tab based on path for Sidebar sync
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes('/allocation')) return 'allocation';
    if (path.includes('/tasks')) return 'tasks';
    if (path.includes('/reports')) return 'reports';
    return 'overview';
  };

  const handleSidebarChange = (tabId) => {
    navigate(`/manager/dashboard/${tabId}`);
  };

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
      <ManagerSidebar activeTab={getActiveTab()} setActiveTab={handleSidebarChange} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 dark:bg-slate-900/50 relative">
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
            <div className="w-full h-full">
              <Outlet context={{ metrics, tasks, scope, loading }} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ManagerDashboard;

