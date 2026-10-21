// The planning half of a task's page: subtasks, sprint and milestone, dependencies and links,
// everyone's time (own timers and logged time) and the repeat schedule. Reads the full task
// (api().planningTask) next to the list model TaskScreen uses.
import { useEffect, useMemo, useState } from 'react';
import { Check, Clock, Link2, ListChecks, Milestone, Pause, Play, Plus, Repeat, Rocket, Timer, X } from 'lucide-react';
import { nav } from '../../app/nav.js';
import { api, useSession } from '../../data/session.js';
import { useDirectory, useTasks } from '../../data/hooks.js';
import { invalidate, setQueryData, useQuery } from '../../data/query.js';
import { trackedSeconds } from '../../data/live/adapter.work.js';
import { STATUS_META } from '../../data/constants.js';
import { Section, Row, RowGroup } from '../../ui/List.jsx';
import { Button, IconButton } from '../../ui/Button.jsx';
import { Field, SearchField, Segmented } from '../../ui/Controls.jsx';
import { ActionSheet, Sheet } from '../../ui/Overlay.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { cx } from '../../ui/cx.js';
import { toast } from '../../lib/bus.js';
import { StatusIcon } from './TaskRow.jsx';
import { useBlockerGuard } from './BlockersSheet.jsx';
import { formatClock, formatDuration, minutesFrom, myOpenSession, openSprints, recurrenceLabel } from './planning.js';
import { REPEAT_FREQUENCIES, WEEKDAYS, describeRule, fromRecurring, normalizeRule, toRecurringPayload } from './recurrence.js';

const LINK_LABEL = {
  depends: 'Depends on',
  blocks: 'Blocks',
  is_blocked_by: 'Blocked by',
  relates_to: 'Relates to',
  duplicates: 'Duplicates',
  is_duplicated_by: 'Duplicated by',
};

export function usePlanningTask(id) {
  return useQuery(id && `taskplan:${id}`, () => api().planningTask(id));
}

function refresh(id) {
  invalidate(`taskplan:${id}`, `task:${id}`, `tasktime:${id}`, 'tasks', 'planning');
}

// ---------------------------------------------------------------- subtasks

function Subtasks({ task }) {
  const me = useSession((s) => s.user?.id);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const subs = task.subtasks;
  const done = subs.filter((s) => s.status === 'done').length;

  const add = async (e) => {
    e?.preventDefault();
    const t = title.trim();
    if (!t) return;
    setBusy(true);
    try {
      const sub = await api().addSubtask(task.id, { title: t, priority: task.priority, assigneeIds: me ? [me] : [] });
      setQueryData(`taskplan:${task.id}`, (d) => (d ? { ...d, subtasks: [...d.subtasks, { id: sub.id, title: sub.title, status: sub.status, assigneeIds: sub.assigneeIds }] } : d));
      setTitle('');
      refresh(task.id);
    } catch (err) {
      toast(err.message || "Couldn't add the subtask", 'danger');
    } finally {
      setBusy(false);
    }
  };

  const blockers = useBlockerGuard();
  const toggle = async (sub) => {
    const next = sub.status === 'done' ? 'todo' : 'done';
    const put = (status) => setQueryData(`taskplan:${task.id}`, (d) => (d ? { ...d, subtasks: d.subtasks.map((s) => (s.id === sub.id ? { ...s, status } : s)) } : d));
    put(next);
    try {
      const done = await blockers.guard(async (ignoreBlockers) => {
        await api().setTaskStatus(sub.id, next, undefined, { ignoreBlockers });
        if (ignoreBlockers) {
          put(next);
          refresh(task.id);
        }
      });
      if (!done) put(sub.status);
      refresh(task.id);
    } catch (err) {
      toast(err.message || "Couldn't update the subtask", 'danger');
      refresh(task.id);
    }
  };

  return (
    <Section title={subs.length ? `Subtasks · ${done}/${subs.length}` : 'Subtasks'}>
      {subs.length > 0 && (
        <div className="mx-4 mb-2 h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
          <div className="h-full bg-accent transition-[width]" style={{ width: `${(done / subs.length) * 100}%` }} />
        </div>
      )}
      <div className="mx-4 overflow-hidden rounded-card border border-line-soft bg-surface divide-y divide-line-soft">
        {subs.map((s) => (
          <div key={s.id} className="flex min-h-[52px] items-center gap-3 px-3">
            <button
              type="button"
              role="checkbox"
              aria-checked={s.status === 'done'}
              aria-label={`Mark “${s.title}” ${s.status === 'done' ? 'not done' : 'done'}`}
              onClick={() => toggle(s)}
              className={cx('grid h-7 w-7 shrink-0 place-items-center rounded-full border', s.status === 'done' ? 'border-success bg-success/15 text-success' : 'border-line text-transparent')}
            >
              <Icon as={Check} size={15} />
            </button>
            <button type="button" onClick={() => nav.push('task', { id: s.id })} className="min-w-0 flex-1 py-3 text-left">
              <span className={cx('block truncate text-[15px]', s.status === 'done' && 'text-text-2 line-through decoration-text-3')}>{s.title}</span>
            </button>
          </div>
        ))}
        <form onSubmit={add} className="flex items-center gap-2 px-3 py-2">
          <Icon as={Plus} size="sm" className="shrink-0 text-text-3" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a subtask"
            aria-label="New subtask"
            enterKeyHint="done"
            className="h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-text-3"
          />
          {title.trim() && (
            <Button size="sm" type="submit" loading={busy}>
              Add
            </Button>
          )}
        </form>
      </div>
      {blockers.ui}
    </Section>
  );
}

// ---------------------------------------------------------------- sprint and milestone

function PlanningPlace({ task }) {
  const ws = useSession((s) => s.workspaceId);
  const { data: sprints } = useQuery(ws && `sprints:${ws}`, () => api().sprints(ws));
  const { data: milestones } = useQuery(ws && `milestones:${ws}`, () => api().milestones(ws));
  const [pick, setPick] = useState(null); // 'sprint' | 'milestone'
  const sprint = (sprints || []).find((s) => s.id === task.sprintId);
  const milestone = (milestones || []).find((m) => m.id === task.milestoneId);

  const move = async (patch, message) => {
    setQueryData(`taskplan:${task.id}`, (d) => (d ? { ...d, ...patch } : d));
    try {
      await api().setTaskPlanning(task.id, patch);
      toast(message, 'success');
    } catch (err) {
      toast(err.message || "Couldn't move the task", 'danger');
    }
    refresh(task.id);
    invalidate('sprints', 'milestones');
  };

  const sprintActions = [
    ...openSprints(sprints)
      .filter((s) => s.id !== task.sprintId)
      .map((s) => ({ label: s.name, icon: Rocket, hint: s.status === 'active' ? 'Active sprint' : 'Planned', onSelect: () => move({ sprintId: s.id }, `Moved to ${s.name}`) })),
    task.sprintId && { label: 'Remove from the sprint', icon: X, danger: true, onSelect: () => move({ sprintId: null }, 'Removed from the sprint') },
  ].filter(Boolean);
  const milestoneActions = [
    ...(milestones || [])
      .filter((m) => m.id !== task.milestoneId && m.status !== 'completed')
      .map((m) => ({ label: m.name, icon: Milestone, onSelect: () => move({ milestoneId: m.id }, `Added to ${m.name}`) })),
    task.milestoneId && { label: 'Remove from the milestone', icon: X, danger: true, onSelect: () => move({ milestoneId: null }, 'Removed from the milestone') },
  ].filter(Boolean);

  if (task.type === 'subtask') return null;
  return (
    <Section title="Planning">
      <RowGroup>
        <Row icon={Rocket} title="Sprint" value={sprint?.name || (task.sprintId ? 'A finished sprint' : 'None')} onClick={() => setPick('sprint')} />
        <Row icon={Milestone} title="Milestone" value={milestone?.name || 'None'} onClick={() => setPick('milestone')} />
      </RowGroup>
      <ActionSheet
        open={pick === 'sprint'}
        onClose={() => setPick(null)}
        title={sprintActions.length ? 'Move to sprint' : 'No open sprints. Create one under Planning.'}
        actions={sprintActions}
      />
      <ActionSheet
        open={pick === 'milestone'}
        onClose={() => setPick(null)}
        title={milestoneActions.length ? 'Milestone' : 'No open milestones. Create one under Planning.'}
        actions={milestoneActions}
      />
    </Section>
  );
}

// ---------------------------------------------------------------- dependencies

function LinkSheet({ open, onClose, task }) {
  const { data: tasks } = useTasks();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('depends');
  const [busy, setBusy] = useState(null);
  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (tasks || []).filter((t) => t.id !== task.id && (!q || t.title.toLowerCase().includes(q))).slice(0, 40);
  }, [tasks, query, task.id]);

  const pick = async (other) => {
    setBusy(other.id);
    try {
      if (kind === 'depends') await api().addDependency(task.id, other.id);
      else await api().linkTask(task.id, other.id, kind);
      refresh(task.id);
      invalidate(`taskplan:${other.id}`);
      toast(`${LINK_LABEL[kind]} “${other.title}”`, 'success');
      onClose();
    } catch (err) {
      toast(err.message || "Couldn't link the tasks", 'danger');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Link a task" full>
      <div className="space-y-3 px-4 pb-3">
        <Segmented
          size="sm"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'depends', label: 'Depends on' },
            { value: 'is_blocked_by', label: 'Blocked by' },
            { value: 'blocks', label: 'Blocks' },
            { value: 'relates_to', label: 'Relates' },
          ]}
        />
        <SearchField value={query} onChange={setQuery} placeholder="Find a task" />
      </div>
      <div className="px-2 pb-3">
        {options.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={Boolean(busy)}
            onClick={() => pick(t)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left active:bg-surface-2 disabled:opacity-50"
          >
            <StatusIcon status={t.status} />
            <span className="min-w-0 flex-1 truncate text-[15px]">{t.title}</span>
            {busy === t.id && <span className="text-xs text-text-3">Linking…</span>}
          </button>
        ))}
        {!options.length && <p className="px-3 py-6 text-center text-sm text-text-2">No other tasks match.</p>}
      </div>
    </Sheet>
  );
}

function Dependencies({ task }) {
  const { data: tasks } = useTasks();
  const byId = useMemo(() => Object.fromEntries((tasks || []).map((t) => [t.id, t])), [tasks]);
  const [adding, setAdding] = useState(false);
  const rows = [
    ...task.dependencyIds.map((id) => ({ key: `d-${id}`, taskId: id, type: 'depends', title: byId[id]?.title, status: byId[id]?.status })),
    ...task.links.map((l) => ({ key: l.id, linkId: l.id, taskId: l.taskId, type: l.type, title: l.title || byId[l.taskId]?.title, status: l.status || byId[l.taskId]?.status })),
  ];
  const remove = async (row) => {
    try {
      if (row.linkId) await api().unlinkTask(task.id, row.linkId);
      else {
        const left = await api().removeDependency(task.id, row.taskId);
        setQueryData(`taskplan:${task.id}`, (d) => (d ? { ...d, dependencyIds: left } : d));
      }
      refresh(task.id);
      invalidate(`taskplan:${row.taskId}`);
    } catch (err) {
      toast(err.message || "Couldn't remove the link", 'danger');
    }
  };
  return (
    <Section
      title="Dependencies"
      action={
        <button type="button" className="text-[13px] font-medium text-accent-ink" onClick={() => setAdding(true)}>
          Add
        </button>
      }
    >
      {rows.length ? (
        <RowGroup footer="A task can’t be completed while what it depends on or is blocked by is still open, unless you complete it anyway.">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center pr-2">
              <button type="button" onClick={() => nav.push('task', { id: r.taskId })} className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left active:bg-surface-2">
                <StatusIcon status={r.status || 'todo'} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{r.title || 'A task you can’t see'}</span>
                  <span className="block truncate text-[13px] text-text-2">
                    {LINK_LABEL[r.type] || r.type}
                    {r.status ? ` · ${STATUS_META[r.status]?.label}` : ''}
                  </span>
                </span>
              </button>
              <IconButton icon={X} size="sm" label={r.linkId ? 'Remove link' : 'Remove dependency'} onClick={() => remove(r)} />
            </div>
          ))}
        </RowGroup>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="mx-4 flex w-[calc(100%-2rem)] items-center gap-3 rounded-card border border-dashed border-line px-4 py-3 text-left text-sm text-text-2">
          <Icon as={Link2} size="sm" /> Link a task this one depends on, blocks or relates to
        </button>
      )}
      {adding && <LinkSheet open onClose={() => setAdding(false)} task={task} />}
    </Section>
  );
}

// ---------------------------------------------------------------- time

function useNow(active) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function LogTimeSheet({ open, onClose, task }) {
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('30');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const total = minutesFrom(hours, minutes);
  const save = async () => {
    if (!total) return;
    setBusy(true);
    try {
      const timeTracking = await api().logTime(task.id, { minutes: total, note: note.trim() });
      if (timeTracking) {
        setQueryData(`taskplan:${task.id}`, (d) => (d ? { ...d, timeTracking, time: { ...d.time, totalSeconds: timeTracking.totalTime || 0, sessions: (timeTracking.sessions || []).length } } : d));
      }
      refresh(task.id);
      toast(`Logged ${formatDuration(total * 60)}`, 'success');
      onClose();
    } catch (err) {
      toast(err.message || "Couldn't log the time", 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Log time"
      footer={
        <Button block loading={busy} disabled={!total} onClick={save}>
          {total ? `Log ${formatDuration(total * 60)}` : 'Log time'}
        </Button>
      }
    >
      <div className="space-y-4 px-5 pb-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hours" type="number" inputMode="numeric" min="0" max="24" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="0" />
          <Field label="Minutes" type="number" inputMode="numeric" min="0" max="59" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="0" />
        </div>
        <Field label="Note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="What you worked on (optional)" />
        <p className="text-xs text-text-2">Logged as ending now. Between 1 minute and 24 hours.</p>
      </div>
    </Sheet>
  );
}

function TimeTracking({ task }) {
  const me = useSession((s) => s.user?.id);
  const directory = useDirectory();
  const { data: breakdown } = useQuery(api().taskTime && `tasktime:${task.id}`, () => api().taskTime(task.id));
  const mine = myOpenSession(task.timeTracking, me);
  const running = Boolean(mine);
  const anyRunning = running || (breakdown?.byUser || []).some((u) => u.running);
  const now = useNow(anyRunning);
  const [busy, setBusy] = useState(false);
  const [logging, setLogging] = useState(false);
  const total = trackedSeconds(task.timeTracking, now);
  const session = running ? Math.floor((now - new Date(mine.start).getTime()) / 1000) : 0;
  const people = (breakdown?.byUser || []).filter((u) => u.seconds > 0 || u.running).sort((a, b) => b.seconds - a.seconds);

  const toggle = async () => {
    setBusy(true);
    try {
      if (running) {
        const { timeTracking, elapsed } = await api().stopTimer(task.id);
        setQueryData(`taskplan:${task.id}`, (d) => (d ? { ...d, timeTracking, time: { ...d.time, totalSeconds: timeTracking?.totalTime || 0, runningSince: null } } : d));
        toast(`Logged ${formatDuration(elapsed)}`, 'success');
      } else {
        const timeTracking = await api().startTimer(task.id);
        const open = myOpenSession(timeTracking, me) || (timeTracking?.sessions || []).find((s) => !s.end);
        setQueryData(`taskplan:${task.id}`, (d) => (d ? { ...d, timeTracking, time: { ...d.time, runningSince: open?.start || new Date().toISOString() } } : d));
      }
      invalidate(`tasktime:${task.id}`);
    } catch (err) {
      toast(err.message || "Couldn't update the timer", 'danger');
      refresh(task.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      title="Time"
      action={
        <button type="button" className="text-[13px] font-medium text-accent-ink" onClick={() => setLogging(true)}>
          Log time
        </button>
      }
    >
      <div className="mx-4 flex items-center gap-4 rounded-card border border-line-soft bg-surface p-4">
        <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-[12px]', running ? 'bg-accent/15 text-accent-ink' : 'bg-surface-3 text-text-2')}>
          <Icon as={Timer} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[20px] font-semibold tabular-nums leading-tight">{running ? formatClock(session) : formatDuration(total)}</p>
          <p className="text-[13px] text-text-2">
            {running
              ? `Your timer · ${formatDuration(total)} in total`
              : task.time.sessions
                ? `Tracked over ${task.time.sessions} session${task.time.sessions > 1 ? 's' : ''}`
                : 'No time tracked yet'}
          </p>
        </div>
        <Button variant={running ? 'secondary' : 'primary'} icon={running ? Pause : Play} loading={busy} onClick={toggle}>
          {running ? 'Stop' : 'Start'}
        </Button>
      </div>
      {people.length > 0 && (
        <RowGroup className="mt-2.5" footer={breakdown?.estimatedHours ? `Estimate: ${breakdown.estimatedHours} h. Everyone runs their own timer.` : 'Everyone runs their own timer.'}>
          {people.map((u) => {
            const who = directory[u.userId] || u.user || {};
            return (
              <Row
                key={u.userId}
                leading={<Avatar name={who.name} src={who.avatarUrl} size="sm" />}
                title={u.userId === me ? 'You' : who.name || 'Someone'}
                subtitle={u.running ? 'Timer running' : `${u.sessions} session${u.sessions === 1 ? '' : 's'}`}
                trailing={
                  <span className={cx('flex items-center gap-1.5 text-sm tabular-nums', u.running ? 'text-accent-ink' : 'text-text-2')}>
                    {u.running && <Icon as={Clock} size={14} />}
                    {formatDuration(u.seconds)}
                  </span>
                }
              />
            );
          })}
        </RowGroup>
      )}
      {logging && <LogTimeSheet open onClose={() => setLogging(false)} task={task} />}
    </Section>
  );
}

// ---------------------------------------------------------------- repeat

export function RecurrenceSheet({ open, onClose, task }) {
  const [rule, setRule] = useState(() => fromRecurring(task.recurring));
  const [busy, setBusy] = useState(false);
  const r = normalizeRule(rule);
  const set = (patch) => setRule((x) => ({ ...x, ...patch }));
  const toggleDay = (d) => set({ daysOfWeek: r.daysOfWeek.includes(d) ? r.daysOfWeek.filter((x) => x !== d) : [...r.daysOfWeek, d] });
  const save = async () => {
    setBusy(true);
    try {
      const payload = toRecurringPayload(r, { dueDate: task.due });
      const saved = await api().setTaskRecurring(task.id, payload);
      setQueryData(`taskplan:${task.id}`, (d) => (d ? { ...d, recurring: saved ? saved.recurring : payload.isRecurring ? payload : null } : d));
      refresh(task.id);
      toast(payload.isRecurring ? describeRule(r) : 'Stopped repeating', 'success');
      onClose();
    } catch (err) {
      toast(err.status === 403 ? 'Only the task’s creator or a workspace admin can change how it repeats.' : err.message || "Couldn't save the schedule", 'danger');
    } finally {
      setBusy(false);
    }
  };
  const unit = r.frequency === 'weekly' ? 'week' : r.frequency === 'monthly' ? 'month' : 'day';
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Repeat"
      footer={
        <Button block loading={busy} onClick={save}>
          Save
        </Button>
      }
    >
      <div className="space-y-4 px-5 pb-4">
        <Segmented size="sm" value={r.frequency} onChange={(frequency) => set({ frequency })} options={REPEAT_FREQUENCIES.map((f) => ({ value: f.id, label: f.id === 'none' ? 'Never' : f.label }))} />
        {r.frequency !== 'none' && (
          <>
            {['weekly', 'monthly', 'custom'].includes(r.frequency) && (
              <div className="flex items-end gap-3">
                <Field
                  className="w-24"
                  label="Every"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="365"
                  value={rule.interval}
                  onChange={(e) => set({ interval: e.target.value })}
                />
                {r.frequency === 'custom' ? (
                  <Segmented
                    size="sm"
                    className="mb-1.5 flex-1"
                    value={r.unit}
                    onChange={(u) => set({ unit: u })}
                    options={[
                      { value: 'day', label: r.interval === 1 ? 'day' : 'days' },
                      { value: 'week', label: r.interval === 1 ? 'week' : 'weeks' },
                      { value: 'month', label: r.interval === 1 ? 'month' : 'months' },
                    ]}
                  />
                ) : (
                  <span className="pb-3.5 text-[15px] text-text-2">{r.interval === 1 ? unit : `${unit}s`}</span>
                )}
              </div>
            )}
            {r.frequency === 'weekly' && (
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-text-2">On</p>
                <div className="flex gap-1.5" role="group" aria-label="Days of the week">
                  {WEEKDAYS.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      aria-pressed={r.daysOfWeek.includes(d.id)}
                      aria-label={d.label}
                      onClick={() => toggleDay(d.id)}
                      className={cx(
                        'grid h-10 flex-1 place-items-center rounded-lg border text-[13px] font-medium',
                        r.daysOfWeek.includes(d.id) ? 'border-accent bg-accent/12 text-accent-ink' : 'border-line bg-input text-text-2',
                      )}
                    >
                      {d.short}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Field label="Ends (optional)" type="date" value={r.endDate} onChange={(e) => set({ endDate: e.target.value })} />
          </>
        )}
        <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-sm text-text-2" data-testid="repeat-summary">
          {describeRule(r)}
          {r.frequency !== 'none' && '. Each occurrence creates a new copy of this task.'}
        </p>
      </div>
    </Sheet>
  );
}

function Recurrence({ task }) {
  const [editing, setEditing] = useState(false);
  const next = task.recurring?.nextDue ? new Date(task.recurring.nextDue).toLocaleDateString() : null;
  return (
    <Section title="Repeat">
      <RowGroup footer={task.recurring ? (next ? `Next copy on ${next}.` : 'The server schedules the next copy.') : null}>
        <Row icon={Repeat} title={recurrenceLabel(task.recurring)} onClick={() => setEditing(true)} />
      </RowGroup>
      {editing && <RecurrenceSheet open onClose={() => setEditing(false)} task={task} />}
    </Section>
  );
}

/** Everything below Details on a task's page. Subtasks open as tasks of their own. */
export function TaskExtras({ id }) {
  const { data: task } = usePlanningTask(id);
  if (!task) return null;
  return (
    <>
      {task.type !== 'subtask' && <Subtasks task={task} />}
      {task.parentId && (
        <Section title="Part of">
          <RowGroup>
            <Row icon={ListChecks} title="Open the parent task" onClick={() => nav.push('task', { id: task.parentId })} />
          </RowGroup>
        </Section>
      )}
      <PlanningPlace task={task} />
      <Dependencies task={task} />
      <TimeTracking task={task} />
      <Recurrence task={task} />
    </>
  );
}
