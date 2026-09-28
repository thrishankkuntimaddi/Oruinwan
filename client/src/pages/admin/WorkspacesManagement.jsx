import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus, Users, Hash, Calendar, Briefcase, Rocket, Zap, Palette, Globe, Trophy, Target, Flame, Microscope, Shield, Lightbulb, Sparkles, ArrowUpRight, Archive,
} from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import CreateWorkspaceModal from '../workspaceSelectComponents/CreateWorkspaceModal';
import WorkspaceMembersModal from './WorkspaceMembersModal';
import {
    DashPage, PageHead, KpiGrid, Kpi, Toolbar, SearchBox, FilterTabs, Btn, Chip, Grid, LoadingState, ErrorState, EmptyState, useAsync, errorMessage, timeAgo,
} from '../../components/company-dash/dashUi';
import './admin.css';

const ICON_MAP = { rocket: Rocket, briefcase: Briefcase, zap: Zap, palette: Palette, globe: Globe, trophy: Trophy, target: Target, flame: Flame, microscope: Microscope, shield: Shield, lightbulb: Lightbulb, sparkles: Sparkles };
const getIconComponent = (name) => ICON_MAP[name] || Globe;
const DEFAULT_CREATE_DATA = { name: '', rules: '', icon: 'rocket', color: '#b8956a', invites: '' };
const STATUS_TONE = { active: 'success', archived: 'warning', inactive: undefined };

const WorkspacesManagement = () => {
    const { showToast } = useToast();
    const { user } = useAuth();
    const navigate = useNavigate();
    const { canManageWorkspace } = usePermissions();
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('all');
    const [modalOpen, setModalOpen] = useState(false);
    const [createStep, setCreateStep] = useState(1);
    const [createData, setCreateData] = useState(DEFAULT_CREATE_DATA);
    const [nameError, setNameError] = useState('');
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [creating, setCreating] = useState(false);
    const [membersWorkspace, setMembersWorkspace] = useState(null);

    const { data, loading, error, reload, setData } = useAsync(
        () => api.get('/api/admin-dashboard/workspaces').then((r) => r.data.workspaces || []),
        [],
    );
    const workspaces = useMemo(() => data || [], [data]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return workspaces.filter((ws) => (status === 'all' || (ws.status || 'active') === status)
            && (!q || ws.name?.toLowerCase().includes(q) || ws.description?.toLowerCase().includes(q)));
    }, [workspaces, query, status]);

    const counts = useMemo(() => ({
        all: workspaces.length,
        active: workspaces.filter((w) => (w.status || 'active') === 'active').length,
        archived: workspaces.filter((w) => w.status === 'archived').length,
        inactive: workspaces.filter((w) => w.status === 'inactive').length,
    }), [workspaces]);
    const totals = useMemo(() => ({
        members: workspaces.reduce((s, w) => s + (w.memberCount || 0), 0),
        channels: workspaces.reduce((s, w) => s + (w.channelCount || 0), 0),
    }), [workspaces]);

    const resetCreate = () => { setCreateStep(1); setCreateData(DEFAULT_CREATE_DATA); setNameError(''); setTermsAccepted(false); };
    const openCreate = () => { resetCreate(); setModalOpen(true); };
    const closeCreate = () => { setModalOpen(false); setTimeout(resetCreate, 300); };

    const handleSubmit = async (e) => {
        e?.preventDefault?.();
        if (creating) return;
        if (!createData.name.trim()) { setNameError('Workspace name is required'); setCreateStep(1); return; }
        setCreating(true);
        try {
            await api.post('/api/workspaces', {
                name: createData.name.trim(), description: createData.rules?.trim() || '',
                icon: createData.icon, color: createData.color, type: 'general',
                settings: { isPrivate: false, allowMemberInvite: true },
            });
            showToast(`Workspace "${createData.name.trim()}" created`, 'success');
            closeCreate();
            reload();
        } catch (err) {
            showToast(errorMessage(err, 'Could not create the workspace'), 'error');
        } finally {
            setCreating(false);
        }
    };

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Organization"
                    title="Workspaces"
                    lead="Every workspace in the company, with membership and activity."
                    actions={canManageWorkspace && <Btn variant="primary" icon={Plus} onClick={openCreate}>New workspace</Btn>}
                />
            )}
        >
            <KpiGrid min={160}>
                <Kpi loading={loading} label="Workspaces" value={data ? workspaces.length : undefined} icon={Briefcase} />
                <Kpi loading={loading} label="Active" value={data ? counts.active : undefined} icon={Globe} tone="success" />
                <Kpi loading={loading} label="Memberships" value={data ? totals.members : undefined} icon={Users} tone="muted" hint="active members across workspaces" />
                <Kpi loading={loading} label="Channels" value={data ? totals.channels : undefined} icon={Hash} tone="muted" />
            </KpiGrid>

            <Toolbar>
                <FilterTabs
                    value={status}
                    onChange={setStatus}
                    label="Status"
                    options={[
                        { value: 'all', label: 'All', count: data ? counts.all : undefined },
                        { value: 'active', label: 'Active', count: data ? counts.active : undefined },
                        { value: 'archived', label: 'Archived', count: data ? counts.archived : undefined },
                        ...(counts.inactive ? [{ value: 'inactive', label: 'Inactive', count: counts.inactive }] : []),
                    ]}
                />
                <SearchBox value={query} onChange={setQuery} placeholder="Search workspaces…" />
            </Toolbar>

            {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <LoadingState label="Loading workspaces…" /> : filtered.length === 0 ? (
                <div className="gl-card">
                    <EmptyState
                        icon={Briefcase}
                        title={workspaces.length ? 'No workspace matches' : 'No workspaces yet'}
                        text={workspaces.length ? 'Try another search or status.' : 'Create the first workspace for your company.'}
                        action={!workspaces.length && canManageWorkspace && <Btn size="sm" icon={Plus} onClick={openCreate}>New workspace</Btn>}
                    />
                </div>
            ) : (
                <Grid cols="3">
                    {filtered.map((ws) => {
                        const Icon = ICON_MAP[ws.icon] || null;
                        const st = ws.status || 'active';
                        return (
                            <article className="gl-card ad-card" key={ws._id}>
                                <div className="ad-card-head">
                                    <span className="ad-mark" aria-hidden="true">{Icon ? <Icon size={16} /> : (ws.icon && ws.icon.length <= 4 ? ws.icon : <Globe size={16} />)}</span>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <h3 className="ad-card-title">{ws.name}</h3>
                                        <p className="ad-card-desc">{ws.description || (ws.department?.name ? `${ws.department.name} department` : 'Company workspace')}</p>
                                    </div>
                                    <Chip tone={STATUS_TONE[st]}>{st === 'archived' && <Archive size={11} />}{st}</Chip>
                                </div>
                                <div className="ad-card-stats">
                                    <span><strong>{ws.memberCount ?? 0}</strong> members</span>
                                    <span><strong>{ws.channelCount ?? 0}</strong> channels</span>
                                    <span title={ws.createdAt ? new Date(ws.createdAt).toLocaleString() : undefined}><Calendar size={11} style={{ verticalAlign: '-1px' }} /> {ws.createdAt ? new Date(ws.createdAt).toLocaleDateString() : '—'}</span>
                                </div>
                                <div className="cd-hint">
                                    {ws.admin?.username ? `Admin: ${ws.admin.username}` : 'No admin'}
                                    {ws.lastActivityAt ? ` · active ${timeAgo(ws.lastActivityAt)}` : ''}
                                </div>
                                <div className="ad-card-foot">
                                    {canManageWorkspace && <Btn size="sm" icon={Users} onClick={() => setMembersWorkspace(ws)}>Members</Btn>}
                                    <Btn size="sm" variant="ghost" icon={ArrowUpRight} onClick={() => navigate(`/workspace/${ws._id}/home`)}>Open</Btn>
                                </div>
                            </article>
                        );
                    })}
                </Grid>
            )}

            <CreateWorkspaceModal
                isOpen={modalOpen}
                onClose={closeCreate}
                createStep={createStep}
                setCreateStep={setCreateStep}
                createData={createData}
                setCreateData={setCreateData}
                nameError={nameError}
                setNameError={setNameError}
                termsAccepted={termsAccepted}
                setTermsAccepted={setTermsAccepted}
                onSubmit={handleSubmit}
                getIconComponent={getIconComponent}
                user={user}
            />
            {membersWorkspace && (
                <WorkspaceMembersModal
                    workspace={membersWorkspace}
                    onClose={() => setMembersWorkspace(null)}
                    onMemberCountChange={(count) => setData((prev) => (prev || []).map((w) => (String(w._id) === String(membersWorkspace._id) ? { ...w, memberCount: count } : w)))}
                />
            )}
        </DashPage>
    );
};

export default WorkspacesManagement;
