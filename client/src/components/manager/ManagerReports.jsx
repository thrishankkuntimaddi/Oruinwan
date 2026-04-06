// ManagerReports — Monolith Flow Design System (Limited Visibility)
import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Users, Building, Shield, Eye, EyeOff, AlertCircle } from 'lucide-react';
import api from '@services/api';

const LABEL_ST = { fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' };

export default function ManagerReports() {
    const { selectedDepartment } = useOutletContext();
    const [info, setInfo] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!selectedDepartment?._id) return;
        setLoading(true);
        api.get(`/api/manager/dashboard/metrics/${selectedDepartment._id}`)
            .then(r => setInfo(r.data))
            .catch(() => setInfo({
                department: { name: selectedDepartment?.name || 'Department', description: '', head: null },
                team: { total: 0, active: 0, pending: 0, managers: 0 }
            }))
            .finally(() => setLoading(false));
    }, [selectedDepartment]);

    // ── Loading skeleton ──────────────────────────────────────────
    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <div style={{ height: '56px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', padding: '0 28px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <div><div className="sk" style={{ height: '13px', width: '150px', marginBottom: '5px' }} /><div className="sk" style={{ height: '9px', width: '250px' }} /></div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
                <div style={{ maxWidth: '760px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Permission notice */}
                    <div style={{ display: 'flex', gap: '10px', padding: '14px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                        <div className="sk" style={{ width: '14px', height: '14px', flexShrink: 0, marginTop: '1px' }} />
                        <div style={{ flex: 1 }}><div className="sk" style={{ height: '11px', width: '160px', marginBottom: '6px' }} /><div className="sk" style={{ height: '9px', width: '100%', marginBottom: '3px' }} /><div className="sk" style={{ height: '9px', width: '80%' }} /></div>
                    </div>
                    {/* 2-col cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {[1,2].map(i => (
                            <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderTop: '2px solid var(--border-accent)', padding: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px' }}><div className="sk" style={{ width: '13px', height: '13px' }} /><div className="sk" style={{ height: '9px', width: '120px' }} /></div>
                                {[1,2,3,4].map(j => (
                                    <div key={j} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'var(--bg-active)', marginBottom: '6px' }}>
                                        <div className="sk" style={{ width: '12px', height: '12px', flexShrink: 0 }} />
                                        <div className="sk" style={{ height: '9px', flex: 1 }} />
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                    {/* Dept info */}
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '20px' }}>
                        <div className="sk" style={{ height: '9px', width: '180px', marginBottom: '16px' }} />
                        <div className="sk" style={{ height: '24px', width: '200px', marginBottom: '14px' }} />
                        <div className="sk" style={{ height: '9px', width: '300px', marginBottom: '16px' }} />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border-subtle)', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
                            {[1,2,3,4].map(i => (
                                <div key={i} style={{ background: 'var(--bg-surface)', padding: '12px 14px', textAlign: 'center' }}>
                                    <div className="sk" style={{ height: '9px', width: '50px', margin: '0 auto 6px' }} />
                                    <div className="sk" style={{ height: '24px', width: '40px', margin: '0 auto' }} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const d = info || { department: { name: '—', head: null }, team: { total: 0, active: 0, pending: 0, managers: 0 } };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Header */}
            <header style={{ height: '56px', padding: '0 28px', display: 'flex', alignItems: 'center', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <Eye size={16} style={{ color: 'var(--accent)' }} /> Limited Visibility
                    </h2>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', marginLeft: '24px' }}>Basic department information · View-only access</p>
                </div>
            </header>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }} className="custom-scrollbar">
                <div style={{ maxWidth: '760px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Permission notice */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '14px 16px', background: 'rgba(184,149,106,0.05)', border: '1px solid rgba(184,149,106,0.25)' }}>
                        <AlertCircle size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '1px' }} />
                        <div>
                            <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)', marginBottom: '3px' }}>Manager Permissions</p>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                                As a manager, you have limited visibility into department settings. Contact an admin or owner for billing, security settings, or organizational changes.
                            </p>
                        </div>
                    </div>

                    {/* Can / Cannot see */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <VisCard icon={Eye} color="var(--state-success)" title="What You Can See" items={[
                            { Icon: Building, label: 'Department name and description' },
                            { Icon: Users,    label: 'Department team members' },
                            { Icon: Shield,   label: 'Your managed workspaces' },
                            { Icon: Eye,      label: 'Basic team metrics' },
                        ]} />
                        <VisCard icon={EyeOff} color="var(--state-danger)" title="What You Cannot Change" items={[
                            { Icon: EyeOff, label: 'Department structure' },
                            { Icon: EyeOff, label: 'Billing & subscriptions' },
                            { Icon: EyeOff, label: 'Security settings' },
                            { Icon: EyeOff, label: 'Admin configurations' },
                        ]} />
                    </div>

                    {/* Dept Info - Read only */}
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '20px' }}>
                        <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '16px' }}>Department Information (Read-Only)</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <span style={LABEL_ST}>Department Name</span>
                                <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{d.department?.name}</p>
                            </div>
                            {d.department?.description && (
                                <div><span style={LABEL_ST}>Description</span>
                                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{d.department.description}</p>
                                </div>
                            )}
                            {d.department?.head && (
                                <div><span style={LABEL_ST}>Department Head</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)' }}>
                                        <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(184,149,106,0.1)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--accent)' }}>
                                            {d.department.head.username?.charAt(0)?.toUpperCase()}
                                        </div>
                                        <div>
                                            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{d.department.head.username}</p>
                                            <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{d.department.head.email}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border-subtle)', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
                                {[
                                    { label: 'Total', val: d.team?.total || 0, color: 'var(--text-primary)' },
                                    { label: 'Active', val: d.team?.active || 0, color: 'var(--state-success)' },
                                    { label: 'Pending', val: d.team?.pending || 0, color: 'var(--accent)' },
                                    { label: 'Managers', val: d.team?.managers || 0, color: '#9b8ecf' },
                                ].map(s => (
                                    <div key={s.label} style={{ background: 'var(--bg-surface)', padding: '12px 14px', textAlign: 'center' }}>
                                        <span style={LABEL_ST}>{s.label}</span>
                                        <p style={{ fontSize: '24px', fontWeight: 700, color: s.color }}>{s.val}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Contact CTA */}
                    <div style={{ padding: '20px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Need More Access?</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: '1.6' }}>Contact your admin or owner to request additional permissions or changes to department settings.</p>
                        <button style={{ padding: '8px 20px', background: 'var(--accent)', border: 'none', color: 'var(--bg-base)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Contact Admin</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

const VisCard = ({ icon: Icon, color, title, items }) => (
    <div style={{ background: 'var(--bg-surface)', border: 'var(--border-subtle) solid 1px', padding: '16px', borderTop: `2px solid ${color}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px' }}>
            <Icon size={13} style={{ color }} />
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items.map(({ Icon: I, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'var(--bg-active)', border: `1px solid ${color}22` }}>
                    <I size={12} style={{ color, flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{label}</span>
                </div>
            ))}
        </div>
    </div>
);
