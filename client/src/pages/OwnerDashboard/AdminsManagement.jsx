import React, { useState, useEffect, useCallback } from 'react';
import { useCompany } from '../../contexts/CompanyContext';
import { useToast } from '../../contexts/ToastContext';
import { UserPlus, Shield, BarChart3, Crown, MoreVertical, Lock, FileText, Settings, UserMinus, MessageSquare, Search } from 'lucide-react';
import { getCompanyMembers } from '../../services/companyService';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const ROLE_COLORS = { owner: '#b8956a', admin: '#7a7a7a' };

const AdminsManagement = () => {
    const { company } = useCompany();
    const { showToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [admins, setAdmins] = useState([]);
    const [filteredAdmins, setFilteredAdmins] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showStats, setShowStats] = useState(false);
    const [actionMenuOpen, setActionMenuOpen] = useState(null);

    useEffect(() => {
        const h = () => setActionMenuOpen(null);
        window.addEventListener('click', h);
        return () => window.removeEventListener('click', h);
    }, []);

    const fetchAdmins = useCallback(async () => {
        if (!company?._id) { setLoading(false); return; }
        try {
            setLoading(true);
            const response = await getCompanyMembers(company._id);
            const adminUsers = (response.members || []).filter(m => m.companyRole === 'owner' || m.companyRole === 'admin');
            setAdmins(adminUsers);
            setFilteredAdmins(adminUsers);
        } catch {
            showToast('Failed to load administrators', 'error');
        } finally {
            setLoading(false);
        }
    }, [company?._id, showToast]);

    useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

    useEffect(() => {
        setFilteredAdmins(!searchQuery ? admins : admins.filter(a =>
            a.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.email?.toLowerCase().includes(searchQuery.toLowerCase())
        ));
    }, [admins, searchQuery]);

    const roleDistribution = [
        { name: 'Owner', value: admins.filter(a => a.companyRole === 'owner').length, color: ROLE_COLORS.owner },
        { name: 'Admin', value: admins.filter(a => a.companyRole === 'admin').length, color: ROLE_COLORS.admin },
    ];
    const onlineAdmins = filteredAdmins.filter(a => a.isOnline).length;

    const tooltipStyle = { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: '11px', borderRadius: '0' };

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <div style={{ height: '56px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div><div className="sk" style={{ height: '13px', width: '160px', marginBottom: '5px' }} /><div className="sk" style={{ height: '9px', width: '240px' }} /></div>
                <div className="sk" style={{ height: '30px', width: '110px' }} />
            </div>
            <div style={{ flex: 1, padding: '20px 28px' }}>
                {/* 3 stat tiles */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border-subtle)', marginBottom: '16px' }}>
                    {[1,2,3].map(i => (
                        <div key={i} style={{ background: 'var(--bg-surface)', padding: '18px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}><div className="sk" style={{ width: '14px', height: '14px' }} /><div className="sk" style={{ height: '9px', width: '80px' }} /></div>
                            <div className="sk" style={{ height: '28px', width: '50px' }} />
                        </div>
                    ))}
                </div>
                {/* Search + filter */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    <div className="sk" style={{ height: '32px', flex: 1 }} />
                    <div className="sk" style={{ height: '32px', width: '130px' }} />
                </div>
                {/* Table */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 80px', background: 'var(--bg-active)', borderBottom: '1px solid var(--border-subtle)', padding: '10px 16px', gap: '16px' }}>
                        {[70,60,55,55,0].map((w,i) => <div key={i} className="sk" style={{ height: '9px', width: `${w}px` }} />)}
                    </div>
                    {[1,2,3,4,5].map(i => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 80px', padding: '11px 16px', borderBottom: '1px solid var(--border-subtle)', gap: '16px', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div className="sk" style={{ width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0 }} />
                                <div><div className="sk" style={{ height: '11px', width: '110px', marginBottom: '4px' }} /><div className="sk" style={{ height: '9px', width: '140px' }} /></div>
                            </div>
                            <div className="sk" style={{ height: '18px', width: '55px' }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div className="sk" style={{ width: '6px', height: '6px', borderRadius: '50%' }} /><div className="sk" style={{ height: '9px', width: '40px' }} /></div>
                            <div className="sk" style={{ height: '9px', width: '80px' }} />
                            <div style={{ display: 'flex', gap: '4px' }}><div className="sk" style={{ height: '24px', width: '24px' }} /><div className="sk" style={{ height: '24px', width: '24px' }} /></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif' }}>

            {/* Header */}
            <header style={{
                height: '56px', padding: '0 28px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)',
                flexShrink: 0, zIndex: 5,
            }}>
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <Shield size={16} style={{ color: 'var(--accent)' }} />
                        Administrators
                    </h2>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', marginLeft: '24px' }}>
                        Owner &amp; Admin roles management
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <StatsBtn active={showStats} onClick={() => setShowStats(p => !p)} />
                    <InviteBtn />
                </div>
            </header>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }} className="custom-scrollbar">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '1280px', margin: '0 auto' }}>

                    {/* Stats panel */}
                    {showStats && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border-subtle)' }}>
                            {/* Total */}
                            <div style={{ background: 'var(--bg-surface)', padding: '20px' }}>
                                <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '8px' }}>Total Administrators</p>
                                <p style={{ fontSize: '36px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: '4px' }}>{filteredAdmins.length}</p>
                                <p style={{ fontSize: '12px', color: 'var(--state-success)' }}>{onlineAdmins} currently online</p>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Total in company: {admins.length}</p>
                            </div>

                            {/* Role Distribution */}
                            <div style={{ background: 'var(--bg-surface)', padding: '20px' }}>
                                <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '8px' }}>Role Distribution</p>
                                <ResponsiveContainer width="100%" height={90}>
                                    <PieChart>
                                        <Pie data={roleDistribution} cx="50%" cy="50%" innerRadius={25} outerRadius={40} paddingAngle={4} dataKey="value">
                                            {roleDistribution.map((e, i) => <Cell key={i} fill={e.color} />)}
                                        </Pie>
                                        <Tooltip contentStyle={tooltipStyle} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                                    {roleDistribution.map(r => (
                                        <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <div style={{ width: '8px', height: '8px', background: r.color, flexShrink: 0 }} />
                                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{r.name}</span>
                                            </div>
                                            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{r.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Admin Powers */}
                            <div style={{ background: 'var(--bg-surface)', padding: '20px', position: 'relative' }}>
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'var(--accent)' }} />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                    <Crown size={14} style={{ color: 'var(--accent)' }} />
                                    <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Admin Powers</p>
                                </div>
                                {['Full system access', 'User management', 'Department control', 'Workspace oversight'].map(p => (
                                    <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                        <div style={{ width: '4px', height: '4px', background: 'var(--accent)', borderRadius: '50%', flexShrink: 0 }} />
                                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{p}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Search */}
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: '10px', padding: '0 14px' }}>
                        <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <input
                            type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search administrators..."
                            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', padding: '10px 0', fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'inherit' }}
                        />
                    </div>

                    {/* Table */}
                    <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-active)' }}>
                                    {['Administrator', 'Role', 'Email', 'Status', 'Actions'].map(col => (
                                        <th key={col} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{col}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAdmins.map(admin => (
                                    <AdminRow
                                        key={admin._id}
                                        admin={admin}
                                        menuOpen={actionMenuOpen === admin._id}
                                        onMenuToggle={e => { e.stopPropagation(); setActionMenuOpen(actionMenuOpen === admin._id ? null : admin._id); }}
                                    />
                                ))}
                                {filteredAdmins.length === 0 && (
                                    <tr><td colSpan={5} style={{ padding: '48px', textAlign: 'center' }}>
                                        <Shield size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No administrators found</p>
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </section>
                </div>
            </div>
        </div>
    );
};

// ─ Sub-components ─────────────────────────────────────────────────────────────

const AdminRow = ({ admin, menuOpen, onMenuToggle }) => {
    const [hov, setHov] = React.useState(false);
    const isOwner = admin.companyRole === 'owner';
    return (
        <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: hov ? 'var(--bg-hover)' : 'transparent', transition: 'background 150ms ease' }}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
            <td style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', background: isOwner ? 'rgba(184,149,106,0.12)' : 'var(--bg-active)', border: `1px solid ${isOwner ? 'var(--accent)' : 'var(--border-accent)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: isOwner ? 'var(--accent)' : 'var(--text-secondary)', flexShrink: 0 }}>
                        {admin.username?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1px' }}>{admin.username}</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{admin.jobTitle || 'Administrator'}</p>
                    </div>
                </div>
            </td>
            <td style={{ padding: '12px 16px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', fontSize: '10px', fontWeight: 700, background: isOwner ? 'rgba(184,149,106,0.12)' : 'var(--bg-active)', border: `1px solid ${isOwner ? 'var(--accent)' : 'var(--border-accent)'}`, color: isOwner ? 'var(--accent)' : 'var(--text-secondary)' }}>
                    {isOwner ? <Crown size={9} /> : <Shield size={9} />}
                    {isOwner ? 'Owner' : 'Admin'}
                </span>
            </td>
            <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>{admin.email}</td>
            <td style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: admin.isOnline ? 'var(--state-success)' : 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', color: admin.isOnline ? 'var(--state-success)' : 'var(--text-muted)' }}>{admin.isOnline ? 'Online' : 'Offline'}</span>
                </div>
            </td>
            <td style={{ padding: '12px 16px', position: 'relative' }}>
                <button onClick={onMenuToggle}
                    style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: menuOpen ? 'var(--bg-active)' : 'none', border: menuOpen ? '1px solid var(--border-default)' : 'none', color: menuOpen ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', borderRadius: '2px', transition: 'all 150ms ease' }}>
                    <MoreVertical size={14} />
                </button>
                {menuOpen && (
                    <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', right: '8px', top: '100%', width: '180px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', zIndex: 50, padding: '4px' }}>
                        {[
                            { Icon: Lock, label: 'Manage Permissions', color: 'var(--text-secondary)' },
                            { Icon: FileText, label: 'View Activity Log', color: 'var(--text-secondary)' },
                            { Icon: Settings, label: 'Edit Role', color: 'var(--text-secondary)' },
                            { Icon: MessageSquare, label: 'Direct Message', color: 'var(--text-secondary)' },
                        ].map(({ Icon, label, color }) => (
                            <MenuBtn key={label} Icon={Icon} label={label} color={color} />
                        ))}
                        {!isOwner && (
                            <>
                                <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />
                                <MenuBtn Icon={UserMinus} label="Revoke Access" color="var(--state-danger)" />
                            </>
                        )}
                    </div>
                )}
            </td>
        </tr>
    );
};

const MenuBtn = ({ Icon, label, color }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: hov ? 'var(--bg-hover)' : 'none', border: 'none', cursor: 'pointer', color, fontSize: '12px', fontWeight: 500, textAlign: 'left', transition: 'background 150ms ease' }}>
            <Icon size={12} /> {label}
        </button>
    );
};

const StatsBtn = ({ active, onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? 'rgba(184,149,106,0.12)' : hov ? 'var(--bg-hover)' : 'var(--bg-active)', border: `1px solid ${active ? 'var(--accent)' : 'var(--border-default)'}`, color: active ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', borderRadius: '2px', transition: 'all 150ms ease' }}>
            <BarChart3 size={14} />
        </button>
    );
};

const InviteBtn = () => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: hov ? 'var(--accent-hover)' : 'var(--accent)', border: 'none', color: 'var(--bg-base)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', borderRadius: '2px', transition: 'background 150ms ease' }}>
            <UserPlus size={13} /> Invite Admin
        </button>
    );
};

export default AdminsManagement;
