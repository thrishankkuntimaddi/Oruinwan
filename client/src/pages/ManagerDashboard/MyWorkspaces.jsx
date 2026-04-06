import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase } from 'lucide-react';

const MyWorkspaces = ({ data }) => {
    const navigate = useNavigate();
    const workspaces = data?.workspaces || [];

    return (
        <section>
            <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.13em', textTransform: 'uppercase', margin: '0 0 4px' }}>
                    My Workspaces
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>Projects you manage</p>
            </div>

            {workspaces.length === 0 ? (
                <div style={{
                    padding: '48px 24px', textAlign: 'center',
                    background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)'
                }}>
                    <Briefcase size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>You don't manage any workspaces yet</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--border-subtle)' }}>
                    {workspaces.map((ws) => (
                        <WorkspaceRow key={ws._id} ws={ws} navigate={navigate} />
                    ))}
                </div>
            )}
        </section>
    );
};

const WorkspaceRow = ({ ws, navigate }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <div
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                background: hov ? 'var(--bg-hover)' : 'var(--bg-surface)',
                padding: '20px 24px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
                transition: 'background 150ms ease'
            }}
        >
            <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <Briefcase size={16} style={{ color: hov ? 'var(--accent)' : 'var(--text-muted)', transition: 'color 150ms ease' }} />
                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{ws.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '24px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{ws.memberCount} Members</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>·</span>
                    <span style={{
                        fontSize: '12px',
                        color: ws.status === 'active' ? 'var(--state-success)' : 'var(--text-muted)'
                    }}>
                        {ws.status === 'active' ? 'Active' : 'Archived'}
                    </span>
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                <StatCell label="Messages" value={ws.activity?.messages || 0} />
                <StatCell label="Open Tasks" value={ws.activity?.tasksActive || 0} />
                <StatCell label="Completed" value={ws.activity?.tasksCompleted || 0} />
                <ManageBtn onClick={() => navigate(`/workspace/${ws._id}/home`)} />
            </div>
        </div>
    );
};

const StatCell = ({ label, value }) => (
    <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em' }}>{value}</div>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '2px' }}>{label}</div>
    </div>
);

const ManageBtn = ({ onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                padding: '7px 16px',
                background: hov ? 'var(--bg-hover)' : 'var(--bg-active)',
                border: '1px solid var(--border-default)',
                color: hov ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '13px', fontWeight: 500,
                borderRadius: '2px', cursor: 'pointer',
                transition: 'color 150ms ease, background 150ms ease'
            }}
        >
            Manage
        </button>
    );
};

export default MyWorkspaces;
