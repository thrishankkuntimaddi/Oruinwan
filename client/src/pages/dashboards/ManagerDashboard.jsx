// client/src/pages/dashboards/ManagerDashboard.jsx
// Manager Dashboard - Complete console for department managers

import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  LayoutDashboard, Users, MapPin, CheckSquare, BarChart3,
  MessageSquare, Settings, ChevronDown, Globe, Moon, Sun, ChevronUp, LogOut, User as UserIcon
} from 'lucide-react';
import axios from 'axios';

const ManagerDashboard = () => {
  const { user, logout } = useAuth();
  const { company } = useCompany();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);

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

  // Auto-select first department if available
  useEffect(() => {
    if (departments.length > 0 && !selectedDepartment) {
      setSelectedDepartment(departments[0]);
    }
  }, [departments, selectedDepartment]);

  // Navigation Groups
  const groupedNavItems = [
    {
      group: 'MANAGE',
      items: [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard, path: '/manager/dashboard/overview' },
        { id: 'team', label: 'My Team', icon: Users, path: '/manager/dashboard/team' },
        { id: 'tasks', label: 'Tasks', icon: CheckSquare, path: '/manager/dashboard/tasks' },
        { id: 'reports', label: 'Reports', icon: BarChart3, path: '/manager/dashboard/reports' },
      ]
    },
    {
      group: 'WORKSPACE',
      items: [
        { id: 'location', label: 'My Location', icon: MapPin, path: '/manager/dashboard/location' },
      ]
    },
    {
      group: 'SYSTEM',
      items: [
        { id: 'contact', label: 'Contact Admin', icon: MessageSquare, path: '/manager/dashboard/contact' },
        { id: 'app', label: 'Go to App', icon: Globe, path: '/workspaces' },
      ]
    }
  ];

  const isActive = (path) => {
    if (path === '/manager/dashboard/overview') {
      return location.pathname === '/manager/dashboard' || location.pathname === '/manager/dashboard/overview';
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
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
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 font-sans text-gray-900 dark:text-gray-100 overflow-hidden transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col z-20 shadow-lg shadow-indigo-100/20 dark:shadow-none h-screen sticky top-0 transition-colors duration-200">
        {/* Logo/Header */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <img
              src="/chttrix-logo.jpg"
              alt="Chttrix Logo"
              className="w-10 h-10 rounded-xl shadow-md object-cover flex-shrink-0"
            />
            <div className="flex flex-col justify-center min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-lg leading-none text-slate-800 dark:text-white tracking-tighter">
                  Chttrix
                </span>
                <span className="text-slate-300 dark:text-gray-600 font-medium text-lg">×</span>
                <span className="font-bold text-lg leading-none text-slate-800 dark:text-white tracking-tight truncate">
                  {company?.name}
                </span>
              </div>

              {/* Department Selector / Display */}
              {['owner', 'admin'].includes(user?.companyRole) && departments.length > 1 ? (
                <div className="relative mt-0.5 flex items-center">
                  <select
                    value={selectedDepartment?._id || ''}
                    onChange={(e) => {
                      const dept = departments.find(d => d._id === e.target.value);
                      setSelectedDepartment(dept);
                    }}
                    className="appearance-none bg-transparent text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest cursor-pointer focus:outline-none pr-4 hover:text-indigo-700 transition-colors"
                  >
                    {departments.map(dept => (
                      <option key={dept._id} value={dept._id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-indigo-400 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              ) : (
                <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest leading-tight mt-0.5 ml-0.5 truncate">
                  {selectedDepartment?.name || 'Manager Console'}
                </span>
              )}
            </div>
          </div>
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="ml-2 p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-gray-700 dark:hover:text-indigo-400 transition-colors flex-shrink-0"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        {/* Grouped Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 scrollbar-hide">
          <div className="space-y-8">
            {groupedNavItems.map((group, groupIndex) => (
              <div key={group.group}>
                <h3 className="px-4 text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                  {group.group}
                </h3>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);

                    return (
                      <button
                        key={item.id}
                        onClick={() => navigate(item.path)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all duration-200 ${active
                          ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold shadow-sm translate-x-1'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200 font-medium'
                          }`}
                      >
                        <Icon
                          size={18}
                          className={`${active ? 'stroke-2' : 'stroke-[1.5]'}`}
                        />
                        <span className="text-sm">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* User Profile Section with Dropdown */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 relative bg-white dark:bg-gray-800">
          {/* Dropdown Menu */}
          {showUserMenu && (
            <div className="absolute bottom-full left-4 right-4 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="p-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400">Account</p>
              </div>
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  navigate('/manager/dashboard/settings');
                }}
                className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
              >
                <Settings size={16} className="text-gray-400" />
                <span className="font-medium">Settings</span>
              </button>
              <div className="border-t border-gray-100 dark:border-gray-700"></div>
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  handleLogout();
                }}
                className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors flex items-center gap-3"
              >
                <LogOut size={16} />
                <span className="font-medium">Logout</span>
              </button>
            </div>
          )}

          {/* User Info Button */}
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all ${showUserMenu ? 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-700' : ''}`}
          >
            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400 text-sm shadow-sm">
              {user?.username?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden text-left">
              <p className="text-sm font-bold truncate text-gray-900 dark:text-white">{user?.username}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate capitalize">{user?.companyRole}</p>
            </div>
            <ChevronUp size={16} className={`text-gray-400 transition-transform duration-200 ${showUserMenu ? '' : 'rotate-180'}`} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <Outlet context={{ selectedDepartment, departments }} />
      </main>
    </div>
  );
};

export default ManagerDashboard;
