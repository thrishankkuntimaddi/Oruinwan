import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import AdminSidebar from '../admin/AdminSidebar';
import OwnerSidebar from '../../pages/OwnerDashboard/OwnerSidebar';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';

const CompanyAdminLayout = () => {
    const { company } = useCompany();
    const { user } = useAuth();
    const location = useLocation();

    const isOwner = user?.companyRole === 'owner';
    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

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

    return (
        <div style={{
            display: 'flex',
            height: '100vh',
            background: 'var(--bg-base)',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            overflow: 'hidden',
            position: 'relative',
        }}>
            <style>{`
                @keyframes sidebarSlideIn {
                    from { transform: translateX(-100%); }
                    to   { transform: translateX(0); }
                }
                @keyframes sidebarSlideOut {
                    from { transform: translateX(0); }
                    to   { transform: translateX(-100%); }
                }
            `}</style>

            {}
            {isMobile && sidebarOpen && (
                <div
                    onClick={closeSidebar}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 35,
                        background: 'rgba(0,0,0,0.65)',
                        backdropFilter: 'blur(2px)',
                        animation: 'fadeIn 200ms ease',
                    }}
                />
            )}

            {}
            <div style={{
                
                ...(isMobile ? {
                    position: 'fixed', top: 0, left: 0, height: '100%', zIndex: 40,
                    transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
                    transition: 'transform 280ms cubic-bezier(0.16,1,0.3,1)',
                    boxShadow: sidebarOpen ? '4px 0 32px rgba(0,0,0,0.5)' : 'none',
                } : {
                    
                    flexShrink: 0,
                })
            }}>
                {isOwner
                    ? <OwnerSidebar onNavigate={closeSidebar} />
                    : <AdminSidebar onNavigate={closeSidebar} />
                }
            </div>

            {}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', minWidth: 0 }}>

                {}
                <header style={{
                    height: '56px',
                    background: 'var(--bg-surface)',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: isMobile ? '0 16px' : '0 24px',
                    flexShrink: 0,
                    zIndex: 10,
                    gap: '12px',
                }}>
                    {}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        {isMobile && (
                            <button
                                onClick={() => setSidebarOpen(o => !o)}
                                style={{
                                    padding: '6px', flexShrink: 0,
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--text-secondary)',
                                    borderRadius: '4px',
                                    display: 'flex', alignItems: 'center',
                                    transition: 'color 150ms ease',
                                }}
                                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                                aria-label="Toggle sidebar"
                            >
                                {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                            </button>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                            <span style={{
                                fontSize: '10px', fontWeight: 700,
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase', letterSpacing: '0.1em', lineHeight: 1,
                            }}>
                                Company Workspace
                            </span>
                            <span style={{
                                fontSize: isMobile ? '15px' : '18px', fontWeight: 700,
                                color: 'var(--text-primary)',
                                letterSpacing: '-0.02em', lineHeight: 1.2,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                                {company?.name || 'My Company'}
                            </span>
                        </div>
                    </div>

                    {}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0 }}>
                        {!isMobile && (
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                                {dateStr}
                            </span>
                        )}
                        <span style={{
                            fontSize: '11px', fontWeight: 600,
                            color: 'var(--state-success)',
                            display: 'flex', alignItems: 'center', gap: '4px', lineHeight: 1,
                        }}>
                            <span style={{
                                display: 'inline-block', width: '6px', height: '6px',
                                borderRadius: '50%', background: 'var(--state-success)', flexShrink: 0,
                            }} />
                            {isMobile ? 'Online' : 'System Online'}
                        </span>
                    </div>
                </header>

                {}
                <main style={{
                    flex: 1, overflow: 'hidden',
                    background: 'var(--bg-base)',
                    position: 'relative',
                    display: 'flex', flexDirection: 'column',
                }}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default CompanyAdminLayout;
