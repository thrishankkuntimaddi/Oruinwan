import React, { useMemo, useState } from 'react';
import { Shield, RefreshCw, Save, Undo2 } from 'lucide-react';
import api from '@services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
    DashPage, PageHead, Btn, RoleChip, ErrorState, EmptyState, LoadingState, Chip, useAsync, errorMessage,
} from '../../components/company-dash/dashUi';
import { isOwnerUser } from '../../components/company-dash/dashNav';
import { companyIdOf, Switch } from './wosShared';

const ROLES = ['owner', 'admin', 'manager', 'member', 'guest'];
const MODULES = [
    { group: 'Company', keys: ['manageCompany', 'viewAnalytics', 'manageBilling'] },
    { group: 'People', keys: ['inviteUsers', 'removeUsers', 'manageRoles'] },
    { group: 'Workspaces', keys: ['createWorkspace', 'deleteWorkspace', 'manageWorkspaceMembers'] },
    { group: 'Channels', keys: ['createChannel', 'deleteChannel', 'manageChannelMembers'] },
    { group: 'Messages', keys: ['sendMessages', 'deleteMessages', 'pinMessages'] },
    { group: 'Tasks', keys: ['createTasks', 'assignTasks', 'deleteTasks'] },
    { group: 'Notes', keys: ['createNotes', 'shareNotes'] },
    { group: 'Updates', keys: ['postUpdates', 'deleteUpdates'] },
];
const LABELS = {
    manageCompany: 'Manage company', viewAnalytics: 'View analytics', manageBilling: 'Billing',
    inviteUsers: 'Invite people', removeUsers: 'Remove people', manageRoles: 'Change roles',
    createWorkspace: 'Create workspaces', deleteWorkspace: 'Delete workspaces', manageWorkspaceMembers: 'Workspace members',
    createChannel: 'Create channels', deleteChannel: 'Delete channels', manageChannelMembers: 'Channel members',
    sendMessages: 'Send messages', deleteMessages: 'Delete messages', pinMessages: 'Pin messages',
    createTasks: 'Create tasks', assignTasks: 'Assign tasks', deleteTasks: 'Delete tasks',
    createNotes: 'Create notes', shareNotes: 'Share notes',
    postUpdates: 'Post updates', deleteUpdates: 'Delete updates',
};
const clone = (m) => JSON.parse(JSON.stringify(m || {}));

/**
 * What each company role may do. The owner row is fixed; only the owner (or a
 * co-owner) can change the admin row, matching the server rule.
 */
export default function PermissionMatrixPage({ companyId: propCompanyId }) {
    const { user } = useAuth();
    const { showToast } = useToast();
    const companyId = propCompanyId || companyIdOf(user);
    const owner = isOwnerUser(user);
    const [draft, setDraft] = useState(null);
    const [saving, setSaving] = useState(false);

    const { data, loading, error, reload } = useAsync(
        () => api.get('/api/permissions/matrix', { params: { companyId } }).then((r) => { setDraft(clone(r.data?.matrix)); return r.data?.matrix || {}; }),
        [companyId],
        { enabled: !!companyId },
    );

    const locked = (role) => role === 'owner' || (role === 'admin' && !owner);
    const changedRoles = useMemo(() => ROLES.filter((r) => draft && data && JSON.stringify(draft[r] || {}) !== JSON.stringify(data[r] || {})), [draft, data]);
    const changes = useMemo(() => {
        let n = 0;
        changedRoles.forEach((r) => Object.keys(draft[r] || {}).forEach((k) => { if (!!draft[r][k] !== !!data[r]?.[k]) n += 1; }));
        return n;
    }, [changedRoles, draft, data]);

    const set = (role, key, v) => setDraft((d) => ({ ...d, [role]: { ...(d[role] || {}), [key]: v } }));

    const save = async () => {
        setSaving(true);
        try {
            const updates = Object.fromEntries(changedRoles.filter((r) => !locked(r)).map((r) => [r, draft[r]]));
            const res = await api.put('/api/permissions/matrix', { companyId, updates });
            showToast('Permissions saved', 'success');
            const next = res.data?.matrix || draft;
            setDraft(clone(next));
            reload();
        } catch (err) {
            showToast(errorMessage(err, 'Could not save permissions'), 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Governance"
                    title="Permission matrix"
                    lead="What each company role can do. Changes apply to everyone with that role."
                    actions={(
                        <>
                            {changes > 0 && <Chip tone="accent">{changes} unsaved</Chip>}
                            {changes > 0 && <Btn variant="ghost" icon={Undo2} onClick={() => setDraft(clone(data))} disabled={saving}>Discard</Btn>}
                            {changes === 0 && <Btn icon={RefreshCw} loading={loading} onClick={reload}>Refresh</Btn>}
                            <Btn variant="primary" icon={Save} loading={saving} disabled={!changes} onClick={save}>Save changes</Btn>
                        </>
                    )}
                />
            )}
        >
            {!companyId ? (
                <EmptyState icon={Shield} title="No company" />
            ) : error && !data ? (
                <ErrorState message={error} onRetry={reload} />
            ) : !data || !draft ? (
                <LoadingState label="Loading permissions…" />
            ) : (
                <>
                    <p className="cd-muted" style={{ margin: 0, fontSize: 12 }}>
                        Owner permissions can't be changed.{owner ? '' : ' Only the owner can change what admins may do.'}
                    </p>
                    <div className="gl-card wo-matrix-wrap" style={{ maxHeight: 'calc(100dvh - 260px)' }}>
                        <table className="wo-matrix">
                            <caption className="sr-only">Permissions by role</caption>
                            <thead>
                                <tr>
                                    <th scope="col">Permission</th>
                                    {ROLES.map((r) => <th key={r} scope="col"><RoleChip role={r} /></th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {MODULES.map((m) => (
                                    <React.Fragment key={m.group}>
                                        <tr className="wo-group"><th colSpan={ROLES.length + 1} scope="colgroup">{m.group}</th></tr>
                                        {m.keys.map((k) => (
                                            <tr key={k}>
                                                <th scope="row">{LABELS[k] || k}</th>
                                                {ROLES.map((r) => {
                                                    const on = !!draft[r]?.[k];
                                                    const changed = on !== !!data[r]?.[k];
                                                    return (
                                                        <td key={r} data-changed={changed ? 'true' : undefined}>
                                                            <Switch
                                                                checked={on}
                                                                disabled={locked(r) || saving}
                                                                label={`${LABELS[k] || k} for ${r}`}
                                                                title={r === 'owner' ? 'Owner permissions are fixed' : locked(r) ? 'Only the owner can change admin permissions' : undefined}
                                                                onChange={(v) => set(r, k, v)}
                                                            />
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </DashPage>
    );
}
