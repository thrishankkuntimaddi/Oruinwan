import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Workflow, Plus, Pencil, Trash2, Pause, Play, MessageSquare, ListPlus, UserCheck, Bell, Webhook,
  Clock, GitMerge, FileUp, CalendarCheck, CheckCircle2, AlertTriangle, Zap, Sparkles,
} from 'lucide-react';
import { getAutomations, deleteAutomation, updateAutomation } from '../../services/automationsService';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useToast } from '../../contexts/ToastContext';
import {
  DashPage, PageHead, Section, Panel, KpiGrid, Kpi, Toolbar, SearchBox, FilterTabs, Btn, IconBtn, Chip,
  LoadingState, ErrorState, EmptyState, Confirm, Grid, timeAgo,
} from '../../components/ui/page';

const TRIGGERS = {
  'message.sent': { label: 'A message is sent', Icon: MessageSquare },
  'task.created': { label: 'A task is created', Icon: ListPlus },
  'task.completed': { label: 'A task is completed', Icon: CheckCircle2 },
  'meeting.completed': { label: 'A meeting ends', Icon: CalendarCheck },
  'file.uploaded': { label: 'A file is uploaded', Icon: FileUp },
  'github.pr_merged': { label: 'A pull request is merged', Icon: GitMerge },
  'webhook.received': { label: 'A webhook arrives', Icon: Webhook },
  scheduled: { label: 'On a schedule', Icon: Clock },
};

const ACTIONS = {
  send_message: { label: 'Send a message', Icon: MessageSquare },
  create_task: { label: 'Create a task', Icon: ListPlus },
  assign_task: { label: 'Assign a task', Icon: UserCheck },
  send_notification: { label: 'Notify someone', Icon: Bell },
  call_webhook: { label: 'Call a webhook', Icon: Webhook },
  post_to_slack: { label: 'Post to Slack', Icon: MessageSquare },
  trigger_ci_pipeline: { label: 'Start a CI run', Icon: Zap },
};

// What people usually build first; each opens the builder, which offers ready-made templates.
const IDEAS = [
  { Icon: Clock, title: 'Weekly reminder', text: 'Post a stand-up or planning reminder in a channel every week.' },
  { Icon: Webhook, title: 'Alerts from other tools', text: 'Turn an incoming webhook into a channel message or a task.' },
  { Icon: GitMerge, title: 'Ship notes', text: 'Announce merged pull requests in your team channel.' },
];

const triggerOf = (type) => TRIGGERS[type] || { label: type || 'Trigger', Icon: Zap };
const actionOf = (type) => ACTIONS[type] || { label: type, Icon: Zap };

/** Agents & tools → Workflows: rules that run on their own (when X happens, do Y). */
export default function AutomationsPage() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { activeWorkspace } = useWorkspace();
  const { showToast } = useToast();

  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const fetchAutomations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await getAutomations(workspaceId);
      setAutomations(data.automations || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load workflows');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { fetchAutomations(); }, [fetchAutomations]);

  const create = () => navigate(`/workspace/${workspaceId}/automations/new`);
  const edit = (a) => navigate(`/workspace/${workspaceId}/automations/${a._id}/edit`);

  const toggle = async (a) => {
    setBusyId(a._id);
    try {
      await updateAutomation(a._id, { workspaceId, isActive: !a.isActive });
      setAutomations((prev) => prev.map((x) => (x._id === a._id ? { ...x, isActive: !x.isActive } : x)));
      showToast(a.isActive ? `Paused “${a.name}”` : `“${a.name}” is running`, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not update the workflow', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    const a = confirmDelete;
    setBusyId(a._id);
    try {
      await deleteAutomation(a._id, workspaceId);
      setAutomations((prev) => prev.filter((x) => x._id !== a._id));
      showToast(`Deleted “${a.name}”`, 'success');
      setConfirmDelete(null);
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not delete the workflow', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const counts = useMemo(() => ({
    all: automations.length,
    running: automations.filter((a) => a.isActive).length,
    paused: automations.filter((a) => !a.isActive).length,
    errors: automations.filter((a) => a.lastError).length,
    runs: automations.reduce((n, a) => n + (a.runCount || 0), 0),
  }), [automations]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return automations.filter((a) => (filter === 'all' || (filter === 'running' ? a.isActive : !a.isActive))
      && (!q || `${a.name} ${a.description || ''}`.toLowerCase().includes(q)));
  }, [automations, query, filter]);

  const hasAny = automations.length > 0;

  return (
    <DashPage
      head={(
        <PageHead
          eyebrow={activeWorkspace?.name ? `${activeWorkspace.name} · Agents & tools` : 'Agents & tools'}
          title="Workflows"
          icon={Workflow}
          lead="Rules that run on their own: when something happens, Oruinwan does the next step for you."
          actions={hasAny && <Btn variant="primary" icon={Plus} onClick={create}>New workflow</Btn>}
        />
      )}
    >
      {loading ? (
        <LoadingState label="Loading workflows…" />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchAutomations} />
      ) : !hasAny ? (
        <>
          <Panel>
            <EmptyState
              icon={Workflow}
              title="No workflows yet"
              text="Save your team the busywork: a workflow watches for an event and does the next step automatically."
              action={<Btn variant="primary" icon={Plus} onClick={create}>Create your first workflow</Btn>}
            />
          </Panel>
          <Section title="Ideas to start with" lead="Each one opens the builder with ready-made templates.">
            <Grid min={220}>
              {IDEAS.map(({ Icon, title, text }) => (
                <button key={title} type="button" className="gl-card gl-card--interactive" onClick={create}
                  style={{ padding: 16, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span className="gl-empty-mark" style={{ marginBottom: 0 }}><Icon size={16} /></span>
                  <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>{title}</strong>
                  <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{text}</span>
                </button>
              ))}
            </Grid>
          </Section>
        </>
      ) : (
        <>
          <KpiGrid min={160}>
            <Kpi label="Running" value={counts.running} icon={Play} tone="success" />
            <Kpi label="Paused" value={counts.paused} icon={Pause} tone="muted" />
            <Kpi label="Total runs" value={counts.runs} icon={Sparkles} />
            <Kpi label="Need attention" value={counts.errors} icon={AlertTriangle} tone={counts.errors ? 'danger' : 'muted'} />
          </KpiGrid>

          <Toolbar>
            <SearchBox value={query} onChange={setQuery} placeholder="Find a workflow" label="Find a workflow" />
            <FilterTabs value={filter} onChange={setFilter} label="Show" options={[
              { value: 'all', label: 'All', count: counts.all },
              { value: 'running', label: 'Running', count: counts.running },
              { value: 'paused', label: 'Paused', count: counts.paused },
            ]} />
          </Toolbar>

          <Panel flush>
            {shown.length === 0 ? (
              <EmptyState title="No workflows match" text="Try a different name or filter." />
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {shown.map((a, i) => {
                  const trig = triggerOf(a.trigger?.type);
                  return (
                    <li key={a._id} className="wf-row" style={{ borderTop: i ? '1px solid var(--border-subtle)' : 'none' }}>
                      <button type="button" className="wf-row-main" onClick={() => edit(a)}>
                        <span className="gl-empty-mark" style={{ margin: 0, opacity: a.isActive ? 1 : 0.55 }}><trig.Icon size={16} /></span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>{a.name}</strong>
                            {a.isActive ? <Chip tone="success">Running</Chip> : <Chip>Paused</Chip>}
                            {a.lastError && <Chip tone="danger">Last run failed</Chip>}
                          </span>
                          <span style={{ display: 'block', marginTop: 3, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                            When {trig.label.charAt(0).toLowerCase() + trig.label.slice(1)}
                            {a.conditions?.length ? ` (and ${a.conditions.length} condition${a.conditions.length > 1 ? 's' : ''})` : ''}
                            {' → '}
                            {(a.actions || []).map((x) => (x.name || actionOf(x.type).label).toLowerCase()).join(' → ') || 'no steps yet'}
                          </span>
                          <span style={{ display: 'block', marginTop: 3, fontSize: 11.5, color: 'var(--text-muted)' }}>
                            {a.runCount ? `Ran ${a.runCount} time${a.runCount === 1 ? '' : 's'}` : 'Hasn’t run yet'}
                            {a.lastRunAt ? ` · last ${timeAgo(a.lastRunAt)}` : ''}
                            {a.isActive && a.nextRunAt ? ` · next ${new Date(a.nextRunAt).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
                            {a.createdBy?.username ? ` · by ${a.createdBy.username}` : ''}
                          </span>
                        </span>
                      </button>
                      <span className="wf-row-actions">
                        <Btn size="sm" variant="ghost" icon={a.isActive ? Pause : Play} loading={busyId === a._id} onClick={() => toggle(a)}>
                          {a.isActive ? 'Pause' : 'Resume'}
                        </Btn>
                        <IconBtn label={`Edit ${a.name}`} onClick={() => edit(a)}><Pencil size={14} /></IconBtn>
                        <IconBtn label={`Delete ${a.name}`} onClick={() => setConfirmDelete(a)}><Trash2 size={14} /></IconBtn>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </>
      )}

      <Confirm
        open={Boolean(confirmDelete)}
        title={`Delete “${confirmDelete?.name}”?`}
        confirmLabel="Delete workflow"
        tone="danger"
        busy={busyId === confirmDelete?._id}
        onConfirm={remove}
        onClose={() => setConfirmDelete(null)}
      >
        It stops running and its run history is removed. This can’t be undone.
      </Confirm>
      <style>{`
        .wf-row { display: flex; align-items: center; gap: 8px; padding: 4px 12px 4px 4px; }
        .wf-row:hover { background: var(--bg-hover); }
        .wf-row-main { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; padding: 12px; background: none; border: 0; text-align: left; cursor: pointer; font-family: var(--font); color: inherit; }
        .wf-row-actions { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
        @media (hover: hover) and (pointer: fine) { .wf-row-actions { opacity: 0; transition: opacity 150ms ease; } .wf-row:hover .wf-row-actions, .wf-row:focus-within .wf-row-actions { opacity: 1; } }
        @media (max-width: 640px) { .wf-row { flex-direction: column; align-items: stretch; padding: 4px 4px 8px; } .wf-row-actions { padding-left: 64px; } }
      `}</style>
    </DashPage>
  );
}
