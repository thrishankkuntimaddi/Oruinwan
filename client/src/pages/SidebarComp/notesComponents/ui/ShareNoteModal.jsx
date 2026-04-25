import React, { useState, useEffect } from 'react';
import { X, Search, Users, Check, UserPlus, Globe, Lock } from 'lucide-react';
import api from '@services/api';

const ShareNoteModal = ({ note, workspaceId, onClose, onShare }) => {
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set(note.sharedWith || []));
  const [isPublic, setIsPublic] = useState(note.isPublic || false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/api/workspaces/${workspaceId}/members`);
        const allMembers = (res.data.members || res.data || []).filter(
          m => (m._id || m.id) !== (note.owner?._id || note.owner)
        );
        setMembers(allMembers);
      } catch (e) { console.error('Failed to load members', e); }
      finally { setLoading(false); }
    };
    load();
  }, [workspaceId, note.owner]);

  const filtered = members.filter(m => {
    const name = m.name || m.username || m.displayName || '';
    const email = m.email || '';
    const q = search.toLowerCase();
    return name.toLowerCase().includes(q) || email.toLowerCase().includes(q);
  });

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try { await onShare([...selected], isPublic); onClose(); }
    catch { } finally { setSaving(false); }
  };

  const sharedCount = selected.size;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: 'var(--bg-hover)', border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
        width: '420px', maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
      }}>
        {}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', background: 'rgba(184,149,106,0.12)', border: '1px solid rgba(184,149,106,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Users size={14} style={{ color: '#b8956a' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Inter, system-ui, sans-serif', marginBottom: '1px' }}>Share Note</h3>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px', fontFamily: 'Inter, system-ui, sans-serif' }}>{note.title || 'Untitled Note'}</p>
            </div>
          </div>
          <button onClick={onClose}
            style={{ padding: '5px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 150ms ease' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#e4e4e4'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(228,228,228,0.35)'; e.currentTarget.style.background = 'transparent'; }}
          ><X size={14} /></button>
        </div>

        {}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: '10px', fontFamily: 'monospace' }}>Visibility</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { id: false, Icon: Lock, label: 'Private', sub: 'Only selected people', active: !isPublic },
              { id: true, Icon: Globe, label: 'Workspace', sub: 'All workspace members', active: isPublic },
            ].map(({ id, Icon: Ic, label, sub, active }) => (
              <button key={String(id)} onClick={() => setIsPublic(id)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', fontSize: '12px', fontWeight: 600, background: active ? 'rgba(184,149,106,0.12)' : '#1a1a1a', border: `1px solid ${active ? 'rgba(184,149,106,0.35)' : 'rgba(255,255,255,0.08)'}`, color: active ? '#b8956a' : 'rgba(228,228,228,0.5)', cursor: 'pointer', transition: 'all 150ms ease', textAlign: 'left', fontFamily: 'Inter, system-ui, sans-serif' }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = '#1a1a1a'; }}
              >
                <Ic size={14} style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, lineHeight: 1.3 }}>{label}</div>
                  <div style={{ fontSize: '10px', opacity: 0.6, lineHeight: 1.3 }}>{sub}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {}
        {!isPublic && (
          <>
            <div style={{ padding: '12px 18px 8px', flexShrink: 0 }}>
              <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: '8px', fontFamily: 'monospace' }}>
                Invite people {sharedCount > 0 && <span style={{ color: '#b8956a' }}>· {sharedCount} selected</span>}
              </p>
              <div style={{ position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input type="text" placeholder="Search by name or email..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', paddingLeft: '30px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px', fontSize: '12px', background: '#111', border: '1px solid var(--border-default)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box', colorScheme: 'dark' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(184,149,106,0.4)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 12px', scrollbarWidth: 'thin' }}>
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
                  <div style={{ width: '20px', height: '20px', border: '2px solid #b8956a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                  <Users size={28} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                  <p style={{ fontSize: '12px' }}>{search ? 'No members match your search' : 'No other members in this workspace'}</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {filtered.map(member => {
                    const id = member._id || member.id;
                    const name = member.name || member.username || member.displayName || 'Unknown';
                    const email = member.email || '';
                    const avatar = member.avatar || member.profilePicture || null;
                    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                    const isSelected = selected.has(id);
                    return (
                      <button key={id} onClick={() => toggle(id)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', textAlign: 'left', background: isSelected ? 'rgba(184,149,106,0.08)' : 'transparent', border: `1px solid ${isSelected ? 'rgba(184,149,106,0.2)' : 'transparent'}`, cursor: 'pointer', transition: 'all 150ms ease' }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                      >
                        {avatar ? (
                          <img src={avatar} alt={name} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg,#b8956a,#8a6a40)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '11px', fontWeight: 700, color: '#0c0c0c' }}>
                            {initials}
                          </div>
                        )}
                        <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                          <p style={{ fontSize: '12px', fontWeight: 600, color: isSelected ? '#b8956a' : '#e4e4e4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Inter, system-ui, sans-serif' }}>{name}</p>
                          {email && <p style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</p>}
                        </div>
                        <div style={{ width: '18px', height: '18px', border: `2px solid ${isSelected ? '#b8956a' : 'rgba(255,255,255,0.2)'}`, background: isSelected ? '#b8956a' : 'transparent', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 150ms ease' }}>
                          {isSelected && <Check size={10} style={{ color: '#0c0c0c' }} strokeWidth={3} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {isPublic && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', background: 'rgba(184,149,106,0.1)', border: '1px solid rgba(184,149,106,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
              <Globe size={24} style={{ color: '#b8956a' }} />
            </div>
            <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px', fontFamily: 'Inter, system-ui, sans-serif' }}>Visible to all workspace members</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Anyone in this workspace will be able to view this note.</p>
          </div>
        )}

        {}
        <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '10px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'Inter, system-ui, sans-serif' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#e4e4e4'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(228,228,228,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
          >Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 1, padding: '10px', fontSize: '13px', fontWeight: 700, color: '#0c0c0c', background: '#b8956a', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontFamily: 'Inter, system-ui, sans-serif', transition: 'opacity 150ms ease' }}
            onMouseEnter={e => { if (!saving) e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={e => { if (!saving) e.currentTarget.style.opacity = '1'; }}
          >
            {saving
              ? <div style={{ width: '16px', height: '16px', border: '2px solid #0c0c0c', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              : <><UserPlus size={14} /> {isPublic ? 'Make Public' : sharedCount > 0 ? `Share with ${sharedCount}` : 'Save'}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareNoteModal;
