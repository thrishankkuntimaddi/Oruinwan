import React from 'react';
import { UserPlus, CheckCircle2 } from 'lucide-react';

const UnassignedEmployees = ({ data }) => {
    const unassigned = data?.unassigned || [];

    return (
        <section>
            <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.13em', textTransform: 'uppercase', margin: '0 0 4px' }}>
                    Unassigned Employees
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>Dept members needing workspace access</p>
            </div>

            <div style={{ border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                {unassigned.length === 0 ? (
                    <div style={{ padding: '48px 24px', textAlign: 'center', background: 'var(--bg-surface)' }}>
                        <CheckCircle2 size={28} style={{ color: 'var(--state-success)', margin: '0 auto 12px' }} />
                        <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>All Clear!</div>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>All department members are assigned to workspaces.</p>
                    </div>
                ) : (
                    <div>
                        <div style={{
                            padding: '10px 16px',
                            background: 'var(--bg-active)',
                            borderBottom: '1px solid var(--border-subtle)'
                        }}>
                            <p style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 500 }}>
                                ⚠ Found {unassigned.length} employees not assigned to your workspaces.
                            </p>
                        </div>
                        <div style={{
                            display: 'flex', flexDirection: 'column', gap: '1px',
                            background: 'var(--border-subtle)',
                            maxHeight: '300px', overflowY: 'auto'
                        }} className="custom-scrollbar">
                            {unassigned.map((user) => (
                                <UserRow key={user._id} user={user} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
};

const UserRow = ({ user }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <div
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                background: hov ? 'var(--bg-hover)' : 'var(--bg-surface)',
                padding: '14px 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'background 150ms ease'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                    width: '32px', height: '32px',
                    background: 'var(--bg-active)',
                    border: '1px solid var(--border-default)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)'
                }}>
                    {user.username?.[0]?.toUpperCase()}
                </div>
                <div>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{user.username}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>
                        {user.departments?.map(d => d.name).join(', ') || 'No Dept'}
                    </div>
                </div>
            </div>
            <AssignBtn />
        </div>
    );
};

const AssignBtn = () => {
    const [hov, setHov] = React.useState(false);
    return (
        <button
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px',
                background: hov ? 'var(--accent-hover)' : 'var(--accent)',
                border: 'none',
                color: 'var(--bg-base)',
                fontSize: '12px', fontWeight: 700,
                borderRadius: '2px', cursor: 'pointer',
                transition: 'background 150ms ease'
            }}
        >
            <UserPlus size={13} />
            Assign
        </button>
    );
};

export default UnassignedEmployees;
