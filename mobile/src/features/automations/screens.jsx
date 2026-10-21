// Automations on the phone: see what runs, switch rules on and off, run one now, and read its
// run history. Building or editing an automation (triggers, conditions, multi-step actions)
// stays on the web and desktop app, where there's room for the builder; the screens link there.
import { useState } from 'react';
import { CircleAlert, CircleCheck, CircleMinus, CircleSlash, ExternalLink, Play, RefreshCw, Workflow, Zap } from 'lucide-react';
import { nav } from '../../app/nav.js';
import { api, useSession, useWorkspace } from '../../data/session.js';
import { invalidate, setQueryData, useQuery } from '../../data/query.js';
import { toast } from '../../lib/bus.js';
import { shortAgo } from '../../lib/time.js';
import { openExternal } from '../../native/index.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { Button, IconButton } from '../../ui/Button.jsx';
import { Toggle } from '../../ui/Controls.jsx';
import { Dialog } from '../../ui/Overlay.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { Row, RowGroup, Section } from '../../ui/List.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { cx } from '../../ui/cx.js';
import { runSummary, RUN_STATUS } from './automationsUi.js';

const STATUS_ICON = { success: CircleCheck, partial: CircleAlert, failed: CircleAlert, skipped: CircleMinus };

function useAutomationsWeb(id) {
  const server = useSession((s) => s.server);
  const mode = useSession((s) => s.mode);
  const ws = useSession((s) => s.workspaceId);
  if (mode !== 'live' || !server || !ws) return null;
  const path = `/workspace/${ws}/automations${id ? `/${id}/edit` : ''}`;
  return () => openExternal(`${server}${path}`);
}

const canManage = (workspace) => ['owner', 'admin'].includes(workspace?.role);

/** "Building automations happens on the web" note with the link. */
function WebNote({ id }) {
  const open = useAutomationsWeb(id);
  return (
    <Section>
      <RowGroup footer="Creating and editing automations — triggers, conditions and multi-step actions — is done in Oruinwan on the web or the desktop app.">
        <Row
          icon={ExternalLink}
          tile="accent"
          title={id ? 'Edit on the web' : 'Build automations on the web'}
          disabled={!open}
          onClick={open || undefined}
        />
      </RowGroup>
    </Section>
  );
}

export function AutomationsScreen() {
  const ws = useSession((s) => s.workspaceId);
  const workspace = useWorkspace();
  const key = ws && `automations:${ws}`;
  const { data, loading, error } = useQuery(key, () => api().automations(ws));
  const admin = canManage(workspace);

  const toggle = async (a, active) => {
    setQueryData(key, (list) => list?.map((x) => (x.id === a.id ? { ...x, active } : x)));
    try {
      await api().setAutomationActive(ws, a.id, active);
      invalidate(`automation:${a.id}`);
    } catch (err) {
      toast(err.message || "Couldn't change the automation", 'danger');
      invalidate(key);
    }
  };

  const list = data || [];
  const on = list.filter((a) => a.active);
  const off = list.filter((a) => !a.active);
  const row = (a) => (
    <Row
      key={a.id}
      icon={a.trigger === 'scheduled' ? RefreshCw : Zap}
      tile={a.active ? 'accent' : 'neutral'}
      title={a.name}
      subtitle={[a.scheduleLabel || a.triggerLabel, `${a.steps.length} step${a.steps.length === 1 ? '' : 's'}`].join(' · ')}
      trailing={admin ? <Toggle checked={a.active} onChange={(v) => toggle(a, v)} label={`${a.name} on`} /> : null}
      chevron
      onClick={() => nav.push('automation', { id: a.id })}
    />
  );

  return (
    <Screen>
      <Header title="Automations" subtitle={workspace?.name} />
      <Body onRefresh={() => invalidate('automations')}>
        {loading && !data ? (
          <SkeletonRows count={4} />
        ) : error && !data ? (
          <EmptyState icon={CircleSlash} title="Couldn't load automations" body={error.message} action={{ label: 'Try again', icon: RefreshCw, onClick: () => invalidate(key) }} />
        ) : list.length ? (
          <>
            {on.length > 0 && (
              <Section title="On">
                <RowGroup>{on.map(row)}</RowGroup>
              </Section>
            )}
            {off.length > 0 && (
              <Section title="Off">
                <RowGroup>{off.map(row)}</RowGroup>
              </Section>
            )}
            {!admin && <p className="mx-5 mt-2 text-xs text-text-2">Workspace admins can switch automations on and off and run them.</p>}
          </>
        ) : (
          <EmptyState icon={Workflow} title="No automations yet" body="Automations post messages, create tasks and call webhooks when something happens in your workspace." />
        )}
        <WebNote />
      </Body>
    </Screen>
  );
}

function StepList({ steps }) {
  return (
    <ol className="space-y-1.5 px-4 py-3">
      {steps.map((s, i) => (
        <li key={s.id} className="flex items-start gap-3 text-[14px]">
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-3 text-[11px] font-semibold text-text-2">{i + 1}</span>
          <span className="min-w-0 flex-1">
            {s.label}
            {s.continueOnError && <span className="text-text-3"> · continues on error</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

function RunRow({ run, open, onToggle }) {
  const st = RUN_STATUS[run.status] || RUN_STATUS.success;
  return (
    <div>
      <Row
        icon={STATUS_ICON[run.status] || CircleCheck}
        tile={st.tile}
        title={st.label}
        subtitle={runSummary(run)}
        value={run.at ? shortAgo(run.at) : null}
        onClick={run.steps.length || run.error ? onToggle : undefined}
        chevron={false}
      />
      {open && (
        <div className="px-4 pb-3">
          {run.error && <p className="mb-2 rounded-xl bg-danger/10 px-3 py-2 text-[13px] text-danger">{run.error}</p>}
          <ul className="space-y-1">
            {run.steps.map((s) => (
              <li key={s.index} className="flex items-start gap-2 text-[13px]">
                <Icon as={STATUS_ICON[s.status] || CircleMinus} size={14} className={cx('mt-0.5 shrink-0', (RUN_STATUS[s.status] || RUN_STATUS.skipped).text)} />
                <span className="min-w-0 flex-1">
                  {s.label}
                  {(s.error || s.reason) && <span className="block text-text-2">{s.error || s.reason}</span>}
                </span>
                {s.durationMs > 0 && <span className="shrink-0 text-text-3">{s.durationMs} ms</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function AutomationScreen({ id }) {
  const ws = useSession((s) => s.workspaceId);
  const workspace = useWorkspace();
  const admin = canManage(workspace);
  const { data: a, loading, error } = useQuery(ws && id && `automation:${id}`, () => api().automation(ws, id));
  const runsKey = ws && id && `automationruns:${id}`;
  const runs = useQuery(runsKey, () => api().automationRuns(ws, id));
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);

  const toggle = async (active) => {
    setQueryData(`automation:${id}`, (x) => (x ? { ...x, active } : x));
    try {
      await api().setAutomationActive(ws, id, active);
      invalidate('automations');
    } catch (err) {
      toast(err.message || "Couldn't change the automation", 'danger');
      invalidate(`automation:${id}`);
    }
  };

  const run = async (dryRun) => {
    setBusy(true);
    try {
      const r = await api().runAutomation(ws, id, { dryRun });
      setConfirm(false);
      setQueryData(runsKey, (list) => [r, ...(list || []).filter((x) => x.id !== r.id)]);
      setOpen(r.id);
      const st = RUN_STATUS[r.status] || RUN_STATUS.success;
      toast(dryRun ? `Test: ${st.label.toLowerCase()}` : `Run: ${st.label.toLowerCase()}`, r.status === 'failed' ? 'danger' : r.status === 'success' ? 'success' : 'warning');
      invalidate(`automation:${id}`);
    } catch (err) {
      toast(err.message || "Couldn't run the automation", 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header
        title={a?.name || 'Automation'}
        subtitle={a ? (a.active ? 'On' : 'Off') : undefined}
        actions={admin && a && <IconButton icon={Play} label="Run now" onClick={() => setConfirm(true)} />}
      />
      <Body onRefresh={() => invalidate(`automation:${id}`, `automationruns:${id}`)}>
        {loading && !a ? (
          <SkeletonRows count={4} avatar={false} />
        ) : !a ? (
          <EmptyState icon={CircleSlash} title="Automation not found" body={error?.message || 'It may have been deleted.'} />
        ) : (
          <>
            {a.description && <p className="mx-5 mt-1 text-[14px] leading-relaxed text-text-2">{a.description}</p>}
            <Section title="When">
              <RowGroup>
                <Row icon={a.trigger === 'scheduled' ? RefreshCw : Zap} tile="accent" title={a.triggerLabel} subtitle={a.scheduleLabel} />
                {a.nextRunAt && <Row title="Next run" value={new Date(a.nextRunAt).toLocaleString()} />}
                {a.conditions > 0 && <Row title="Conditions" value={`${a.conditions} · ${a.conditionLogic === 'any' ? 'any matches' : 'all match'}`} />}
              </RowGroup>
            </Section>
            <Section title="Then">
              <RowGroup>{a.steps.length ? <StepList steps={a.steps} /> : <Row title="No steps" />}</RowGroup>
            </Section>
            {admin && (
              <Section>
                <RowGroup footer="Run now does the steps for real. Test shows what would happen without doing anything.">
                  <Row title="On" trailing={<Toggle checked={a.active} onChange={toggle} label="Automation on" />} />
                  <div className="flex gap-2 px-4 py-3">
                    <Button size="sm" icon={Play} onClick={() => setConfirm(true)}>
                      Run now
                    </Button>
                    <Button size="sm" variant="secondary" loading={busy && !confirm} onClick={() => run(true)}>
                      Test
                    </Button>
                  </div>
                </RowGroup>
              </Section>
            )}
            <Section title="Run history">
              {runs.loading && !runs.data ? (
                <SkeletonRows count={3} avatar={false} />
              ) : runs.data?.length ? (
                <RowGroup footer="Runs are kept for 30 days.">
                  {runs.data.map((r) => (
                    <RunRow key={r.id} run={r} open={open === r.id} onToggle={() => setOpen((o) => (o === r.id ? null : r.id))} />
                  ))}
                </RowGroup>
              ) : (
                <EmptyState icon={Workflow} title="No runs yet" body="Each time this automation runs, it shows up here with what every step did." className="py-8" />
              )}
            </Section>
            <WebNote id={id} />
          </>
        )}
      </Body>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Run “${a?.name || 'automation'}” now?`}
        body="Its steps run for real: messages are posted, tasks created and webhooks called."
        confirmLabel="Run now"
        busy={busy}
        onConfirm={() => run(false)}
      />
    </Screen>
  );
}
