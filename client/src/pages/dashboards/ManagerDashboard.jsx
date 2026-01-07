// client/src/pages/dashboards/ManagerDashboard.jsx
// Manager Dashboard - Complete console for department managers

import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import {
  LayoutDashboard, Users, MapPin, CheckSquare, BarChart3,
  MessageSquare, Settings, ChevronDown
} from 'lucide-react';
import axios from 'axios';

const ManagerDashboard = () => {
  const { user } = useAuth();
  const { company } = useCompany();
  const navigate = useNavigate();
  const location = useLocation();

  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch user's managed departments
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/api/manager/my-departments`,
          { withCredentials: true }
        );

        const depts = response.data.departments || [];
        setDepartments(depts);

        // Auto-select first department if available
        if (depts.length > 0 && !selectedDepartment) {
          setSelectedDepartment(depts[0]);
        }
      } catch (error) {
        console.error('Error fetching departments:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchDepartments();
    }
  }, [user]);

  // Navigation items
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, path: '/manager/dashboard' },
    { id: 'team', label: 'My Team', icon: Users, path: '/manager/dashboard/team' },
    { id: 'location', label: 'My Location', icon: MapPin, path: '/manager/dashboard/location' },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, path: '/manager/dashboard/tasks' },
    { id: 'reports', label: 'Reports', icon: BarChart3, path: '/manager/dashboard/reports' },
    { id: 'contact', label: 'Contact Admin', icon: MessageSquare, path: '/manager/dashboard/contact' }
  ];

  const isActive = (path) => {
    if (path === '/manager/dashboard') {
      return location.pathname === path || location.pathname === '/manager/dashboard/overview';
    }
    // Specific check for settings to highlight nothing else or maybe a settings icon if we had one
    if (location.pathname === '/manager/dashboard/settings') return false;

    return location.pathname.startsWith(path);
  };

  // Check if user has manager or admin role
  const isManager = user?.companyRole === 'manager' || ['owner', 'admin'].includes(user?.companyRole);

  if (!isManager) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-500 mb-6">You need manager privileges to access this page</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (departments.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Department Assigned</h2>
          <p className="text-gray-500 mb-6">
            You are not currently managing any departments. Please contact your company administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo/Header - Updated to match AdminSidebar branding */}
        <div className="h-20 flex items-center px-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <img
              src="/chttrix-logo.jpg"
              alt="Chttrix Logo"
              className="w-10 h-10 rounded-xl shadow-md object-cover"
            />
            <div className="flex flex-col justify-center">
              <span className="font-black text-2xl leading-none text-slate-800 tracking-tighter">
                Chttrix
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-tight mt-1 ml-0.5">
                Manager Console
              </span>
            </div>
          </div>
        </div>

        {/* Context Header (Company/Dept) */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 bg-indigo-100 rounded-md flex items-center justify-center">
              <LayoutDashboard className="w-3 h-3 text-indigo-600" />
            </div>
            <span className="text-xs font-bold text-gray-500">{company?.name}</span>
          </div>

          {/* Department Selector (if admin viewing multiple) */}
          {['owner', 'admin'].includes(user?.companyRole) && departments.length > 1 ? (
            <div className="relative">
              <select
                value={selectedDepartment?._id || ''}
                onChange={(e) => {
                  const dept = departments.find(d => d._id === e.target.value);
                  setSelectedDepartment(dept);
                }}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none pr-8 shadow-sm"
              >
                {departments.map(dept => (
                  <option key={dept._id} value={dept._id}>
                    {dept.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          ) : (
            <div className="text-sm font-black text-gray-900 px-1">
              {selectedDepartment?.name || 'My Department'}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${active
                    ? 'bg-indigo-50 text-indigo-600 font-bold shadow-sm'
                    : 'text-gray-700 hover:bg-gray-50 font-medium'
                    }`}
                >
                  <Icon
                    size={20}
                    className={active ? 'text-indigo-600' : 'text-gray-400'}
                  />
                  <span className="text-sm">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* User Profile Section */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
              {user?.username?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{user?.username}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.companyRole}</p>
            </div>
            <button
              onClick={() => navigate('/manager/dashboard/settings')}
              className="p-2 hover:bg-gray-50 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings size={16} className="text-gray-400 hover:text-indigo-600" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet context={{ selectedDepartment, departments }} />
      </main>
    </div>
  );
};

export default ManagerDashboard;
