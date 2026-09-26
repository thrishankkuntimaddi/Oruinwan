import React, { useEffect, useState, useMemo } from 'react';
import { X, Search, Loader2, AlertCircle } from 'lucide-react';
import api from '@services/api';

const FONT = 'Inter, system-ui, -apple-system, sans-serif';

export default function ContactPickerModal({ isOpen, onClose, onSelect, workspaceId }) {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState(null);
    const [query,   setQuery]   = useState('');

    useEffect(() => {
        if (!isOpen || !workspaceId) return;
        let cancelled = false;
        setLoading(true);
        setError(null);

        api.get(`/api/workspaces/${workspaceId}/members`)
            .then(({ data }) => {
                if (cancelled) return;
                const list = Array.isArray(data) ? data : (data.members || data.users || []);
                setMembers(list);
            })
            .catch(err => {
                if (cancelled) return;
                setError(err?.response?.data?.message || 'Could not load members');
            })
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [isOpen, workspaceId]);

    useEffect(() => { if (isOpen) setQuery(''); }, [isOpen]);

    const filtered = useMemo(() => {
        if (!query.trim()) return members;
        const q = query.toLowerCase();
        return members.filter(m => {
            const name  = (m.user?.username || m.username || m.name || '').toLowerCase();
            const email = (m.user?.email    || m.email    || '').toLowerCase();
            return name.includes(q) || email.includes(q);
        });
    }, [members, query]);

    const handleSelect = (member) => {
        const u = member.user || member;
        onSelect({
            name:   u.username || u.name || 'Unknown',
            email:  u.email    || '',
            phone:  u.phone    || u.phoneNumber || '',
            avatar: u.profilePicture || u.avatar || '',
        });
    };

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed', inset: 0,
                backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 50, padding: '16px', fontFamily: FONT,
            }}
            onClick={onClose}
        >
            <div
                style={{
                    width: '100%', maxWidth: '420px', maxHeight: '80vh',
                    display: 'flex', flexDirection: 'column',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-accent)',
                    borderRadius: '4px',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                    overflow: 'hidden',
                    animation: 'fadeIn 180ms ease',
                }}
                onClick={e => e.stopPropagation()}
            >
                {}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: FONT }}>Share a Contact</h2>
                        <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)', fontFamily: FONT }}>Select a workspace member</p>
                    </div>
                    <CloseBtn onClick={onClose} />
                </div>

                {}
                <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        <input
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search by name or email…"
                            autoFocus
                            style={{
                                width: '100%', padding: '7px 10px 7px 32px',
                                backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-default)',
                                borderRadius: '2px', outline: 'none', color: 'var(--text-primary)',
                                fontSize: '13px', fontFamily: FONT, boxSizing: 'border-box', transition: 'border-color 100ms ease',
                            }}
                            onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                        />
                    </div>
                </div>

                {}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {loading && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '40px 0', color: 'var(--text-muted)', fontSize: '12px', fontFamily: FONT }}>
                            <Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} />
                            Loading members…
                        </div>
                    )}
                    {error && !loading && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '40px 24px', textAlign: 'center', color: 'var(--state-danger)', fontSize: '12px', fontFamily: FONT }}>
                            <AlertCircle size={18} />
                            {error}
                        </div>
                    )}
                    {!loading && !error && filtered.length === 0 && (
                        <div style={{ padding: '40px 0', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', fontFamily: FONT }}>
                            {query ? 'No members match your search' : 'No members found'}
                        </div>
                    )}
                    {!loading && !error && filtered.map((member, i) => {
                        const u     = member.user || member;
                        const name  = u.username  || u.name  || 'Unknown';
                        const email = u.email     || '';
                        const avatar = u.profilePicture || u.avatar || null;
                        return (
                            <MemberBtn
                                key={u._id || u.id || i}
                                name={name} email={email} avatar={avatar}
                                onClick={() => handleSelect(member)}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function MemberBtn({ name, email, avatar, onClick }) {
    const [hov, setHov] = useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 16px', border: 'none', outline: 'none', cursor: 'pointer',
                textAlign: 'left', borderBottom: '1px solid var(--border-subtle)',
                backgroundColor: hov ? 'var(--bg-hover)' : 'transparent', transition: '100ms ease',
            }}>
            {avatar ? (
                <img src={avatar} alt={name} style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
                <div style={{
                    width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                    backgroundColor: 'var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0c0c0c' }}>
                        {name.charAt(0).toUpperCase()}
                    </span>
                </div>
            )}
            <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {name}
                </p>
                {email && (
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Inter, system-ui, sans-serif' }}>
                        {email}
                    </p>
                )}
            </div>
        </button>
    );
}

function CloseBtn({ onClick }) {
    const [hov, setHov] = useState(false);
    return (
        <button onClick={onClick}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                padding: '5px', border: 'none', outline: 'none', background: 'none',
                cursor: 'pointer', borderRadius: '2px', display: 'flex', transition: '100ms',
                color: hov ? 'var(--state-danger)' : 'var(--text-muted)',
            }}>
            <X size={16} />
        </button>
    );
}
