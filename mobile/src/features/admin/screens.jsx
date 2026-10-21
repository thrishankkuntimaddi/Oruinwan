// Admin: workspace owners and admins manage the workspace from the phone or tablet, with the
// server's existing admin APIs. Company-wide pages (departments, teams, org chart, the
// permission matrix, audit logs) appear when the account belongs to a company.
// Privacy: analytics are counts only. Nothing here shows messages or who talks to whom.
import { useMemo, useRef, useState } from 'react';
import {
  Activity, BarChart3, Building2, ClipboardCheck, Copy, Download, FileJson, Gavel, Hash, LayoutTemplate, Lock, Megaphone, Network, ScrollText,
  ShieldCheck, SlidersHorizontal, ToggleRight, Upload, Users, UsersRound,
} from 'lucide-react';
import { nav } from '../../app/nav.js';
import { useWide } from '../../app/layout.js';
import { api, useSession, useWorkspace } from '../../data/session.js';
import { useChannels } from '../../data/hooks.js';
import { invalidate, setQueryData, useQuery } from '../../data/query.js';
import { toast } from '../../lib/bus.js';
import { shortAgo } from '../../lib/time.js';
import { saveJson } from '../../native/index.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { Button } from '../../ui/Button.jsx';
import { Chips, Field, SearchField, Segmented, Toggle } from '../../ui/Controls.jsx';
import { Dialog, Sheet } from '../../ui/Overlay.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { Row, RowGroup, Section } from '../../ui/List.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import {
  FEATURE_LABELS, MATRIX_ROLES, PERMISSION_LABELS, actionLabel, exportFileName, flattenTree, isCompanyAdmin, isWorkspaceAdmin, parseBundle, toggleCell,
} from './adminUi.js';

const useCompany = () => useQuery('company:ctx', () => api().companyContext(), { staleMs: 5 * 60_000 });

const roleLabel = (r) => (r ? r.charAt(0).toUpperCase() + r.slice(1) : 'Member');

/** Shown instead of an admin page to people who aren't admins. */
function NotAdmin({ title = 'Admin', body = 'Only workspace owners and admins can open this.' }) {
  return (
    <Screen>
      <Header title={title} />
      <EmptyState icon={Lock} title="Admins only" body={body} />
    </Screen>
  );
}

function NoCompany({ title }) {
  return (
    <Screen>
      <Header title={title} />
      <EmptyState icon={Building2} title="Company accounts only" body="This is managed for a whole company. Your account isn't part of one." />
    </Screen>
  );
}

function useAdminGuard() {
  const workspace = useWorkspace();
  return { workspace, ok: isWorkspaceAdmin(workspace) };
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-card border border-line-soft bg-surface p-4" style={{ backgroundImage: 'var(--glass)' }}>
      <p className="text-[12px] font-medium tracking-wide text-text-2 uppercase">{label}</p>
      <p className="mt-1 text-[26px] font-bold tabular-nums leading-tight">{value ?? '–'}</p>
      {hint && <p className="mt-0.5 text-xs text-text-3">{hint}</p>}
    </div>
  );
}

function ErrorState({ error }) {
  const code = error?.status;
  return (
    <EmptyState
      icon={code === 403 ? Lock : Activity}
      title={code === 403 ? 'Not allowed' : "Couldn't load this"}
      body={code === 403 ? error.message || 'Your role does not allow this.' : error?.message || 'Pull down to try again.'}
    />
  );
}

// ---------------------------------------------------------------- hub

export function AdminScreen() {
  const { workspace, ok } = useAdminGuard();
  const { data: company } = useCompany();
  if (!ok) return <NotAdmin />;
  const hasCompany = Boolean(company?.companyId);
  const companyAdmin = isCompanyAdmin(company);
  return (
    <Screen>
      <Header title="Admin" subtitle={`${workspace.name} · ${roleLabel(workspace.role)}`} />
      <Body>
        <Section title="Workspace">
          <RowGroup>
            <Row icon={BarChart3} tile="accent" title="Analytics" subtitle="Members, channels, tasks and files" onClick={() => nav.push('admin.analytics')} />
            <Row icon={ToggleRight} tile="accent" title="Features" subtitle="Turn tasks, AI, huddles and more on or off" onClick={() => nav.push('admin.features')} />
            <Row icon={SlidersHorizontal} tile="accent" title="Permissions" subtitle="Who can invite and create channels" onClick={() => nav.push('admin.permissions')} />
            <Row icon={Megaphone} tile="accent" title="Channel settings" subtitle="Posting policy, @channel and @here" onClick={() => nav.push('admin.channels')} />
          </RowGroup>
        </Section>
        <Section title="People">
          <RowGroup>
            <Row icon={Users} tile="accent" title="Directory" subtitle="Search members and employees" onClick={() => nav.push('admin.directory')} />
            <Row icon={Network} tile="accent" title="Org chart" disabled={!hasCompany} subtitle={hasCompany ? 'Who reports to whom' : 'Company accounts only'} onClick={hasCompany ? () => nav.push('admin.org') : undefined} />
            <Row icon={UsersRound} tile="accent" title="Departments & teams" disabled={!hasCompany} subtitle={hasCompany ? 'Company structure' : 'Company accounts only'} onClick={hasCompany ? () => nav.push('admin.departments') : undefined} />
          </RowGroup>
        </Section>
        <Section title="Workspaces">
          <RowGroup>
            <Row icon={LayoutTemplate} tile="accent" title="New from a template" subtitle="Channels and settings ready to go" onClick={() => nav.push('admin.templates')} />
            <Row icon={FileJson} tile="accent" title="Clone, export & import" subtitle="Copy this workspace's structure" onClick={() => nav.push('admin.data')} />
          </RowGroup>
        </Section>
        <Section title="Compliance">
          <RowGroup footer={companyAdmin ? null : 'Audit and compliance logs are for company owners and admins.'}>
            <Row icon={ScrollText} tile="accent" title="Audit log" disabled={!companyAdmin} onClick={companyAdmin ? () => nav.push('admin.audit', { kind: 'audit' }) : undefined} />
            <Row icon={ClipboardCheck} tile="accent" title="Compliance log" subtitle="Tamper-evident record" disabled={!companyAdmin} onClick={companyAdmin ? () => nav.push('admin.audit', { kind: 'compliance' }) : undefined} />
            <Row icon={Gavel} tile="accent" title="Legal holds" subtitle="Keep someone's data from being deleted" disabled={!companyAdmin} onClick={companyAdmin ? () => nav.push('admin.directory', { holds: true }) : undefined} />
          </RowGroup>
        </Section>
      </Body>
    </Screen>
  );
}

// ---------------------------------------------------------------- analytics

const RANGES = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

export function AdminAnalyticsScreen() {
  const { workspace, ok } = useAdminGuard();
  const [range, setRange] = useState(30);
  const { data, loading, error, refetch } = useQuery(ok && `wsanalytics:${workspace.id}:${range}`, () => api().workspaceAnalytics(workspace.id, range));
  if (!ok) return <NotAdmin title="Analytics" />;
  const s = data?.summary || {};
  const days = data?.daily || [];
  const max = Math.max(1, ...days.map((d) => Math.max(d.created || 0, d.completed || 0)));
  return (
    <Screen>
      <Header title="Analytics" subtitle={workspace.name} />
      <Body onRefresh={refetch}>
        <div className="px-4">
          <Segmented size="sm" options={RANGES} value={range} onChange={setRange} />
        </div>
        {loading ? (
          <SkeletonRows count={4} avatar={false} />
        ) : error && !data ? (
          <ErrorState error={error} />
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 px-4 md:grid-cols-3">
              <Stat label="Members" value={s.memberCount} />
              <Stat label="Channels" value={s.channelCount} />
              <Stat label="Open tasks" value={s.openTasks} hint={s.totalTasks != null ? `${s.totalTasks} in total` : null} />
              <Stat label="Completion" value={s.taskCompletionRate != null ? `${Math.round(s.taskCompletionRate)}%` : null} />
              <Stat label="Files" value={s.fileCount} />
              <Stat label="Docs" value={s.docCount} />
            </div>
            <Section title={`Tasks per day · last ${range} days`}>
              {days.length ? (
                <div className="mx-4 rounded-card border border-line-soft bg-surface p-4">
                  <div className="flex h-32 items-end gap-[2px]" role="img" aria-label={`Tasks created and completed per day over the last ${range} days`}>
                    {days.map((d) => (
                      <div key={d.date} className="flex h-full min-w-0 flex-1 items-end gap-[1px]" title={`${d.date}: ${d.created} created, ${d.completed} completed`}>
                        <span className="w-1/2 rounded-t-sm bg-accent/70" style={{ height: `${((d.created || 0) / max) * 100}%` }} />
                        <span className="w-1/2 rounded-t-sm bg-success/70" style={{ height: `${((d.completed || 0) / max) * 100}%` }} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-4 text-xs text-text-2">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent" /> Created</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" /> Completed</span>
                  </div>
                </div>
              ) : (
                <p className="mx-4 text-sm text-text-2">No task activity in this period.</p>
              )}
            </Section>
            <p className="mx-5 mt-4 text-xs text-text-3">Counts only. Oruinwan never shows anyone's messages or who talks to whom.{data?.computedAt ? ` Updated ${shortAgo(data.computedAt)}.` : ''}</p>
          </>
        )}
      </Body>
    </Screen>
  );
}

// ---------------------------------------------------------------- features

export function AdminFeaturesScreen() {
  const { workspace, ok } = useAdminGuard();
  const key = ok && `wsfeatures:${workspace.id}`;
  const { data, loading, error } = useQuery(key, () => api().workspaceFeatures(workspace.id));
  if (!ok) return <NotAdmin title="Features" />;
  const set = async (name, on) => {
    const next = { ...data, [name]: on };
    setQueryData(key, next);
    try {
      await api().saveWorkspaceFeatures(workspace.id, next);
    } catch (err) {
      toast(err.message || "Couldn't save that", 'danger');
      invalidate(key);
    }
  };
  const keys = Object.keys({ ...FEATURE_LABELS, ...(data || {}) });
  return (
    <Screen>
      <Header title="Features" subtitle={workspace.name} />
      <Body>
        {loading ? (
          <SkeletonRows count={6} avatar={false} />
        ) : error && !data ? (
          <ErrorState error={error} />
        ) : (
          <RowGroup className="mt-1" footer="Changes apply to everyone in this workspace right away.">
            {keys.map((k) => (
              <Row key={k} title={FEATURE_LABELS[k]?.[0] || k} subtitle={FEATURE_LABELS[k]?.[1]} trailing={<Toggle label={FEATURE_LABELS[k]?.[0] || k} checked={data?.[k] !== false} onChange={(v) => set(k, v)} />} />
            ))}
          </RowGroup>
        )}
      </Body>
    </Screen>
  );
}

// ---------------------------------------------------------------- permissions

const WHO = [
  { value: 'owner', label: 'Owners' },
  { value: 'admin', label: 'Admins' },
  { value: 'member', label: 'Everyone' },
];

function MatrixEditor({ canEdit }) {
  const wide = useWide();
  const { data: matrix, loading, error } = useQuery('permmatrix', () => api().permissionMatrix());
  const [role, setRole] = useState('member');
  if (loading) return <SkeletonRows count={6} avatar={false} />;
  if (error && !matrix) return <ErrorState error={error} />;
  const keys = Object.keys(PERMISSION_LABELS);
  const toggle = async (r, k) => {
    const row = toggleCell(matrix, r, k);
    setQueryData('permmatrix', (m) => ({ ...m, [r]: row }));
    try {
      await api().savePermissionRow(r, row);
    } catch (err) {
      toast(err.message || "Couldn't change that permission", 'danger');
      invalidate('permmatrix');
    }
  };
  if (wide) {
    return (
      <div className="mx-4 overflow-x-auto rounded-card border border-line-soft bg-surface">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b border-line-soft text-left text-xs text-text-2">
              <th className="px-4 py-3 font-medium">Permission</th>
              {MATRIX_ROLES.map((r) => (
                <th key={r} className="px-2 py-3 text-center font-medium">{roleLabel(r)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {keys.map((k) => (
              <tr key={k}>
                <td className="px-4 py-2.5">{PERMISSION_LABELS[k]}</td>
                {MATRIX_ROLES.map((r) => (
                  <td key={r} className="px-2 py-2.5 text-center">
                    <span className="inline-flex">
                      <Toggle label={`${PERMISSION_LABELS[k]} for ${r}`} checked={Boolean(matrix?.[r]?.[k])} disabled={!canEdit || r === 'owner'} onChange={() => toggle(r, k)} />
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <>
      <Chips options={MATRIX_ROLES.map((r) => ({ value: r, label: roleLabel(r) }))} value={role} onChange={setRole} className="pb-3" />
      <RowGroup footer={role === 'owner' ? 'Owners always have every permission.' : canEdit ? null : 'Only company owners and admins can change these.'}>
        {keys.map((k) => (
          <Row key={k} title={PERMISSION_LABELS[k]} trailing={<Toggle label={PERMISSION_LABELS[k]} checked={Boolean(matrix?.[role]?.[k])} disabled={!canEdit || role === 'owner'} onChange={() => toggle(role, k)} />} />
        ))}
      </RowGroup>
    </>
  );
}

export function AdminPermissionsScreen() {
  const { workspace, ok } = useAdminGuard();
  const key = ok && `wsperms:${workspace.id}`;
  const { data, loading, error } = useQuery(key, () => api().workspacePermissions(workspace.id));
  const { data: company } = useCompany();
  if (!ok) return <NotAdmin title="Permissions" />;
  const save = async (patch) => {
    setQueryData(key, (p) => ({ ...p, ...patch }));
    try {
      await api().saveWorkspacePermissions(workspace.id, patch);
      toast('Saved', 'success');
    } catch (err) {
      toast(err.message || "Couldn't save that", 'danger');
      invalidate(key);
    }
  };
  return (
    <Screen>
      <Header title="Permissions" subtitle={workspace.name} />
      <Body>
        {loading ? (
          <SkeletonRows count={3} avatar={false} />
        ) : error && !data ? (
          <ErrorState error={error} />
        ) : (
          <>
            <Section title="Who can invite people">
              <div className="px-4">
                <Segmented size="sm" options={WHO} value={data.invite} onChange={(v) => save({ invite: v })} />
              </div>
            </Section>
            <Section title="Who can create channels">
              <div className="px-4">
                <Segmented size="sm" options={WHO} value={data.channelCreation} onChange={(v) => save({ channelCreation: v })} />
              </div>
            </Section>
          </>
        )}
        {company?.companyId && (
          <Section title="Company roles">
            <MatrixEditor canEdit={isCompanyAdmin(company)} />
          </Section>
        )}
      </Body>
    </Screen>
  );
}

// ---------------------------------------------------------------- channels

const POLICY = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'admins', label: 'Admins only' },
];

function ChannelPolicySheet({ channel, onClose }) {
  const key = `chpolicy:${channel.id}`;
  const { data, loading } = useQuery(key, () => api().channelPolicy(channel.id), { staleMs: 0 });
  const save = async (field, value) => {
    setQueryData(key, (p) => ({ ...p, [field]: value }));
    try {
      if (field === 'posting') await api().setChannelPosting(channel.id, value);
      else await api().setChannelMentions(channel.id, value);
      invalidate('channels');
    } catch (err) {
      toast(err.message || "Couldn't save that", 'danger');
      invalidate(key);
    }
  };
  return (
    <Sheet open onClose={onClose} title={`#${channel.name}`}>
      {loading || !data ? (
        <SkeletonRows count={2} avatar={false} />
      ) : (
        <div className="space-y-5 px-5 pb-5">
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-text-2">Who can post</p>
            <Segmented size="sm" options={POLICY} value={data.posting} onChange={(v) => save('posting', v)} />
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-text-2">Who can use @channel and @here</p>
            <Segmented size="sm" options={POLICY} value={data.mentions} onChange={(v) => save('mentions', v)} />
          </div>
          {!data.canManage && <p className="text-xs text-text-2">You can see these settings, but only channel admins and workspace admins can change them.</p>}
        </div>
      )}
    </Sheet>
  );
}

export function AdminChannelsScreen() {
  const { ok } = useAdminGuard();
  const { data, loading } = useChannels();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(null);
  if (!ok) return <NotAdmin title="Channel settings" />;
  const list = (data || []).filter((c) => !query || c.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <Screen>
      <Header title="Channel settings">
        <div className="px-4 pb-3">
          <SearchField value={query} onChange={setQuery} placeholder="Find a channel" />
        </div>
      </Header>
      <Body>
        {loading ? (
          <SkeletonRows count={5} />
        ) : (
          <RowGroup className="mt-1">
            {list.map((c) => (
              <Row key={c.id} icon={c.private ? Lock : Hash} title={c.name} subtitle={c.broadcast ? 'Admins post' : 'Everyone posts'} onClick={() => setOpen(c)} />
            ))}
          </RowGroup>
        )}
      </Body>
      {open && <ChannelPolicySheet channel={open} onClose={() => setOpen(null)} />}
    </Screen>
  );
}

// ---------------------------------------------------------------- directory & legal holds

function PersonSheet({ person, canHold, onClose }) {
  const key = `legalhold:${person.id}`;
  const hold = useQuery(canHold && key, () => api().legalHold(person.id), { staleMs: 0 });
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);
  const set = async (on) => {
    setConfirm(false);
    try {
      await api().setLegalHold(person.id, on, reason.trim());
      invalidate(key);
      toast(on ? 'Legal hold placed' : 'Legal hold lifted', 'success');
    } catch (err) {
      toast(err.message || "Couldn't change the legal hold", 'danger');
    }
  };
  return (
    <Sheet open onClose={onClose} title={person.name}>
      <div className="px-5 pb-5">
        <div className="flex items-center gap-3">
          <Avatar name={person.name} src={person.avatarUrl} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium">{person.email || person.username}</p>
            <p className="text-[13px] text-text-2">{[roleLabel(person.role), ...(person.departments || [])].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        <Button className="mt-4" variant="secondary" block onClick={() => { onClose(); nav.push('profile', { userId: person.id }); }}>
          Open profile
        </Button>
        {canHold && (
          <div className="mt-5 rounded-card border border-line-soft bg-surface p-4">
            <p className="flex items-center gap-2 text-[15px] font-medium">
              <Icon as={Gavel} size="sm" /> Legal hold
            </p>
            {hold.loading ? (
              <p className="mt-2 text-sm text-text-2">Checking…</p>
            ) : hold.data?.on ? (
              <>
                <p className="mt-1 text-sm text-text-2">
                  On{hold.data.setBy ? ` · by ${hold.data.setBy}` : ''}{hold.data.at ? ` · ${shortAgo(hold.data.at)}` : ''}. {hold.data.reason}
                </p>
                <Button className="mt-3" size="sm" variant="danger" onClick={() => set(false)}>
                  Lift the hold
                </Button>
              </>
            ) : (
              <>
                <p className="mt-1 text-sm text-text-2">Off. A hold stops this person's data from being deleted, even by them.</p>
                <Field className="mt-3" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (kept with the hold)" />
                <Button className="mt-3" size="sm" onClick={() => setConfirm(true)}>
                  Place a hold
                </Button>
              </>
            )}
          </div>
        )}
      </div>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title={`Place a legal hold on ${person.name}?`} body="Their account and data can't be deleted until the hold is lifted." confirmLabel="Place hold" onConfirm={() => set(true)} />
    </Sheet>
  );
}

export function AdminDirectoryScreen({ holds = false }) {
  const { workspace, ok } = useAdminGuard();
  const { data: company } = useCompany();
  const [scope, setScope] = useState('workspace');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(null);
  const members = useQuery(ok && `directory:${workspace.id}`, () => api().memberDirectory(workspace.id));
  const companyId = company?.companyId;
  const employees = useQuery(ok && scope === 'company' && companyId && `employees:${companyId}:${query.trim()}`, () => api().employees(companyId, { search: query.trim() }), { staleMs: 30_000 });
  if (!ok) return <NotAdmin title="Directory" />;
  const q = query.trim().toLowerCase();
  const list = scope === 'company'
    ? employees.data?.people || []
    : (members.data || []).filter((m) => !q || [m.name, m.email, m.username, m.title].some((v) => v && v.toLowerCase().includes(q)));
  const loading = scope === 'company' ? employees.loading : members.loading;
  return (
    <Screen>
      <Header title={holds ? 'Legal holds' : 'Directory'} subtitle={holds ? 'Pick a person to place or lift a hold' : null}>
        <div className="space-y-3 px-4 pb-3">
          {companyId && (
            <Segmented size="sm" options={[{ value: 'workspace', label: 'This workspace' }, { value: 'company', label: 'Company' }]} value={scope} onChange={setScope} />
          )}
          <SearchField value={query} onChange={setQuery} placeholder="Search by name, email or title" />
        </div>
      </Header>
      <Body onRefresh={() => invalidate('directory', 'employees')}>
        {loading ? (
          <SkeletonRows count={6} />
        ) : list.length ? (
          <RowGroup className="mt-1" footer={scope === 'company' && employees.data?.total > list.length ? `Showing ${list.length} of ${employees.data.total}. Search to narrow it down.` : null}>
            {list.map((p) => (
              <Row key={p.id} leading={<Avatar name={p.name} src={p.avatarUrl} size="sm" presence={p.online ? 'active' : undefined} />} title={p.name} subtitle={[p.title || p.email, roleLabel(p.role)].filter(Boolean).join(' · ')} onClick={() => setOpen(p)} />
            ))}
          </RowGroup>
        ) : (
          <EmptyState icon={Users} title={q ? 'Nobody matches' : 'Nobody here yet'} />
        )}
      </Body>
      {open && <PersonSheet person={open} canHold={isCompanyAdmin(company)} onClose={() => setOpen(null)} />}
    </Screen>
  );
}

// ---------------------------------------------------------------- org chart

function OrgNode({ node }) {
  return (
    <div className="flex flex-col items-center">
      <button type="button" onClick={() => nav.push('profile', { userId: node.id })} className="flex w-44 items-center gap-2 rounded-card border border-line-soft bg-surface px-3 py-2.5 text-left active:bg-surface-2">
        <Avatar name={node.name} src={node.avatarUrl} size="sm" />
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-medium">{node.name}</span>
          <span className="block truncate text-xs text-text-2">{roleLabel(node.role)}</span>
        </span>
      </button>
      {node.reports.length > 0 && (
        <>
          <span className="h-4 w-px bg-line" aria-hidden />
          <div className="flex gap-4 border-t border-line pt-4">
            {node.reports.map((r) => (
              <OrgNode key={r.id} node={r} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function AdminOrgScreen() {
  const wide = useWide();
  const { data: company } = useCompany();
  const companyId = company?.companyId;
  const { data, loading, error, refetch } = useQuery(companyId && `orgchart:${companyId}`, () => api().orgChart(companyId));
  const rows = useMemo(() => flattenTree(data?.roots), [data]);
  if (company && !companyId) return <NoCompany title="Org chart" />;
  return (
    <Screen>
      <Header title="Org chart" subtitle={data ? `${data.company || 'Company'} · ${data.total} people` : null} />
      <Body fluid={wide} onRefresh={refetch}>
        {loading || !company ? (
          <SkeletonRows count={6} />
        ) : error && !data ? (
          <ErrorState error={error} />
        ) : !rows.length ? (
          <EmptyState icon={Network} title="No reporting lines yet" body="When managers are set for people, the chart builds itself." />
        ) : wide ? (
          <div className="overflow-x-auto px-6 py-4">
            <div className="flex min-w-max justify-center gap-6">
              {data.roots.map((r) => (
                <OrgNode key={r.id} node={r} />
              ))}
            </div>
          </div>
        ) : (
          <RowGroup className="mt-1">
            {rows.map(({ node, depth }) => (
              <button key={node.id} type="button" onClick={() => nav.push('profile', { userId: node.id })} className="flex min-h-[52px] w-full items-center gap-3 py-2 pr-4 text-left active:bg-surface-2" style={{ paddingLeft: 16 + Math.min(depth, 6) * 20 }}>
                {depth > 0 && <span className="h-px w-3 shrink-0 bg-line" aria-hidden />}
                <Avatar name={node.name} src={node.avatarUrl} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{node.name}</span>
                  <span className="block truncate text-[13px] text-text-2">
                    {roleLabel(node.role)}
                    {node.reports.length ? ` · ${node.reports.length} report${node.reports.length > 1 ? 's' : ''}` : ''}
                  </span>
                </span>
              </button>
            ))}
          </RowGroup>
        )}
      </Body>
    </Screen>
  );
}

// ---------------------------------------------------------------- departments & teams

function CreateSheet({ kind, onClose }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      if (kind === 'department') await api().createDepartment({ name: name.trim(), description: description.trim() });
      else await api().createTeam({ name: name.trim(), description: description.trim() });
      invalidate('departments', 'teams');
      toast(`${kind === 'department' ? 'Department' : 'Team'} created`, 'success');
      onClose();
    } catch (err) {
      toast(err.message || "Couldn't create it", 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title={kind === 'department' ? 'New department' : 'New team'} footer={<Button block loading={busy} disabled={!name.trim()} onClick={save}>Create</Button>}>
      <div className="space-y-4 px-5 pb-4">
        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <Field label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
    </Sheet>
  );
}

export function AdminDepartmentsScreen() {
  const { data: company } = useCompany();
  const [tab, setTab] = useState('departments');
  const [creating, setCreating] = useState(null);
  const departments = useQuery(company?.companyId && 'departments', () => api().departments());
  const teams = useQuery(company?.companyId && 'teams', () => api().teams());
  if (company && !company.companyId) return <NoCompany title="Departments & teams" />;
  const q = tab === 'departments' ? departments : teams;
  const admin = isCompanyAdmin(company);
  return (
    <Screen>
      <Header title="Departments & teams">
        <Chips options={[{ value: 'departments', label: 'Departments' }, { value: 'teams', label: 'Teams' }]} value={tab} onChange={setTab} className="pb-3" />
      </Header>
      <Body onRefresh={() => invalidate('departments', 'teams')}>
        {admin && (
          <div className="flex justify-end px-4 pt-1">
            <Button size="sm" variant="secondary" onClick={() => setCreating(tab === 'departments' ? 'department' : 'team')}>
              {tab === 'departments' ? 'New department' : 'New team'}
            </Button>
          </div>
        )}
        {q.loading || !company ? (
          <SkeletonRows count={4} avatar={false} />
        ) : q.error && !q.data ? (
          <ErrorState error={q.error} />
        ) : q.data?.length ? (
          <RowGroup className="mt-3">
            {q.data.map((d) => (
              <Row key={d.id} icon={tab === 'departments' ? Building2 : UsersRound} tile="accent" title={d.name} subtitle={[d.description, `${d.memberCount || 0} people`, d.head?.name && `Head: ${d.head.name}`, d.lead?.name && `Lead: ${d.lead.name}`].filter(Boolean).join(' · ')} chevron={false} />
            ))}
          </RowGroup>
        ) : (
          <EmptyState icon={tab === 'departments' ? Building2 : UsersRound} title={`No ${tab} yet`} />
        )}
      </Body>
      {creating && <CreateSheet kind={creating} onClose={() => setCreating(null)} />}
    </Screen>
  );
}

// ---------------------------------------------------------------- audit & compliance logs

export function AdminAuditScreen({ kind = 'audit' }) {
  const { data: company } = useCompany();
  const [page, setPage] = useState(1);
  const companyId = company?.companyId;
  const enabled = kind === 'compliance' ? Boolean(company) : Boolean(companyId);
  const { data, loading, error, refetch } = useQuery(enabled && `${kind}log:${companyId}:${page}`, () =>
    kind === 'compliance' ? api().complianceLogs({ page }) : api().auditLogs(companyId, { page }),
  );
  if (company && !companyId) return <NoCompany title={kind === 'compliance' ? 'Compliance log' : 'Audit log'} />;
  return (
    <Screen>
      <Header title={kind === 'compliance' ? 'Compliance log' : 'Audit log'} subtitle={data ? `Page ${page} of ${data.pages}` : null} />
      <Body onRefresh={refetch}>
        {loading || !company ? (
          <SkeletonRows count={8} />
        ) : error && !data ? (
          <ErrorState error={error} />
        ) : data?.logs?.length ? (
          <>
            <RowGroup className="mt-1">
              {data.logs.map((l) => (
                <div key={l.id} className="flex items-start gap-3 px-4 py-3">
                  <Avatar name={l.actor?.name || 'System'} src={l.actor?.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px]">
                      <span className="font-medium">{l.actor?.name || 'System'}</span> · {actionLabel(l.action)}
                    </p>
                    <p className="truncate text-[13px] text-text-2">{[l.target, l.severity, shortAgo(l.at)].filter(Boolean).join(' · ')}</p>
                    {l.detail && <p className="mt-0.5 line-clamp-2 break-all text-xs text-text-3">{l.detail}</p>}
                  </div>
                  {l.valid === false && <span className="rounded-full bg-danger/12 px-2 py-0.5 text-[11px] font-medium text-danger">Altered</span>}
                  {l.valid === true && <Icon as={ShieldCheck} size="sm" className="mt-1 shrink-0 text-success" aria-label="Verified" />}
                </div>
              ))}
            </RowGroup>
            <div className="mx-4 mt-3 flex gap-2.5">
              <Button variant="secondary" block disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Newer
              </Button>
              <Button variant="secondary" block disabled={page >= (data.pages || 1)} onClick={() => setPage((p) => p + 1)}>
                Older
              </Button>
            </div>
          </>
        ) : (
          <EmptyState icon={ScrollText} title="Nothing logged yet" />
        )}
      </Body>
    </Screen>
  );
}

// ---------------------------------------------------------------- templates

export function AdminTemplatesScreen() {
  const { data, loading, error } = useQuery('wstemplates', () => api().workspaceTemplates(), { staleMs: 5 * 60_000 });
  const [picked, setPicked] = useState(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    try {
      const ws = await api().createWorkspaceFromTemplate({ name: name.trim(), templateId: picked.id });
      if (ws.templateError) toast(`Created, but the template could not be applied: ${ws.templateError}`, 'warning');
      else toast(`${ws.name} is ready`, 'success');
      setPicked(null);
      await useSession.getState().finishCreateWorkspace(ws);
    } catch (err) {
      toast(err.message || "Couldn't create the workspace", 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <Header title="New from a template" />
      <Body>
        {loading ? (
          <SkeletonRows count={4} />
        ) : error && !data ? (
          <ErrorState error={error} />
        ) : data?.length ? (
          <RowGroup className="mt-1">
            {data.map((t) => (
              <Row
                key={t.id}
                leading={<span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-accent/15 text-lg">{t.icon || '🗂️'}</span>}
                title={t.name}
                subtitle={t.description || (t.channels.length ? t.channels.map((c) => `#${c}`).join(' ') : t.category)}
                multiline
                onClick={() => {
                  setName(t.name);
                  setPicked(t);
                }}
              />
            ))}
          </RowGroup>
        ) : (
          <EmptyState icon={LayoutTemplate} title="No templates" body="Your server has no workspace templates yet." />
        )}
      </Body>
      <Sheet open={Boolean(picked)} onClose={() => setPicked(null)} title={picked ? `New workspace from “${picked.name}”` : ''} footer={<Button block loading={busy} disabled={!name.trim()} onClick={create}>Create workspace</Button>}>
        <div className="space-y-3 px-5 pb-4">
          <Field label="Workspace name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          {picked?.channels?.length > 0 && <p className="text-sm text-text-2">Comes with {picked.channels.map((c) => `#${c}`).join(', ')}.</p>}
        </div>
      </Sheet>
    </Screen>
  );
}

// ---------------------------------------------------------------- clone / export / import

export function AdminDataScreen() {
  const { workspace, ok } = useAdminGuard();
  const [cloneName, setCloneName] = useState('');
  const [withMembers, setWithMembers] = useState(false);
  const [busy, setBusy] = useState(null);
  const [paste, setPaste] = useState(false);
  const [pasted, setPasted] = useState('');
  const fileInput = useRef(null);
  if (!ok) return <NotAdmin title="Clone, export & import" />;

  const run = async (what, fn) => {
    setBusy(what);
    try {
      await fn();
    } catch (err) {
      toast(err.message || 'Something went wrong', 'danger');
    } finally {
      setBusy(null);
    }
  };
  const clone = () => run('clone', async () => {
    const ws = await api().cloneWorkspace(workspace.id, { name: cloneName.trim() || `${workspace.name} (copy)`, includeMembers: withMembers });
    toast(`${ws.name} created`, 'success');
    setCloneName('');
    await useSession.getState().loadWorkspaces();
  });
  const doExport = () => run('export', async () => {
    const bundle = await api().exportWorkspace(workspace.id);
    const result = await saveJson(exportFileName(workspace.name), bundle);
    if (result === 'copied') toast('Export copied to the clipboard', 'success');
    else if (result === 'saved') toast('Export downloaded', 'success');
  });
  const doImport = (text) => run('import', async () => {
    const bundle = parseBundle(text);
    const ws = await api().importWorkspace(bundle);
    setPaste(false);
    setPasted('');
    toast(`${ws.name} imported`, 'success');
    await useSession.getState().finishCreateWorkspace(ws);
  });

  return (
    <Screen>
      <Header title="Clone, export & import" subtitle={workspace.name} />
      <Body>
        <Section title="Clone">
          <div className="mx-4 space-y-3 rounded-card border border-line-soft bg-surface p-4">
            <Field label="New workspace name" value={cloneName} onChange={(e) => setCloneName(e.target.value)} placeholder={`${workspace.name} (copy)`} />
            <div className="flex items-center justify-between gap-3">
              <span className="text-[15px]">Copy the members too</span>
              <Toggle label="Copy the members too" checked={withMembers} onChange={setWithMembers} />
            </div>
            <Button block icon={Copy} loading={busy === 'clone'} onClick={clone}>
              Clone workspace
            </Button>
          </div>
        </Section>
        <Section title="Export">
          <RowGroup footer="The structure only: settings, channels and feature switches. Messages are end-to-end encrypted and never exported.">
            <Row icon={Download} tile="accent" title="Export this workspace" subtitle="A JSON file you can import elsewhere" trailing={busy === 'export' ? <span className="text-xs text-text-3">Exporting…</span> : null} onClick={doExport} />
          </RowGroup>
        </Section>
        <Section title="Import">
          <RowGroup footer="Creates a new workspace from an export. Nothing in this workspace changes.">
            <Row icon={Upload} tile="accent" title="Import from a file" onClick={() => fileInput.current?.click()} />
            <Row icon={FileJson} tile="accent" title="Paste an export" onClick={() => setPaste(true)} />
          </RowGroup>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) doImport(await f.text());
            }}
          />
        </Section>
      </Body>
      <Sheet open={paste} onClose={() => setPaste(false)} title="Paste an export" footer={<Button block loading={busy === 'import'} disabled={!pasted.trim()} onClick={() => doImport(pasted)}>Import</Button>}>
        <div className="px-5 pb-4">
          <Field multiline value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder='{"schemaVersion": "1.0", …}' inputClassName="font-mono text-[13px]" />
        </div>
      </Sheet>
    </Screen>
  );
}

