import React from 'react';
import { Shield, FileText, Lock } from 'lucide-react';

const S = {
    label: {
        fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)',
        letterSpacing: '0.13em', textTransform: 'uppercase', margin: '0 0 4px'
    },
    subtext: { fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }
};

const AuditSecurity = ({ data }) => {
    const recentActions = data?.recentActions || [];
    const stats = {
        roleChanges: data?.roleChanges || 0,
        permissionChanges: data?.permissionChanges || 0
    };

    return (
        <section>
            <div style={{ marginBottom: '16px' }}>
                <h3 style={S.label}>Audit & Security</h3>
                <p style={S.subtext}>System governance logs</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1px', background: 'var(--border-subtle)' }}>
                {}
                <div style={{ background: 'var(--bg-surface)', padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                        <Shield size={14} style={{ color: 'var(--accent)' }} />
                        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Security Snapshot</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <ProgressStat label="Role Changes" value={stats.roleChanges} barColor="var(--accent)" />
                        <ProgressStat label="Permission Updates" value={stats.permissionChanges} barColor="var(--text-secondary)" />

                        <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                            <SecBtn icon={Lock} label="Security Settings" />
                        </div>
                    </div>
                </div>

                {}
                <div style={{ background: 'var(--bg-surface)', padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={14} style={{ color: 'var(--text-muted)' }} />
                            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Recent Audit Logs</span>
                        </div>
                        <ViewAllBtn label="View Full Log" />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {recentActions.length === 0 ? (
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No recent audit logs found.</p>
                        ) : (
                            recentActions.map((log, index) => (
                                <AuditEntry key={index} log={log} isLast={index === recentActions.length - 1} />
                            ))
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
};

const ProgressStat = ({ label, value, barColor }) => (
    <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{label}</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
        </div>
        <div style={{ width: '100%', height: '2px', background: 'var(--border-default)', overflow: 'hidden' }}>
            <div style={{ width: '25%', height: '100%', background: barColor, transition: 'width 260ms cubic-bezier(0.16,1,0.3,1)' }} />
        </div>
    </div>
);

const AuditEntry = ({ log, isLast }) => (
    <div style={{
        display: 'flex', gap: '12px',
        paddingBottom: isLast ? 0 : '16px',
        borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)'
    }}>
        <div style={{ marginTop: '6px', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--border-accent)', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {log.action?.replace(/_/g, ' ') || 'Unknown Action'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0, marginLeft: '8px' }}>
                    {new Date(log.timestamp).toLocaleDateString()}
                </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.5' }}>
                {log.description}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                <div style={{
                    width: '16px', height: '16px',
                    background: 'var(--bg-active)',
                    border: '1px solid var(--border-accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '9px', fontWeight: 700, color: 'var(--accent)'
                }}>
                    {log.actor?.[0]?.toUpperCase()}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>By {log.actor}</span>
            </div>
        </div>
    </div>
);

const SecBtn = ({ icon: Icon, label }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                width: '100%', padding: '8px 0',
                background: 'none',
                border: '1px solid var(--border-default)',
                color: hov ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: '13px', fontWeight: 500,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                borderRadius: '2px',
                transition: 'color 150ms ease, border-color 150ms ease'
            }}
        >
            <Icon size={13} />
            {label}
        </button>
    );
};

const ViewAllBtn = ({ label }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                background: 'none', border: 'none',
                fontSize: '12px', fontWeight: 500,
                color: hov ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'color 150ms ease'
            }}
        >
            {label}
        </button>
    );
};

export default AuditSecurity;
