import React, { useMemo, useState } from 'react';
import { UserPlus, UserCheck, RefreshCw } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';
import {
    DashPage, PageHead, Toolbar, SearchBox, DataTable, Chip, Btn, Avatar, Dialog, Field, SelectBox,
    ErrorState, EmptyState, LoadingState, useAsync, errorMessage, timeAgo,
} from '../company-dash/dashUi';
import { useDepartment, DepartmentGate } from './managerScope';

/**
 * Department members who are not in any workspace yet. "Assign" adds them to a
 * workspace the viewer administers (POST /api/managers/allocations/update).
 */
export default function UnassignedMembers() {
    const scope = useDepartment();
    const { departmentId, department } = scope;
    const { showToast } = useToast();
    const [q, setQ] = useState('');
    const [target, setTarget] = useState(null);
    const [wsId, setWsId] = useState('');
    const [saving, setSaving] = useState(false);

    const { data, loading, error, reload, setData } = useAsync(
        () => api.get(`/api/manager/dashboard/unassigned/${departmentId}`).then((r) => r.data?.unassigned || []),
        [departmentId],
        { enabled: !!departmentId },
    );
    // Workspaces the viewer can add people to (owner/admin of the workspace).
    const workspaces = useAsync(
        () => api.get('/api/workspaces/my').then((r) => (r.data?.workspaces || []).filter((w) => ['owner', 'admin'].includes(w.role))),
    );

    const rows = useMemo(() => {
        const s = q.trim().toLowerCase();
        return (data || []).filter((m) => !s || m.username?.toLowerCase().includes(s) || m.email?.toLowerCase().includes(s));
    }, [data, q]);

    const openAssign = (m) => { setTarget(m); setWsId(workspaces.data?.[0]?.id || workspaces.data?.[0]?._id || ''); };
    const assign = async () => {
        if (!target || !wsId) return;
        setSaving(true);
        try {
            await api.post('/api/managers/allocations/update', { userId: target._id, workspaceId: wsId, action: 'add' });
            const ws = (workspaces.data || []).find((w) => String(w.id || w._id) === String(wsId));
            showToast(`${target.username} added to ${ws?.name || 'the workspace'}`, 'success');
            setData((list) => (list || []).filter((m) => m._id !== target._id));
            setTarget(null);
        } catch (err) {
            showToast(errorMessage(err, 'Could not add them to the workspace'), 'error');
        } finally {
            setSaving(false);
        }
    };

    const canAssign = (workspaces.data || []).length > 0;
    const columns = [
        {
            key: 'member', label: 'Member', render: (m) => (
                <div className="cd-cell-user">
                    <Avatar user={m} size="sm" />
                    <div>
                        <div className="cd-cell-title">{m.username}</div>
                        <div className="cd-cell-sub">{m.email}</div>
                    </div>
                </div>
            ),
        },
        {
            key: 'depts', label: 'Departments', className: 'cd-hide-sm', render: (m) => (m.departments || []).length
                ? <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{m.departments.map((d) => <Chip key={d._id || d.name}>{d.name}</Chip>)}</div>
                : <span className="cd-muted">None</span>,
        },
        { key: 'joined', label: 'Joined', className: 'cd-hide-sm', render: (m) => <span className="cd-muted">{timeAgo(m.createdAt)}</span> },
        {
            key: 'act', label: '', render: (m) => (
                <Btn
                    size="sm"
                    icon={UserPlus}
                    onClick={() => openAssign(m)}
                    disabled={!canAssign}
                    title={canAssign ? undefined : 'You need to be an admin of a workspace to add people to it'}
                >
                    Assign
                </Btn>
            ),
        },
    ];

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Manager console"
                    title="Unassigned members"
                    lead={`People${department?.name ? ` in ${department.name}` : ''} who aren't in any workspace yet.`}
                    actions={departmentId && <Btn icon={RefreshCw} loading={loading} onClick={reload}>Refresh</Btn>}
                />
            )}
        >
            <DepartmentGate scope={scope}>
                {error && !data ? (
                    <ErrorState message={error} onRetry={reload} />
                ) : !data ? (
                    <LoadingState label="Loading members…" />
                ) : data.length === 0 ? (
                    <EmptyState icon={UserCheck} title="Everyone is placed" text="Every member of this department is in at least one workspace." />
                ) : (
                    <>
                        <Toolbar>
                            <SearchBox value={q} onChange={setQ} placeholder="Search members…" />
                            <span className="cd-muted" style={{ fontSize: 12 }}>{data.length} not in a workspace</span>
                        </Toolbar>
                        {!workspaces.loading && !canAssign && (
                            <p className="cd-muted" style={{ margin: 0, fontSize: 12 }}>
                                You aren't an admin of any workspace, so you can't add people yet. Ask a workspace admin to invite them.
                            </p>
                        )}
                        <DataTable columns={columns} rows={rows} empty={<EmptyState title="No matches" text={`No member matches “${q}”.`} />} />
                    </>
                )}
            </DepartmentGate>

            <Dialog
                open={!!target}
                title="Add to a workspace"
                lead={target ? `${target.username} will join the workspace as a member.` : undefined}
                onClose={() => setTarget(null)}
                busy={saving}
                size="sm"
                footer={(
                    <>
                        <Btn variant="ghost" onClick={() => setTarget(null)} disabled={saving}>Cancel</Btn>
                        <Btn variant="primary" loading={saving} disabled={!wsId} onClick={assign}>Add to workspace</Btn>
                    </>
                )}
            >
                <Field label="Workspace">
                    <SelectBox value={wsId} onChange={setWsId} label="Workspace">
                        {(workspaces.data || []).map((w) => <option key={w.id || w._id} value={w.id || w._id}>{w.name}</option>)}
                    </SelectBox>
                </Field>
            </Dialog>
        </DashPage>
    );
}
