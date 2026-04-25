import React from 'react';
import { Info } from 'lucide-react';

const TOGGLES = [
    { key: 'allowMemberChannelCreation', label: 'Channel Creation',        sub: 'Allow members to create new channels' },
    { key: 'allowMemberInvite',          label: 'Invite Members',          sub: 'Allow members to invite new people' },
    { key: 'requireAdminApproval',       label: 'Admin Approval Required', sub: 'Require admin approval for new members' },
    { key: 'isDiscoverable',             label: 'Workspace Discoverable',  sub: 'Make workspace visible in search' },
];

const Toggle = ({ checked, onChange, disabled }) => (
    <button
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        style={{
            width: '36px', height: '20px', borderRadius: '10px', position: 'relative', flexShrink: 0,
            background: checked ? 'var(--accent)' : 'var(--bg-hover)',
            border: `1px solid ${checked ? 'var(--accent)' : 'var(--border-default)'}`,
            cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
            transition: '150ms ease', outline: 'none',
        }}
    >
        <span style={{
            position: 'absolute', top: '2px',
            left: checked ? '17px' : '2px',
            width: '14px', height: '14px', borderRadius: '50%',
            background: '#fff', transition: '150ms ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
    </button>
);

const PermissionsTab = ({ isAdmin, permissions, savingPermissions, handlePermissionChange }) => (
    <div style={{ fontFamily: 'var(--font)' }}>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Control what members can do in this workspace.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
            {TOGGLES.map(({ key, label, sub }, i) => (
                <div key={key} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 0',
                    borderBottom: i < TOGGLES.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}>
                    <div>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '2px' }}>{label}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sub}</div>
                    </div>
                    <Toggle
                        checked={!!permissions[key]}
                        onChange={(val) => handlePermissionChange(key, val)}
                        disabled={savingPermissions || !isAdmin}
                    />
                </div>
            ))}
        </div>

        {!isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px', marginTop: '16px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', borderRadius: '2px' }}>
                <Info size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Note:</strong> Only workspace administrators can change permissions.
                </p>
            </div>
        )}
    </div>
);

export default PermissionsTab;
