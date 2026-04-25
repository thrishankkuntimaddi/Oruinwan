import React from 'react';
import { Mail, Phone, UserCircle } from 'lucide-react';

export default function ContactMessage({ msg }) {
    const contact = msg?.contact || msg?.payload?.contact;
    if (!contact) return null;

    const { name, email, phone, avatar } = contact;

    return (
        <div style={{
            marginTop: '4px',
            backgroundColor: 'var(--bg-active)',
            border: '1px solid var(--border-accent)',
            borderRadius: '2px',
            padding: '12px',
            maxWidth: '280px',
        }}>
            {}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                {avatar ? (
                    <img
                        src={avatar}
                        alt={name}
                        style={{
                            width: '36px', height: '36px', borderRadius: '2px',
                            objectFit: 'cover', flexShrink: 0,
                            border: '1px solid var(--border-default)',
                        }}
                    />
                ) : (
                    <div style={{
                        width: '36px', height: '36px', borderRadius: '2px',
                        backgroundColor: 'var(--bg-hover)',
                        border: '1px solid var(--border-default)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                    }}>
                        <UserCircle size={18} style={{ color: 'var(--text-muted)' }} />
                    </div>
                )}
                <div style={{ minWidth: 0 }}>
                    <div style={{
                        fontSize: '9px', fontWeight: 700,
                        color: 'var(--accent)',
                        textTransform: 'uppercase', letterSpacing: '0.12em',
                        marginBottom: '2px',
                        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    }}>
                        Contact
                    </div>
                    <div style={{
                        fontSize: '13px', fontWeight: 500,
                        color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    }}>
                        {name || 'Unknown Contact'}
                    </div>
                </div>
            </div>

            {}
            <div style={{
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '10px',
                display: 'flex', flexDirection: 'column', gap: '6px',
            }}>
                {email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Mail size={12} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                        <a
                            href={`mailto:${email}`}
                            style={{
                                fontSize: '12px', color: 'var(--text-secondary)',
                                textDecoration: 'none',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                transition: 'color 150ms ease',
                                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                        >
                            {email}
                        </a>
                    </div>
                )}
                {phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Phone size={12} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                        <a
                            href={`tel:${phone}`}
                            style={{
                                fontSize: '12px', color: 'var(--text-secondary)',
                                textDecoration: 'none',
                                transition: 'color 150ms ease',
                                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                        >
                            {phone}
                        </a>
                    </div>
                )}
                {!email && !phone && (
                    <p style={{
                        fontSize: '12px', color: 'var(--text-muted)',
                        fontStyle: 'italic', margin: 0,
                        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    }}>No contact details</p>
                )}
            </div>
        </div>
    );
}
