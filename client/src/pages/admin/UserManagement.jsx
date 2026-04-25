import React, { useState, useEffect } from 'react';
import { Search, Mail, BarChart2, Briefcase } from 'lucide-react';
import { useCompany } from '../../contexts/CompanyContext';
import { getCompanyMembers } from '../../services/companyService';
import { getDepartments, assignUserToDepartment } from '../../services/departmentService';
import { workspaceService } from '../../services/workspaceService';
import { InviteUserModal } from '../../components/company';
import EmployeeActionsMenu from '../../components/company/EmployeeActionsMenu';
import { useToast } from '../../contexts/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const COLORS = ['#b8956a', '#c9a87c', '#5aba8a', '#e05252', '#7a7a7a', '#383838'];

const inputSt = {
    background: 'var(--bg-input)', border: '1px solid var(--border-default)',
    color: 'var(--text-primary)', fontSize: '12px', outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif', padding: '7px 10px',
};

const roleBg = { owner: '#b8956a', admin: 'var(--accent)', manager: 'var(--text-secondary)', member: 'var(--text-muted)', guest: 'var(--border-accent)' };

const UserManagement = () => {
    const { company } = useCompany();
    const { showToast } = useToast();
    const { canInviteUsers, canSuspendUsers, companyRole } = usePermissions();
    const [allMembers, setAllMembers] = useState([]);
    const [filteredMembers, setFilteredMembers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [workspaces, setWorkspaces] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showStats, setShowStats] = useState(false);
    const [tab, setTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [deptFilter, setDeptFilter] = useState('all');
    const [roleFilter] = useState('all');
    const [workspaceFilter, setWorkspaceFilter] = useState('all');
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [isBulkDeptOpen, setIsBulkDeptOpen] = useState(false);
    const [selectedBulkDept, setSelectedBulkDept] = useState('');
    const [bulkProcessing, setBulkProcessing] = useState(false);

    const fetchData = React.useCallback(async () => {
        if (!company?._id) { setLoading(false); return; }
        try {
            setLoading(true);
            const [membersRes, deptsRes, workspacesRes] = await Promise.all([
                getCompanyMembers(company._id), getDepartments(company._id), workspaceService.getWorkspaces(company._id)
            ]);
            setAllMembers(membersRes.members || []);
            setDepartments(deptsRes.departments || []);
            setWorkspaces(Array.isArray(workspacesRes.data?.workspaces) ? workspacesRes.data.workspaces : []);
        } catch { showToast('Failed to load users', 'error'); } finally { setLoading(false); }
    }, [company?._id, showToast]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        let result = allMembers;
        if (tab === 'admins') result = result.filter(m => ['owner', 'admin'].includes(m.companyRole));
        else if (tab === 'managers') result = result.filter(m => m.companyRole === 'manager');
        else if (tab === 'members') result = result.filter(m => m.companyRole === 'member');
        else if (tab === 'guests') result = result.filter(m => m.companyRole === 'guest');
        if (searchQuery) { const q = searchQuery.toLowerCase(); result = result.filter(m => m.username?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q) || m.jobTitle?.toLowerCase().includes(q)); }
        if (deptFilter !== 'all') result = result.filter(m => m.departments?.some(d => d._id === deptFilter || d === deptFilter));
        if (workspaceFilter !== 'all') result = result.filter(m => m.workspaces?.some(ws => ws.workspace?._id === workspaceFilter || ws.workspace === workspaceFilter));
        if (roleFilter !== 'all') result = result.filter(m => m.companyRole === roleFilter);
        setFilteredMembers(result);
    }, [allMembers, tab, searchQuery, deptFilter, roleFilter, workspaceFilter]);

    const handleSelectAll = (e) => setSelectedUsers(e.target.checked ? filteredMembers.map(m => m._id) : []);
    const handleSelectUser = (id) => setSelectedUsers(selectedUsers.includes(id) ? selectedUsers.filter(u => u !== id) : [...selectedUsers, id]);

    const handleBulkAssign = async () => {
        if (!selectedBulkDept) return;
        try {
            setBulkProcessing(true);
            await Promise.all(selectedUsers.map(uid => assignUserToDepartment(uid, selectedBulkDept)));
            showToast(`Assigned ${selectedUsers.length} users to department`, 'success');
            setIsBulkDeptOpen(false); setSelectedUsers([]); fetchData();
        } catch { showToast('Failed to assign users', 'error'); } finally { setBulkProcessing(false); }
    };

    const roleStats = React.useMemo(() => {
        const stats = {};
        filteredMembers.forEach(m => { const r = m.companyRole || 'Unknown'; stats[r] = (stats[r] || 0) + 1; });
        return Object.keys(stats).map(k => ({ name: k.charAt(0).toUpperCase() + k.slice(1), value: stats[k] }));
    }, [filteredMembers]);

    const chartStats = React.useMemo(() => {
        const stats = {};
        const isDept = deptFilter !== 'all';
        filteredMembers.forEach(m => {
            if (isDept) {
                m.workspaces?.length > 0 ? m.workspaces.forEach(w => { const n = w.workspace?.name || 'Unknown'; stats[n] = (stats[n] || 0) + 1; }) : (stats['No Workspace'] = (stats['No Workspace'] || 0) + 1);
            } else {
                m.departments?.length > 0 ? m.departments.forEach(d => { stats[d.name || 'Unknown'] = (stats[d.name || 'Unknown'] || 0) + 1; }) : (stats['No Dept'] = (stats['No Dept'] || 0) + 1);
            }
        });
        return { title: isDept ? 'Workspace Distribution' : 'Department Breakdown', data: Object.keys(stats).map(k => ({ name: k, value: stats[k] })).sort((a, b) => b.value - a.value).slice(0, 5) };
    }, [filteredMembers, deptFilter]);

    return (
        <React.Fragment>
            <header style={{ height: '56px', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', flexShrink: 0 }}>
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1px' }}>People</h2>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Team & Access</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={() => setShowStats(!showStats)} title={showStats ? 'Hide Statistics' : 'Show Statistics'}
                        style={{ padding: '7px', background: showStats ? 'var(--bg-active)' : 'none', border: showStats ? '1px solid var(--border-accent)' : '1px solid transparent', color: showStats ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', borderRadius: '2px', transition: 'all 150ms ease' }}>
                        <BarChart2 size={16} />
                    </button>
                    {canInviteUsers && (
                        <ActionBtn onClick={() => setIsInviteModalOpen(true)} icon={Mail} label="Invite People" />
                    )}
                </div>
            </header>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', background: 'var(--bg-base)' }} className="custom-scrollbar">
                {}
                {showStats && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
                        {}
                        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '16px' }}>
                            <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '6px' }}>Filtered Users</p>
                            <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '4px' }}>{filteredMembers.length}</div>
                            <div style={{ fontSize: '11px', color: 'var(--state-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--state-success)' }} />
                                {filteredMembers.filter(m => m.isOnline).length} online
                            </div>
                            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                                    <span>Total in Company:</span><span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{allMembers.length}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                                    <span>Selected:</span><span style={{ fontWeight: 600, color: selectedUsers.length > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>{selectedUsers.length}</span>
                                </div>
                            </div>
                        </div>
                        {}
                        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '16px' }}>
                            <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '6px' }}>Role Distribution</p>
                            <div style={{ height: '100px', display: 'flex', alignItems: 'center' }}>
                                <ResponsiveContainer width="40%" height="100%">
                                    <PieChart>
                                        <Pie data={roleStats} cx="50%" cy="50%" innerRadius={22} outerRadius={40} paddingAngle={4} dataKey="value" stroke="none">
                                            {roleStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid #222222', borderRadius: '2px', color: 'var(--text-primary)', fontSize: '11px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                    {roleStats.map((e, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                                                <span style={{ color: 'var(--text-secondary)' }}>{e.name}</span>
                                            </div>
                                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{e.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        {}
                        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '16px', position: 'relative' }}>
                            <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {deptFilter !== 'all' && <Briefcase size={10} />}{chartStats.title}
                            </p>
                            <div style={{ height: '100px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartStats.data} layout="vertical" margin={{ left: 0, right: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#222222" />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={70} tick={{ fontSize: 10, fill: '#7a7a7a' }} interval={0} />
                                        <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid #222222', borderRadius: '2px', color: 'var(--text-primary)', fontSize: '11px' }} />
                                        <Bar dataKey="value" fill="#b8956a" radius={[0, 2, 2, 0]} barSize={10}>
                                            {chartStats.data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}

                {}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '2px' }}>
                        {['all', 'admins', 'managers', 'members', 'guests'].map(t => (
                            <button key={t} onClick={() => setTab(t)}
                                style={{ padding: '5px 12px', fontSize: '12px', fontWeight: tab === t ? 600 : 400, background: tab === t ? 'var(--bg-active)' : 'none', border: tab === t ? '1px solid var(--border-accent)' : '1px solid transparent', color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 150ms ease' }}>
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {selectedUsers.length > 0 && canSuspendUsers && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)' }}>{selectedUsers.length} selected</span>
                                <button onClick={() => setIsBulkDeptOpen(true)} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--bg-base)', background: 'var(--accent)', border: 'none', padding: '2px 8px', cursor: 'pointer', borderRadius: '2px' }}>Assign Dept</button>
                            </div>
                        )}
                        <div style={{ position: 'relative' }}>
                            <Search size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                            <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                style={{ ...inputSt, paddingLeft: '26px', width: '180px' }} />
                        </div>
                        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={inputSt}>
                            <option value="all">All Departments</option>
                            {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                        </select>
                        <select value={workspaceFilter} onChange={e => setWorkspaceFilter(e.target.value)} style={inputSt}>
                            <option value="all">All Workspaces</option>
                            {workspaces.map(ws => <option key={ws._id} value={ws._id}>{ws.name}</option>)}
                        </select>
                    </div>
                </div>

                {}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-active)', borderBottom: '1px solid var(--border-subtle)' }}>
                                <th style={{ padding: '10px 14px', width: '40px', textAlign: 'center' }}>
                                    <input type="checkbox" onChange={handleSelectAll} checked={filteredMembers.length > 0 && selectedUsers.length === filteredMembers.length} style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
                                </th>
                                {['User', 'Role', 'Departments', 'Status', 'Actions'].map((h, i) => (
                                    <th key={h} style={{ padding: '10px 14px', textAlign: i === 4 ? 'right' : 'left', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <>
                                    {[1,2,3,4,5].map(i => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                            <td style={{ padding: '10px 14px', textAlign: 'center' }}><div className="sk" style={{ width: '14px', height: '14px', margin: '0 auto' }} /></td>
                                            <td style={{ padding: '10px 14px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div className="sk" style={{ width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0 }} />
                                                    <div>
                                                        <div className="sk" style={{ height: '11px', width: '110px', marginBottom: '3px' }} />
                                                        <div className="sk" style={{ height: '9px', width: '80px', marginBottom: '2px' }} />
                                                        <div className="sk" style={{ height: '9px', width: '140px' }} />
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '10px 14px' }}><div className="sk" style={{ height: '18px', width: '60px' }} /></td>
                                            <td style={{ padding: '10px 14px' }}><div style={{ display: 'flex', gap: '4px' }}><div className="sk" style={{ height: '18px', width: '70px' }} /><div className="sk" style={{ height: '18px', width: '60px' }} /></div></td>
                                            <td style={{ padding: '10px 14px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div className="sk" style={{ width: '6px', height: '6px', borderRadius: '50%' }} /><div className="sk" style={{ height: '9px', width: '45px' }} /></div></td>
                                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                                    <div className="sk" style={{ height: '26px', width: '26px' }} />
                                                    <div className="sk" style={{ height: '26px', width: '26px' }} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </>
                            ) : filteredMembers.length === 0 ? (
                                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '32px', fontSize: '13px', color: 'var(--text-muted)' }}>No members found</td></tr>
                            ) : filteredMembers.map(m => (
                                <tr key={m._id} style={{ borderBottom: '1px solid var(--border-subtle)', background: selectedUsers.includes(m._id) ? 'var(--bg-hover)' : 'transparent', transition: 'background 150ms ease' }}
                                    onMouseEnter={e => { if (!selectedUsers.includes(m._id)) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                    onMouseLeave={e => { if (!selectedUsers.includes(m._id)) e.currentTarget.style.background = 'transparent'; }}>
                                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                        <input type="checkbox" checked={selectedUsers.includes(m._id)} onChange={() => handleSelectUser(m._id)} style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
                                    </td>
                                    <td style={{ padding: '10px 14px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            {m.profilePicture ? (
                                                <img src={m.profilePicture} alt="" style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }} />
                                            ) : (
                                                <div style={{ width: '30px', height: '30px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                                                    {m.username?.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div>
                                                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{m.username}</div>
                                                {m.jobTitle && <div style={{ fontSize: '11px', color: 'var(--accent)' }}>{m.jobTitle}</div>}
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.companyEmail || m.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '10px 14px' }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', fontSize: '10px', fontWeight: 700, textTransform: 'capitalize', border: `1px solid ${roleBg[m.companyRole] || 'var(--border-default)'}`, color: roleBg[m.companyRole] || 'var(--text-muted)' }}>
                                            {m.companyRole}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px 14px' }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                            {m.departments?.length > 0 ? m.departments.map((d, i) => (
                                                <span key={i} style={{ fontSize: '10px', fontWeight: 500, padding: '1px 6px', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>{d.name || 'Unknown'}</span>
                                            )) : <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>}
                                        </div>
                                    </td>
                                    <td style={{ padding: '10px 14px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: m.isOnline ? 'var(--state-success)' : 'var(--border-accent)' }} />
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>{m.isOnline ? 'Online' : 'Offline'}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                        {canSuspendUsers && <EmployeeActionsMenu employee={m} departments={departments} onUpdate={fetchData} viewerRole={companyRole} />}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <InviteUserModal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} companyId={company?._id} />

            {isBulkDeptOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', width: '100%', maxWidth: '360px', padding: '24px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>Assign Department</h3>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Add {selectedUsers.length} selected users to:</p>
                        <select value={selectedBulkDept} onChange={e => setSelectedBulkDept(e.target.value)} style={{ ...inputSt, width: '100%', marginBottom: '16px', boxSizing: 'border-box' }}>
                            <option value="">Select Department...</option>
                            {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                        </select>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button onClick={() => setIsBulkDeptOpen(false)} style={{ padding: '8px 14px', background: 'none', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', borderRadius: '2px' }}>Cancel</button>
                            <button onClick={handleBulkAssign} disabled={!selectedBulkDept || bulkProcessing} style={{ padding: '8px 14px', background: 'var(--accent)', border: 'none', color: 'var(--bg-base)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', borderRadius: '2px', opacity: (!selectedBulkDept || bulkProcessing) ? 0.5 : 1 }}>
                                {bulkProcessing ? 'Assigning...' : 'Confirm Assignment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </React.Fragment>
    );
};

const ActionBtn = ({ onClick, icon: Icon, label }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', background: hov ? 'var(--accent-hover)' : 'var(--accent)', border: 'none', color: 'var(--bg-base)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', borderRadius: '2px', transition: 'background 150ms ease' }}>
            <Icon size={13} /> {label}
        </button>
    );
};

export default UserManagement;
