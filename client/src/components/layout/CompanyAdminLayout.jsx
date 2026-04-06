// CompanyAdminLayout — Monolith Flow Design System
import React from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from '../admin/AdminSidebar';
import OwnerSidebar from '../../pages/OwnerDashboard/OwnerSidebar';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';

const CompanyAdminLayout = () => {
    const { company } = useCompany();
    const { user } = useAuth();

    const isOwner = user?.companyRole === 'owner';
    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    return (
        <div style={{
            display: 'flex',
            height: '100vh',
            background: 'var(--bg-base)',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            overflow: 'hidden',
        }}>
            {isOwner ? <OwnerSidebar /> : <AdminSidebar />}

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', minWidth: 0 }}>
                {/* ── Top Context Header ── */}
                <header style={{
                    height: '56px',
                    background: 'var(--bg-surface)',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 24px',
                    flexShrink: 0,
                    zIndex: 10,
                }}>
                    {/* Left — Company Identity */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{
                            fontSize: '10px', fontWeight: 700,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase', letterSpacing: '0.1em', lineHeight: 1,
                        }}>
                            Company Workspace
                        </span>
                        <span style={{
                            fontSize: '18px', fontWeight: 700,
                            color: 'var(--text-primary)',
                            letterSpacing: '-0.02em', lineHeight: 1.2,
                        }}>
                            {company?.name || 'My Company'}
                        </span>
                    </div>

                    {/* Right — Date + Status */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                            {dateStr}
                        </span>
                        <span style={{
                            fontSize: '11px', fontWeight: 600,
                            color: 'var(--state-success)',
                            display: 'flex', alignItems: 'center', gap: '4px', lineHeight: 1,
                        }}>
                            <span style={{
                                display: 'inline-block', width: '6px', height: '6px',
                                borderRadius: '50%', background: 'var(--state-success)', flexShrink: 0,
                            }} />
                            System Online
                        </span>
                    </div>
                </header>

                {/* ── Main Content ── */}
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
