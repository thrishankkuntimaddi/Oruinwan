import React from 'react';
import { Lock, Users, X, Info } from 'lucide-react';

export default function ModalHeader({
    channel,
    members,
    onClose,
    activeTab,
    showDebugInfo,
    onToggleDebugInfo
}) {
    return (
        <div style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            backgroundColor: 'var(--bg-surface)',
            flexShrink: 0,
        }}>
            <div>
                <h3 style={{
                    fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)',
                    display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 6px',
                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                }}>
                    {channel.isPrivate
                        ? <Lock size={16} style={{ color: 'var(--text-muted)' }} />
                        : <Users size={16} style={{ color: 'var(--text-muted)' }} />}
                    {channel.name}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <p style={{
                        fontSize: '12px', color: 'var(--text-secondary)', margin: 0,
                        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    }}>
                        {members.length} members · {channel.isPrivate ? "Private" : "Public"} Channel
                    </p>
                    {channel.description && (
                        <p style={{
                            fontSize: '12px', color: 'var(--text-muted)', margin: 0,
                            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                        }}>
                            {channel.description}
                        </p>
                    )}
                    <p style={{
                        fontSize: '11px', color: 'var(--text-muted)', margin: 0,
                        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    }}>
                        Created {new Date(channel.createdAt || Date.now()).toLocaleDateString()} by {channel.creatorName || "Admin"}
                    </p>
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {activeTab === "invite" && (
                    <button
                        onClick={onToggleDebugInfo}
                        style={{
                            padding: '6px', background: 'none', border: 'none',
                            cursor: 'pointer', color: 'var(--text-muted)', borderRadius: '2px',
                            display: 'flex', alignItems: 'center', transition: 'color 150ms ease',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                        title={showDebugInfo ? 'Hide Debug Info' : 'Show Debug Info'}
                    >
                        <Info size={18} />
                    </button>
                )}
                <button
                    onClick={onClose}
                    style={{
                        padding: '6px', background: 'none', border: 'none',
                        cursor: 'pointer', color: 'var(--text-muted)', borderRadius: '2px',
                        display: 'flex', alignItems: 'center', transition: 'color 150ms ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--state-danger)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    );
}
