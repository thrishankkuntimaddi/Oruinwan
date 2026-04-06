import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { Menu, X, Shield } from 'lucide-react';
import ManagerSidebar from '../manager/ManagerSidebar';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';

const ManagerLayout = () => {
    const { company, isCompanyOwner, isCompanyAdmin } = useCompany();
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const showAdminButton = isCompanyOwner() || isCompanyAdmin();

    const isValidObjectId = (id) => /^[a-f\d]{24}$/i.test(String(id ?? ''));

    const selectedDept = (() => {
        const depts = company?.departments ?? [];
        const managed = depts.find(d => d.head?._id === user?._id || d.head === user?._id);
        const candidate = managed ?? depts[0] ?? null;
        return candidate && isValidObjectId(candidate._id) ? candidate : null;
    })();

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

    // Auto-close on navigation
    useEffect(() => {
        if (isMobile) setSidebarOpen(false);
    }, [location.pathname, isMobile]);

    const closeSidebar = useCallback(() => setSidebarOpen(false), []);

    return (
        <div style={{
            display: 'flex', height: '100vh', overflow: 'hidden',
            background: 'var(--bg-base)',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
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
            <div style={{
                ...(isMobile ? {
                    position: 'fixed', top: 0, left: 0, height: '100%', zIndex: 40,
                    transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
                    transition: 'transform 280ms cubic-bezier(0.16,1,0.3,1)',
                    boxShadow: sidebarOpen ? '4px 0 32px rgba(0,0,0,0.5)' : 'none',
                } : { flexShrink: 0 })
            }}>
                <ManagerSidebar onNavigate={closeSidebar} />
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', minWidth: 0 }}>
                {/* Top Context Bar */}
                <header style={{
                    height: '56px', flexShrink: 0,
                    padding: isMobile ? '0 16px' : '0 28px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'var(--bg-surface)',
                    borderBottom: '1px solid var(--border-subtle)',
                    zIndex: 10, gap: '12px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        {isMobile && (
                            <button
                                onClick={() => setSidebarOpen(o => !o)}
                                style={{
                                    padding: '6px', flexShrink: 0,
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--text-secondary)', borderRadius: '4px',
                                    display: 'flex', alignItems: 'center',
                                    transition: 'color 150ms ease',
                                }}
                                aria-label="Toggle sidebar"
                            >
                                {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                            </button>
                        )}
                        <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: '2px' }}>
                                Workspace Manager
                            </p>
                            <h1 style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {company?.displayName || company?.name || 'My Company'}
                            </h1>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {showAdminButton && !isMobile && (
                            <AdminConsoleBtn onClick={() => navigate('/admin/dashboard')} />
                        )}
                        {!isMobile && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                                {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                            </span>
                        )}
                    </div>
                </header>

                {/* Main Content */}
                <main style={{ flex: 1, overflow: 'hidden', background: 'var(--bg-base)', position: 'relative' }}>
                    <Outlet context={{ selectedDepartment: selectedDept }} />
                </main>
            </div>
        </div>
    );
};

const AdminConsoleBtn = ({ onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: hov ? 'rgba(184,149,106,0.15)' : 'var(--bg-active)', border: '1px solid var(--border-default)', color: hov ? 'var(--accent)' : 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', borderRadius: '2px', transition: 'all 150ms ease' }}>
            <Shield size={12} /> Admin Console
        </button>
    );
};

export default ManagerLayout;
