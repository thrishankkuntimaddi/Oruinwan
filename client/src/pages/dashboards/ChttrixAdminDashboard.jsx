import React, { useState } from "react";
import { Shield, Home, Users, FileText, MessageSquare, Activity, Settings, LogOut, CheckSquare, Megaphone } from "lucide-react";
import { useNavigate } from "react-router-dom";

// View Imports
import Overview from "../admin/platform/views/Overview";
import PendingRequests from "../admin/platform/views/PendingRequests";
import ActiveCompanies from "../admin/platform/views/ActiveCompanies";
import SupportTickets from "../admin/platform/views/SupportTickets";
import PlatformChat from "../admin/platform/views/PlatformChat";
import AuditLogs from "../admin/platform/views/AuditLogs";
import Broadcast from "../admin/platform/views/Broadcast";
import CompanyDetail from "../admin/platform/views/CompanyDetail";
import AdminSettings from "../admin/platform/views/AdminSettings";
import Billing from "../admin/platform/views/Billing";
import SystemHealth from "../admin/platform/views/SystemHealth";

const ChttrixAdminDashboard = () => {
    const [currentView, setCurrentView] = useState("overview");
    const [chatTarget, setChatTarget] = useState(null); // ID of company to chat with
    const [detailTarget, setDetailTarget] = useState(null); // ID of company to view details
    const navigate = useNavigate();

    const handleChatStart = (companyId) => {
        setChatTarget(companyId);
        setCurrentView("chat");
    };

    const handleViewDetail = (companyId) => {
        setDetailTarget(companyId);
        setCurrentView("companyDetail");
    };

    const menuItems = [
        { id: "overview", label: "Overview", icon: Home },
        { id: "pending", label: "Pending Requests", icon: CheckSquare },
        { id: "companies", label: "Active Companies", icon: Users },
        { id: "tickets", label: "Support Tickets", icon: FileText },
        { id: "broadcast", label: "Broadcast", icon: Megaphone },
        { id: "chat", label: "Direct Messages", icon: MessageSquare },
        { id: "billing", label: "Revenue & Billing", icon: Settings }, // Using Settings icon as placeholder for dollar/billing if needed or reuse
        { id: "health", label: "System Health", icon: Activity },
        { id: "settings", label: "Admin Settings", icon: Shield },
        { id: "logs", label: "Audit Logs", icon: FileText }, // Changed icon to distinguish
    ];

    const renderView = () => {
        switch (currentView) {
            case "overview": return <Overview />;
            case "pending": return <PendingRequests />;
            case "companies": return <ActiveCompanies onChatStart={handleChatStart} onViewDetail={handleViewDetail} />;
            case "tickets": return <SupportTickets />;
            case "chat": return <PlatformChat targetCompanyId={chatTarget} />;
            case "broadcast": return <Broadcast />;
            case "companyDetail": return <CompanyDetail companyId={detailTarget} onBack={() => setCurrentView("companies")} />;
            case "billing": return <Billing />;
            case "health": return <SystemHealth />;
            case "settings": return <AdminSettings />;
            case "logs": return <AuditLogs />;
            default: return <Overview />;
        }
    };

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
                        <button
                            key={item.id}
                            onClick={() => setCurrentView(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all
                                ${currentView === item.id
                                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/50"
                                    : "text-gray-400 hover:bg-gray-800 hover:text-white"}`}
                        >
                            <item.icon size={18} />
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-gray-800">
                    <button
                        onClick={() => navigate("/login")}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-400 hover:bg-red-400/10 transition-colors"
                    >
                        <LogOut size={18} /> Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 h-full overflow-y-auto p-8">
                {renderView()}
            </main>
        </div>
    );
};

export default ChttrixAdminDashboard;
