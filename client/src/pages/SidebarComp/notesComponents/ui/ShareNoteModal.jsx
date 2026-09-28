import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Users, Check, UserPlus, Globe, Lock, Pencil, Eye } from 'lucide-react';
import api from '@services/api';
import logger from '../../../../utils/logger';

const idOf = (v) => String(v?._id || v?.id || v || '');

const label = { fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', margin: '0 0 8px', fontFamily: 'var(--font)' };

/**
 * Owner-only sharing settings: workspace visibility, the people the note is shared
 * with (pre-selected from the note) and whether they may edit.
 * onShare({ userIds, allowEditing, isPublic }) resolves true on success.
 */
const ShareNoteModal = ({ note, workspaceId, onClose, onShare }) => {
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState('');
  // sharedWith holds populated users ({ _id, username }) or ids: compare by id.
  const [selected, setSelected] = useState(() => new Set((note.sharedWith || []).map(idOf).filter(Boolean)));
  const [isPublic, setIsPublic] = useState(!!note.isPublic);
  const [allowEditing, setAllowEditing] = useState(!!note.allowEditing);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ownerId = idOf(note.owner);
    api.get(`/api/workspaces/${workspaceId}/members`)
      .then((res) => {
        if (cancelled) return;
        const all = (res.data.members || res.data || [])
          .filter(m => (m.membershipStatus || 'active') === 'active')
          .filter(m => idOf(m) !== ownerId);
        setMembers(all);
      })
      .catch((e) => {
        logger.error('Failed to load members', e);
        if (!cancelled) setLoadError(e?.response?.data?.message || 'Could not load workspace members');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [workspaceId, note.owner]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter(m => {
      const name = m.profile?.name || m.name || m.username || '';
      return !q || name.toLowerCase().includes(q) || (m.username || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q);
    });
  }, [members, search]);

  const toggle = (uid) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  const initial = useMemo(() => new Set((note.sharedWith || []).map(idOf)), [note.sharedWith]);
  const dirty = isPublic !== !!note.isPublic || allowEditing !== !!note.allowEditing
    || selected.size !== initial.size || [...selected].some(uid => !initial.has(uid));

  const handleSave = async () => {
    if (!dirty) { onClose(); return; }
    setSaving(true);
    const ok = await onShare({ userIds: [...selected], allowEditing, isPublic });
    setSaving(false);
    if (ok) onClose();
  };

  const sharedCount = selected.size;
  const btnBase = { padding: '9px', fontSize: '13px', borderRadius: '2px', cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all 150ms ease' };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'var(--bg-overlay)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label="Share note" data-testid="share-note-modal" style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px',
        boxShadow: 'var(--card-shadow)', width: '440px', maxWidth: '100%', maxHeight: '85vh',
        display: 'flex', flexDirection: 'column', fontFamily: 'var(--font)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div style={{ width: '32px', height: '32px', background: 'var(--accent-dim)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Users size={14} style={{ color: 'var(--accent)' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Share note</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px', margin: 0 }}>{note.title || 'Untitled'}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close"
            style={{ padding: '5px', background: 'transparent', border: 'none', borderRadius: '2px', color: 'var(--text-muted)', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
          ><X size={14} /></button>
        </div>

        {/* Visibility */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <p style={label}>Visibility</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { value: false, Icon: Lock, title: 'Private', sub: 'Only you and people below' },
              { value: true, Icon: Globe, title: 'Workspace', sub: 'Every member can view' },
            ].map(({ value, Icon: Ic, title, sub }) => {
              const active = isPublic === value;
              return (
                <button key={String(value)} onClick={() => setIsPublic(value)} aria-pressed={active}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: active ? 'var(--accent-dim)' : 'var(--bg-base)', border: `1px solid ${active ? 'var(--accent)' : 'var(--border-default)'}`, borderRadius: '2px', color: active ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)', transition: 'all 150ms ease' }}
                >
                  <Ic size={14} style={{ flexShrink: 0 }} />
                  <span>
                    <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, lineHeight: 1.3 }}>{title}</span>
                    <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.3 }}>{sub}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* People */}
        <div style={{ padding: '12px 18px 8px', flexShrink: 0 }}>
          <p style={label}>
            Share with people {sharedCount > 0 && <span style={{ color: 'var(--accent)' }}>· {sharedCount} selected</span>}
          </p>
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input type="text" placeholder="Search members…" aria-label="Search members"
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '7px 12px 7px 30px', fontSize: '12px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '2px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)', boxSizing: 'border-box' }}
              onFocus={e => { e.target.style.borderColor = 'var(--border-accent)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 10px', minHeight: '120px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px' }}>
              {[0, 1, 2].map(i => <div key={i} style={{ height: '36px', background: 'var(--bg-hover)', borderRadius: '2px' }} />)}
            </div>
          ) : loadError ? (
            <p style={{ fontSize: '12px', color: 'var(--state-danger)', padding: '16px 8px', margin: 0 }}>{loadError}</p>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-muted)' }}>
              <Users size={24} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <p style={{ fontSize: '12px', margin: 0 }}>{search ? 'No members match your search' : 'No other members in this workspace'}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {filtered.map(member => {
                const uid = idOf(member);
                const name = member.profile?.name || member.name || member.username || 'Unknown';
                const avatar = member.profilePicture || member.avatar || null;
                const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                const isSelected = selected.has(uid);
                return (
                  <button key={uid} onClick={() => toggle(uid)} aria-pressed={isSelected} data-testid={`share-member-${member.username || uid}`}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', textAlign: 'left', background: isSelected ? 'var(--accent-dim)' : 'transparent', border: '1px solid transparent', borderRadius: '2px', cursor: 'pointer', transition: 'background 150ms ease', fontFamily: 'var(--font)' }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {avatar ? (
                      <img src={avatar} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg-active)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        {initials}
                      </div>
                    )}
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                      {member.email && <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.email}</span>}
                    </span>
                    <span style={{ width: '16px', height: '16px', border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-accent)'}`, background: isSelected ? 'var(--accent)' : 'transparent', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {isSelected && <Check size={10} style={{ color: '#0c0c0c' }} strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Edit permission */}
        <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <p style={label}>People you share with can</p>
          <div style={{ display: 'flex', gap: '8px' }} role="radiogroup" aria-label="Permission for shared people">
            {[
              { value: false, Icon: Eye, title: 'View' },
              { value: true, Icon: Pencil, title: 'Edit' },
            ].map(({ value, Icon: Ic, title }) => {
              const active = allowEditing === value;
              return (
                <button key={title} role="radio" aria-checked={active} onClick={() => setAllowEditing(value)} data-testid={`share-permission-${title.toLowerCase()}`}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '7px 10px', fontSize: '12px', fontWeight: 600, background: active ? 'var(--accent-dim)' : 'transparent', border: `1px solid ${active ? 'var(--accent)' : 'var(--border-default)'}`, borderRadius: '2px', color: active ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font)' }}
                >
                  <Ic size={12} /> {title}
                </button>
              );
            })}
          </div>
          {isPublic && (
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '8px 0 0' }}>
              Other workspace members can view this note but not edit it.
            </p>
          )}
        </div>

        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button onClick={onClose}
            style={{ ...btnBase, flex: 1, fontWeight: 600, color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--border-default)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}
          >Cancel</button>
          <button onClick={handleSave} disabled={saving} data-testid="share-note-save"
            style={{ ...btnBase, flex: 1, fontWeight: 700, color: '#0c0c0c', background: 'var(--accent)', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <UserPlus size={14} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareNoteModal;
