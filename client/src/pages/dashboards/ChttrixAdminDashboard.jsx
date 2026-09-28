import React, { useCallback, useEffect, useRef, useState } from "react";
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation } from "react-router-dom";
import {
    LayoutDashboard, Building2, CheckSquare, MessageSquare, Megaphone, LifeBuoy,
    CreditCard, Activity, ClipboardList, UserRound, LogOut, Menu, X, Sun, Moon,
    ChevronsUpDown, Settings,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { Avatar } from "../../components/company-dash/DashShell";
import "../../styles/gloss.css";
import "../../components/company-dash/dash.css";
import "../admin/platform/platform.css";

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

const NAV = [
    { label: "Platform", items: [
        { path: "", label: "Overview", icon: LayoutDashboard },
        { path: "companies", label: "Companies", icon: Building2 },
        { path: "pending", label: "Pending requests", icon: CheckSquare },
    ] },
    { label: "Communication", items: [
        { path: "dm", label: "Direct messages", icon: MessageSquare },
        { path: "broadcast", label: "Broadcast", icon: Megaphone },
        { path: "tickets", label: "Support tickets", icon: LifeBuoy },
    ] },
    { label: "System", items: [
        { path: "billing", label: "Revenue & billing", icon: CreditCard },
        { path: "health", label: "System health", icon: Activity },
        { path: "logs", label: "Audit logs", icon: ClipboardList },
        { path: "settings", label: "My account", icon: UserRound },
    ] },
];

/**
 * Oruinwan staff console (/platform-admin/*). Same frame as the company
 * consoles (cd-shell): grouped sidebar, glass top bar, drawer below 900px.
 * Access is guarded by RequireChttrixAdmin in App.js.
 */
const ChttrixAdminDashboard = () => {
    const { user, logout } = useAuth();
    const { resolvedTheme, toggleTheme } = useTheme() || {};
    const navigate = useNavigate();
    const location = useLocation();
    const [open, setOpen] = useState(false);
    const [menu, setMenu] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => { setOpen(false); setMenu(false); }, [location.pathname]);
    useEffect(() => {
        if (!open && !menu) return undefined;
        const onKey = (e) => { if (e.key === "Escape") { setOpen(false); setMenu(false); } };
        const onDown = (e) => { if (menu && menuRef.current && !menuRef.current.contains(e.target)) setMenu(false); };
        document.addEventListener("keydown", onKey);
        document.addEventListener("mousedown", onDown);
        return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
    }, [open, menu]);

    const signOut = useCallback(async () => { await logout?.(); navigate("/login"); }, [logout, navigate]);
    const current = NAV.flatMap((g) => g.items).find((it) => {
        const p = location.pathname.replace(/^\/platform-admin\/?/, "");
        return it.path === "" ? p === "" : p === it.path || p.startsWith(`${it.path}/`);
    });
    const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

    return (
        <div className="cd-shell" data-nav-open={open ? "true" : undefined} data-console="platform">
            {open && <div className="cd-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
            <aside className="cd-side" aria-label="Platform console navigation">
                <div className="cd-side-brand">
                    <img src="/icons/oruinwan-128.png" alt="" />
                    <div style={{ minWidth: 0 }}>
                        <div className="cd-side-brand-name">Oruinwan</div>
                        <div className="cd-side-brand-role">Platform console</div>
                    </div>
                    <button type="button" className="gl-icon-btn cd-side-close" aria-label="Close navigation" onClick={() => setOpen(false)}>
                        <X size={16} />
                    </button>
                </div>
                <nav className="cd-side-nav">
                    {NAV.map((g) => (
                        <div className="cd-nav-group" key={g.label}>
                            <div className="gl-section-label">{g.label}</div>
                            {g.items.map((it) => (
                                <NavLink
                                    key={it.path}
                                    to={`/platform-admin${it.path ? `/${it.path}` : ""}`}
                                    end={it.path === ""}
                                    className={({ isActive }) => `gl-item cd-nav-item${isActive ? " is-active" : ""}`}
                                >
                                    <it.icon size={15} />
                                    <span>{it.label}</span>
                                </NavLink>
                            ))}
                        </div>
                    ))}
                </nav>
                <div className="cd-side-foot" ref={menuRef}>
                    {menu && (
                        <div className="cd-menu" role="menu">
                            <button type="button" role="menuitem" onClick={() => navigate("/platform-admin/settings")}>
                                <UserRound size={14} /> My account
                            </button>
                            <button type="button" role="menuitem" onClick={() => navigate("/settings")}>
                                <Settings size={14} /> Account settings
                            </button>
                            <button type="button" role="menuitem" data-tone="danger" onClick={signOut}>
                                <LogOut size={14} /> Sign out
                            </button>
                        </div>
                    )}
                    <button type="button" className="cd-me" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
                        <Avatar user={user} />
                        <span className="cd-me-text">
                            <span className="cd-me-name">{user?.profile?.name || user?.username || user?.email}</span>
                            <span className="cd-me-role">Platform staff</span>
                        </span>
                        <ChevronsUpDown size={14} className="cd-muted" />
                    </button>
                </div>
            </aside>

            <div className="cd-main">
                <header className="cd-top gl-glass-bar">
                    <button type="button" className="gl-icon-btn cd-top-menu" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(true)}>
                        <Menu size={18} />
                    </button>
                    <div className="cd-top-titles">
                        <span className="cd-top-kicker">Platform console</span>
                        <span className="cd-top-title">{current?.label || "Oruinwan"}</span>
                    </div>
                    <div className="cd-top-actions">
                        <span className="cd-top-date">{today}</span>
                        {toggleTheme && (
                            <button
                                type="button"
                                className="gl-icon-btn"
                                aria-label={resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                                title={resolvedTheme === "dark" ? "Light theme" : "Dark theme"}
                                onClick={() => toggleTheme()}
                            >
                                {resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                            </button>
                        )}
                    </div>
                </header>
                <main className="cd-content">
                    <Routes>
                        <Route index element={<Overview />} />
                        <Route path="pending" element={<PendingRequests />} />
                        <Route path="companies" element={<ActiveCompanies />} />
                        <Route path="tickets" element={<div className="pf-legacy"><SupportTickets /></div>} />
                        <Route path="broadcast" element={<Broadcast />} />
                        <Route path="dm" element={<PlatformChat />} />
                        <Route path="dm/user/:userId" element={<PlatformChat />} />
                        <Route path="billing" element={<Billing />} />
                        <Route path="health" element={<SystemHealth />} />
                        <Route path="settings" element={<AdminSettings />} />
                        <Route path="logs" element={<AuditLogs />} />
                        <Route path="*" element={<Navigate to="/platform-admin" replace />} />
                    </Routes>
                </main>
            </div>
        </div>
    );
};

export default ChttrixAdminDashboard;
