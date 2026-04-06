import React, { useState, useEffect, useCallback } from "react";
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation } from "react-router-dom";
import {
    Shield, Home, Users, FileText, MessageSquare, Activity,
    Settings, LogOut, CheckSquare, Megaphone, DollarSign,
    ChevronUp, Menu, X
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

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

const ChttrixAdminDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        const onResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (!mobile) setSidebarOpen(false);
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        if (isMobile) setSidebarOpen(false);
    }, [location.pathname, isMobile]);

    const closeSidebar = useCallback(() => setSidebarOpen(false), []);

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    return (
        <div style={{
            display: 'flex',
            height: '100vh',
            background: 'var(--bg-base)',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            overflow: 'hidden',
            position: 'relative',
        }}>
            {/* Mobile Backdrop */}
            {isMobile && sidebarOpen && (
                <div
                    onClick={closeSidebar}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 35,
                        background: 'rgba(0,0,0,0.65)',
                        backdropFilter: 'blur(2px)',
                    }}
                />
            )}

            {/* Sidebar */}
            <aside style={{
                width: '240px',
                background: 'var(--bg-surface)',
                borderRight: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
                flexShrink: 0,
                ...(isMobile ? {
                    position: 'fixed', top: 0, left: 0, zIndex: 40,
                    transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
                    transition: 'transform 280ms cubic-bezier(0.16,1,0.3,1)',
                    boxShadow: sidebarOpen ? '4px 0 32px rgba(0,0,0,0.5)' : 'none',
                } : {
                    position: 'sticky', top: 0, zIndex: 20,
                })
            }}>
                {/* Header */}
                <div style={{
                    height: '64px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '0 20px',
                    borderBottom: '1px solid var(--border-subtle)',
                    flexShrink: 0
                }}>
                    <img src="/chttrix-logo.jpg" alt="Chttrix" style={{ width: '28px', height: '28px', objectFit: 'cover', flexShrink: 0 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em', lineHeight: 1.2 }}>
                            Chttrix
                        </span>
                        <span style={{
                            fontSize: '10px', fontWeight: 700,
                            color: 'var(--text-muted)',
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            lineHeight: 1.4, marginTop: '2px'
                        }}>
                            Platform Admin
                        </span>
                    </div>
                </div>

                {/* Navigation */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }} className="custom-scrollbar">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {navGroups.map((group, idx) => (
                            <div key={idx}>
                                <h3 style={{
                                    fontSize: '10px', fontWeight: 700,
                                    color: 'var(--text-muted)',
                                    letterSpacing: '0.13em',
                                    textTransform: 'uppercase',
                                    padding: '0 8px',
                                    marginBottom: '4px'
                                }}>
                                    {group.title}
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                    {group.items.map(item => (
                                        <SidebarNavLink key={item.path} item={item} onClose={closeSidebar} />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer / User Profile */}
                <div style={{ padding: '12px', borderTop: '1px solid var(--border-subtle)', position: 'relative', flexShrink: 0 }}>
                    {showUserMenu && (
                        <div style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: '12px',
                            right: '12px',
                            marginBottom: '4px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-default)',
                            overflow: 'hidden',
                            zIndex: 50
                        }}>
                            <MenuHeader label="Account" />
                            <MenuActionBtn
                                icon={Settings}
                                label="Settings"
                                onClick={() => { setShowUserMenu(false); navigate('/chttrix-admin/settings'); }}
                            />
                            <div style={{ height: '1px', background: 'var(--border-subtle)' }} />
                            <LogoutBtnItem onClick={handleLogout} />
                        </div>
                    )}
                    <ProfileBtn
                        user={user}
                        showUserMenu={showUserMenu}
                        onToggle={() => setShowUserMenu(!showUserMenu)}
                    />
                </div>
            </aside>

            {/* Main Content */}
            <main style={{
                flex: 1,
                height: '100vh',
                overflowY: 'auto',
                background: 'var(--bg-base)',
                display: 'flex', flexDirection: 'column',
            }} className="custom-scrollbar">
                {/* Mobile Top Bar */}
                {isMobile && (
                    <div style={{
                        height: '52px', flexShrink: 0,
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '0 16px',
                        background: 'var(--bg-surface)',
                        borderBottom: '1px solid var(--border-subtle)',
                        position: 'sticky', top: 0, zIndex: 10,
                    }}>
                        <button
                            onClick={() => setSidebarOpen(o => !o)}
                            style={{
                                padding: '6px', background: 'none', border: 'none',
                                cursor: 'pointer', color: 'var(--text-secondary)',
                                display: 'flex', alignItems: 'center',
                            }}
                            aria-label="Toggle sidebar"
                        >
                            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                        <div>
                            <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)', margin: 0 }}>Platform Admin</p>
                            <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>Chttrix Console</p>
                        </div>
                    </div>
                )}
                <div style={{ padding: isMobile ? '20px 16px 80px' : '32px', paddingBottom: '80px', flex: 1 }}>
                    <Routes>
                        <Route index element={<Overview />} />
                        <Route path="pending" element={<PendingRequests />} />
                        <Route path="companies" element={<ActiveCompanies />} />
                        <Route path="tickets" element={<SupportTickets />} />
                        <Route path="broadcast" element={<Broadcast />} />
                        <Route path="dm" element={<PlatformChat />} />
                        <Route path="dm/user/:userId" element={<PlatformChat />} />
                        <Route path="billing" element={<Billing />} />
                        <Route path="health" element={<SystemHealth />} />
                        <Route path="settings" element={<AdminSettings />} />
                        <Route path="logs" element={<AuditLogs />} />
                        <Route path="*" element={<Navigate to="/chttrix-admin" replace />} />
                    </Routes>
                </div>
            </main>
        </div>
    );
};

const SidebarNavLink = ({ item, onClose }) => (
    <NavLink
        to={`/chttrix-admin/${item.path}`}
        end={item.path === ""}
        onClick={onClose}
        style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px',
            background: isActive ? 'var(--bg-active)' : 'transparent',
            borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
            color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontSize: '13px',
            fontWeight: isActive ? 500 : 400,
            textDecoration: 'none',
            transition: 'color 150ms ease, background 150ms ease',
            cursor: 'pointer'
        })}
        onMouseEnter={e => {
            if (!e.currentTarget.style.borderLeftColor.includes('accent')) {
                e.currentTarget.style.background = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
            }
        }}
        onMouseLeave={e => {
            if (e.currentTarget.getAttribute('aria-current') !== 'page') {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
            }
        }}
    >
        {({ isActive }) => (
            <>
                <item.icon size={14} style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0 }} />
                {item.label}
            </>
        )}
    </NavLink>
);

const ProfileBtn = ({ user, showUserMenu, onToggle }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button
            onClick={onToggle}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                width: '100%',
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px',
                background: hov ? 'var(--bg-hover)' : 'transparent',
                border: 'none', cursor: 'pointer',
                transition: 'background 150ms ease'
            }}
        >
            <div style={{
                width: '32px', height: '32px',
                background: 'var(--bg-active)',
                border: '1px solid var(--border-accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700, color: 'var(--accent)',
                flexShrink: 0
            }}>
                {user?.username?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div style={{ flex: 1, overflow: 'hidden', textAlign: 'left' }}>
                <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user?.username || 'Admin'}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--accent)', margin: 0, fontWeight: 700, letterSpacing: '0.04em' }}>Super Admin</p>
            </div>
            <ChevronUp size={14} style={{
                color: 'var(--text-muted)',
                transform: showUserMenu ? 'rotate(0deg)' : 'rotate(180deg)',
                transition: 'transform 150ms ease',
                flexShrink: 0
            }} />
        </button>
    );
};

const MenuHeader = ({ label }) => (
    <div style={{
        padding: '8px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-active)'
    }}>
        <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>
            {label}
        </p>
    </div>
);

const MenuActionBtn = ({ icon: Icon, label, onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                width: '100%', padding: '10px 16px',
                background: hov ? 'var(--bg-hover)' : 'transparent',
                border: 'none',
                color: hov ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '13px', fontWeight: 400,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
                textAlign: 'left',
                transition: 'background 150ms ease, color 150ms ease'
            }}
        >
            <Icon size={14} style={{ color: 'var(--text-muted)' }} />
            {label}
        </button>
    );
};

const LogoutBtnItem = ({ onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                width: '100%', padding: '10px 16px',
                background: hov ? 'var(--bg-hover)' : 'transparent',
                border: 'none',
                color: 'var(--state-danger)',
                fontSize: '13px', fontWeight: 500,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
                textAlign: 'left',
                transition: 'background 150ms ease'
            }}
        >
            <LogOut size={14} />
            Logout
        </button>
    );
};

export default ChttrixAdminDashboard;
