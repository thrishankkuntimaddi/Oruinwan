import React from 'react';
import { Info } from 'lucide-react';
import SettingSwitch from '../../ui/SettingSwitch';

const TOGGLES = [
    { key: 'allowMemberChannelCreation', label: 'Channel Creation',        sub: 'Allow members to create new channels' },
    { key: 'allowMemberInvite',          label: 'Invite Members',          sub: 'Allow members to invite new people' },
    { key: 'requireAdminApproval',       label: 'Admin Approval Required', sub: 'Require admin approval for new members' },
    { key: 'isDiscoverable',             label: 'Workspace Discoverable',  sub: 'Make workspace visible in search' },
];

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
                    <div style={{ paddingRight: '16px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '2px' }}>{label}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{sub}</div>
                    </div>
                    <SettingSwitch
                        checked={!!permissions[key]}
                        onChange={(val) => handlePermissionChange(key, val)}
                        disabled={savingPermissions || !isAdmin}
                        label={label}
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
