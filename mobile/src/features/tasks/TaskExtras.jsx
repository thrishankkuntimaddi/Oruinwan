// The planning half of a task's page: subtasks, dependencies and links, time tracking and the
// repeat schedule. Reads the full task (api().planningTask) next to the list model TaskScreen uses.
import { useEffect, useMemo, useState } from 'react';
import { Check, Link2, ListChecks, Pause, Play, Plus, Repeat, Timer, X } from 'lucide-react';
import { nav } from '../../app/nav.js';
import { api, useSession } from '../../data/session.js';
import { useTasks } from '../../data/hooks.js';
import { invalidate, setQueryData, useQuery } from '../../data/query.js';
import { trackedSeconds } from '../../data/live/adapter.work.js';
import { STATUS_META } from '../../data/constants.js';
import { Section, Row, RowGroup } from '../../ui/List.jsx';
import { Button, IconButton } from '../../ui/Button.jsx';
import { SearchField, Segmented } from '../../ui/Controls.jsx';
import { Sheet } from '../../ui/Overlay.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { cx } from '../../ui/cx.js';
import { toast } from '../../lib/bus.js';
import { StatusIcon } from './TaskRow.jsx';
import { formatClock, formatDuration, recurrenceLabel } from './planning.js';

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
  invalidate(`taskplan:${id}`, `task:${id}`, 'tasks');
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

  const toggle = async (sub) => {
    const next = sub.status === 'done' ? 'todo' : 'done';
    setQueryData(`taskplan:${task.id}`, (d) => (d ? { ...d, subtasks: d.subtasks.map((s) => (s.id === sub.id ? { ...s, status: next } : s)) } : d));
    try {
      await api().setTaskStatus(sub.id, next);
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
      await api().unlinkTask(task.id, row.linkId);
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
        <RowGroup footer={task.dependencyIds.length ? '“Depends on” links are kept with the task; other links can be removed here.' : null}>
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
              {r.linkId && <IconButton icon={X} size="sm" label="Remove link" onClick={() => remove(r)} />}
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

function TimeTracking({ task }) {
  const running = Boolean(task.time.runningSince);
  const now = useNow(running);
  const [busy, setBusy] = useState(false);
  const total = trackedSeconds(task.timeTracking, now);
  const session = running ? Math.floor((now - new Date(task.time.runningSince).getTime()) / 1000) : 0;

  const toggle = async () => {
    setBusy(true);
    try {
      if (running) {
        const { timeTracking, elapsed } = await api().stopTimer(task.id);
        setQueryData(`taskplan:${task.id}`, (d) => (d ? { ...d, timeTracking, time: { ...d.time, totalSeconds: timeTracking?.totalTime || 0, runningSince: null } } : d));
        toast(`Logged ${formatDuration(elapsed)}`, 'success');
      } else {
        const timeTracking = await api().startTimer(task.id);
        const open = (timeTracking?.sessions || []).find((s) => !s.end);
        setQueryData(`taskplan:${task.id}`, (d) => (d ? { ...d, timeTracking, time: { ...d.time, runningSince: open?.start || new Date().toISOString() } } : d));
      }
    } catch (err) {
      toast(err.message || "Couldn't update the timer", 'danger');
      refresh(task.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Time">
      <div className="mx-4 flex items-center gap-4 rounded-card border border-line-soft bg-surface p-4">
        <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-[12px]', running ? 'bg-accent/15 text-accent-ink' : 'bg-surface-3 text-text-2')}>
          <Icon as={Timer} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[20px] font-semibold tabular-nums leading-tight">{running ? formatClock(session) : formatDuration(total)}</p>
          <p className="text-[13px] text-text-2">
            {running ? `Running · ${formatDuration(total)} in total` : task.time.sessions ? `Tracked over ${task.time.sessions} session${task.time.sessions > 1 ? 's' : ''}` : 'No time tracked yet'}
          </p>
        </div>
        <Button variant={running ? 'secondary' : 'primary'} icon={running ? Pause : Play} loading={busy} onClick={toggle}>
          {running ? 'Stop' : 'Start'}
        </Button>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------- repeat

function Recurrence({ task }) {
  return (
    <Section title="Repeat">
      <RowGroup footer={task.recurring ? `Next copy ${task.recurring.nextDue ? `on ${new Date(task.recurring.nextDue).toLocaleDateString()}` : 'is scheduled by the server'}.` : 'Repeat schedules are set up by your server’s automations; the app shows them here.'}>
        <Row icon={Repeat} title={recurrenceLabel(task.recurring)} chevron={false} />
      </RowGroup>
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
      <Dependencies task={task} />
      <TimeTracking task={task} />
      <Recurrence task={task} />
    </>
  );
}
