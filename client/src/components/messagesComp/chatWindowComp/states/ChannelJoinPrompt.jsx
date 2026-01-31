// client/src/components/messagesComp/chatWindowComp/states/ChannelJoinPrompt.jsx

// ⚠️ UI-ONLY COMPONENT
// Do NOT add business logic, socket handlers, or state management here.
// This component must remain props-only.

import { Lock } from 'lucide-react';

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
            backgroundColor: 'var(--bg-primary)'
        }}>
            {/* Lock Icon */}
            <div style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '2.5rem',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                boxShadow: '0 8px 32px rgba(59, 130, 246, 0.1)',
                animation: 'pulse 3s infinite'
            }}>
                <Lock size={48} style={{ color: '#3B82F6', filter: 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.2))' }} />
            </div>

            {/* Message */}
            <h2 style={{
                color: 'var(--text-primary)',
                fontSize: '2rem',
                fontWeight: '700',
                marginBottom: '1rem',
                textAlign: 'center',
                letterSpacing: '-0.025em'
            }}>
                You're not a member of this channel
            </h2>

            <p style={{
                color: 'var(--text-secondary)',
                fontSize: '1.1rem',
                marginBottom: '3rem',
                maxWidth: '500px',
                textAlign: 'center',
                lineHeight: '1.6'
            }}>
                Would you like to join <strong>{chatName}</strong> to start viewing and sending messages?
            </p>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', width: '100%', maxWidth: '400px', justifyContent: 'center' }}>
                <button
                    onClick={onJoinChannel}
                    disabled={isJoining}
                    style={{
                        flex: 1,
                        padding: '1rem 0',
                        backgroundColor: isJoining ? '#9CA3AF' : '#3B82F6',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '1rem',
                        fontWeight: '600',
                        cursor: isJoining ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        opacity: isJoining ? 0.7 : 1,
                        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                    }}
                    onMouseOver={(e) => {
                        if (!isJoining) {
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.backgroundColor = '#2563EB';
                            e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
                        }
                    }}
                    onMouseOut={(e) => {
                        if (!isJoining) {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.backgroundColor = '#3B82F6';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                        }
                    }}
                >
                    {isJoining ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Joining...</span>
                        </>
                    ) : 'Join Channel'}
                </button>

                <button
                    onClick={onIgnore}
                    disabled={isJoining}
                    style={{
                        flex: 1,
                        padding: '1rem 0',
                        backgroundColor: 'transparent',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        fontSize: '1rem',
                        fontWeight: '500',
                        cursor: isJoining ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                        if (!isJoining) {
                            e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                            e.currentTarget.style.borderColor = 'var(--text-secondary)';
                        }
                    }}
                    onMouseOut={(e) => {
                        if (!isJoining) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.borderColor = 'var(--border-color)';
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
