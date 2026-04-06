import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Lock, Globe, ArrowRight } from 'lucide-react';

const S = {
    label: {
        fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)',
        letterSpacing: '0.13em', textTransform: 'uppercase', margin: '0 0 4px'
    },
    subtext: { fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }
};

const WorkspacesAccess = ({ data }) => {
    const navigate = useNavigate();
    const workspaces = data?.workspaces || [];

    return (
        <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                    <h3 style={S.label}>Workspaces Access</h3>
                    <p style={S.subtext}>Environment visibility & management</p>
                </div>
                <ManageBtn icon={ArrowRight} label="Manage" onClick={() => navigate('/admin/workspaces')} />
            </div>

            <div style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', overflow: 'hidden' }}>
                {workspaces.length === 0 ? (
                    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                        <Briefcase size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px', opacity: 0.5 }} />
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>No workspaces found</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-active)' }}>
                                    {['Workspace', 'Owners/Managers', 'Access', 'Activity', 'Members'].map((col, i) => (
                                        <th key={col} style={{
                                            padding: '10px 16px',
                                            fontSize: '11px', fontWeight: 700,
                                            letterSpacing: '0.12em', textTransform: 'uppercase',
                                            color: 'var(--text-muted)',
                                            textAlign: i === 4 ? 'right' : i === 3 ? 'center' : 'left'
                                        }}>{col}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {workspaces.slice(0, 5).map((ws) => (
                                    <WorkspaceRow key={ws._id} ws={ws} onClick={() => navigate('/admin/workspaces')} />
                                ))}
                            </tbody>
                        </table>
                        {workspaces.length > 5 && (
                            <div style={{
                                padding: '10px 16px',
                                borderTop: '1px solid var(--border-subtle)',
                                fontSize: '12px',
                                color: 'var(--text-muted)',
                                textAlign: 'center'
                            }}>
                                +{workspaces.length - 5} more workspaces
                            </div>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
};

const WorkspaceRow = ({ ws, onClick }) => {
    const [hov, setHov] = React.useState(false);

    const activityColor = ws.activity === 'high'
        ? 'var(--state-success)'
        : ws.activity === 'medium'
            ? 'var(--accent)'
            : 'var(--text-muted)';

    return (
        <tr
            onClick={onClick}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                borderBottom: '1px solid var(--border-subtle)',
                background: hov ? 'var(--bg-hover)' : 'transparent',
                cursor: 'pointer',
                transition: 'background 150ms ease'
            }}
        >
            <td style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    <Briefcase size={14} style={{ color: 'var(--text-muted)' }} />
                    {ws.name}
                </div>
                {ws.department && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', paddingLeft: '22px' }}>
                        {ws.department.name}
                    </div>
                )}
            </td>
            <td style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {ws.owners?.length > 0 && (
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Owner: </span>
                            {ws.owners[0].username}
                        </div>
                    )}
                    {ws.managers?.length > 0 && (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {ws.managers.length} Manager{ws.managers.length !== 1 ? 's' : ''}
                        </div>
                    )}
                </div>
            </td>
            <td style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {ws.settings?.isPrivate === false ? (
                        <><Globe size={13} style={{ color: 'var(--state-success)' }} /><span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Public</span></>
                    ) : (
                        <><Lock size={13} style={{ color: 'var(--text-muted)' }} /><span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Private</span></>
                    )}
                </div>
            </td>
            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                <span style={{
                    fontSize: '10px', fontWeight: 700,
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: activityColor,
                    padding: '2px 6px',
                    border: `1px solid ${activityColor}`,
                    opacity: 0.85
                }}>
                    {ws.activity}
                </span>
            </td>
            <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                {ws.memberCount}
            </td>
        </tr>
    );
};

const ManageBtn = ({ icon: Icon, label, onClick }) => {
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

export default WorkspacesAccess;
