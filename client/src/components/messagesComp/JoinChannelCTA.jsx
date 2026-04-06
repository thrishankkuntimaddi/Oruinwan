import React, { useState } from 'react';
import { UserPlus, Hash, AlertCircle, Loader2 } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../../contexts/ToastContext';

/**
 * JoinChannelCTA — shown when a non-member views a public discoverable channel.
 */
export default function JoinChannelCTA({ channel, onJoinSuccess }) {
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState(null);
    const { showToast } = useToast();

    const handleJoin = async () => {
        setIsJoining(true);
        setError(null);
        try {
            await api.post(`/api/channels/${channel._id}/join-discoverable`);
            showToast(`Successfully joined #${channel.name}`, 'success');
            if (onJoinSuccess) onJoinSuccess();
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Failed to join channel';
            setError(errorMessage);
            showToast(errorMessage, 'error');
        } finally {
            setIsJoining(false);
        }
    };

    return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', backgroundColor: 'var(--bg-base)' }}>
            <div style={{ maxWidth: '360px', width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>

                {/* Channel icon */}
                <div style={{ width: '64px', height: '64px', borderRadius: '2px', backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Hash size={28} style={{ color: 'var(--accent)' }} strokeWidth={2} />
                </div>

                {/* Channel name + description */}
                <div>
                    <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px', fontFamily: 'var(--font)' }}>
                        #{channel.name}
                    </h2>
                    {channel.description && (
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                            {channel.description}
                        </p>
                    )}
                </div>

                {/* Info card */}
                <div style={{ width: '100%', padding: '12px 16px', backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-default)', borderRadius: '2px' }}>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.65 }}>
                        You are not a member of this channel. Join to start chatting and collaborating!
                    </p>
                </div>

                {/* Error */}
                {error && (
                    <div style={{ width: '100%', padding: '10px 14px', backgroundColor: 'rgba(224,82,82,0.08)', border: '1px solid rgba(224,82,82,0.3)', borderRadius: '2px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <AlertCircle size={16} style={{ color: 'var(--state-danger)', flexShrink: 0, marginTop: '1px' }} />
                        <p style={{ fontSize: '12px', color: 'var(--state-danger)', margin: 0, textAlign: 'left' }}>{error}</p>
                    </div>
                )}

                {/* Join button */}
                <button
                    onClick={handleJoin}
                    disabled={isJoining}
                    style={{
                        width: '100%', padding: '10px 0',
                        backgroundColor: isJoining ? 'var(--bg-active)' : 'var(--accent)',
                        color: isJoining ? 'var(--text-muted)' : '#0c0c0c',
                        border: 'none', outline: 'none', borderRadius: '2px',
                        fontSize: '14px', fontWeight: 600,
                        fontFamily: 'var(--font)', cursor: isJoining ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        transition: '120ms ease',
                    }}
                    onMouseEnter={e => { if (!isJoining) e.currentTarget.style.backgroundColor = 'var(--accent-hover)'; }}
                    onMouseLeave={e => { if (!isJoining) e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
                >
                    {isJoining ? (
                        <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /><span>Joining...</span></>
                    ) : (
                        <><UserPlus size={16} /><span>Join Channel</span></>
                    )}
                </button>

                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                    This is a public discoverable channel. Anyone in the workspace can join.
                </p>
            </div>
        </div>
    );
}
