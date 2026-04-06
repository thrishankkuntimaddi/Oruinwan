import React, { useState, useEffect, useCallback } from 'react';
import api from '@services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Users, Plus, Edit2, Trash2, UserPlus, Search, ChevronDown, ChevronUp, X } from 'lucide-react';

const NODE_COLORS = ['#b8956a','#5aba8a','#9b8ecf','#e05252','#7a7a7a','#5ab8ba','#ba5a8a'];
function teamColor(idx) { return NODE_COLORS[idx % NODE_COLORS.length]; }

const inputStyle = {
    width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)',
    border: '1px solid var(--border-default)', color: 'var(--text-primary)',
    fontSize: '13px', padding: '9px 12px', outline: 'none', borderRadius: '0',
    fontFamily: 'Inter, system-ui, sans-serif', transition: 'border-color 150ms ease',
};
const labelStyle = { fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' };

// ── Team Card ─────────────────────────────────────────────────────────────────
function TeamCard({ team, idx, onEdit, onDelete, onManageMembers }) {
    const [expanded, setExpanded] = useState(false);
    const color = teamColor(idx);
    const [hov, setHov] = useState(false);
    return (
        <div style={{ background: hov ? 'var(--bg-hover)' : 'var(--bg-surface)', border: `1px solid var(--border-subtle)`, borderTop: `2px solid ${color}`, transition: 'background 150ms ease', overflow: 'hidden' }}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
            <div style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '3px' }}>{team.name}</h3>
                        {team.department && <span style={{ fontSize: '10px', color, border: `1px solid ${color}`, padding: '1px 7px', fontWeight: 600 }}>{team.department.name}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        <IconBtn icon={<Edit2 size={12} />} onClick={() => onEdit(team)} title="Edit" />
                        <IconBtn icon={<UserPlus size={12} />} onClick={() => onManageMembers(team)} title="Members" />
                        <IconBtn icon={<Trash2 size={12} />} onClick={() => onDelete(team._id, team.name)} title="Delete" danger />
                    </div>
                </div>
                {team.description && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '10px', lineHeight: '1.5' }}>{team.description}</p>}
                <div style={{ display: 'flex', gap: '14px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        <b style={{ color: 'var(--text-primary)' }}>{team.members?.length || 0}</b> member{team.members?.length !== 1 ? 's' : ''}
                    </span>
                    {team.lead && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Lead: <b style={{ color: 'var(--text-secondary)' }}>{team.lead.username}</b></span>}
                    {(team.members?.length > 0) && (
                        <button onClick={() => setExpanded(e => !e)}
                            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '3px', background: 'none', border: 'none', color: color, fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {expanded ? 'Hide' : 'Members'}
                        </button>
                    )}
                </div>
                {expanded && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {(team.members || []).map(m => (
                            <div key={m.user?._id || m._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: 'var(--bg-active)' }}>
                                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: 'var(--bg-base)', flexShrink: 0 }}>
                                    {(m.user?.username || '?').charAt(0).toUpperCase()}
                                </div>
                                <span style={{ fontSize: '12px', color: 'var(--text-primary)', flex: 1 }}>{m.user?.username || 'Unknown'}</span>
                                <span style={{ fontSize: '10px', color: m.role === 'lead' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 700 }}>{m.role}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Team Form Modal ───────────────────────────────────────────────────────────
function TeamFormModal({ initial, departments, employees, onSave, onClose, saving }) {
    const isEdit = !!initial?._id;
    const [form, setForm] = useState({
        name: initial?.name || '', description: initial?.description || '',
        departmentId: initial?.department?._id || initial?.department || '',
        leadId: initial?.lead?._id || initial?.lead || '',
    });
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{isEdit ? 'Edit Team' : 'Create Team'}</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}><X size={16} /></button>
                </div>
                <form onSubmit={e => { e.preventDefault(); onSave(form); }} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div><label style={labelStyle}>Team Name *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="Team name" /></div>
                    <div><label style={labelStyle}>Description</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, resize: 'vertical', minHeight: '72px' }} placeholder="Optional description" /></div>
                    <div><label style={labelStyle}>Department</label>
                        <select value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))} style={inputStyle}>
                            <option value="">No department</option>
                            {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                        </select>
                    </div>
                    <div><label style={labelStyle}>Team Lead</label>
                        <select value={form.leadId} onChange={e => setForm(f => ({ ...f, leadId: e.target.value }))} style={inputStyle}>
                            <option value="">No lead assigned</option>
                            {employees.map(emp => <option key={emp._id} value={emp._id}>{emp.username}{emp.email ? ` (${emp.email})` : ''}</option>)}
                        </select>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
                        <button type="button" onClick={onClose} style={{ padding: '8px 18px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', borderRadius: '2px' }}>Cancel</button>
                        <button type="submit" disabled={saving} style={{ padding: '8px 20px', background: saving ? 'var(--bg-active)' : 'var(--accent)', border: 'none', color: saving ? 'var(--text-muted)' : 'var(--bg-base)', fontSize: '12px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', borderRadius: '2px', transition: 'background 150ms ease' }}>
                            {saving ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save' : 'Create')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Members Modal ─────────────────────────────────────────────────────────────
function MembersModal({ team, employees, onClose, onSaved }) {
    const [members, setMembers] = useState(() => new Set((team.members || []).map(m => m.user?._id || m.user).filter(Boolean).map(String)));
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');

    const toggle = uid => setMembers(prev => { const n = new Set(prev); if (n.has(String(uid))) n.delete(String(uid)); else n.add(String(uid)); return n; });
    const filtered = employees.filter(e => !search || e.username.toLowerCase().includes(search.toLowerCase()) || e.email?.toLowerCase().includes(search.toLowerCase()));

    const handleSave = async () => {
        setSaving(true);
        try {
            const currentIds = new Set((team.members || []).map(m => String(m.user?._id || m.user)).filter(Boolean));
            const toAdd = [...members].filter(id => !currentIds.has(id));
            const toRemove = [...currentIds].filter(id => !members.has(id));
            if (toAdd.length > 0) await api.patch(`/api/teams/${team._id}/members`, { userIds: toAdd, action: 'add' });
            if (toRemove.length > 0) await api.patch(`/api/teams/${team._id}/members`, { userIds: toRemove, action: 'remove' });
            onSaved(); onClose();
        } catch (err) { alert(err.response?.data?.error || 'Failed to update members'); }
        finally { setSaving(false); }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', width: '100%', maxWidth: '500px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Manage Members</h2>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>{team.name} · <b style={{ color: 'var(--accent)' }}>{members.size}</b> selected</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', padding: '0 10px' }}>
                        <Search size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees…" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', padding: '8px 0', fontSize: '12px', color: 'var(--text-primary)', fontFamily: 'inherit' }} />
                    </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }} className="custom-scrollbar">
                    {filtered.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px', fontSize: '12px' }}>No employees found</p>}
                    {filtered.map(emp => {
                        const sel = members.has(String(emp._id));
                        return (
                            <div key={emp._id} onClick={() => toggle(emp._id)}
                                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', marginBottom: '3px', cursor: 'pointer', background: sel ? 'rgba(184,149,106,0.08)' : 'transparent', border: `1px solid ${sel ? 'var(--accent)' : 'transparent'}`, transition: 'all 150ms ease' }}>
                                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: sel ? 'var(--accent)' : 'var(--bg-active)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: sel ? 'var(--bg-base)' : 'var(--text-secondary)', flexShrink: 0 }}>
                                    {emp.username.charAt(0).toUpperCase()}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{emp.username}</p>
                                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.email}</p>
                                </div>
                                <div style={{ width: '18px', height: '18px', border: `1px solid ${sel ? 'var(--accent)' : 'var(--border-accent)'}`, background: sel ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: '2px' }}>
                                    {sel && <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--bg-base)', lineHeight: 1 }}>✓</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '8px 18px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', borderRadius: '2px' }}>Cancel</button>
                    <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', background: saving ? 'var(--bg-active)' : 'var(--accent)', border: 'none', color: saving ? 'var(--text-muted)' : 'var(--bg-base)', fontSize: '12px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', borderRadius: '2px', transition: 'background 150ms ease' }}>
                        {saving ? 'Saving…' : `Save (${members.size})`}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TeamsManagement() {
    const { user } = useAuth();
    const rawCompanyId = user?.companyId;
    const companyId = typeof rawCompanyId === 'object' && rawCompanyId !== null ? (rawCompanyId._id || rawCompanyId.id || String(rawCompanyId)) : rawCompanyId;

    const [teams, setTeams] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterDept, setFilterDept] = useState('');
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [editTeam, setEditTeam] = useState(null);
    const [membersTeam, setMembersTeam] = useState(null);
    const [saving, setSaving] = useState(false);

    const fetchTeams = useCallback(async () => {
        try {
            setLoading(true);
            const params = filterDept ? `?departmentId=${filterDept}` : '';
            const { data } = await api.get(`/api/teams${params}`);
            setTeams(data.teams || []);
        } catch (err) { setError(err.response?.data?.error || 'Failed to load teams'); }
        finally { setLoading(false); }
    }, [filterDept]);

    useEffect(() => { fetchTeams(); }, [fetchTeams]);

    useEffect(() => {
        api.get('/api/departments').then(r => setDepartments(r.data.departments || r.data || [])).catch(() => {});
        if (companyId) api.get(`/api/companies/${companyId}/employees?limit=200`).then(r => setEmployees(r.data.employees || [])).catch(() => {});
    }, [companyId]);

    const handleCreate = async (form) => {
        setSaving(true);
        try { await api.post('/api/teams', form); setShowCreate(false); fetchTeams(); }
        catch (err) { alert(err.response?.data?.error || 'Failed to create team'); }
        finally { setSaving(false); }
    };
    const handleEdit = async (form) => {
        setSaving(true);
        try { await api.patch(`/api/teams/${editTeam._id}`, form); setEditTeam(null); fetchTeams(); }
        catch (err) { alert(err.response?.data?.error || 'Failed to update team'); }
        finally { setSaving(false); }
    };
    const handleDelete = async (teamId, name) => {
        if (!window.confirm(`Delete team "${name}"? This cannot be undone.`)) return;
        try { await api.delete(`/api/teams/${teamId}`); fetchTeams(); }
        catch (err) { alert(err.response?.data?.error || 'Failed to delete team'); }
    };

    const filtered = teams.filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description?.toLowerCase().includes(search.toLowerCase()));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Header */}
            <header style={{ height: '56px', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, zIndex: 5 }}>
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <Users size={16} style={{ color: 'var(--accent)' }} />
                        Teams
                    </h2>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', marginLeft: '24px' }}>Sub-groups within departments for focused collaboration</p>
                </div>
                <CreateBtn onClick={() => setShowCreate(true)} />
            </header>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }} className="custom-scrollbar">
                {/* Filters */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '200px' }}>
                        <Search size={12} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search teams…"
                            style={{ ...inputStyle, paddingLeft: '28px' }} />
                    </div>
                    <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
                        style={{ ...inputStyle, width: 'auto', minWidth: '160px', cursor: 'pointer' }}>
                        <option value="">All Departments</option>
                        {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                    </select>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{filtered.length} team{filtered.length !== 1 ? 's' : ''}</span>
                </div>

                {error && <div style={{ padding: '10px 14px', background: 'rgba(224,82,82,0.08)', border: '1px solid var(--state-danger)', color: 'var(--state-danger)', fontSize: '12px', marginBottom: '12px' }}>{error}</div>}

                {loading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
                        {[1,2,3,4].map(i => (
                            <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderTop: '2px solid var(--border-accent)', padding: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                                    <div><div className="sk" style={{ height: '13px', width: '140px', marginBottom: '5px' }} /><div className="sk" style={{ height: '9px', width: '90px' }} /></div>
                                    <div style={{ display: 'flex', gap: '4px' }}><div className="sk" style={{ width: '22px', height: '22px' }} /><div className="sk" style={{ width: '22px', height: '22px' }} /></div>
                                </div>
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '14px' }}>
                                    {[1,2].map(j => <div key={j} className="sk" style={{ height: '18px', width: '70px' }} />)}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                                    <div style={{ display: 'flex' }}>{[1,2,3].map(j => <div key={j} className="sk" style={{ width: '26px', height: '26px', borderRadius: '50%', marginLeft: j > 1 ? '-6px' : 0 }} />)}</div>
                                    <div className="sk" style={{ height: '28px', width: '100px' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '64px' }}>
                        <Users size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 10px', opacity: 0.4 }} />
                        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>{teams.length === 0 ? 'No teams yet' : 'No teams match your search'}</p>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{teams.length === 0 ? 'Create a team to organize members within a department.' : 'Try a different search or department filter.'}</p>
                        {teams.length === 0 && <CreateBtn onClick={() => setShowCreate(true)} style={{ margin: '16px auto 0', display: 'inline-flex' }} />}
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
                        {filtered.map((team, i) => (
                            <TeamCard key={team._id} team={team} idx={i} onEdit={setEditTeam} onDelete={handleDelete} onManageMembers={setMembersTeam} />
                        ))}
                    </div>
                )}
            </div>

            {showCreate && <TeamFormModal departments={departments} employees={employees} onSave={handleCreate} onClose={() => setShowCreate(false)} saving={saving} />}
            {editTeam && <TeamFormModal initial={editTeam} departments={departments} employees={employees} onSave={handleEdit} onClose={() => setEditTeam(null)} saving={saving} />}
            {membersTeam && <MembersModal team={membersTeam} employees={employees} onClose={() => setMembersTeam(null)} onSaved={fetchTeams} />}
        </div>
    );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const IconBtn = ({ icon, onClick, title, danger }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} title={title} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: hov ? (danger ? 'rgba(224,82,82,0.1)' : 'var(--bg-active)') : 'none', border: 'none', color: hov ? (danger ? 'var(--state-danger)' : 'var(--text-primary)') : 'var(--text-muted)', cursor: 'pointer', borderRadius: '2px', transition: 'all 150ms ease' }}>
            {icon}
        </button>
    );
};

const CreateBtn = ({ onClick, style }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', background: hov ? 'var(--accent-hover)' : 'var(--accent)', border: 'none', color: 'var(--bg-base)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', borderRadius: '2px', transition: 'background 150ms ease', ...style }}>
            <Plus size={13} /> Create Team
        </button>
    );
};
