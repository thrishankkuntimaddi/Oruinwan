import React, { useState, useEffect } from "react";
import { Mail, Phone, Info, X } from "lucide-react";
import api from '@services/api';

const FONT = 'Inter, system-ui, -apple-system, sans-serif';

const STATUS_COLORS = {
    active:  { dot: 'var(--state-success)', text: 'var(--state-success)' },
    away:    { dot: 'var(--state-warning)', text: 'var(--state-warning)' },
    dnd:     { dot: 'var(--state-danger)',  text: 'var(--state-danger)'  },
    default: { dot: 'var(--text-muted)',    text: 'var(--text-muted)'    },
};

function getStatusColor(userStatus, isOnline) {
    if (userStatus === 'active' || (isOnline && !userStatus)) return STATUS_COLORS.active;
    if (userStatus === 'away') return STATUS_COLORS.away;
    if (userStatus === 'dnd')  return STATUS_COLORS.dnd;
    return STATUS_COLORS.default;
}

export default function ContactInfoModal({ chat, onClose }) {
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                setLoading(true);
                const workspaceId = chat.workspaceId;
                if (!workspaceId) throw new Error('No workspace ID');

                const res = await api.get(`/api/workspaces/${workspaceId}/members`);
                const members = res.data.members || [];
                const userId = chat.userId || chat.id;
                const user = members.find(m => String(m._id || m.id) === String(userId));

                setUserData(user || {
                    username: chat.name || chat.username,
                    email: chat.email, phone: chat.phone,
                    profilePicture: chat.image, isOnline: chat.status === 'online',
                    profile: chat.profile || {}
                });
            } catch {
                setUserData({
                    username: chat.name || chat.username, email: chat.email,
                    phone: chat.phone, profilePicture: chat.image,
                    isOnline: chat.status === 'online', profile: {}
                });
            } finally {
                setLoading(false);
            }
        };
        if (chat) fetchUserData();
    }, [chat]);

    if (!chat) return null;

    const displayData = userData || chat;
    const displayName   = displayData.username || displayData.name || 'Unknown User';
    const displayEmail  = displayData.email  || 'No email provided';
    const displayPhone  = displayData.phone  || 'No phone provided';
    const displayAbout  = displayData.profile?.about || displayData.about || "Hey there! I'm using Chttrix.";
    const isOnline      = displayData.isOnline || chat.status === 'online';
    const statusColor   = getStatusColor(displayData.userStatus, isOnline);
    const statusLabel   = displayData.userStatus ? displayData.userStatus.toUpperCase() : (isOnline ? 'ONLINE' : 'OFFLINE');

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: FONT,
        }}>
            {}
            <div
                style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }}
                onClick={onClose}
            />

            {}
            <div style={{
                position: 'relative', zIndex: 10,
                width: '360px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-accent)',
                borderRadius: '4px',
                boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                overflow: 'hidden',
                animation: 'fadeIn 180ms ease',
            }}>
                {}
                <CloseBtn onClick={onClose} />

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
                        <div style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            border: '2px solid var(--accent)', borderTopColor: 'transparent',
                            animation: 'spin 0.8s linear infinite',
                        }} />
                    </div>
                ) : (
                    <>
                        {}
                        <div style={{
                            padding: '16px',
                            borderBottom: '1px solid var(--border-default)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {}
                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                    {displayData.profilePicture ? (
                                        <img
                                            src={displayData.profilePicture}
                                            alt={displayName}
                                            style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-accent)' }}
                                        />
                                    ) : (
                                        <div style={{
                                            width: '52px', height: '52px', borderRadius: '50%',
                                            backgroundColor: 'var(--accent)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            border: '2px solid var(--border-accent)',
                                        }}>
                                            <span style={{ color: '#0c0c0c', fontWeight: 700, fontSize: '18px' }}>
                                                {displayName.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                    {}
                                    <span style={{
                                        position: 'absolute', bottom: 1, right: 1,
                                        width: '12px', height: '12px', borderRadius: '50%',
                                        backgroundColor: statusColor.dot,
                                        border: '2px solid var(--bg-surface)',
                                    }} />
                                </div>
                                {}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h2 style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: FONT }}>
                                        {displayName}
                                    </h2>
                                    <p style={{ margin: '2px 0 0', fontSize: '10px', fontWeight: 600, color: statusColor.text, fontFamily: FONT, letterSpacing: '0.06em' }}>
                                        {statusLabel}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {}
                        <div>
                            <InfoRow icon={<Mail size={15} />} label="Email"   value={displayEmail} />
                            <InfoRow icon={<Phone size={15} />} label="Phone"   value={displayPhone} />
                            <InfoRow icon={<Info  size={15} />} label="About"   value={displayAbout} last />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function CloseBtn({ onClick }) {
    const [hovered, setHovered] = useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                position: 'absolute', top: '10px', right: '10px', zIndex: 10,
                padding: '5px', border: 'none', outline: 'none', background: 'none',
                cursor: 'pointer', borderRadius: '2px',
                color: hovered ? 'var(--state-danger)' : 'var(--text-muted)',
                transition: '100ms ease', display: 'flex',
            }}
        >
            <X size={16} />
        </button>
    );
}

function InfoRow({ icon, label, value, last }) {
    const [hovered, setHovered] = useState(false);
    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                padding: '11px 16px',
                borderBottom: last ? 'none' : '1px solid var(--border-subtle)',
                backgroundColor: hovered ? 'var(--bg-hover)' : 'transparent',
                transition: '100ms ease',
            }}
        >
            <span style={{ color: 'var(--accent)', marginTop: '1px', flexShrink: 0 }}>{icon}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '2px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {label}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', wordBreak: 'break-all', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: 1.5 }}>
                    {value}
                </div>
            </div>
        </div>
    );
}
