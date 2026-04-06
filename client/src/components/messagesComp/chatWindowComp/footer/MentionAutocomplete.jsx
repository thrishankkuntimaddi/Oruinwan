// MentionAutocomplete — Monolith Flow Design System
import React, { useEffect, useRef } from 'react';
import { AtSign } from 'lucide-react';

const avatarColor = (name = '') => {
    const palette = ['#b8956a', '#9c7fd4', '#63b3ed', '#48bb78', '#fc8181'];
    return palette[name.charCodeAt(0) % palette.length];
};

export default function MentionAutocomplete({ suggestions, selectedIndex, onSelect, onClose }) {
    const listRef = useRef(null);

    useEffect(() => {
        if (listRef.current) {
            const selected = listRef.current.children[selectedIndex];
            if (selected) selected.scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex]);

    if (!suggestions || suggestions.length === 0) return null;

    return (
        <div
            style={{
                width: '100%', backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-accent)', borderRadius: '2px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)', zIndex: 60,
                overflow: 'hidden', fontFamily: 'var(--font)',
            }}
            onMouseDown={e => e.preventDefault()}
        >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-active)' }}>
                <AtSign size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                    Mention a member
                </span>
            </div>

            {/* List */}
            <ul ref={listRef} style={{ maxHeight: '180px', overflowY: 'auto', padding: '4px 0', listStyle: 'none', margin: 0 }} className="custom-scrollbar" role="listbox">
                {suggestions.map((member, idx) => {
                    const isSelected = idx === selectedIndex;
                    const initials = member.username?.charAt(0).toUpperCase() || '?';
                    const bg = avatarColor(member.username || '');
                    return (
                        <li
                            key={member._id}
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => onSelect(member)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '7px 12px', cursor: 'pointer', transition: '120ms ease',
                                backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                                borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                            }}
                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                            {/* Avatar */}
                            {member.profilePicture ? (
                                <img src={member.profilePicture} alt={member.username}
                                    style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                                />
                            ) : (
                                <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0c0c0c', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                                    {initials}
                                </div>
                            )}

                            {/* Name */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                                    {member.username}
                                </p>
                                {member.name && member.name !== member.username && (
                                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                                        {member.name}
                                    </p>
                                )}
                            </div>

                            {isSelected && <span style={{ flexShrink: 0, fontSize: '11px', color: 'var(--text-muted)' }}>↵</span>}
                        </li>
                    );
                })}
            </ul>

            {/* Footer hint */}
            <div style={{ padding: '5px 12px', borderTop: '1px solid var(--border-subtle)', fontSize: '10px', color: 'var(--text-muted)' }}>
                ↑↓ navigate &nbsp;·&nbsp; Tab/Enter to select &nbsp;·&nbsp; Esc to close
            </div>
        </div>
    );
}
