import React, { useState, useEffect, useCallback } from 'react';
import api from '@services/api';
import { API_BASE } from '@services/api';

const CATEGORIES = ['general','engineering','design','marketing','sales','hr','finance','support','product','custom'];
const CATEGORY_COLORS = { engineering:'#3b82f6', design:'#ec4899', marketing:'#f59e0b', sales:'#10b981', hr:'#8b5cf6', finance:'#6366f1', support:'#14b8a6', product:'#f97316', general:'#6b7280', custom:'#a855f7' };

export default function WorkspaceTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filterCat, setFilterCat] = useState('');
  const [saving, setSaving] = useState(false);

  const defaultForm = { name: '', description: '', icon: '📁', color: '#6366f1', category: 'general', isPublic: false, defaultChannels: [{ name: 'general', description: 'General discussion', isPrivate: false, isDefault: true }] };
  const [form, setForm] = useState(defaultForm);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/api/workspace-templates`);
      setTemplates(data.templates || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load templates');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/api/workspace-templates`, form);
      setShowCreate(false);
      setForm(defaultForm);
      fetchTemplates();
    } catch (err) { alert(err.response?.data?.error || err.response?.data?.message || 'Failed to create template'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete template "${name}"?`)) return;
    try {
      await api.delete(`/api/workspace-templates/${id}`);
      fetchTemplates();
    } catch (err) { alert(err.response?.data?.message || 'Failed to delete'); }
  };

  const addChannel = () => setForm(f => ({ ...f, defaultChannels: [...f.defaultChannels, { name: '', description: '', isPrivate: false, isDefault: false }] }));
  const removeChannel = (i) => setForm(f => ({ ...f, defaultChannels: f.defaultChannels.filter((_, idx) => idx !== i) }));
  const updateChannel = (i, key, val) => setForm(f => ({
    ...f,
    defaultChannels: f.defaultChannels.map((ch, idx) => idx === i ? { ...ch, [key]: val } : ch)
  }));

  const filtered = filterCat ? templates.filter(t => t.category === filterCat) : templates;

  return (
    <div style={{ padding: '32px', fontFamily: 'Inter, sans-serif', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Workspace Templates</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>Pre-built workspace blueprints. Apply to create new workspaces instantly.</p>
        </div>
        <button id="create-template-btn" onClick={() => setShowCreate(true)}
          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontWeight: 600, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.35)' }}>
          + New Template
        </button>
      </div>

      {/* Category filter pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {['', ...CATEGORIES].map(cat => (
          <button key={cat} onClick={() => setFilterCat(cat)}
            style={{ padding: '6px 16px', borderRadius: 20, border: '1.5px solid', borderColor: filterCat === cat ? '#6366f1' : '#e5e7eb', background: filterCat === cat ? '#6366f1' : '#fff', color: filterCat === cat ? '#fff' : '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}>
            {cat === '' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: 16, color: '#dc2626', marginBottom: 24 }}>{error}</div>}
      {loading && <div style={{ textAlign: 'center', color: '#9ca3af', padding: 64 }}>Loading templates…</div>}

      {/* Templates grid */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {filtered.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 80, color: '#9ca3af' }}>
              <div style={{ fontSize: 48 }}>📁</div>
              <p>No templates yet. Create your first workspace template.</p>
            </div>
          )}
          {filtered.map(t => (
            <div key={t._id} id={`template-card-${t._id}`}
              style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #f3f4f6', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', transition: 'box-shadow 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 24px rgba(99,102,241,0.12)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'}>
              {/* Color banner */}
              <div style={{ height: 6, background: t.color || '#6366f1' }} />
              <div style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 26 }}>{t.icon || '📁'}</span>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>{t.name}</h3>
                      <span style={{ fontSize: 11, background: `${CATEGORY_COLORS[t.category] || '#6366f1'}15`, color: CATEGORY_COLORS[t.category] || '#6366f1', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                        {t.category}
                      </span>
                    </div>
                  </div>
                  {t.isPublic && <span style={{ fontSize: 10, background: '#f0fdf4', color: '#16a34a', padding: '3px 8px', borderRadius: 20, fontWeight: 600 }}>PUBLIC</span>}
                </div>

                {t.description && <p style={{ margin: '12px 0 0', fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>{t.description}</p>}

                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6', display: 'flex', gap: 16 }}>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>📌 {(t.defaultChannels || []).length} channels</span>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>📊 {t.usageCount || 0} uses</span>
                </div>

                <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                  <button id={`use-template-${t._id}`}
                    style={{ flex: 1, padding: '8px', borderRadius: 8, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                    onClick={() => alert('Navigate to workspace creation with this template pre-selected.')}>
                    Use Template
                  </button>
                  <button id={`delete-template-${t._id}`} onClick={() => handleDelete(t._id, t.name)}
                    style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #fee2e2', background: '#fff', color: '#ef4444', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h2 style={{ margin: '0 0 24px', fontSize: 20, fontWeight: 700 }}>Create Workspace Template</h2>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                  style={{ width: 52, padding: '10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 22, textAlign: 'center' }} placeholder="📁" />
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14 }} placeholder="Template name *" />
              </div>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                style={{ padding: '10px 14px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14, resize: 'vertical', minHeight: 68 }} placeholder="Description" />
              <div style={{ display: 'flex', gap: 10 }}>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14 }}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.isPublic} onChange={e => setForm(f => ({ ...f, isPublic: e.target.checked }))} />
                  Public
                </label>
              </div>

              {/* Channels */}
              <div>
                <p style={{ margin: '4px 0 10px', fontSize: 13, fontWeight: 600, color: '#374151' }}>Default Channels</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {form.defaultChannels.map((ch, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 16 }}>#</span>
                      <input required value={ch.name} onChange={e => updateChannel(i, 'name', e.target.value)}
                        style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13 }} placeholder="channel-name" />
                      <label style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                        <input type="checkbox" checked={ch.isPrivate} onChange={e => updateChannel(i, 'isPrivate', e.target.checked)} />
                        Private
                      </label>
                      {form.defaultChannels.length > 1 && (
                        <button type="button" onClick={() => removeChannel(i)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={addChannel}
                    style={{ padding: '8px', borderRadius: 8, border: '1.5px dashed #e5e7eb', background: '#f9fafb', color: '#6b7280', cursor: 'pointer', fontSize: 13 }}>
                    + Add Channel
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={() => setShowCreate(false)}
                  style={{ padding: '10px 20px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', cursor: 'pointer', fontWeight: 500 }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  style={{ padding: '10px 20px', borderRadius: 8, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  {saving ? 'Creating…' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
