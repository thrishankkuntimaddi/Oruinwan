import React from "react";
import { Routes, Route, NavLink, Navigate, useNavigate } from "react-router-dom";
import { Shield, Home, Users, FileText, MessageSquare, Activity, Settings, LogOut, CheckSquare, Megaphone, DollarSign } from "lucide-react";

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

import { useAuth } from "../../contexts/AuthContext";

const ChttrixAdminDashboard = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    const menuItems = [
        { path: "", label: "Overview", icon: Home },
        { path: "pending", label: "Pending Requests", icon: CheckSquare },
        { path: "companies", label: "Active Companies", icon: Users },
        { path: "tickets", label: "Support Tickets", icon: FileText },
        { path: "broadcast", label: "Broadcast", icon: Megaphone },
        { path: "dm", label: "Direct Messages", icon: MessageSquare },
        { path: "billing", label: "Revenue & Billing", icon: DollarSign },
        { path: "health", label: "System Health", icon: Activity },
        { path: "settings", label: "Admin Settings", icon: Shield },
        { path: "logs", label: "Audit Logs", icon: FileText },
    ];

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900 font-sans overflow-hidden transition-colors duration-200">
            {/* Sidebar */}
            <aside className="w-64 bg-gray-900 text-white flex-shrink-0 h-full flex flex-col overflow-y-auto">
                <div className="p-8 flex items-center gap-3">
                    <img src="/chttrix-logo.jpg" alt="Chttrix" className="w-8 h-8 rounded-lg object-cover" />
                    <div>
                        <h1 className="font-black text-xl tracking-tight">Chttrix</h1>
                        <p className="text-xs text-gray-400 font-medium tracking-wider uppercase">Platform Admin</p>
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    {menuItems.map(item => (
                        <NavLink
                            key={item.path}
                            to={`/chttrix-admin/${item.path}`}
                            end={item.path === ""}
                            className={({ isActive }) => `
                                w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all
                                ${isActive
                                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/50"
                                    : "text-gray-400 hover:bg-gray-800 hover:text-white"}
                            `}
                        >
                            <item.icon size={18} />
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                <div className="p-4 border-t border-gray-800">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-400 hover:bg-red-400/10 transition-colors"
                    >
                        <LogOut size={18} /> Logout
                    </button>
                </div>
            </aside>

            {/* Main Content with Nested Routes */}
            <main className="flex-1 h-full overflow-y-auto p-8">
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
            </main>
        </div>
    );
};

export default ChttrixAdminDashboard;
