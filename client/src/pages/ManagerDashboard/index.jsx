import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../contexts/CompanyContext';
import { useToast } from '../../contexts/ToastContext';
import { RefreshCw, LayoutGrid, Shield } from 'lucide-react';

import MyWorkspaces from './MyWorkspaces';
import TeamLoad from './TeamLoad';
import UnassignedEmployees from './UnassignedEmployees';

import {
    getMyWorkspaces,
    getTeamLoad,
    getUnassignedEmployees
} from '../../services/managerDashboardService';

const ManagerDashboard = () => {
    const { userCompanyRole, isCompanyOwner } = useCompany();
    const isManagerOrAbove = ['owner', 'admin', 'manager'].includes(userCompanyRole) || isCompanyOwner();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [workspacesData, setWorkspacesData] = useState(null);
    const [teamLoadData, setTeamLoadData] = useState(null);
    const [unassignedData, setUnassignedData] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const [wsData, teamData, unassigned] = await Promise.all([
                getMyWorkspaces(),
                getTeamLoad(),
                getUnassignedEmployees()
            ]);
            setWorkspacesData(wsData);
            setTeamLoadData(teamData);
            setUnassignedData(unassigned);
        } catch (error) {
            console.error("Error fetching manager dashboard data:", error);
            if (error.response?.status !== 404) {
                showToast("Failed to load dashboard data", "error");
            }
        }
    }, [showToast]);

    useEffect(() => {
        if (!isManagerOrAbove) return;
        const loadInitialData = async () => {
            setLoading(true);
            await fetchData();
            setLoading(false);
        };
        loadInitialData();
    }, [isManagerOrAbove, fetchData]);

    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
        showToast("Dashboard refreshed", "success");
    };

    if (!isManagerOrAbove) {
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
                    <LayoutGrid size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
                    <h2 style={{
                        fontSize: '22px', fontWeight: 600,
                        color: 'var(--text-primary)', marginBottom: '8px',
                        letterSpacing: '-0.015em'
                    }}>Access Denied</h2>
                    <p style={{
                        fontSize: '14px', color: 'var(--text-secondary)',
                        marginBottom: '24px', lineHeight: '1.6'
                    }}>
                        You need manager privileges to access this page.
                    </p>
                    <button
                        onClick={() => navigate('/workspaces')}
                        style={{
                            padding: '8px 20px',
                            background: 'var(--bg-active)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-default)',
                            borderRadius: '2px',
                            fontSize: '14px', fontWeight: 500,
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
            display: 'flex', flexDirection: 'column', height: '100vh',
            background: 'var(--bg-base)',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
        }}>
            {/* Header */}
            <header style={{
                height: '64px', padding: '0 32px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--bg-surface)',
                borderBottom: '1px solid var(--border-subtle)',
                flexShrink: 0, zIndex: 10
            }}>
                <div>
                    <h2 style={{
                        fontSize: '18px', fontWeight: 600,
                        color: 'var(--text-primary)',
                        display: 'flex', alignItems: 'center', gap: '8px',
                        letterSpacing: '-0.015em', margin: 0
                    }}>
                        <LayoutGrid size={18} style={{ color: 'var(--accent)' }} />
                        Manager Console
                    </h2>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', marginLeft: '26px' }}>
                        Delivery & Team Allocation · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {['owner', 'admin'].includes(userCompanyRole) && (
                        <HeaderBtn icon={Shield} label="Admin Console" onClick={() => navigate('/admin/dashboard')} />
                    )}
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
                            width: '24px', height: '24px',
                            border: '2px solid var(--border-accent)',
                            borderTopColor: 'var(--accent)',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite'
                        }} />
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '1280px', margin: '0 auto' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                            <UnassignedEmployees data={unassignedData} />
                            <TeamLoad data={teamLoadData} />
                        </div>
                        <MyWorkspaces data={workspacesData} />
                    </div>
                )}
            </div>
        </div>
    );
};

const HeaderBtn = ({ icon: Icon, label, onClick, disabled, spinning }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                padding: '7px 14px',
                background: hov ? 'var(--bg-hover)' : 'var(--bg-active)',
                border: '1px solid var(--border-default)',
                color: hov ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '13px', fontWeight: 500,
                borderRadius: '2px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
                opacity: disabled ? 0.5 : 1,
                transition: 'color 150ms ease, background 150ms ease'
            }}
        >
            <Icon size={14} style={{ animation: spinning ? 'spin 1s linear infinite' : 'none' }} />
            {label}
        </button>
    );
};

export default ManagerDashboard;
