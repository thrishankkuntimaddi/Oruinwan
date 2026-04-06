import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../contexts/CompanyContext';
import { useToast } from '../../contexts/ToastContext';
import { RefreshCw, Shield, LayoutGrid, UserPlus } from 'lucide-react';

import UsersAccess from './UsersAccess';
import DepartmentsView from './DepartmentsView';
import WorkspacesAccess from './WorkspacesAccess';
import AuditSecurity from './AuditSecurity';

import {
    getUsersAccess,
    getDepartmentsView,
    getWorkspacesAccess,
    getAuditSecurity
} from '../../services/adminDashboardService';

const AdminDashboard = () => {
    const { isCompanyAdmin } = useCompany();
    const { showToast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                if (user.companyRole === 'owner') {
                    navigate('/owner/dashboard', { replace: true });
                }
            } catch (e) {}
        }
    }, [navigate]);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [usersData, setUsersData] = useState(null);
    const [deptData, setDeptData] = useState(null);
    const [workspaceData, setWorkspaceData] = useState(null);
    const [auditData, setAuditData] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const [users, depts, workspaces, audit] = await Promise.all([
                getUsersAccess(),
                getDepartmentsView(),
                getWorkspacesAccess(),
                getAuditSecurity()
            ]);
            setUsersData(users);
            setDeptData(depts);
            setWorkspaceData(workspaces);
            setAuditData(audit);
        } catch (error) {
            console.error("Error fetching admin dashboard data:", error);
            showToast("Failed to load dashboard data", "error");
        }
    }, [showToast]);

    useEffect(() => {
        if (!isCompanyAdmin()) return;
        const loadInitialData = async () => {
            setLoading(true);
            await fetchData();
            setLoading(false);
        };
        loadInitialData();
    }, [isCompanyAdmin, fetchData]);

    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
        showToast("Dashboard refreshed", "success");
    };

    if (!isCompanyAdmin()) {
        return (
            <div style={{
                minHeight: '100vh',
                background: 'var(--bg-base)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 16px',
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <Shield size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
                    <h2 style={{
                        fontSize: '22px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        marginBottom: '8px',
                        letterSpacing: '-0.015em'
                    }}>Access Denied</h2>
                    <p style={{
                        fontSize: '14px',
                        color: 'var(--text-secondary)',
                        marginBottom: '24px',
                        lineHeight: '1.6'
                    }}>
                        You need admin privileges to access this page.
                    </p>
                    <button
                        onClick={() => navigate('/workspaces')}
                        style={{
                            padding: '8px 20px',
                            background: 'var(--bg-active)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-default)',
                            borderRadius: '2px',
                            fontSize: '14px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'background 150ms ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-active)'}
                    >
                        Go to Workspaces
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            background: 'var(--bg-base)',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
        }}>
            {/* Header */}
            <header style={{
                height: '64px',
                padding: '0 32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-surface)',
                borderBottom: '1px solid var(--border-subtle)',
                flexShrink: 0,
                zIndex: 10
            }}>
                <div>
                    <h2 style={{
                        fontSize: '18px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        letterSpacing: '-0.015em',
                        margin: 0
                    }}>
                        <Shield size={18} style={{ color: 'var(--accent)' }} />
                        Admin Console
                    </h2>
                    <p style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        marginTop: '2px',
                        marginLeft: '26px'
                    }}>
                        People, Structure & Compliance · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <HeaderBtn icon={UserPlus} label="Onboard Employee" onClick={() => navigate('/admin/onboard')} accent />
                    <HeaderBtn icon={LayoutGrid} label="Manager Console" onClick={() => navigate('/manager/dashboard')} />
                    <HeaderBtn
                        icon={RefreshCw}
                        label={refreshing ? 'Refreshing...' : 'Refresh'}
                        onClick={handleRefresh}
                        disabled={refreshing || loading}
                        spinning={refreshing}
                    />
                </div>
            </header>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }} className="custom-scrollbar">
                {loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
                        <div style={{
                            width: '24px',
                            height: '24px',
                            border: '2px solid var(--border-accent)',
                            borderTopColor: 'var(--accent)',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite'
                        }} />
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '1280px', margin: '0 auto' }}>
                        <UsersAccess data={usersData} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                            <DepartmentsView data={deptData} />
                            <WorkspacesAccess data={workspaceData} />
                        </div>
                        <AuditSecurity data={auditData} />
                    </div>
                )}
            </div>
        </div>
    );
};

const HeaderBtn = ({ icon: Icon, label, onClick, disabled, spinning, accent }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                padding: '7px 14px',
                background: accent
                    ? (hov ? 'var(--accent-hover)' : 'var(--accent)')
                    : (hov ? 'var(--bg-hover)' : 'var(--bg-active)'),
                border: accent ? 'none' : '1px solid var(--border-default)',
                color: accent ? 'var(--bg-base)' : (hov ? 'var(--text-primary)' : 'var(--text-secondary)'),
                fontSize: '13px',
                fontWeight: 500,
                borderRadius: '2px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: disabled ? 0.5 : 1,
                transition: 'color 150ms ease, background 150ms ease'
            }}
        >
            <Icon size={14} style={{ animation: spinning ? 'spin 1s linear infinite' : 'none' }} />
            {label}
        </button>
    );
};

export default AdminDashboard;
