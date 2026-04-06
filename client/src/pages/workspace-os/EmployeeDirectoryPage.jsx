// client/src/pages/workspace-os/EmployeeDirectoryPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '@services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Search, Users, ChevronLeft, ChevronRight, RefreshCw, Mail, Phone } from 'lucide-react';

const ROLE_META = {
    owner:   { label: 'Owner',   color: 'var(--accent)',       bg: 'rgba(184,149,106,0.1)',  border: 'var(--accent)' },
    admin:   { label: 'Admin',   color: 'var(--state-danger)', bg: 'rgba(224,82,82,0.1)',    border: 'var(--state-danger)' },
    manager: { label: 'Manager', color: '#9b8ecf',             bg: 'rgba(155,142,207,0.1)', border: '#9b8ecf' },
    member:  { label: 'Member',  color: 'var(--text-secondary)',bg: 'var(--bg-active)',       border: 'var(--border-accent)' },
    guest:   { label: 'Guest',   color: 'var(--text-muted)',   bg: 'var(--bg-active)',       border: 'var(--border-default)' },
};

function initials(name) { return (name || '?').slice(0, 2).toUpperCase(); }
function avatarBg(name) {
    const clrs = ['#b8956a','#5aba8a','#7a7a7a','#e05252','#9b8ecf'];
    return clrs[(name || '').charCodeAt(0) % clrs.length];
}

const inputBase = {
    background: 'var(--bg-input)', border: '1px solid var(--border-default)',
    color: 'var(--text-primary)', fontSize: '12px', outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif', padding: '7px 12px',
    transition: 'border-color 150ms ease',
};

export default function EmployeeDirectoryPage({ companyId: propCompanyId }) {
    const { user } = useAuth();
    const rawId = propCompanyId || user?.companyId;
    const companyId = typeof rawId === 'object' && rawId !== null ? (rawId._id || rawId.id || String(rawId)) : rawId;

    const [employees, setEmployees] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 1 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [dept, setDept] = useState('');
    const [role, setRole] = useState('');
    const [page, setPage] = useState(1);

    useEffect(() => {
        if (!companyId) return;
        api.get(`/api/departments?companyId=${companyId}`).then(r => setDepartments(r.data.departments || [])).catch(() => {});
    }, [companyId]);

    const load = useCallback(async () => {
        if (!companyId) return;
        setLoading(true); setError(null);
        try {
            const params = { page, limit: 25 };
            if (search.trim()) params.search = search.trim();
            if (dept) params.dept = dept;
            if (role) params.role = role;
            const res = await api.get(`/api/companies/${companyId}/employees`, { params });
            setEmployees(res.data.employees || []);
            setPagination(res.data.pagination || { page: 1, limit: 25, total: 0, pages: 1 });
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load employees');
        } finally { setLoading(false); }
    }, [companyId, page, search, dept, role]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { setPage(1); }, [search, dept, role]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Header */}
            <header style={{ height: '56px', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, zIndex: 5 }}>
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <Users size={16} style={{ color: 'var(--accent)' }} />
                        Employee Directory
                        {pagination.total > 0 && <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>({pagination.total})</span>}
                    </h2>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', marginLeft: '24px' }}>All company members with role and status</p>
                </div>
                <button onClick={load}
                    style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-active)', border: '1px solid var(--border-default)', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: '2px', transition: 'all 150ms ease' }}>
                    <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                </button>
            </header>

            {/* Content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '20px 28px' }} className="custom-scrollbar">

                {/* Filters */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '200px' }}>
                        <Search size={12} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        <input type="text" placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)}
                            style={{ ...inputBase, width: '100%', boxSizing: 'border-box', paddingLeft: '28px' }} />
                    </div>
                    <select value={dept} onChange={e => setDept(e.target.value)} style={{ ...inputBase, cursor: 'pointer' }}>
                        <option value="">All Departments</option>
                        {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                    </select>
                    <select value={role} onChange={e => setRole(e.target.value)} style={{ ...inputBase, cursor: 'pointer' }}>
                        <option value="">All Roles</option>
                        {Object.entries(ROLE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                </div>

                {error && <div style={{ padding: '10px 14px', background: 'rgba(224,82,82,0.08)', border: '1px solid var(--state-danger)', color: 'var(--state-danger)', fontSize: '12px', marginBottom: '12px' }}>{error}</div>}

                {/* Table */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', overflow: 'hidden', flex: 1, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-active)' }}>
                                {['Employee', 'Contact', 'Role', 'Department', 'Status'].map(h => (
                                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} style={{ padding: '48px', textAlign: 'center' }}>
                                    <RefreshCw size={20} style={{ color: 'var(--text-muted)', margin: '0 auto', animation: 'spin 1s linear infinite' }} />
                                </td></tr>
                            ) : employees.length === 0 ? (
                                <tr><td colSpan={5} style={{ padding: '48px', textAlign: 'center' }}>
                                    <Users size={28} style={{ color: 'var(--text-muted)', margin: '0 auto 8px', opacity: 0.4 }} />
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No employees found</p>
                                </td></tr>
                            ) : employees.map(emp => {
                                const fullName = [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.username;
                                const rm = ROLE_META[emp.companyRole] || ROLE_META.member;
                                return (
                                    <EmpRow key={emp._id} emp={emp} fullName={fullName} rm={rm} />
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Pagination */}
                    {pagination.pages > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {((page - 1) * pagination.limit) + 1}–{Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <PagBtn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} icon={<ChevronLeft size={13} />} />
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>{page} / {pagination.pages}</span>
                                <PagBtn onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page >= pagination.pages} icon={<ChevronRight size={13} />} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

const EmpRow = ({ emp, fullName, rm }) => {
    const [hov, setHov] = React.useState(false);
    const statusColor = emp.accountStatus === 'active' ? 'var(--state-success)' : emp.accountStatus === 'invited' ? 'var(--accent)' : 'var(--text-muted)';
    return (
        <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: hov ? 'var(--bg-hover)' : 'transparent', transition: 'background 150ms ease' }}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
            <td style={{ padding: '11px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                        {emp.profilePicture
                            ? <img src={emp.profilePicture} alt={fullName} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                            : <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: avatarBg(fullName), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials(fullName)}</div>}
                        <div style={{ position: 'absolute', bottom: '-1px', right: '-1px', width: '8px', height: '8px', borderRadius: '50%', background: emp.isOnline ? 'var(--state-success)' : 'var(--text-muted)', border: '1.5px solid var(--bg-surface)' }} />
                    </div>
                    <div>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1px' }}>{fullName}</p>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>@{emp.username}</p>
                    </div>
                </div>
            </td>
            <td style={{ padding: '11px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <Mail size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.email}</span>
                </div>
                {emp.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    <Phone size={10} style={{ flexShrink: 0 }} /> {emp.phone}
                </div>}
            </td>
            <td style={{ padding: '11px 16px' }}>
                <span style={{ display: 'inline-block', padding: '3px 8px', fontSize: '10px', fontWeight: 700, background: rm.bg, border: `1px solid ${rm.border}`, color: rm.color }}>{rm.label}</span>
            </td>
            <td style={{ padding: '11px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                {emp.departmentNames?.length > 0 ? emp.departmentNames.join(', ') : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Unassigned</span>}
            </td>
            <td style={{ padding: '11px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: statusColor, fontWeight: 500 }}>
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                    {emp.accountStatus || 'unknown'}
                </div>
            </td>
        </tr>
    );
};

const PagBtn = ({ onClick, disabled, icon }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} disabled={disabled} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: hov && !disabled ? 'var(--bg-hover)' : 'var(--bg-active)', border: '1px solid var(--border-default)', color: disabled ? 'var(--text-muted)' : 'var(--text-secondary)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1, transition: 'all 150ms ease', borderRadius: '2px' }}>
            {icon}
        </button>
    );
};
