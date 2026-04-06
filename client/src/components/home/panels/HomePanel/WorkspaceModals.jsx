import React from 'react';
import InvitePeopleModal from "../../../InvitePeopleModal";
import { X } from 'lucide-react';

// Shared modal shell styles
const modalOverlay = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
    zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--font)',
};
const modalBox = {
    background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
    borderRadius: '2px', width: '380px', padding: '24px', position: 'relative',
};
const labelStyle = {
    display: 'block', fontSize: '10px', fontWeight: 700,
    color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px',
};
const inputStyle = {
    width: '100%', padding: '9px 12px', background: 'var(--bg-input)',
    border: '1px solid var(--border-default)', borderRadius: '2px', fontSize: '13px',
    color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)', boxSizing: 'border-box',
};

const WorkspaceModals = ({
    showRenameModal, setShowRenameModal, newName, setNewName, handleRename,
    showInviteModal, setShowInviteModal, workspaceName, activeWorkspace,
}) => (
    <>
        {/* Rename Modal */}
        {showRenameModal && (
            <div style={modalOverlay} onClick={e => { if (e.target === e.currentTarget) setShowRenameModal(false); }}>
                <div style={modalBox}>
                    {/* Close */}
                    <button onClick={() => setShowRenameModal(false)}
                        style={{ position: 'absolute', top: '14px', right: '14px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '3px', borderRadius: '2px', transition: '150ms ease' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                        <X size={16} />
                    </button>

                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                        Rename Workspace
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.6 }}>
                        Choose a new name for your team&apos;s workspace. This will be visible to everyone.
                    </p>

                    <label style={labelStyle}>Workspace Name</label>
                    <input
                        type="text" value={newName}
                        onChange={e => setNewName(e.target.value)}
                        style={{ ...inputStyle, marginBottom: '20px' }}
                        placeholder="e.g. Chttrix" autoFocus
                        onFocus={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
                        onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                    />

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button onClick={() => setShowRenameModal(false)}
                            style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', background: 'none', border: '1px solid var(--border-default)', borderRadius: '2px', cursor: 'pointer', fontFamily: 'var(--font)', transition: '150ms ease' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                            Cancel
                        </button>
                        <button onClick={handleRename}
                            style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--accent)', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', borderRadius: '2px', cursor: 'pointer', fontFamily: 'var(--font)', transition: '150ms ease' }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--text-muted)'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
                        >
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Invite Modal */}
        <InvitePeopleModal
            isOpen={showInviteModal}
            onClose={() => setShowInviteModal(false)}
            workspaceId={activeWorkspace?.id}
            workspaceName={workspaceName}
        />
    </>
);

export default WorkspaceModals;
