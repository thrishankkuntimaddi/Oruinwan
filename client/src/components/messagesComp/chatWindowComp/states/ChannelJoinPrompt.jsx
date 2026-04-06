// client/src/components/messagesComp/chatWindowComp/states/ChannelJoinPrompt.jsx

// ⚠️ UI-ONLY COMPONENT
// Do NOT add business logic, socket handlers, or state management here.
// This component must remain props-only.

import { Lock, Loader2 } from 'lucide-react';

const FONT = 'Inter, system-ui, -apple-system, sans-serif';

/**
 * ChannelJoinPrompt - Gate screen for non-members viewing discoverable public channels
 * @param {string} chatName - Name of the channel
 * @param {boolean} isJoining - Whether join operation is in progress
 * @param {function} onJoinChannel - Join button click handler
 * @param {function} onIgnore - Ignore button click handler
 */
function ChannelJoinPrompt({ chatName, isJoining, onJoinChannel, onIgnore }) {
    return (
        <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-primary)',
            fontFamily: FONT,
        }}>
            {/* Lock Icon */}
            <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '2px',
                backgroundColor: 'rgba(184,149,106,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '2rem',
                border: '1px solid var(--border-accent)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}>
                <Lock size={36} style={{ color: 'var(--accent)' }} />
            </div>

            {/* Message */}
            <h2 style={{
                color: 'var(--text-primary)',
                fontSize: '1.25rem',
                fontWeight: 700,
                marginBottom: '0.75rem',
                textAlign: 'center',
                letterSpacing: '-0.02em',
                fontFamily: FONT,
            }}>
                You're not a member of this channel
            </h2>

            <p style={{
                color: 'var(--text-muted)',
                fontSize: '13px',
                marginBottom: '2.5rem',
                maxWidth: '420px',
                textAlign: 'center',
                lineHeight: 1.65,
                fontFamily: FONT,
            }}>
                Would you like to join <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{chatName}</strong> to start viewing and sending messages?
            </p>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%', maxWidth: '340px' }}>
                <button
                    onClick={onJoinChannel}
                    disabled={isJoining}
                    style={{
                        flex: 1,
                        padding: '9px 0',
                        backgroundColor: isJoining ? 'var(--bg-active)' : 'var(--accent)',
                        color: isJoining ? 'var(--text-muted)' : '#0c0c0c',
                        border: 'none',
                        borderRadius: '2px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: isJoining ? 'not-allowed' : 'pointer',
                        transition: '150ms ease',
                        opacity: isJoining ? 0.65 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '7px',
                        fontFamily: FONT,
                        outline: 'none',
                    }}
                    onMouseEnter={e => { if (!isJoining) e.currentTarget.style.backgroundColor = 'var(--accent-hover)'; }}
                    onMouseLeave={e => { if (!isJoining) e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
                >
                    {isJoining ? (
                        <>
                            <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
                            <span>Joining...</span>
                        </>
                    ) : 'Join Channel'}
                </button>

                <button
                    onClick={onIgnore}
                    disabled={isJoining}
                    style={{
                        flex: 1,
                        padding: '9px 0',
                        backgroundColor: 'transparent',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '2px',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: isJoining ? 'not-allowed' : 'pointer',
                        transition: '150ms ease',
                        fontFamily: FONT,
                        outline: 'none',
                    }}
                    onMouseEnter={e => {
                        if (!isJoining) {
                            e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                            e.currentTarget.style.borderColor = 'var(--border-accent)';
                            e.currentTarget.style.color = 'var(--text-primary)';
                        }
                    }}
                    onMouseLeave={e => {
                        if (!isJoining) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.borderColor = 'var(--border-default)';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                        }
                    }}
                >
                    Ignore
                </button>
            </div>
        </div>
    );
}

export default ChannelJoinPrompt;
