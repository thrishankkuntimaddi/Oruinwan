import React from 'react';
import { Users, AlertCircle } from 'lucide-react';

const TeamLoad = ({ data }) => {
    const getLoadStatus = (workload) => {
        switch (workload) {
            case 'high': return { color: 'var(--state-danger)', label: 'High Load' };
            case 'low': return { color: 'var(--state-success)', label: 'Available' };
            default: return { color: 'var(--accent)', label: 'Optimal' };
        }
    };

    const members = data?.teamMembers || [];
    const overloaded = data?.overloaded || [];

    return (
        <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                    <h3 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.13em', textTransform: 'uppercase', margin: '0 0 4px' }}>
                        Team Load
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>Resource allocation & capacity</p>
                </div>
                {overloaded.length > 0 && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '4px 10px',
                        border: '1px solid var(--state-danger)',
                        background: 'var(--bg-surface)'
                    }}>
                        <AlertCircle size={13} style={{ color: 'var(--state-danger)' }} />
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--state-danger)' }}>
                            {overloaded.length} Overloaded
                        </span>
                    </div>
                )}
            </div>

            <div style={{ border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                {members.length === 0 ? (
                    <div style={{ padding: '48px 24px', textAlign: 'center', background: 'var(--bg-surface)' }}>
                        <Users size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px', opacity: 0.5 }} />
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>No team members found</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--border-subtle)' }}>
                        {members.map((member) => (
                            <MemberRow key={member._id} member={member} getLoadStatus={getLoadStatus} />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
};

const MemberRow = ({ member, getLoadStatus }) => {
    const status = getLoadStatus(member.workload);
    const [hov, setHov] = React.useState(false);

    return (
        <div
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                background: hov ? 'var(--bg-hover)' : 'var(--bg-surface)',
                padding: '16px 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'background 150ms ease'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                    width: '36px', height: '36px',
                    background: 'var(--bg-active)',
                    border: '1px solid var(--border-accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: 700, color: 'var(--accent)'
                }}>
                    {member.username?.[0]?.toUpperCase()}
                </div>
                <div>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{member.username}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        In {member.workspaces?.length || 0} workspaces
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{member.activeTasks}</div>
                    <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Tasks</div>
                </div>
                <span style={{
                    fontSize: '10px', fontWeight: 700,
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: status.color,
                    padding: '3px 8px',
                    border: `1px solid ${status.color}`
                }}>
                    {status.label}
                </span>
            </div>
        </div>
    );
};

export default TeamLoad;
