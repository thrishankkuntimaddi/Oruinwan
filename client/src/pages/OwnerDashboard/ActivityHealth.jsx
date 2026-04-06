import React from 'react';
import { MessageSquare, Briefcase, Zap, Moon } from 'lucide-react';

const ActivityHealth = ({ data }) => {
    const stats = data || {
        messages: { last7days: 0, last30days: 0, trend: 'stable' },
        activeWorkspaces: 0,
        dormantWorkspaces: 0,
        engagementScore: 0
    };

    const MetricCard = ({ icon: Icon, title, children }) => (
        <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            padding: '20px',
            transition: 'background 150ms ease'
        }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-surface)'}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Icon size={14} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>{title}</span>
            </div>
            {children}
        </div>
    );

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
                }}>Activity & Health</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                    Platform engagement metrics
                </p>
            </div>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '1px',
                background: 'var(--border-subtle)'
            }}>
                {/* Engagement Score */}
                <MetricCard icon={Zap} title="Engagement Score">
                    <div style={{
                        fontSize: '26px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        letterSpacing: '-0.02em',
                        marginBottom: '12px'
                    }}>
                        {stats.engagementScore}%
                    </div>
                    <div style={{
                        width: '100%',
                        height: '2px',
                        background: 'var(--border-default)',
                        borderRadius: '1px',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            width: `${stats.engagementScore}%`,
                            height: '100%',
                            background: 'var(--accent)',
                            borderRadius: '1px',
                            transition: 'width 260ms cubic-bezier(0.16,1,0.3,1)'
                        }} />
                    </div>
                </MetricCard>

                {/* Message Volume */}
                <MetricCard icon={MessageSquare} title="Message Volume">
                    <div style={{
                        fontSize: '26px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        letterSpacing: '-0.02em',
                        marginBottom: '4px'
                    }}>
                        {stats.messages.last7days}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                        Last 7 days vs {Math.round(stats.messages.last30days / 4)} avg
                    </div>
                    <div style={{
                        fontSize: '11px',
                        fontWeight: 500,
                        color: stats.messages.trend === 'up' ? 'var(--state-success)' : 'var(--text-muted)'
                    }}>
                        {stats.messages.trend === 'up' ? '↗ Trending Up' : '— Stable'}
                    </div>
                </MetricCard>

                {/* Active Workspaces */}
                <MetricCard icon={Briefcase} title="Active Workspaces">
                    <div style={{
                        fontSize: '26px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        letterSpacing: '-0.02em',
                        marginBottom: '4px'
                    }}>
                        {stats.activeWorkspaces}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Workspaces with activity this week
                    </div>
                </MetricCard>

                {/* Dormant Workspaces */}
                <MetricCard icon={Moon} title="Dormant">
                    <div style={{
                        fontSize: '26px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        letterSpacing: '-0.02em',
                        marginBottom: '4px'
                    }}>
                        {stats.dormantWorkspaces}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        No activity &gt; 7 days
                    </div>
                </MetricCard>
            </div>
        </section>
    );
};

export default ActivityHealth;
