import React, { useEffect, useMemo, useState } from 'react';
import { Lock, RefreshCw, Save } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../components/company-dash/dashNav';
import {
    DashPage, PageHead, Panel, Toolbar, FilterTabs, SelectBox, Btn, Chip, Field,
    ErrorState, EmptyState, LoadingState, useAsync, errorMessage,
} from '../../components/company-dash/dashUi';
import { Switch } from '../workspace-os/wosShared';

const FEATURES = [
    { key: 'tasks', label: 'Tasks', desc: 'Create and assign tasks' },
    { key: 'notes', label: 'Notes', desc: 'Collaborative notes' },
    { key: 'polls', label: 'Polls', desc: 'Polls in channels' },
    { key: 'ai', label: 'AI assistant', desc: 'Smart replies and AI tools' },
    { key: 'huddles', label: 'Huddles', desc: 'Voice and video huddles' },
    { key: 'fileUploads', label: 'File uploads', desc: 'Share files in channels' },
    { key: 'reactions', label: 'Reactions', desc: 'Emoji reactions on messages' },
    { key: 'threads', label: 'Threads', desc: 'Threaded replies' },
    { key: 'bookmarks', label: 'Bookmarks', desc: 'Save messages for later' },
    { key: 'reminders', label: 'Reminders', desc: 'Message reminders' },
];
const ROLE_OPTIONS = [
    { value: 'owner', label: 'Owners only' },
    { value: 'admin', label: 'Admins and owners' },
    { value: 'member', label: 'All members' },
];

/**
 * Per-workspace feature toggles and who may invite / create channels. Lists the
 * company's workspaces; changes need workspace-admin rights in that workspace.
 */
export default function WorkspacePermissions({ workspaceId: propWorkspaceId }) {
    const { showToast } = useToast();
    const { user } = useAuth();
    const queryWs = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('workspaceId') : null;
    const [wsId, setWsId] = useState(propWorkspaceId || queryWs || '');
    const [tab, setTab] = useState('features');
    const [roles, setRoles] = useState(null);
    const [savingKey, setSavingKey] = useState(null);
    const [savingRoles, setSavingRoles] = useState(false);

    const company = useAsync(() => api.get('/api/admin-dashboard/workspaces').then((r) => r.data?.workspaces || []));
    const mine = useAsync(() => api.get('/api/workspaces/my').then((r) => r.data?.workspaces || []));
    const myRole = useMemo(() => Object.fromEntries((mine.data || []).map((w) => [String(w.id), w.role])), [mine.data]);
    const workspaces = useMemo(() => {
        const list = (company.data || []).map((w) => ({ id: String(w._id), name: w.name }));
        // Fall back to the user's own workspaces if the company list is unavailable.
        if (!list.length && mine.data) return mine.data.map((w) => ({ id: String(w.id), name: w.name }));
        return list;
    }, [company.data, mine.data]);

    useEffect(() => { if (!wsId && workspaces.length) setWsId(workspaces[0].id); }, [wsId, workspaces]);

    const perms = useAsync(
        () => api.get(`/api/workspaces/${wsId}/permissions`).then((r) => r.data?.permissions),
        [wsId],
        { enabled: !!wsId },
    );
    useEffect(() => {
        if (perms.data) setRoles({ invitePermission: perms.data.invitePermission, channelCreationPermission: perms.data.channelCreationPermission });
    }, [perms.data]);

    const role = myRole[wsId];
    // Company owners/admins manage every company workspace; otherwise the workspace role decides.
    const canEdit = isAdminUser(user) || role === 'owner' || role === 'admin';
    const rolesDirty = perms.data && roles && (roles.invitePermission !== perms.data.invitePermission || roles.channelCreationPermission !== perms.data.channelCreationPermission);

    const toggle = async (key, value) => {
        const prev = perms.data;
        const featureToggles = { ...(prev?.featureToggles || {}), [key]: value };
        perms.setData({ ...prev, featureToggles });
        setSavingKey(key);
        try {
            await api.put(`/api/workspaces/${wsId}/features`, { featureToggles });
            showToast(`${FEATURES.find((f) => f.key === key)?.label} ${value ? 'on' : 'off'}`, 'success');
        } catch (err) {
            perms.setData(prev);
            showToast(errorMessage(err, 'Could not change that feature'), 'error');
        } finally {
            setSavingKey(null);
        }
    };

    const saveRoles = async () => {
        setSavingRoles(true);
        try {
            await api.put(`/api/workspaces/${wsId}/permissions`, roles);
            perms.setData((p) => ({ ...p, ...roles }));
            showToast('Permissions saved', 'success');
        } catch (err) {
            showToast(errorMessage(err, 'Could not save permissions'), 'error');
        } finally {
            setSavingRoles(false);
        }
    };

    const loadingList = (company.loading || mine.loading) && !workspaces.length;

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Collaboration"
                    title="Workspace permissions"
                    lead="Turn features on or off per workspace and choose who can invite people or create channels."
                    actions={wsId && <Btn icon={RefreshCw} loading={perms.loading} onClick={perms.reload}>Refresh</Btn>}
                />
            )}
        >
            {loadingList ? (
                <LoadingState label="Loading workspaces…" />
            ) : !workspaces.length ? (
                company.error ? <ErrorState message={company.error} onRetry={company.reload} /> : <EmptyState icon={Lock} title="No workspaces yet" text="Create a workspace first, then manage its permissions here." />
            ) : (
                <>
                    <Toolbar>
                        <SelectBox value={wsId} onChange={(v) => { setWsId(v); setRoles(null); }} label="Workspace" style={{ maxWidth: 280 }}>
                            {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </SelectBox>
                        {role ? <Chip tone={canEdit ? 'accent' : undefined}>You: workspace {role}</Chip> : <Chip>Not a member</Chip>}
                        <span className="cd-toolbar-spacer" />
                        <FilterTabs
                            value={tab}
                            onChange={setTab}
                            label="Permission type"
                            options={[{ value: 'features', label: 'Features' }, { value: 'roles', label: 'Roles' }]}
                        />
                    </Toolbar>

                    {!canEdit && perms.data && (
                        <p className="cd-muted" style={{ margin: 0, fontSize: 12 }}>
                            You can view these settings. Only this workspace's owners and admins can change them.
                        </p>
                    )}

                    {perms.error && !perms.data ? (
                        <ErrorState
                            message={perms.error}
                            onRetry={perms.reload}
                        />
                    ) : !perms.data ? (
                        <LoadingState />
                    ) : tab === 'features' ? (
                        <Panel flush title="Features" icon={Lock}>
                            <div className="wo-rows">
                                {FEATURES.map((f) => (
                                    <div key={f.key} className="wo-row" data-testid={`ws-feature-${f.key}`}>
                                        <div className="wo-row-text">
                                            <div className="wo-row-title">{f.label}</div>
                                            <div className="wo-row-desc">{f.desc}</div>
                                        </div>
                                        <Switch
                                            label={f.label}
                                            checked={perms.data.featureToggles?.[f.key] !== false}
                                            disabled={!canEdit || savingKey === f.key}
                                            onChange={(v) => toggle(f.key, v)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </Panel>
                    ) : (
                        <Panel title="Roles" icon={Lock}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520 }}>
                                <Field label="Who can invite people" hint="Minimum workspace role that can create invites.">
                                    <SelectBox value={roles?.invitePermission || 'admin'} onChange={(v) => setRoles((r) => ({ ...r, invitePermission: v }))} label="Who can invite people">
                                        {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value} disabled={!canEdit}>{o.label}</option>)}
                                    </SelectBox>
                                </Field>
                                <Field label="Who can create channels" hint="Minimum workspace role that can create channels.">
                                    <SelectBox value={roles?.channelCreationPermission || 'member'} onChange={(v) => setRoles((r) => ({ ...r, channelCreationPermission: v }))} label="Who can create channels">
                                        {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value} disabled={!canEdit}>{o.label}</option>)}
                                    </SelectBox>
                                </Field>
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                    {rolesDirty && <Btn variant="ghost" onClick={() => setRoles({ invitePermission: perms.data.invitePermission, channelCreationPermission: perms.data.channelCreationPermission })}>Discard</Btn>}
                                    <Btn variant="primary" icon={Save} loading={savingRoles} disabled={!canEdit || !rolesDirty} onClick={saveRoles}>Save</Btn>
                                </div>
                            </div>
                        </Panel>
                    )}
                </>
            )}
        </DashPage>
    );
}
