import React, { useState, useEffect, useCallback } from 'react';
import api from '@services/api';
import { Layers, Plus, Trash2, Hash, Lock, X } from 'lucide-react';

const CATEGORIES = ['general','engineering','design','marketing','sales','hr','finance','support','product','custom'];
const CAT_COLORS = { engineering: '#5ab8ba', design: '#ba5a8a', marketing: 'var(--accent)', sales: 'var(--state-success)', hr: '#9b8ecf', finance: '#b8956a', support: '#5aba8a', product: '#e05252', general: 'var(--text-secondary)', custom: '#9b5ab8' };

const inputStyle = {
    width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)',
    border: '1px solid var(--border-default)', color: 'var(--text-primary)',
    fontSize: '12px', padding: '8px 12px', outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif', transition: 'border-color 150ms ease', borderRadius: '0',
};
const labelStyle = { fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' };

export default function WorkspaceTemplates() {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showCreate, setShowCreate] = useState(false);
    const [filterCat, setFilterCat] = useState('');
    const [saving, setSaving] = useState(false);

    const defaultForm = { name: '', description: '', category: 'general', isPublic: false, defaultChannels: [{ name: 'general', description: 'General discussion', isPrivate: false, isDefault: true }] };
    const [form, setForm] = useState(defaultForm);

    const fetchTemplates = useCallback(async () => {
        try { setLoading(true); const { data } = await api.get('/api/workspace-templates'); setTemplates(data.templates || []); }
        catch (err) { setError(err.response?.data?.message || 'Failed to load templates'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

    const handleCreate = async (e) => {
        e.preventDefault(); setSaving(true);
        try { await api.post('/api/workspace-templates', form); setShowCreate(false); setForm(defaultForm); fetchTemplates(); }
        catch (err) { alert(err.response?.data?.error || err.response?.data?.message || 'Failed to create template'); }
        finally { setSaving(false); }
    };
    const handleDelete = async (id, name) => {
        if (!window.confirm(`Delete template "${name}"?`)) return;
        try { await api.delete(`/api/workspace-templates/${id}`); fetchTemplates(); }
        catch (err) { alert(err.response?.data?.message || 'Failed to delete'); }
    };

    const addChannel = () => setForm(f => ({ ...f, defaultChannels: [...f.defaultChannels, { name: '', description: '', isPrivate: false, isDefault: false }] }));
    const removeChannel = (i) => setForm(f => ({ ...f, defaultChannels: f.defaultChannels.filter((_, idx) => idx !== i) }));
    const updateChannel = (i, key, val) => setForm(f => ({ ...f, defaultChannels: f.defaultChannels.map((ch, idx) => idx === i ? { ...ch, [key]: val } : ch) }));

    const filtered = filterCat ? templates.filter(t => t.category === filterCat) : templates;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Header */}
            <header style={{ height: '56px', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, zIndex: 5 }}>
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <Layers size={16} style={{ color: 'var(--accent)' }} />
                        Workspace Templates
                    </h2>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', marginLeft: '24px' }}>Pre-built workspace blueprints. Apply to create new workspaces instantly.</p>
                </div>
                <TplCreateBtn onClick={() => setShowCreate(true)} />
            </header>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }} className="custom-scrollbar">
                {/* Category filter */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px' }}>
                    {['', ...CATEGORIES].map(cat => (
                        <button key={cat} onClick={() => setFilterCat(cat)}
                            style={{
                                padding: '4px 14px', border: `1px solid ${filterCat === cat ? 'var(--accent)' : 'var(--border-default)'}`,
                                background: filterCat === cat ? 'var(--accent)' : 'var(--bg-surface)',
                                color: filterCat === cat ? 'var(--bg-base)' : 'var(--text-secondary)',
                                fontSize: '11px', fontWeight: filterCat === cat ? 700 : 400, cursor: 'pointer', borderRadius: '0', transition: 'all 150ms ease',
                            }}>
                            {cat === '' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </button>
                    ))}
                </div>

                {error && <div style={{ padding: '10px 14px', background: 'rgba(224,82,82,0.08)', border: '1px solid var(--state-danger)', color: 'var(--state-danger)', fontSize: '12px', marginBottom: '12px' }}>{error}</div>}

                {loading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                        {[1,2,3].map(i => (
                            <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderTop: '2px solid var(--border-accent)', padding: '18px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                    <div className="sk" style={{ width: '32px', height: '32px' }} />
                                    <div className="sk" style={{ height: '18px', width: '55px' }} />
                                </div>
                                <div className="sk" style={{ height: '13px', width: '160px', marginBottom: '8px' }} />
                                <div className="sk" style={{ height: '9px', width: '100%', marginBottom: '4px' }} />
                                <div className="sk" style={{ height: '9px', width: '75%', marginBottom: '16px' }} />
                                <div style={{ display: 'flex', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                                    <div className="sk" style={{ height: '30px', flex: 1 }} />
                                    <div className="sk" style={{ height: '30px', width: '38px' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                        {filtered.length === 0 && (
                            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '64px' }}>
                                <Layers size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 10px', opacity: 0.4 }} />
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No templates yet. Create your first workspace template.</p>
                            </div>
                        )}
                        {filtered.map(t => <TemplateCard key={t._id} t={t} onDelete={handleDelete} />)}
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {showCreate && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
                    onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Create Workspace Template</h2>
                            <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleCreate} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div><label style={labelStyle}>Template Name *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="Template name" /></div>
                            <div><label style={labelStyle}>Description</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, resize: 'vertical', minHeight: '64px' }} placeholder="Description" /></div>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>Category</label>
                                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                                    </select>
                                </div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer', paddingBottom: '8px' }}>
                                    <input type="checkbox" checked={form.isPublic} onChange={e => setForm(f => ({ ...f, isPublic: e.target.checked }))} style={{ accentColor: 'var(--accent)' }} />
                                    Public
                                </label>
                            </div>
                            <div>
                                <label style={labelStyle}>Default Channels</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {form.defaultChannels.map((ch, i) => (
                                        <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                            <Hash size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                            <input required value={ch.name} onChange={e => updateChannel(i, 'name', e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="channel-name" />
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                                <Lock size={10} /><input type="checkbox" checked={ch.isPrivate} onChange={e => updateChannel(i, 'isPrivate', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                                                Private
                                            </label>
                                            {form.defaultChannels.length > 1 && (
                                                <button type="button" onClick={() => removeChannel(i)} style={{ background: 'none', border: 'none', color: 'var(--state-danger)', cursor: 'pointer', padding: '2px', flexShrink: 0 }}><X size={13} /></button>
                                            )}
                                        </div>
                                    ))}
                                    <button type="button" onClick={addChannel}
                                        style={{ padding: '7px', border: '1px dashed var(--border-accent)', background: 'var(--bg-active)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center', transition: 'all 150ms ease' }}>
                                        <Plus size={11} /> Add Channel
                                    </button>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
                                <button type="button" onClick={() => setShowCreate(false)} style={{ padding: '8px 18px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', borderRadius: '2px' }}>Cancel</button>
                                <button type="submit" disabled={saving} style={{ padding: '8px 20px', background: saving ? 'var(--bg-active)' : 'var(--accent)', border: 'none', color: saving ? 'var(--text-muted)' : 'var(--bg-base)', fontSize: '12px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', borderRadius: '2px', transition: 'background 150ms ease' }}>
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

const TemplateCard = ({ t, onDelete }) => {
    const [hov, setHov] = React.useState(false);
    const color = CAT_COLORS[t.category] || 'var(--text-secondary)';
    return (
        <div style={{ background: hov ? 'var(--bg-hover)' : 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderTop: `2px solid ${color}`, transition: 'background 150ms ease', overflow: 'hidden' }}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
            <div style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                        <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{t.name}</h3>
                        <span style={{ fontSize: '10px', color, border: `1px solid ${color}`, padding: '1px 7px', fontWeight: 600 }}>{t.category}</span>
                    </div>
                    {t.isPublic && <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--state-success)', border: '1px solid var(--state-success)', padding: '2px 6px', flexShrink: 0 }}>PUBLIC</span>}
                </div>
                {t.description && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.5', marginBottom: '12px' }}>{t.description}</p>}
                <div style={{ display: 'flex', gap: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', marginBottom: '14px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{(t.defaultChannels || []).length} channels</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.usageCount || 0} uses</span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => alert('Navigate to workspace creation with this template pre-selected.')}
                        style={{ flex: 1, padding: '7px', background: 'var(--accent)', border: 'none', color: 'var(--bg-base)', fontWeight: 700, fontSize: '12px', cursor: 'pointer', borderRadius: '2px', transition: 'background 150ms ease' }}>
                        Use Template
                    </button>
                    <button onClick={() => onDelete(t._id, t.name)}
                        style={{ padding: '7px 10px', background: 'none', border: '1px solid var(--state-danger)', color: 'var(--state-danger)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, borderRadius: '2px', transition: 'all 150ms ease' }}>
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>
        </div>
    );
};

const TplCreateBtn = ({ onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', background: hov ? 'var(--accent-hover)' : 'var(--accent)', border: 'none', color: 'var(--bg-base)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', borderRadius: '2px', transition: 'background 150ms ease' }}>
            <Plus size={13} /> New Template
        </button>
    );
};
