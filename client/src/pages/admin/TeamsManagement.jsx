import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const TEAM_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981',
  '#3b82f6','#ef4444','#14b8a6','#f97316','#64748b'
];

function Avatar({ name, src, size = 32 }) {
  const colors = ['#6366f1','#10b981','#3b82f6','#8b5cf6','#f59e0b','#ec4899'];
  const initial = (name || '?').charAt(0).toUpperCase();
  const bg = colors[(name || '').charCodeAt(0) % colors.length];
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: size * 0.4, flexShrink: 0 }}>
      {initial}
    </div>
  );
}

function Badge({ children, color = '#6366f1' }) {
  return (
    <span style={{ fontSize: 11, background: `${color}18`, color, padding: '2px 8px', borderRadius: 20, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

// ── Team Card ────────────────────────────────────────────────────────────────
function TeamCard({ team, onEdit, onDelete, onManageMembers }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      id={`team-card-${team._id}`}
      style={{ background: '#fff', borderRadius: 18, border: '1.5px solid #f1f5f9', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', transition: 'box-shadow 0.2s, transform 0.2s' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 8px 28px ${team.color || '#6366f1'}22`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {/* Color strip */}
      <div style={{ height: 5, background: team.color || '#6366f1' }} />
      <div style={{ padding: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: `${team.color || '#6366f1'}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
              {team.icon || '👥'}
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{team.name}</h3>
              {team.department && <Badge color="#6b7280">{team.department.name}</Badge>}
            </div>
          </div>
          {/* Actions */}
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button
              id={`edit-team-${team._id}`}
              onClick={() => onEdit(team)}
              title="Edit team"
              style={{ padding: '6px 8px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6b7280', cursor: 'pointer', fontSize: 13, lineHeight: 1, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f0f9ff'; e.currentTarget.style.color = '#3b82f6'; e.currentTarget.style.borderColor = '#3b82f6'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
            >✏️</button>
            <button
              id={`members-team-${team._id}`}
              onClick={() => onManageMembers(team)}
              title="Manage members"
              style={{ padding: '6px 8px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6b7280', cursor: 'pointer', fontSize: 13, lineHeight: 1, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.color = '#10b981'; e.currentTarget.style.borderColor = '#10b981'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
            >👤</button>
            <button
              id={`delete-team-${team._id}`}
              onClick={() => onDelete(team._id, team.name)}
              title="Delete team"
              style={{ padding: '6px 8px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6b7280', cursor: 'pointer', fontSize: 13, lineHeight: 1, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef4444'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
            >🗑</button>
          </div>
        </div>

        {team.description && (
          <p style={{ margin: '12px 0 0', fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{team.description}</p>
        )}

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 16, marginTop: 16, paddingTop: 14, borderTop: '1px solid #f1f5f9', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            <strong style={{ color: '#374151' }}>{team.members?.length || 0}</strong> member{team.members?.length !== 1 ? 's' : ''}
          </span>
          {team.lead && (
            <span style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Avatar name={team.lead.username} src={team.lead.profilePicture} size={18} />
              Lead: <strong style={{ color: '#374151' }}>{team.lead.username}</strong>
            </span>
          )}
          {(team.members?.length > 0) && (
            <button
              onClick={() => setExpanded(e => !e)}
              style={{ marginLeft: 'auto', fontSize: 12, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: '2px 6px', borderRadius: 6 }}
            >
              {expanded ? '▲ Hide' : '▼ Show members'}
            </button>
          )}
        </div>

        {/* Expanded member list */}
        {expanded && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(team.members || []).map(m => (
              <div key={m.user?._id || m._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#f8fafc', borderRadius: 10 }}>
                <Avatar name={m.user?.username} src={m.user?.profilePicture} size={28} />
                <span style={{ fontSize: 13, color: '#374151', fontWeight: 500, flex: 1 }}>{m.user?.username || 'Unknown'}</span>
                <Badge color={m.role === 'lead' ? '#f59e0b' : '#6366f1'}>{m.role}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Create / Edit Modal ──────────────────────────────────────────────────────
function TeamFormModal({ initial, departments, employees, onSave, onClose, saving }) {
  const isEdit = !!initial?._id;
  const [form, setForm] = useState(() => ({
    name: initial?.name || '',
    description: initial?.description || '',
    icon: initial?.icon || '👥',
    color: initial?.color || '#6366f1',
    departmentId: initial?.department?._id || initial?.department || '',
    leadId: initial?.lead?._id || initial?.lead || '',
  }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(2px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: 22, padding: 32, width: '100%', maxWidth: 500, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#111827' }}>
            {isEdit ? 'Edit Team' : 'Create Team'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: '#9ca3af', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Icon + Name */}
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
              style={{ width: 56, padding: '10px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 22, textAlign: 'center' }}
              placeholder="👥"
            />
            <input
              required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, color: '#111827' }}
              placeholder="Team name *"
            />
          </div>

          {/* Description */}
          <textarea
            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, resize: 'vertical', minHeight: 72, color: '#374151' }}
            placeholder="Description (optional)"
          />

          {/* Department */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Department</label>
            <select
              value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, color: '#374151' }}
            >
              <option value="">No department</option>
              {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>

          {/* Lead selection */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Team Lead</label>
            <select
              value={form.leadId} onChange={e => setForm(f => ({ ...f, leadId: e.target.value }))}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, color: '#374151' }}
            >
              <option value="">No lead assigned</option>
              {employees.map(emp => (
                <option key={emp._id} value={emp._id}>
                  {emp.username} {emp.email ? `(${emp.email})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Color picker */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Team Color</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TEAM_COLORS.map(c => (
                <button
                  key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                  style={{ width: 30, height: 30, borderRadius: 8, background: c, border: form.color === c ? `3px solid #111827` : '3px solid transparent', cursor: 'pointer', transition: 'border 0.15s', boxShadow: form.color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none' }}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" onClick={onClose}
              style={{ padding: '10px 22px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', cursor: 'pointer', fontWeight: 500, fontSize: 14 }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              style={{ padding: '10px 24px', borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14, opacity: saving ? 0.7 : 1 }}>
              {saving ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create Team')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Member Management Modal ──────────────────────────────────────────────────
function MembersModal({ team, employees, onClose, onSaved }) {
  const [members, setMembers] = useState(() =>
    new Set((team.members || []).map(m => m.user?._id || m.user).filter(Boolean).map(String))
  );
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const toggle = (userId) => {
    setMembers(prev => {
      const next = new Set(prev);
      if (next.has(String(userId))) next.delete(String(userId));
      else next.add(String(userId));
      return next;
    });
  };

  const isMember = (uid) => members.has(String(uid));

  const handleSave = async () => {
    setSaving(true);
    try {
      const currentIds = new Set((team.members || []).map(m => String(m.user?._id || m.user)).filter(Boolean));
      const newIds = members;

      const toAdd = [...newIds].filter(id => !currentIds.has(id));
      const toRemove = [...currentIds].filter(id => !newIds.has(id));

      if (toAdd.length > 0) {
        await axios.patch(`${API_BASE}/api/teams/${team._id}/members`, { userIds: toAdd, action: 'add' }, { withCredentials: true });
      }
      if (toRemove.length > 0) {
        await axios.patch(`${API_BASE}/api/teams/${team._id}/members`, { userIds: toRemove, action: 'remove' }, { withCredentials: true });
      }
      onSaved();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update members');
    } finally {
      setSaving(false);
    }
  };

  const filtered = employees.filter(emp =>
    !search || emp.username.toLowerCase().includes(search.toLowerCase()) || emp.email?.toLowerCase().includes(search.toLowerCase())
  );

  const selectedCount = members.size;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(2px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: 22, width: '100%', maxWidth: 520, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '24px 28px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#111827' }}>Manage Members</h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                {team.icon} {team.name} · <strong style={{ color: '#6366f1' }}>{selectedCount}</strong> selected
              </p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: '#9ca3af', cursor: 'pointer' }}>×</button>
          </div>
          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search employees…"
            style={{ marginTop: 14, width: '100%', padding: '9px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box', color: '#111827' }}
          />
        </div>

        {/* Employee list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 28px' }}>
          {filtered.length === 0 && (
            <p style={{ textAlign: 'center', color: '#9ca3af', padding: 32, fontSize: 14 }}>No employees found</p>
          )}
          {filtered.map(emp => {
            const selected = isMember(emp._id);
            return (
              <div
                key={emp._id}
                id={`member-toggle-${emp._id}`}
                onClick={() => toggle(emp._id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', transition: 'background 0.15s', background: selected ? '#f0f4ff' : 'transparent', marginBottom: 4, border: `1.5px solid ${selected ? '#c7d2fe' : 'transparent'}` }}
                onMouseEnter={e => { if (!selected) e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
              >
                <Avatar name={emp.username} src={emp.profilePicture} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{emp.username}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.email}</div>
                </div>
                <Badge color={selected ? '#6366f1' : '#d1d5db'}>{emp.companyRole || 'member'}</Badge>
                <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${selected ? '#6366f1' : '#d1d5db'}`, background: selected ? '#6366f1' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}>
                  {selected && <span style={{ color: '#fff', fontSize: 12, fontWeight: 800, lineHeight: 1 }}>✓</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            style={{ padding: '10px 22px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', cursor: 'pointer', fontWeight: 500, fontSize: 14 }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} id="save-members-btn"
            style={{ padding: '10px 24px', borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : `Save Members (${selectedCount})`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function TeamsManagement() {
  const { user } = useAuth();
  const rawCompanyId = user?.companyId;
  const companyId = typeof rawCompanyId === 'object' && rawCompanyId !== null
    ? (rawCompanyId._id || rawCompanyId.id || String(rawCompanyId))
    : rawCompanyId;

  const [teams, setTeams] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterDept, setFilterDept] = useState('');
  const [search, setSearch] = useState('');

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [editTeam, setEditTeam] = useState(null);
  const [membersTeam, setMembersTeam] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchTeams = useCallback(async () => {
    try {
      setLoading(true);
      const params = filterDept ? `?departmentId=${filterDept}` : '';
      const { data } = await axios.get(`${API_BASE}/api/teams${params}`, { withCredentials: true });
      setTeams(data.teams || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  }, [filterDept]);

  const fetchDepts = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/api/departments`, { withCredentials: true });
      setDepartments(data.departments || data || []);
    } catch { /* non-fatal */ }
  }, []);

  const fetchEmployees = useCallback(async () => {
    if (!companyId) return;
    try {
      const { data } = await axios.get(`${API_BASE}/api/companies/${companyId}/employees?limit=200`, { withCredentials: true });
      setEmployees(data.employees || []);
    } catch { /* non-fatal */ }
  }, [companyId]);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);
  useEffect(() => { fetchDepts(); fetchEmployees(); }, [fetchDepts, fetchEmployees]);

  const handleCreate = async (form) => {
    setSaving(true);
    try {
      await axios.post(`${API_BASE}/api/teams`, form, { withCredentials: true });
      setShowCreate(false);
      fetchTeams();
    } catch (err) { alert(err.response?.data?.error || 'Failed to create team'); }
    finally { setSaving(false); }
  };

  const handleEdit = async (form) => {
    setSaving(true);
    try {
      await axios.patch(`${API_BASE}/api/teams/${editTeam._id}`, form, { withCredentials: true });
      setEditTeam(null);
      fetchTeams();
    } catch (err) { alert(err.response?.data?.error || 'Failed to update team'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (teamId, name) => {
    if (!window.confirm(`Delete team "${name}"? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API_BASE}/api/teams/${teamId}`, { withCredentials: true });
      fetchTeams();
    } catch (err) { alert(err.response?.data?.error || 'Failed to delete team'); }
  };

  // Filtered teams
  const filtered = teams.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ fontFamily: 'Inter, -apple-system, sans-serif', minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Teams
            </h1>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
              Sub-groups within departments for focused collaboration
            </p>
          </div>
          <button
            id="create-team-btn"
            onClick={() => setShowCreate(true)}
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.4)', whiteSpace: 'nowrap', transition: 'opacity 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            + Create Team
          </button>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search teams…"
            style={{ flex: '1 1 200px', minWidth: 200, padding: '10px 16px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, background: '#fff', color: '#111827', outline: 'none' }}
          />
          {/* Dept filter */}
          <select
            value={filterDept}
            onChange={e => setFilterDept(e.target.value)}
            style={{ padding: '10px 16px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, background: '#fff', color: '#374151', cursor: 'pointer', minWidth: 160 }}
          >
            <option value="">✓ All Departments</option>
            {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
          <span style={{ fontSize: 13, color: '#9ca3af', display: 'flex', alignItems: 'center', padding: '0 4px' }}>
            {filtered.length} team{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '14px 18px', color: '#dc2626', marginBottom: 24, fontSize: 14 }}>
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', color: '#9ca3af', padding: 80 }}>
            <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
            Loading teams…
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>👥</div>
            <p style={{ fontSize: 18, fontWeight: 600, color: '#374151', margin: '0 0 8px' }}>
              {teams.length === 0 ? 'No teams yet' : 'No teams match your search'}
            </p>
            <p style={{ fontSize: 14, margin: 0 }}>
              {teams.length === 0 ? 'Create a team to organize members within a department.' : 'Try a different search or department filter.'}
            </p>
            {teams.length === 0 && (
              <button
                onClick={() => setShowCreate(true)}
                style={{ marginTop: 20, padding: '10px 24px', borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}
              >
                + Create First Team
              </button>
            )}
          </div>
        )}

        {/* Teams grid */}
        {!loading && filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 20 }}>
            {filtered.map(team => (
              <TeamCard
                key={team._id}
                team={team}
                onEdit={setEditTeam}
                onDelete={handleDelete}
                onManageMembers={setMembersTeam}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <TeamFormModal
          departments={departments}
          employees={employees}
          onSave={handleCreate}
          onClose={() => setShowCreate(false)}
          saving={saving}
        />
      )}

      {/* Edit Modal */}
      {editTeam && (
        <TeamFormModal
          initial={editTeam}
          departments={departments}
          employees={employees}
          onSave={handleEdit}
          onClose={() => setEditTeam(null)}
          saving={saving}
        />
      )}

      {/* Members Modal */}
      {membersTeam && (
        <MembersModal
          team={membersTeam}
          employees={employees}
          onClose={() => setMembersTeam(null)}
          onSaved={fetchTeams}
        />
      )}
    </div>
  );
}
