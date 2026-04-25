import React from 'react';
import { User, ArrowRight, Plus, Shield, Lock } from 'lucide-react';

const WorkspaceGrid = ({ workspaces, onWorkspaceClick, onCreateClick, getIconComponent, user }) => {
    const ownedWorkspacesCount = workspaces.filter(ws => ws.isOwner).length;
    const isLimitReached = user?.userType === 'personal' && ownedWorkspacesCount >= 3;
    const isCompanyMember = user?.companyRole === 'member' && user?.userType !== 'personal';
    const companyName = user?.companyName || 'your company';

    const cardBase = {
        display: 'flex', flexDirection: 'column', height: '200px',
        background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
        borderRadius: '2px', padding: '20px', textAlign: 'left',
        cursor: 'pointer', fontFamily: 'var(--font)',
        transition: 'background 150ms ease, border-color 150ms ease',
        overflow: 'hidden', position: 'relative',
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
            {workspaces.map((ws) => {
                const IconComponent = getIconComponent(ws.icon);
                return (
                    <button key={ws.id} onClick={() => onWorkspaceClick(ws.id)}
                        className="ws-card"
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'var(--bg-hover)';
                            e.currentTarget.style.outline = '1px solid var(--border-accent)';
                            const arrow = e.currentTarget.querySelector('.ws-arrow');
                            if (arrow) { arrow.style.opacity = '1'; arrow.style.transform = 'translateX(3px)'; }
                            const title = e.currentTarget.querySelector('.ws-name');
                            if (title) title.style.color = 'var(--text-primary)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'var(--bg-surface)';
                            e.currentTarget.style.outline = '1px solid var(--border-default)';
                            const arrow = e.currentTarget.querySelector('.ws-arrow');
                            if (arrow) { arrow.style.opacity = '0'; arrow.style.transform = 'translateX(0)'; }
                            const title = e.currentTarget.querySelector('.ws-name');
                            if (title) title.style.color = 'var(--text-secondary)';
                        }}
                        style={{ ...cardBase, border: 'none', outline: '1px solid var(--border-default)' }}
                    >
                        <div style={{ flex: 1 }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', marginBottom: '14px', backgroundColor: ws.color, flexShrink: 0 }}>
                                <IconComponent size={18} />
                            </div>

                            <h3 className="ws-name" style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'color 150ms ease', margin: '0 0 6px' }}>
                                {ws.name}
                            </h3>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <User size={11} />
                                    {ws.role === 'owner' ? 'Owner' : 'Member'}
                                </div>
                                <div style={{ width: '3px', height: '3px', background: 'var(--border-accent)', borderRadius: '50%' }} />
                                <div>{ws.members} member{ws.members !== 1 && 's'}</div>
                            </div>
                        </div>

                        <div className="ws-arrow" style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 500, color: 'var(--accent)', opacity: 0, transform: 'translateX(0)', transition: 'opacity 150ms ease, transform 150ms ease' }}>
                            Open Workspace <ArrowRight size={13} />
                        </div>
                    </button>
                );
            })}

            {}
            {isCompanyMember ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', border: '1px dashed var(--border-default)', borderRadius: '2px', background: 'var(--bg-surface)', cursor: 'not-allowed', userSelect: 'none', padding: '24px', textAlign: 'center' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-active)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px', border: '1px solid var(--border-default)' }}>
                        <Lock size={16} style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>Create Workspace</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '10px', display: 'block' }}>
                        Only admins &amp; owners can create workspaces in <span style={{ color: 'var(--text-secondary)' }}>{companyName}</span>.
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', border: '1px solid var(--border-default)', padding: '4px 10px', borderRadius: '2px' }}>
                        <Shield size={11} /> Contact your Admin or Owner
                    </span>
                </div>
            ) : (
                
                <button
                    onClick={() => { if (!isLimitReached) onCreateClick(); }}
                    disabled={isLimitReached}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', border: `1px dashed ${isLimitReached ? 'var(--border-subtle)' : 'var(--border-default)'}`, borderRadius: '2px', background: 'transparent', cursor: isLimitReached ? 'not-allowed' : 'pointer', opacity: isLimitReached ? 0.45 : 1, padding: '24px', textAlign: 'center', transition: 'background 150ms ease, border-color 150ms ease', fontFamily: 'var(--font)' }}
                    onMouseEnter={e => {
                        if (!isLimitReached) {
                            e.currentTarget.style.background = 'var(--bg-hover)';
                            e.currentTarget.style.borderColor = 'var(--accent)';
                            const icon = e.currentTarget.querySelector('.create-icon');
                            if (icon) icon.style.color = 'var(--accent)';
                            const label = e.currentTarget.querySelector('.create-label');
                            if (label) label.style.color = 'var(--text-primary)';
                        }
                    }}
                    onMouseLeave={e => {
                        if (!isLimitReached) {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.borderColor = 'var(--border-default)';
                            const icon = e.currentTarget.querySelector('.create-icon');
                            if (icon) icon.style.color = 'var(--text-muted)';
                            const label = e.currentTarget.querySelector('.create-label');
                            if (label) label.style.color = 'var(--text-secondary)';
                        }
                    }}
                >
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px', background: 'var(--bg-active)', border: '1px solid var(--border-default)' }}>
                        {isLimitReached
                            ? <Shield size={18} className="create-icon" style={{ color: 'var(--text-muted)', transition: 'color 150ms ease' }} />
                            : <Plus size={18} className="create-icon" style={{ color: 'var(--text-muted)', transition: 'color 150ms ease' }} />
                        }
                    </div>
                    <span className="create-label" style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', transition: 'color 150ms ease' }}>
                        {isLimitReached ? 'Plan Limit Reached' : 'Create New Workspace'}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>
                        {isLimitReached ? 'You have reached the limit of 3 workspaces on the personal plan.' : 'Start a new project or team'}
                    </span>
                </button>
            )}
        </div>
    );
};

export default WorkspaceGrid;
