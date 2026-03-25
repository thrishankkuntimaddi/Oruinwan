import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE } from '../../services/api';

const API = `${API_BASE}/api/teams`;

const roleColors = { admin: '#6366f1', owner: '#f59e0b', member: '#3b82f6', manager: '#10b981' };

export default function TeamsManagement() {
  const [teams, setTeams] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [filterDept, setFilterDept] = useState('');

  const [form, setForm] = useState({ name: '', description: '', icon: '👥', color: '#6366f1', departmentId: '' });
  const [saving, setSaving] = useState(false);

  const fetchTeams = useCallback(async () => {
    try {
      setLoading(true);
      const params = filterDept ? `?departmentId=${filterDept}` : '';
      const { data } = await axios.get(`${API}${params}`, { withCredentials: true });
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

  useEffect(() => { fetchTeams(); }, [fetchTeams]);
  useEffect(() => { fetchDepts(); }, [fetchDepts]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.post(API, form, { withCredentials: true });
      setShowCreateModal(false);
      setForm({ name: '', description: '', icon: '👥', color: '#6366f1', departmentId: '' });
      fetchTeams();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create team');
    } finally { setSaving(false); }
  };

  const handleDelete = async (teamId, name) => {
    if (!window.confirm(`Delete team "${name}"? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API}/${teamId}`, { withCredentials: true });
      fetchTeams();
    } catch (err) { alert(err.response?.data?.error || 'Failed to delete team'); }
  };

  return (
    <div style={{ padding: '32px', fontFamily: 'Inter, sans-serif', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Teams</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>Sub-groups within departments for focused collaboration</p>
        </div>
        <button
          id="create-team-btn"
          onClick={() => setShowCreateModal(true)}
          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontWeight: 600, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.35)' }}
        >
          + Create Team
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <select
          value={filterDept}
          onChange={e => setFilterDept(e.target.value)}
          style={{ padding: '10px 16px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14, background: '#fff', color: '#374151', cursor: 'pointer' }}
        >
          <option value="">All Departments</option>
          {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#9ca3af', display: 'flex', alignItems: 'center' }}>
          {teams.length} team{teams.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Error / Loading States */}
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: 16, color: '#dc2626', marginBottom: 24 }}>{error}</div>}
      {loading && <div style={{ textAlign: 'center', color: '#9ca3af', padding: 64 }}>Loading teams…</div>}

      {/* Teams Grid */}
      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {teams.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 80, color: '#9ca3af' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
              <p style={{ fontSize: 16, fontWeight: 500 }}>No teams yet</p>
              <p style={{ fontSize: 13 }}>Create a team to organize members within a department.</p>
            </div>
          )}
          {teams.map(team => (
            <div
              key={team._id}
              id={`team-card-${team._id}`}
              style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #f3f4f6', padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', transition: 'box-shadow 0.2s', cursor: 'pointer' }}
              onClick={() => setSelectedTeam(selectedTeam?._id === team._id ? null : team)}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(99,102,241,0.12)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'}
            >
              {/* Team header strip */}
              <div style={{ height: 4, borderRadius: 4, background: team.color || '#6366f1', marginBottom: 16, marginLeft: -24, marginRight: -24, marginTop: -24, borderTopLeftRadius: 16, borderTopRightRadius: 16 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 28 }}>{team.icon || '👥'}</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>{team.name}</h3>
                    {team.department && <span style={{ fontSize: 11, color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: 20 }}>{team.department.name}</span>}
                  </div>
                </div>
                <button
                  id={`delete-team-${team._id}`}
                  onClick={e => { e.stopPropagation(); handleDelete(team._id, team.name); }}
                  style={{ background: 'transparent', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4, borderRadius: 6 }}
                  onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                  onMouseLeave={e => e.currentTarget.style.color = '#d1d5db'}
                >×</button>
              </div>

              {team.description && <p style={{ margin: '12px 0 0', fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>{team.description}</p>}

              {/* Stats row */}
              <div style={{ display: 'flex', gap: 20, marginTop: 16, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
                <span style={{ fontSize: 12, color: '#6b7280' }}><strong style={{ color: '#374151' }}>{team.members?.length || 0}</strong> members</span>
                {team.lead && <span style={{ fontSize: 12, color: '#6b7280' }}>Lead: <strong style={{ color: '#374151' }}>{team.lead.username}</strong></span>}
              </div>

              {/* Expanded member list */}
              {selectedTeam?._id === team._id && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
                  <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>Members</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(team.members || []).map(m => (
                      <div key={m.user?._id || m._id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#374151' }}>
                          {(m.user?.username || '?').charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: 13, color: '#374151' }}>{m.user?.username || 'Unknown'}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, background: `${roleColors[m.role] || '#6366f1'}15`, color: roleColors[m.role] || '#6366f1', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{m.role}</span>
                      </div>
                    ))}
                    {(!team.members || team.members.length === 0) && <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>No members yet</p>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreateModal(false); }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h2 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 700 }}>Create Team</h2>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <input
                    type="text" value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                    style={{ width: 56, padding: '10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 22, textAlign: 'center' }} placeholder="👥"
                  />
                  <input
                    required type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14 }} placeholder="Team name *"
                  />
                </div>
                <textarea
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  style={{ padding: '10px 14px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14, resize: 'vertical', minHeight: 80 }} placeholder="Description (optional)"
                />
                <select
                  value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}
                  style={{ padding: '10px 14px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14 }}
                >
                  <option value="">No department</option>
                  {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                  <button type="button" onClick={() => setShowCreateModal(false)}
                    style={{ padding: '10px 20px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', cursor: 'pointer', fontWeight: 500 }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={saving}
                    style={{ padding: '10px 20px', borderRadius: 8, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                    {saving ? 'Creating…' : 'Create Team'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
