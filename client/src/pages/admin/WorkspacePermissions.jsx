import React, { useState, useEffect, useCallback } from 'react';
import api from '../../../services/api';
import { API_BASE } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const FEATURES = [
  { key: 'tasks',       label: 'Tasks',        icon: '✅', desc: 'Create and assign tasks' },
  { key: 'notes',       label: 'Notes',        icon: '📝', desc: 'Collaborative notes' },
  { key: 'polls',       label: 'Polls',        icon: '📊', desc: 'Create channel polls' },
  { key: 'ai',          label: 'AI Assistant', icon: '🤖', desc: 'Smart replies & AI tools' },
  { key: 'huddles',     label: 'Huddles',      icon: '🎙️', desc: 'Voice & video huddles' },
  { key: 'fileUploads', label: 'File Uploads', icon: '📎', desc: 'Share files in channels' },
  { key: 'reactions',   label: 'Reactions',    icon: '😀', desc: 'Message emoji reactions' },
  { key: 'threads',     label: 'Threads',      icon: '💬', desc: 'Message thread replies' },
  { key: 'bookmarks',   label: 'Bookmarks',    icon: '🔖', desc: 'Bookmark messages' },
  { key: 'reminders',   label: 'Reminders',    icon: '⏰', desc: 'Set message reminders' },
];

const INVITE_ROLES = ['owner', 'admin', 'member'];
const CHANNEL_CREATE_ROLES = ['owner', 'admin', 'member'];

function Toggle({ checked, onChange }) {
  return (
    <div
      onClick={onChange}
      style={{
        width: 44, height: 24, borderRadius: 12, cursor: 'pointer', transition: 'background 0.2s',
        background: checked ? '#6366f1' : '#e5e7eb', position: 'relative', flexShrink: 0
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: checked ? 23 : 3, width: 18, height: 18,
        borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.15)'
      }} />
    </div>
  );
}

export default function WorkspacePermissions({ workspaceId: propWorkspaceId }) {
  const { user } = useAuth();

  // user.workspaces is [{workspace: ObjectId, role, joinedAt}]
  // Extract the actual workspace IDs from the nested .workspace field
  const userWorkspaces = (user?.workspaces || []).map(ws => ({
    id: typeof ws.workspace === 'object' ? (ws.workspace._id || ws.workspace.id || ws.workspace) : ws.workspace,
    name: ws.workspace?.name || null,
    role: ws.role
  })).filter(ws => ws.id);

  // Also include personalWorkspace if present
  const personalWs = user?.personalWorkspace;
  const personalWsId = personalWs
    ? (typeof personalWs === 'object' ? personalWs._id || personalWs.id : personalWs)
    : null;
  const allWorkspaces = personalWsId
    ? [{ id: personalWsId, name: 'Personal Workspace', role: 'owner' }, ...userWorkspaces]
    : userWorkspaces;

  // Priority: prop → query param → first workspace from user context
  const queryWsId = new URLSearchParams(window.location.search).get('workspaceId');
  const [selectedWsId, setSelectedWsId] = useState(
    propWorkspaceId || queryWsId || allWorkspaces[0]?.id || ''
  );

  // Update when user loads (async auth)
  useEffect(() => {
    if (!selectedWsId && allWorkspaces.length > 0) {
      setSelectedWsId(String(allWorkspaces[0].id));
    }
  }, [user, selectedWsId]); // eslint-disable-line

  const wsId = selectedWsId ? String(selectedWsId) : '';

  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('features');

  const fetchPermissions = useCallback(async () => {
    if (!wsId) { setError('No workspace selected'); setLoading(false); return; }
    try {
      setLoading(true);
      const { data } = await api.get(`/api/workspaces/${wsId}/permissions`);
      setPermissions(data.permissions);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load permissions');
    } finally { setLoading(false); }
  }, [wsId]);

  useEffect(() => { fetchPermissions(); }, [fetchPermissions]);

  const updateToggle = async (key, value) => {
    if (!permissions) return;
    const updated = { ...permissions.featureToggles, [key]: value };
    setPermissions(p => ({ ...p, featureToggles: updated }));
    try {
      await api.put(`/api/workspaces/${wsId}/features`, { featureToggles: updated });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { fetchPermissions(); }
  };

  const savePermissions = async () => {
    if (!permissions) return;
    setSaving(true);
    try {
      await api.put(`/api/workspaces/${wsId}/permissions`, {
        invitePermission: permissions.invitePermission,
        channelCreationPermission: permissions.channelCreationPermission
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) { alert(err.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ padding: '32px', fontFamily: 'Inter, sans-serif', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: userWorkspaces.length > 1 ? 16 : 32, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Workspace Permissions</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>Control feature access and role-based permissions</p>
        </div>
        {saved && <span style={{ fontSize: 13, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '6px 14px', borderRadius: 20, fontWeight: 600 }}>✓ Saved</span>}
      </div>

      {/* Workspace picker — shown when multiple workspaces available */}
      {allWorkspaces.length > 1 && (
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Workspace:</label>
          <select
            id="ws-picker"
            value={selectedWsId}
            onChange={e => { setSelectedWsId(e.target.value); setPermissions(null); }}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14, background: '#fff', color: '#374151', cursor: 'pointer' }}
          >
            {allWorkspaces.map(ws => (
              <option key={String(ws.id)} value={String(ws.id)}>
                {ws.name || String(ws.id)}
              </option>
            ))}
          </select>
        </div>
      )}

      {!wsId && !loading && (
        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: 16, color: '#92400e', marginBottom: 24 }}>
          No workspace found in your account. Please join or create a workspace first.
        </div>
      )}

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: 16, color: '#dc2626', marginBottom: 24 }}>{error}</div>}
      {loading && <div style={{ textAlign: 'center', color: '#9ca3af', padding: 64 }}>Loading…</div>}

      {permissions && !loading && (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#f3f4f6', borderRadius: 10, padding: 4, width: 'fit-content' }}>
            {[['features', '⚡ Feature Toggles'], ['roles', '🔑 Role Permissions']].map(([key, label]) => (
              <button key={key} id={`tab-${key}`} onClick={() => setActiveTab(key)}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                  background: activeTab === key ? '#fff' : 'transparent',
                  color: activeTab === key ? '#6366f1' : '#6b7280',
                  boxShadow: activeTab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
                {label}
              </button>
            ))}
          </div>

          {/* Feature Toggles tab */}
          {activeTab === 'features' && (
            <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #f3f4f6', overflow: 'hidden' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
                <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Enable or disable features for this workspace. Changes take effect immediately for all members.</p>
              </div>
              <div style={{ divide: '1px solid #f3f4f6' }}>
                {FEATURES.map((feat, idx) => (
                  <div key={feat.key} id={`feature-toggle-${feat.key}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px', borderBottom: idx < FEATURES.length - 1 ? '1px solid #f9fafb' : 'none', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ fontSize: 22, width: 32, textAlign: 'center' }}>{feat.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{feat.label}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>{feat.desc}</div>
                    </div>
                    <Toggle
                      checked={permissions.featureToggles?.[feat.key] !== false}
                      onChange={() => updateToggle(feat.key, !(permissions.featureToggles?.[feat.key] !== false))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Role Permissions tab */}
          {activeTab === 'roles' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'Who can invite members?', key: 'invitePermission', options: INVITE_ROLES, desc: 'Minimum role required to generate invite links' },
                { label: 'Who can create channels?', key: 'channelCreationPermission', options: CHANNEL_CREATE_ROLES, desc: 'Minimum role required to create new channels' },
              ].map(({ label, key, options, desc }) => (
                <div key={key} style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #f3f4f6', padding: 24 }}>
                  <div style={{ marginBottom: 14 }}>
                    <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: '#111827' }}>{label}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>{desc}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {options.map(role => (
                      <button key={role} id={`role-btn-${key}-${role}`}
                        onClick={() => setPermissions(p => ({ ...p, [key]: role }))}
                        style={{ padding: '8px 20px', borderRadius: 8, border: '1.5px solid', cursor: 'pointer', fontWeight: 600, fontSize: 13, transition: 'all 0.15s',
                          borderColor: permissions[key] === role ? '#6366f1' : '#e5e7eb',
                          background: permissions[key] === role ? '#6366f1' : '#fff',
                          color: permissions[key] === role ? '#fff' : '#374151' }}>
                        {role.charAt(0).toUpperCase() + role.slice(1)}+
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button id="save-permissions-btn" onClick={savePermissions} disabled={saving}
                  style={{ padding: '12px 28px', borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                  {saving ? 'Saving…' : 'Save Permissions'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
