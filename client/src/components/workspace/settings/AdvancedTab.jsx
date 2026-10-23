import React, { useState } from 'react';
import { AlertTriangle, Archive, Crown, Lock, Trash2 } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../../contexts/ToastContext';
import { Panel, Btn, Confirm, Dialog, Field, SelectBox, EmptyState, errorMessage } from '../../ui/page';

/** Active members other than me who could become the owner. */
export function ownerCandidates(members = []) {
    return members.filter((m) => !m.isCurrentUser && (m.memberStatus || 'active') === 'active' && m.role !== 'owner');
}

function DangerRow({ icon: Icon, title, text, action, last }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: last ? 'none' : '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
            <Icon size={16} style={{ color: 'var(--state-danger)', flexShrink: 0 }} />
            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.5 }}>{text}</div>
            </div>
            {action}
        </div>
    );
}

/**
 * Danger zone (owner only; the server enforces the same): hand the workspace to someone else,
 * archive it (hidden for everyone, restorable by the owner from the workspace list), or delete it.
 */
const AdvancedTab = ({ isOwner, workspace, members = [], setShowDeleteConfirm, onChanged }) => {
    const { showToast } = useToast();
    const [transferOpen, setTransferOpen] = useState(false);
    const [newOwner, setNewOwner] = useState('');
    const [confirmTransfer, setConfirmTransfer] = useState(false);
    const [confirmArchive, setConfirmArchive] = useState(false);
    const [busy, setBusy] = useState(null);
    const personal = workspace?.type === 'personal' || workspace?.isPersonal;
    const candidates = ownerCandidates(members);
    const picked = candidates.find((m) => String(m.id) === String(newOwner));

    if (!isOwner) {
        return (
            <Panel>
                <EmptyState icon={Lock} title="Owner only" text="Only the workspace owner can transfer, archive or delete this workspace." />
            </Panel>
        );
    }

    const transfer = async () => {
        setBusy('transfer');
        try {
            await api.post(`/api/workspaces/${workspace.id}/transfer-ownership`, { userId: newOwner });
            showToast(`${picked?.name || 'They'} now own${picked ? 's' : ''} ${workspace.name}. You are an admin.`, 'success');
            setConfirmTransfer(false);
            setTransferOpen(false);
            onChanged?.('transferred');
        } catch (err) {
            showToast(errorMessage(err, 'Could not transfer ownership'), 'error');
        } finally {
            setBusy(null);
        }
    };

    const archive = async () => {
        setBusy('archive');
        try {
            await api.post(`/api/workspaces/${workspace.id}/archive`);
            showToast(`${workspace.name} is archived. Restore it any time from your workspace list.`, 'success');
            setConfirmArchive(false);
            onChanged?.('archived');
        } catch (err) {
            showToast(errorMessage(err, 'Could not archive the workspace'), 'error');
        } finally {
            setBusy(null);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Panel flush title="Danger zone" icon={AlertTriangle} style={{ borderColor: 'var(--state-danger)' }}>
                <DangerRow
                    icon={Crown}
                    title="Transfer ownership"
                    text={personal ? 'A personal workspace stays yours.' : 'Give this workspace to another member. You stay on as an admin.'}
                    action={<Btn size="sm" onClick={() => setTransferOpen(true)} disabled={personal || candidates.length === 0}
                        title={candidates.length === 0 ? 'Invite someone first' : undefined}>Transfer…</Btn>}
                />
                <DangerRow
                    icon={Archive}
                    title="Archive workspace"
                    text={personal ? 'A personal workspace can’t be archived.' : 'Hide it for everyone and stop all activity. Nothing is deleted; you can restore it from your workspace list.'}
                    action={<Btn size="sm" onClick={() => setConfirmArchive(true)} disabled={personal}>Archive…</Btn>}
                />
                <DangerRow
                    icon={Trash2}
                    title="Delete workspace"
                    text="Permanently removes every channel, message, file and task. This can’t be undone."
                    action={<Btn size="sm" variant="danger" onClick={() => setShowDeleteConfirm(true)}>Delete…</Btn>}
                    last
                />
            </Panel>

            <Dialog
                open={transferOpen}
                title="Transfer ownership"
                lead="The new owner can delete or archive the workspace and manage admins. You become an admin."
                size="sm"
                onClose={() => setTransferOpen(false)}
                footer={(
                    <>
                        <Btn variant="ghost" onClick={() => setTransferOpen(false)}>Cancel</Btn>
                        <Btn variant="primary" disabled={!picked} onClick={() => setConfirmTransfer(true)}>Continue</Btn>
                    </>
                )}
            >
                <Field label="New owner">
                    <SelectBox value={newOwner} onChange={setNewOwner} label="New owner" style={{ width: '100%' }}>
                        <option value="">Choose a member…</option>
                        {candidates.map((m) => <option key={m.id} value={m.id}>{m.name}{m.role === 'admin' ? ' (admin)' : ''}</option>)}
                    </SelectBox>
                </Field>
            </Dialog>

            <Confirm
                open={confirmTransfer}
                title={`Make ${picked?.name || 'them'} the owner?`}
                confirmLabel="Transfer ownership"
                tone="danger"
                busy={busy === 'transfer'}
                onConfirm={transfer}
                onClose={() => setConfirmTransfer(false)}
            >
                You will no longer be the owner of {workspace?.name}. Only the new owner can give it back.
            </Confirm>

            <Confirm
                open={confirmArchive}
                title={`Archive ${workspace?.name}?`}
                confirmLabel="Archive workspace"
                tone="danger"
                busy={busy === 'archive'}
                onConfirm={archive}
                onClose={() => setConfirmArchive(false)}
            >
                Members lose access until you restore it. Messages, files and tasks are kept.
            </Confirm>
        </div>
    );
};

export default AdvancedTab;
