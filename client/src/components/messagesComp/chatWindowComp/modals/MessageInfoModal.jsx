import React, { useState } from "react";
import { X, CheckCircle2, Clock, Lock, Smile, MessageSquare } from "lucide-react";

const FONT = 'Inter, system-ui, -apple-system, sans-serif';

export default function MessageInfoModal({ msg, members = [], readBy = [], currentUserId, onClose }) {
    if (!msg) return null;

    const readBySet = new Set(readBy.map(String));

    const seenByList = members.filter(m => {
        const id = String(m._id);
        return readBySet.has(id) && id !== String(currentUserId);
    }).sort((a, b) => (a.username || '').localeCompare(b.username || ''));

    const deliveredToList = members.filter(m => {
        const id = String(m._id);
        return !readBySet.has(id) && id !== String(currentUserId);
    }).sort((a, b) => (a.username || '').localeCompare(b.username || ''));

    const displayText = msg.text || msg.payload?.text || '🔒 Encrypted message';
    const sentAt   = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '–';
    const sentDate = msg.createdAt ? new Date(msg.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '';

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 100,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            fontFamily: FONT,
        }}>
            {}
            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }} onClick={onClose} />

            {}
            <div style={{
                position: 'relative', zIndex: 10,
                width: '100%', maxWidth: '380px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-accent)',
                borderBottom: 'none',
                borderRadius: '4px 4px 0 0',
                boxShadow: '0 -16px 48px rgba(0,0,0,0.5)',
                overflow: 'hidden',
            }}>
                {}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-default)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MessageSquare size={14} style={{ color: 'var(--accent)' }} />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: FONT }}>Message Info</span>
                    </div>
                    <CloseBtn onClick={onClose} />
                </div>

                {}
                <div style={{ padding: '12px 16px', backgroundColor: 'var(--bg-active)', borderBottom: '1px solid var(--border-default)' }}>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', fontFamily: FONT }}>
                        &ldquo;{displayText}&rdquo;
                    </p>
                    <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '10px', color: 'var(--text-muted)', fontFamily: FONT }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={10} /> {sentDate} at {sentAt}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Lock size={10} style={{ color: 'var(--accent)' }} />
                            {msg.isEncrypted ? 'End-to-end encrypted' : 'Encrypted in transit'}
                        </span>
                    </div>
                </div>

                {}
                <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>

                    {}
                    {msg.reactions && msg.reactions.length > 0 && (
                        <Section>
                            <SectionHeader icon={<Smile size={13} style={{ color: 'var(--accent)' }} />}>
                                Reactions ({msg.reactions.reduce((acc, r) => acc + (r.users?.length || 0), 0)})
                            </SectionHeader>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {msg.reactions.map((reaction, idx) => {
                                    const reactedNames = members
                                        .filter(m => reaction.users?.some(uid => String(uid) === String(m._id)))
                                        .map(u => u.username || 'Unknown');
                                    return (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '16px' }}>{reaction.emoji}</span>
                                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: FONT }}>
                                                {reactedNames.join(', ') || `${reaction.users?.length || 0} members`}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </Section>
                    )}

                    {}
                    <Section>
                        <SectionHeader icon={<CheckCircle2 size={13} style={{ color: 'var(--accent)' }} />}>
                            Seen by {seenByList.length}
                        </SectionHeader>
                        {seenByList.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {seenByList.map(user => (
                                    <MemberRow key={user._id} user={user} />
                                ))}
                            </div>
                        ) : (
                            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: '18px', fontFamily: FONT }}>No one has read this yet.</p>
                        )}
                    </Section>

                    {}
                    <Section>
                        <SectionHeader>Delivered to ({deliveredToList.length})</SectionHeader>
                        {deliveredToList.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {deliveredToList.map(user => (
                                    <MemberRow key={user._id} user={user} muted />
                                ))}
                            </div>
                        ) : (
                            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: '18px', fontFamily: FONT }}>All members have seen this.</p>
                        )}
                    </Section>
                </div>

                {}
                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-default)' }}>
                    <FooterBtn onClick={onClose}>Close</FooterBtn>
                </div>
            </div>
        </div>
    );
}

function CloseBtn({ onClick }) {
    const [hovered, setHovered] = useState(false);
    return (
        <button onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                padding: '5px', border: 'none', outline: 'none', background: 'none',
                cursor: 'pointer', borderRadius: '2px', display: 'flex', transition: '100ms ease',
                color: hovered ? 'var(--state-danger)' : 'var(--text-muted)',
            }}>
            <X size={15} />
        </button>
    );
}

function Section({ children }) {
    return (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
            {children}
        </div>
    );
}

function SectionHeader({ icon, children }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', fontFamily: 'Inter, system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {icon}
            {children}
        </div>
    );
}

function MemberRow({ user, muted }) {
    const char = (user.username || '?').charAt(0).toUpperCase();
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', opacity: muted ? 0.6 : 1 }}>
            {user.profilePicture ? (
                <img src={user.profilePicture} alt={user.username}
                    style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border-default)' }} />
            ) : (
                <div style={{
                    width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                    backgroundColor: muted ? 'var(--bg-hover)' : 'rgba(184,149,106,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1px solid ${muted ? 'var(--border-default)' : 'var(--border-accent)'}`,
                    fontSize: '10px', fontWeight: 700,
                    color: muted ? 'var(--text-muted)' : 'var(--accent)',
                }}>
                    {char}
                </div>
            )}
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'Inter, system-ui, sans-serif' }}>
                {user.username}
            </span>
        </div>
    );
}

function FooterBtn({ onClick, children }) {
    const [hovered, setHovered] = useState(false);
    return (
        <button onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                width: '100%', padding: '8px 0', fontSize: '13px', fontWeight: 500,
                color: hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
                backgroundColor: hovered ? 'var(--bg-hover)' : 'var(--bg-active)',
                border: '1px solid var(--border-default)', borderRadius: '2px', cursor: 'pointer',
                outline: 'none', transition: '100ms ease', fontFamily: 'Inter, system-ui, sans-serif',
            }}>
            {children}
        </button>
    );
}
