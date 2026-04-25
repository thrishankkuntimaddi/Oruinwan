import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Upload } from 'lucide-react';

const S = {
    section: {},
    sectionHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px'
    },
    label: {
        fontSize: '11px',
        fontWeight: 700,
        color: 'var(--text-muted)',
        letterSpacing: '0.13em',
        textTransform: 'uppercase',
        margin: '0 0 4px'
    },
    subtext: { fontSize: '13px', color: 'var(--text-secondary)', margin: 0 },
};

const ActionBtn = ({ icon: Icon, label, onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px',
                background: hov ? 'var(--bg-hover)' : 'var(--bg-active)',
                border: '1px solid var(--border-default)',
                color: hov ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '12px', fontWeight: 500,
                borderRadius: '2px', cursor: 'pointer',
                transition: 'color 150ms ease, background 150ms ease'
            }}
        >
            <Icon size={13} />
            {label}
        </button>
    );
};

const UsersAccess = ({ data }) => {
    const navigate = useNavigate();
    const stats = data?.stats || { total: 0, active: 0, pending: 0, suspended: 0, blocked: 0, guests: 0 };
    const recentInvites = data?.recentInvites || [];

    const statItems = [
        { label: 'Total Users', value: stats.total, color: 'var(--text-secondary)' },
        { label: 'Active', value: stats.active, color: 'var(--state-success)' },
        { label: 'Pending', value: stats.pending, color: 'var(--accent)' },
        { label: 'Guests', value: stats.guests, color: 'var(--text-secondary)' },
        { label: 'Suspended', value: stats.suspended, color: 'var(--state-danger)' },
        { label: 'Blocked', value: stats.blocked, color: 'var(--text-muted)' },
    ];

    return (
        <section>
            <div style={S.sectionHeader}>
                <div>
                    <h3 style={S.label}>Users & Access</h3>
                    <p style={S.subtext}>People management & roles</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <ActionBtn icon={UserPlus} label="Invite" onClick={() => navigate('/admin/people')} />
                    <ActionBtn icon={Upload} label="Import" onClick={() => navigate('/admin/onboard')} />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', background: 'var(--border-subtle)' }}>
                {}
                <div style={{
                    gridColumn: 'span 2',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '1px',
                    background: 'var(--border-subtle)'
                }}>
                    {statItems.map((item) => (
                        <StatCell key={item.label} label={item.label} value={item.value} color={item.color} />
                    ))}
                </div>

                {}
                <div style={{ background: 'var(--bg-surface)', padding: '20px' }}>
                    <h4 style={S.label}>Recent Invites</h4>
                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {recentInvites.length === 0 ? (
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No recent invites</p>
                        ) : (
                            recentInvites.slice(0, 4).map((invite, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                        <div style={{
                                            width: '24px', height: '24px',
                                            background: 'var(--bg-active)',
                                            border: '1px solid var(--border-default)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '11px', fontWeight: 700,
                                            color: 'var(--text-secondary)'
                                        }}>
                                            {invite.email?.[0]?.toUpperCase()}
                                        </div>
                                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {invite.email}
                                        </span>
                                    </div>
                                    <span style={{
                                        fontSize: '10px', fontWeight: 700,
                                        letterSpacing: '0.12em', textTransform: 'uppercase',
                                        color: 'var(--accent)',
                                        padding: '2px 6px',
                                        border: '1px solid var(--border-accent)'
                                    }}>
                                        Pending
                                    </span>
                                </div>
                            ))
                        )}
                        <ManageBtn label="Manage All Users →" onClick={() => navigate('/admin/people')} />
                    </div>
                </div>
            </div>
        </section>
    );
};

const StatCell = ({ label, value, color }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <div
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                background: hov ? 'var(--bg-hover)' : 'var(--bg-surface)',
                padding: '20px',
                transition: 'background 150ms ease'
            }}
        >
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color, marginBottom: '8px' }}>
                {label}
            </div>
            <div style={{ fontSize: '26px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                {value}
            </div>
        </div>
    );
};

const ManageBtn = ({ label, onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                width: '100%', marginTop: '4px',
                padding: '8px 0',
                background: 'none', border: 'none',
                color: hov ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: '13px', fontWeight: 500,
                cursor: 'pointer', textAlign: 'left',
                transition: 'color 150ms ease',
                borderTop: '1px solid var(--border-subtle)'
            }}
        >
            {label}
        </button>
    );
};

export default UsersAccess;
