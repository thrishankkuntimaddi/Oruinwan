import React from 'react';
import { Users, Briefcase, Building, TrendingUp } from 'lucide-react';

const OrganizationOverview = ({ data }) => {
    const stats = data || {
        totalUsers: 0,
        activeUsers: 0,
        workspaceCount: 0,
        departmentCount: 0,
        growthRate: { users: 0, workspaces: 0 }
    };

    const StatCard = ({ icon: Icon, value, label, trend, trendLabel }) => {
        const [hovered, setHovered] = React.useState(false);
        return (
            <div
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                    background: hovered ? 'var(--bg-hover)' : 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    padding: '20px',
                    transition: 'background 150ms ease'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <Icon size={16} style={{ color: 'var(--text-muted)' }} />
                    {trend !== undefined && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: 'var(--state-success)',
                            letterSpacing: '0.04em'
                        }}>
                            <TrendingUp size={10} />
                            +{trend}
                        </div>
                    )}
                </div>
                <div style={{
                    fontSize: '26px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.02em',
                    lineHeight: '1.2'
                }}>{value}</div>
                <div style={{
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    marginTop: '4px'
                }}>{label}</div>
                {trendLabel && (
                    <div style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        marginTop: '8px'
                    }}>{trendLabel}</div>
                )}
            </div>
        );
    };

    return (
        <section>
            <div style={{ marginBottom: '16px' }}>
                <h3 style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.13em',
                    textTransform: 'uppercase',
                    margin: '0 0 4px'
                }}>Organization Overview</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                    High-level growth & scale metrics
                </p>
            </div>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '1px',
                background: 'var(--border-subtle)'
            }}>
                <StatCard
                    icon={Users}
                    value={stats.totalUsers}
                    label="Total Employees"
                    trend={stats.growthRate?.users}
                    trendLabel="New in last 30 days"
                />
                <StatCard
                    icon={Users}
                    value={stats.activeUsers}
                    label="Active Users"
                    trendLabel="Currently active"
                />
                <StatCard
                    icon={Briefcase}
                    value={stats.workspaceCount}
                    label="Total Workspaces"
                    trend={stats.growthRate?.workspaces}
                    trendLabel="New in last 30 days"
                />
                <StatCard
                    icon={Building}
                    value={stats.departmentCount}
                    label="Departments"
                    trendLabel="Structural units"
                />
            </div>
        </section>
    );
};

export default OrganizationOverview;
