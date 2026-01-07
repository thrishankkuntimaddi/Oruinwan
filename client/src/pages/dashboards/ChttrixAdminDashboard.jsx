import React, { useState } from "react";
import { Routes, Route, NavLink, Navigate, useNavigate } from "react-router-dom";
import {
    Shield, Home, Users, FileText, MessageSquare, Activity,
    Settings, LogOut, CheckSquare, Megaphone, DollarSign,
    Sun, Moon, ChevronUp
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";

// View Imports
import Overview from "../admin/platform/views/Overview";
import PendingRequests from "../admin/platform/views/PendingRequests";
import ActiveCompanies from "../admin/platform/views/ActiveCompanies";
import SupportTickets from "../admin/platform/views/SupportTickets";
import PlatformChat from "../admin/platform/views/PlatformChat";
import AuditLogs from "../admin/platform/views/AuditLogs";
import Broadcast from "../admin/platform/views/Broadcast";
import AdminSettings from "../admin/platform/views/AdminSettings";
import Billing from "../admin/platform/views/Billing";
import SystemHealth from "../admin/platform/views/SystemHealth";

const ChttrixAdminDashboard = () => {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [showUserMenu, setShowUserMenu] = useState(false);

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    const navGroups = [
        {
            title: "PLATFORM",
            items: [
                { path: "", label: "Overview", icon: Home },
                { path: "companies", label: "Active Companies", icon: Users },
                { path: "pending", label: "Pending Requests", icon: CheckSquare },
            ]
        },
        {
            title: "COMMUNICATION",
            items: [
                { path: "dm", label: "Direct Messages", icon: MessageSquare },
                { path: "broadcast", label: "Broadcast", icon: Megaphone },
                { path: "tickets", label: "Support Tickets", icon: FileText },
            ]
        },
        {
            title: "SYSTEM",
            items: [
                { path: "billing", label: "Revenue & Billing", icon: DollarSign },
                { path: "health", label: "System Health", icon: Activity },
                { path: "logs", label: "Audit Logs", icon: FileText },
                { path: "settings", label: "Admin Settings", icon: Shield },
            ]
        }
    ];

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900 font-sans text-gray-900 dark:text-gray-100 overflow-hidden transition-colors duration-200">
            {/* Sidebar */}
            <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col z-20 shadow-lg shadow-indigo-100/20 dark:shadow-none h-screen sticky top-0 transition-colors duration-200">
                {/* Header */}
                <div className="h-20 flex items-center justify-between px-6 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <img src="/chttrix-logo.jpg" alt="Chttrix" className="w-9 h-9 rounded-xl shadow-md object-cover" />
                        <div className="flex flex-col justify-center">
                            <span className="font-black text-xl leading-none text-slate-800 dark:text-white tracking-tighter">
                                Chttrix
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-[0.1em] leading-tight mt-1">
                                Platform Admin
                            </span>
                        </div>
                    </div>
                    {/* Dark Mode Toggle */}
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-gray-700 dark:hover:text-indigo-400 transition-colors"
                    >
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                </div>

                {/* Navigation */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                    {navGroups.map((group, idx) => (
                        <div key={idx}>
                            <h3 className="px-4 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest mb-2 font-mono">
                                {group.title}
                            </h3>
                            <div className="space-y-1">
                                {group.items.map(item => (
                                    <NavLink
                                        key={item.path}
                                        to={`/chttrix-admin/${item.path}`}
                                        end={item.path === ""}
                                        className={({ isActive }) => `
                                            w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200
                                            ${isActive
                                                ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 shadow-sm"
                                                : "text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700/50 hover:text-slate-900 dark:hover:text-gray-200"}
                                        `}
                                    >
                                        <item.icon size={18} className="flex-shrink-0" />
                                        {item.label}
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer / User Profile */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-700 relative">
                    {showUserMenu && (
                        <div className="absolute bottom-full left-4 right-4 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200">
                            <div className="p-3 bg-gray-50 dark:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700">
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Account</p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowUserMenu(false);
                                    navigate('/chttrix-admin/settings');
                                }}
                                className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 text-gray-700 dark:text-gray-200"
                            >
                                <Settings size={16} className="text-gray-400" />
                                <span>Settings</span>
                            </button>
                            <div className="border-t border-gray-100 dark:border-gray-700"></div>
                            <button
                                onClick={handleLogout}
                                className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-3 font-medium"
                            >
                                <LogOut size={16} />
                                <span>Logout</span>
                            </button>
                        </div>
                    )}
                    <button
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
                    >
                        <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400 text-sm border-2 border-white dark:border-gray-600 shadow-sm group-hover:border-indigo-200 dark:group-hover:border-indigo-700 transition-colors">
                            {user?.username?.charAt(0)?.toUpperCase() || 'A'}
                        </div>
                        <div className="flex-1 overflow-hidden text-left">
                            <p className="text-sm font-bold truncate text-gray-900 dark:text-gray-100">{user?.username || 'Admin'}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Super Admin</p>
                        </div>
                        <ChevronUp size={16} className={`text-gray-400 transition-transform duration-200 ${showUserMenu ? '' : 'rotate-180'}`} />
                    </button>
                </div>
            </aside>

            {/* Main Content with Nested Routes */}
            <main className="flex-1 h-full overflow-y-auto bg-gray-50 dark:bg-gray-900 relative">
                <div className="p-8 pb-20">
                    <Routes>
                        <Route index element={<Overview />} />
                        <Route path="pending" element={<PendingRequests />} />
                        <Route path="companies" element={<ActiveCompanies />} />
                        <Route path="tickets" element={<SupportTickets />} />
                        <Route path="broadcast" element={<Broadcast />} />
                        <Route path="dm" element={<PlatformChat />} />
                        <Route path="dm/:companyId" element={<PlatformChat />} />
                        <Route path="billing" element={<Billing />} />
                        <Route path="health" element={<SystemHealth />} />
                        <Route path="settings" element={<AdminSettings />} />
                        <Route path="logs" element={<AuditLogs />} />
                        {/* Fallback to overview */}
                        <Route path="*" element={<Navigate to="/chttrix-admin" replace />} />
                    </Routes>
                </div>
            </main>
        </div>
    );
};

export default ChttrixAdminDashboard;
