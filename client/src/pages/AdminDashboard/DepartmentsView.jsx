import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building, Users } from 'lucide-react';

const S = {
    label: {
        fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)',
        letterSpacing: '0.13em', textTransform: 'uppercase', margin: '0 0 4px'
    },
    subtext: { fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }
};

const DepartmentsView = ({ data }) => {
    const navigate = useNavigate();
    const departments = data?.departments || [];

    return (
        <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                    <h3 style={S.label}>Departments</h3>
                    <p style={S.subtext}>Organizational structure & headcount</p>
                </div>
                <ManageBtn label="Manage Departments" onClick={() => navigate('/admin/departments')} />
            </div>

            {departments.length === 0 ? (
                <EmptyState icon={Building} message="No departments defined" />
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '1px',
                    background: 'var(--border-subtle)'
                }}>
                    {departments.map((dept) => (
                        <DeptCard key={dept._id} dept={dept} />
                    ))}
                </div>
            )}
        </section>
    );
};

const DeptCard = ({ dept }) => {
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
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                <Building size={16} style={{ color: 'var(--text-muted)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Users size={12} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>{dept.userCount}</span>
                </div>
            </div>

            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '16px' }}>
                {dept.name}
            </div>

            <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Managers
                </p>
                {dept.managers.length === 0 ? (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No managers assigned</span>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {dept.managers.map((manager, i) => (
                            <div
                                key={i}
                                title={manager.username}
                                style={{
                                    width: '22px', height: '22px',
                                    background: 'var(--bg-active)',
                                    border: '1px solid var(--border-accent)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '10px', fontWeight: 700,
                                    color: 'var(--accent)'
                                }}
                            >
                                {manager.username?.[0]?.toUpperCase()}
                            </div>
                        ))}
                        {dept.managers.length === 1 && (
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>
                                {dept.managers[0].username}
                            </span>
                        )}
                    </div>
                )}
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
                padding: '6px 12px',
                background: hov ? 'var(--bg-hover)' : 'var(--bg-active)',
                border: '1px solid var(--border-default)',
                color: hov ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '12px', fontWeight: 500,
                borderRadius: '2px', cursor: 'pointer',
                transition: 'color 150ms ease, background 150ms ease'
            }}
        >
            {label}
        </button>
    );
};

const EmptyState = ({ icon: Icon, message }) => (
    <div style={{
        padding: '48px 24px', textAlign: 'center',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)'
    }}>
        <Icon size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{message}</p>
    </div>
);

export default DepartmentsView;
