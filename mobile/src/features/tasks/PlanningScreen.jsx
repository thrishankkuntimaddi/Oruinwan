// Planning: sprints (with a board), milestones, a timeline of due dates, everyone's workload, the
// time report, design reviews and task templates — the same Planning section as the web's Tasks
// panel. One screen with a view picker; sprints and reviews open their own screens in this tab.
import { Suspense, lazy, useMemo, useState } from 'react';
import { CalendarRange, Clock, Flag, GanttChart, LayoutTemplate, ListChecks, Milestone, Plus, Rocket, Trash2, Users, X } from 'lucide-react';
import { nav } from '../../app/nav.js';
import { useWide } from '../../app/layout.js';
import { api, useSession } from '../../data/session.js';
import { useDirectory } from '../../data/hooks.js';
import { invalidate, setQueryData, useQuery } from '../../data/query.js';
import { PRIORITY_META, STATUS_META, TASK_TRANSITIONS } from '../../data/constants.js';
import { prefs } from '../../native/storage.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { Button, IconButton } from '../../ui/Button.jsx';
import { Chips, Field, SearchField } from '../../ui/Controls.jsx';
import { ActionSheet, Dialog, Sheet } from '../../ui/Overlay.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { Row, RowGroup, Section } from '../../ui/List.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { cx } from '../../ui/cx.js';
import { toast } from '../../lib/bus.js';
import { StatusIcon } from './TaskRow.jsx';
import { PriorityPicker, fromDateInput, toDateInput } from './TaskEditorSheet.jsx';
import {
  REPORT_RANGES, formatDuration, milestoneProgress, openSprints, reportRange, reportRows, sprintBoard, timelineRows, workloadBars,
} from './planning.js';
import { useBlockerGuard } from './BlockersSheet.jsx';

// Design reviews load with their own code (pdf.js and all) only when the view is opened.
const DesignReviewsView = lazy(() => import('../design/screens.jsx').then((m) => ({ default: m.DesignReviewsView })));

export const PLANNING_VIEWS = [
  { value: 'sprints', label: 'Sprints' },
  { value: 'milestones', label: 'Milestones' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'workload', label: 'Workload' },
  { value: 'time', label: 'Time report' },
  { value: 'reviews', label: 'Design reviews' },
  { value: 'templates', label: 'Templates' },
];
const VIEWS = PLANNING_VIEWS;

const SPRINT_STATUS = { planning: 'Planning', active: 'Active', completed: 'Completed', cancelled: 'Cancelled' };
const MILESTONE_STATUS = { not_started: 'Not started', in_progress: 'In progress', at_risk: 'At risk', completed: 'Completed' };
const MILESTONE_TONE = { not_started: 'text-text-2', in_progress: 'text-info', at_risk: 'text-warning', completed: 'text-success' };

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '—');

export function usePlanningTasks() {
  const ws = useSession((s) => s.workspaceId);
  return useQuery(ws && `planning:${ws}`, () => api().planningTasks(ws));
}

function Progress({ percent }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
      <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------- sprints

function NewSprintSheet({ open, onClose }) {
  const ws = useSession((s) => s.workspaceId);
  const today = toDateInput(new Date().toISOString());
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(toDateInput(new Date(Date.now() + 13 * 86_400_000).toISOString()));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api().createSprint(ws, { name: name.trim(), goal: goal.trim(), start: fromDateInput(start), end: fromDateInput(end) });
      invalidate('sprints');
      toast('Sprint created', 'success');
      onClose();
    } catch (err) {
      toast(err.message || "Couldn't create the sprint", 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="New sprint" footer={<Button block loading={busy} disabled={!name.trim() || !start || !end} onClick={save}>Create sprint</Button>}>
      <div className="space-y-4 px-5 pb-4">
        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sprint 12" autoFocus />
        <Field label="Goal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="What this sprint should deliver" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <Field label="Ends" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
    </Sheet>
  );
}

function SprintsView({ tasks }) {
  const ws = useSession((s) => s.workspaceId);
  const { data, loading } = useQuery(ws && `sprints:${ws}`, () => api().sprints(ws));
  const [creating, setCreating] = useState(false);
  const order = { active: 0, planning: 1, completed: 2, cancelled: 3 };
  const list = [...(data || [])].sort((a, b) => order[a.status] - order[b.status] || String(a.start).localeCompare(String(b.start)));
  return (
    <>
      <div className="flex justify-end px-4 pt-1">
        <Button size="sm" variant="secondary" icon={Plus} onClick={() => setCreating(true)}>
          New sprint
        </Button>
      </div>
      {loading ? (
        <SkeletonRows count={3} avatar={false} />
      ) : list.length ? (
        <RowGroup className="mt-3">
          {list.map((s) => {
            const board = sprintBoard(tasks, s.id);
            const total = s.counts?.total ?? board.reduce((n, c) => n + c.items.length, 0);
            const done = s.counts?.done ?? board.find((c) => c.status === 'done').items.length;
            return (
              <Row
                key={s.id}
                icon={Rocket}
                tile={s.status === 'active' ? 'accent' : 'neutral'}
                title={s.name}
                subtitle={`${SPRINT_STATUS[s.status]} · ${fmtDate(s.start)} – ${fmtDate(s.end)} · ${done}/${total} done`}
                onClick={() => nav.push('sprint', { id: s.id })}
              />
            );
          })}
        </RowGroup>
      ) : (
        <EmptyState icon={Rocket} title="No sprints yet" body="Plan work in time-boxed sprints and move tasks across the board." action={{ label: 'New sprint', icon: Plus, onClick: () => setCreating(true) }} />
      )}
      {creating && <NewSprintSheet open onClose={() => setCreating(false)} />}
    </>
  );
}

function BlockedDialog({ task, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  return (
    <Dialog open={Boolean(task)} onClose={onClose} title="What's blocking it?" confirmLabel="Mark blocked" onConfirm={() => reason.trim() && onConfirm(reason.trim())}>
      <Field className="mt-4" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Waiting on review" autoFocus />
    </Dialog>
  );
}

/**
 * Moves a task to another status (the sprint board's "move"), with the blocked reason when needed
 * and the "blocked by open tasks" question when completing. With `sprints` (the sprint board),
 * the same sheet also moves the task to another sprint or out of this one.
 */
export function useMoveTask(keys, { sprintId = null, sprints = null } = {}) {
  const [moving, setMoving] = useState(null);
  const [blocked, setBlocked] = useState(null);
  const blockers = useBlockerGuard();
  const put = (task, patch) => {
    for (const k of keys) setQueryData(k, (list) => list?.map((t) => (t.id === task.id ? { ...t, ...patch } : t)));
  };
  const move = async (task, status, reason) => {
    if (status === 'blocked' && !reason) return setBlocked(task);
    put(task, { status });
    try {
      const done = await blockers.guard(async (ignoreBlockers) => {
        await api().setTaskStatus(task.id, status, reason, { ignoreBlockers });
        if (ignoreBlockers) {
          put(task, { status });
          invalidate('tasks', 'planning', `task:${task.id}`, `taskplan:${task.id}`);
        }
        toast(`Moved to ${STATUS_META[status].label}`, 'success');
      });
      if (!done) put(task, { status: task.status });
    } catch (err) {
      toast(err.message || "Couldn't move the task", 'danger');
    }
    invalidate('tasks', 'planning', `task:${task.id}`, `taskplan:${task.id}`);
    return undefined;
  };
  const moveSprint = async (task, to) => {
    put(task, { sprintId: to?.id || null });
    try {
      await api().setTaskPlanning(task.id, { sprintId: to?.id || null });
      toast(to ? `Moved to ${to.name}` : 'Removed from the sprint', 'success');
    } catch (err) {
      toast(err.message || "Couldn't move the task", 'danger');
    }
    invalidate('tasks', 'planning', 'sprints', `taskplan:${task.id}`);
  };
  const sprintActions = moving && sprints
    ? [
        ...openSprints(sprints)
          .filter((s) => s.id !== sprintId)
          .map((s) => ({ label: `Move to ${s.name}`, icon: Rocket, onSelect: () => moveSprint(moving, s) })),
        sprintId && { label: 'Remove from this sprint', icon: X, danger: true, onSelect: () => moveSprint(moving, null) },
      ].filter(Boolean)
    : [];
  const ui = (
    <>
      <ActionSheet
        open={Boolean(moving)}
        onClose={() => setMoving(null)}
        title={moving ? `Move “${moving.title}”` : ''}
        actions={[
          ...(moving ? TASK_TRANSITIONS[moving.status] || [] : []).map((s) => ({ label: STATUS_META[s].label, onSelect: () => move(moving, s) })),
          ...sprintActions,
        ]}
      />
      {blockers.ui}
      <BlockedDialog
        task={blocked}
        onClose={() => setBlocked(null)}
        onConfirm={(reason) => {
          const t = blocked;
          setBlocked(null);
          move(t, 'blocked', reason);
        }}
      />
    </>
  );
  return { open: setMoving, ui };
}

/** Picks tasks (not done, not already in this sprint) to add to a sprint. */
function AddToSprintSheet({ open, onClose, sprint, tasks }) {
  const ws = useSession((s) => s.workspaceId);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(null);
  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (tasks || [])
      .filter((t) => t.type !== 'subtask' && !t.parentId && t.sprintId !== sprint?.id && !['done', 'cancelled'].includes(t.status))
      .filter((t) => !q || t.title.toLowerCase().includes(q) || String(t.issueKey || '').toLowerCase().includes(q))
      .slice(0, 60);
  }, [tasks, query, sprint?.id]);
  const add = async (t) => {
    setBusy(t.id);
    try {
      await api().setTaskPlanning(t.id, { sprintId: sprint.id });
      setQueryData(`planning:${ws}`, (list) => list?.map((x) => (x.id === t.id ? { ...x, sprintId: sprint.id } : x)));
      invalidate('sprints', `taskplan:${t.id}`);
      toast(`Added to ${sprint.name}`, 'success');
    } catch (err) {
      toast(err.message || "Couldn't add the task", 'danger');
    } finally {
      setBusy(null);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title={`Add to ${sprint?.name || 'sprint'}`} full footer={<Button block variant="secondary" onClick={onClose}>Done</Button>}>
      <div className="px-4 pb-3">
        <SearchField value={query} onChange={setQuery} placeholder="Find a task" />
      </div>
      <div className="px-2 pb-3">
        {options.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={Boolean(busy)}
            onClick={() => add(t)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left active:bg-surface-2 disabled:opacity-50"
          >
            <StatusIcon status={t.status} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px]">{t.title}</span>
              {t.sprintId && <span className="block truncate text-[12px] text-text-3">In another sprint</span>}
            </span>
            <span className="text-xs text-accent-ink">{busy === t.id ? 'Adding…' : 'Add'}</span>
          </button>
        ))}
        {!options.length && <p className="px-3 py-6 text-center text-sm text-text-2">No open tasks to add.</p>}
      </div>
    </Sheet>
  );
}

export function SprintScreen({ id }) {
  const ws = useSession((s) => s.workspaceId);
  const wide = useWide();
  const directory = useDirectory();
  const { data: sprints } = useQuery(ws && `sprints:${ws}`, () => api().sprints(ws));
  const { data: tasks, loading } = usePlanningTasks();
  const sprint = (sprints || []).find((s) => s.id === id);
  const [menu, setMenu] = useState(false);
  const mover = useMoveTask([`planning:${ws}`], { sprintId: id, sprints });
  const [adding, setAdding] = useState(false);
  const board = useMemo(() => sprintBoard(tasks || [], id), [tasks, id]);
  const count = board.reduce((n, c) => n + c.items.length, 0);

  const setStatus = async (status) => {
    try {
      await api().updateSprint(id, { status });
      invalidate('sprints');
      toast(`Sprint ${SPRINT_STATUS[status].toLowerCase()}`, 'success');
    } catch (err) {
      toast(err.message || "Couldn't update the sprint", 'danger');
    }
  };

  return (
    <Screen>
      <Header
        title={sprint?.name || 'Sprint'}
        subtitle={sprint ? `${SPRINT_STATUS[sprint.status]} · ${fmtDate(sprint.start)} – ${fmtDate(sprint.end)}` : ''}
        actions={
          sprint && (
            <>
              <IconButton icon={Plus} label="Add tasks to this sprint" onClick={() => setAdding(true)} />
              <IconButton icon={Flag} label="Sprint status" onClick={() => setMenu(true)} />
            </>
          )
        }
      />
      <Body fluid onRefresh={() => invalidate('planning', 'sprints')}>
        {sprint?.goal && <p className="mx-4 mb-2 rounded-card border border-line-soft bg-surface px-4 py-3 text-sm text-text-2">Goal: {sprint.goal}</p>}
        {loading ? (
          <SkeletonRows count={4} avatar={false} />
        ) : !count ? (
          <EmptyState icon={Rocket} title="No tasks in this sprint" body="Add tasks to plan this sprint, then move them across the board." action={{ label: 'Add tasks', icon: Plus, onClick: () => setAdding(true) }} />
        ) : (
          <div className={cx('px-4 pt-2 pb-4', wide ? 'grid gap-3' : 'no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto')} style={wide ? { gridTemplateColumns: `repeat(${board.length}, minmax(0, 1fr))` } : undefined}>
            {board.map((col) => (
              <section key={col.status} className={cx('flex flex-col rounded-card border border-line-soft bg-surface', !wide && 'w-[78%] max-w-80 shrink-0 snap-center')}>
                <header className="flex items-center gap-2 border-b border-line-soft px-3.5 py-3">
                  <StatusIcon status={col.status} size={16} />
                  <h3 className="flex-1 truncate text-[14px] font-semibold">{STATUS_META[col.status].label}</h3>
                  <span className="text-xs tabular-nums text-text-3">{col.items.length}</span>
                </header>
                <div className="space-y-2 p-2">
                  {col.items.map((t) => (
                    <div key={t.id} className="rounded-xl border border-line-soft bg-surface-2 p-3">
                      <button type="button" className="block w-full text-left" onClick={() => nav.push('task', { id: t.id })}>
                        <span className="flex items-center gap-1.5 text-[11px] text-text-3">
                          <span className="h-2 w-2 rounded-full" style={{ background: PRIORITY_META[t.priority]?.color }} />
                          {t.issueKey || PRIORITY_META[t.priority]?.label}
                        </span>
                        <span className="mt-1 block text-[14px] leading-snug">{t.title}</span>
                      </button>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="flex -space-x-2">
                          {t.assigneeIds.slice(0, 3).map((a) => directory[a] && (
                            <span key={a} className="rounded-full ring-2 ring-surface-2">
                              <Avatar name={directory[a].name} src={directory[a].avatarUrl} size="xs" />
                            </span>
                          ))}
                        </span>
                        <Button size="sm" variant="ghost" onClick={() => mover.open(t)}>
                          Move
                        </Button>
                      </div>
                    </div>
                  ))}
                  {!col.items.length && <p className="px-2 py-5 text-center text-xs text-text-3">Nothing here</p>}
                </div>
              </section>
            ))}
          </div>
        )}
      </Body>
      {mover.ui}
      {adding && <AddToSprintSheet open onClose={() => setAdding(false)} sprint={sprint} tasks={tasks} />}
      <ActionSheet
        open={menu}
        onClose={() => setMenu(false)}
        title="Sprint status"
        actions={Object.entries(SPRINT_STATUS).map(([k, label]) => ({ label: `${label}${sprint?.status === k ? '  ✓' : ''}`, onSelect: () => setStatus(k) }))}
      />
    </Screen>
  );
}

// ---------------------------------------------------------------- milestones

function NewMilestoneSheet({ open, onClose }) {
  const ws = useSession((s) => s.workspaceId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api().createMilestone(ws, { name: name.trim(), description: description.trim(), due: fromDateInput(due) });
      invalidate('milestones');
      toast('Milestone created', 'success');
      onClose();
    } catch (err) {
      toast(err.message || "Couldn't create the milestone", 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="New milestone" footer={<Button block loading={busy} disabled={!name.trim()} onClick={save}>Create milestone</Button>}>
      <div className="space-y-4 px-5 pb-4">
        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Public beta" autoFocus />
        <Field label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Field label="Due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </div>
    </Sheet>
  );
}

function MilestonesView({ tasks }) {
  const ws = useSession((s) => s.workspaceId);
  const { data, loading } = useQuery(ws && `milestones:${ws}`, () => api().milestones(ws));
  const [creating, setCreating] = useState(false);
  const [picked, setPicked] = useState(null);
  const setStatus = async (m, status) => {
    setQueryData(`milestones:${ws}`, (list) => list?.map((x) => (x.id === m.id ? { ...x, status } : x)));
    try {
      await api().updateMilestone(m.id, { status });
    } catch (err) {
      toast(err.message || "Couldn't update the milestone", 'danger');
      invalidate('milestones');
    }
  };
  return (
    <>
      <div className="flex justify-end px-4 pt-1">
        <Button size="sm" variant="secondary" icon={Plus} onClick={() => setCreating(true)}>
          New milestone
        </Button>
      </div>
      {loading ? (
        <SkeletonRows count={3} avatar={false} />
      ) : data?.length ? (
        <div className="mt-3 space-y-2.5 px-4">
          {data.map((m) => {
            const p = milestoneProgress(m, tasks);
            return (
              <button key={m.id} type="button" onClick={() => setPicked(m)} className="block w-full rounded-card border border-line-soft bg-surface p-4 text-left active:bg-surface-2">
                <div className="flex items-start gap-3">
                  <Milestone size={20} className="mt-0.5 shrink-0 text-accent-ink" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{m.name}</p>
                    <p className="text-[13px] text-text-2">
                      Due {fmtDate(m.due)} · <span className={MILESTONE_TONE[m.status]}>{MILESTONE_STATUS[m.status]}</span>
                    </p>
                  </div>
                  <span className="text-sm tabular-nums text-text-2">{p.percent}%</span>
                </div>
                <div className="mt-3">
                  <Progress percent={p.percent} />
                </div>
                <p className="mt-1.5 text-xs text-text-3">{p.total ? `${p.done} of ${p.total} tasks done` : 'No tasks linked yet'}</p>
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={Milestone} title="No milestones yet" body="Milestones mark the dates that matter: launches, reviews, deadlines." action={{ label: 'New milestone', icon: Plus, onClick: () => setCreating(true) }} />
      )}
      {creating && <NewMilestoneSheet open onClose={() => setCreating(false)} />}
      <ActionSheet
        open={Boolean(picked)}
        onClose={() => setPicked(null)}
        title={picked?.name}
        actions={Object.entries(MILESTONE_STATUS).map(([k, label]) => ({ label: `${label}${picked?.status === k ? '  ✓' : ''}`, onSelect: () => setStatus(picked, k) }))}
      />
    </>
  );
}

// ---------------------------------------------------------------- timeline

function TimelineView({ tasks }) {
  const wide = useWide();
  const { from, days, rows } = useMemo(() => timelineRows((tasks || []).filter((t) => !['done', 'cancelled'].includes(t.status))), [tasks]);
  if (!rows.length) return <EmptyState icon={GanttChart} title="Nothing on the timeline" body="Open tasks with a due date show up here, from start to due." />;
  const dayWidth = wide ? 44 : 32;
  const width = Math.max(days * dayWidth, 320);
  const today = Math.floor((Date.now() - from) / 86_400_000);
  const labelCol = wide ? 240 : 140;
  return (
    <div className="mx-4 mt-2 overflow-hidden rounded-card border border-line-soft bg-surface">
      <div className="flex">
        <div className="shrink-0 border-r border-line-soft" style={{ width: labelCol }}>
          <div className="h-9 border-b border-line-soft" />
          {rows.map((r) => (
            <button key={r.task.id} type="button" onClick={() => nav.push('task', { id: r.task.id })} className="flex h-11 w-full items-center gap-2 border-b border-line-soft px-3 text-left last:border-0 active:bg-surface-2">
              <StatusIcon status={r.task.status} size={14} />
              <span className="truncate text-[13px]">{r.task.title}</span>
            </button>
          ))}
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="relative" style={{ width }}>
            <div className="flex h-9 border-b border-line-soft">
              {Array.from({ length: days }, (_, i) => {
                const d = new Date(from + i * 86_400_000);
                return (
                  <span key={i} className={cx('shrink-0 border-r border-line-soft/60 pt-1 text-center text-[10px] leading-3', i === today ? 'text-accent-ink font-semibold' : 'text-text-3')} style={{ width: width / days }}>
                    {d.getDate() === 1 || i === 0 ? d.toLocaleDateString([], { month: 'short' }) : ''}
                    <br />
                    {d.getDate()}
                  </span>
                );
              })}
            </div>
            {today >= 0 && today < days && <span className="absolute top-9 bottom-0 w-px bg-accent/60" style={{ left: `${((today + 0.5) / days) * 100}%` }} aria-hidden />}
            {rows.map((r) => (
              <div key={r.task.id} className="relative h-11 border-b border-line-soft last:border-0">
                <button
                  type="button"
                  aria-label={`${r.task.title}, due ${fmtDate(r.task.due)}`}
                  onClick={() => nav.push('task', { id: r.task.id })}
                  className="absolute top-2.5 h-6 rounded-md"
                  style={{ left: `${r.left}%`, width: `${r.width}%`, background: `${STATUS_META[r.task.status]?.color}55`, border: `1px solid ${STATUS_META[r.task.status]?.color}` }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- workload

function WorkloadView() {
  const ws = useSession((s) => s.workspaceId);
  const directory = useDirectory();
  const { data, loading } = useQuery(ws && `workload:${ws}`, () => api().workload(ws));
  const bars = workloadBars(data || []);
  if (loading) return <SkeletonRows count={4} />;
  if (!bars.length) return <EmptyState icon={Users} title="No open tasks" body="When people have open tasks, you'll see who has the most on their plate." />;
  return (
    <RowGroup className="mt-2" footer="Open tasks per person (everything not done or cancelled), including subtasks you can see.">
      {bars.map((w) => {
        const u = directory[w.userId] || w.user || { name: 'Unassigned' };
        return (
          <div key={w.userId || 'none'} className="flex items-center gap-3 px-4 py-3">
            <Avatar name={u.name} src={u.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[15px]">{u.name}</span>
                <span className="text-sm tabular-nums text-text-2">{w.count}</span>
              </div>
              <div className="mt-1.5">
                <Progress percent={w.percent} />
              </div>
            </div>
          </div>
        );
      })}
    </RowGroup>
  );
}

// ---------------------------------------------------------------- time report

function TimeReportView() {
  const ws = useSession((s) => s.workspaceId);
  const directory = useDirectory();
  const [range, setRange] = useState(() => prefs.get('tasks.timeRange', 'week'));
  const { data, loading, error, refetch } = useQuery(ws && `timereport:${ws}:${range}`, () => api().timeReport(ws, reportRange(range)), { staleMs: 30_000 });
  const people = reportRows(data?.byUser, data?.totalSeconds);
  const tasks = reportRows(data?.byTask, data?.totalSeconds);
  const pick = (v) => {
    prefs.set('tasks.timeRange', v);
    setRange(v);
  };
  let body;
  if (loading && !data) body = <SkeletonRows count={4} />;
  else if (error && !data) {
    body = <EmptyState icon={Clock} title="Couldn't load the time report" body={error.message} action={<Button variant="secondary" onClick={refetch}>Try again</Button>} />;
  } else if (!people.length && !tasks.length) {
    body = <EmptyState icon={Clock} title="No time logged in this period" body="Start a timer or log time on a task and it shows up here, per person and per task." />;
  } else {
    body = (
      <>
        <Section title="People">
          <RowGroup>
            {people.map((p) => {
              const u = directory[p.userId] || p.user || { name: 'Someone' };
              return (
                <div key={p.userId || 'none'} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={u.name} src={u.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[15px]">
                        {u.name}
                        {p.running && <span className="text-[12px] text-success"> · tracking</span>}
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">{formatDuration(p.seconds)}</span>
                    </div>
                    <div className="mt-1.5">
                      <Progress percent={p.share} />
                    </div>
                  </div>
                </div>
              );
            })}
          </RowGroup>
        </Section>
        <Section title="Tasks">
          <RowGroup>
            {tasks.map((t) => (
              <Row
                key={t.taskId}
                icon={ListChecks}
                title={t.title}
                subtitle={[t.issueKey, t.estimatedHours && `Estimate ${t.estimatedHours}h`].filter(Boolean).join(' · ') || undefined}
                value={formatDuration(t.seconds)}
                onClick={() => nav.push('task', { id: t.taskId })}
              />
            ))}
          </RowGroup>
        </Section>
      </>
    );
  }
  return (
    <>
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-1">
        <span className="text-[13px] text-text-2">Total</span>
        <span className="text-[17px] font-semibold tabular-nums">{formatDuration(data?.totalSeconds || 0)}</span>
      </div>
      <Chips className="pb-1" options={REPORT_RANGES} value={range} onChange={pick} />
      {body}
    </>
  );
}

// ---------------------------------------------------------------- templates

function NewTemplateSheet({ open, onClose }) {
  const ws = useSession((s) => s.workspaceId);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [subtasks, setSubtasks] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api().createTaskTemplate(ws, {
        name: name.trim(),
        title: title.trim() || name.trim(),
        description,
        priority,
        subtaskTitles: subtasks.split('\n').map((s) => s.trim()).filter(Boolean),
      });
      invalidate('templates');
      toast('Template saved', 'success');
      onClose();
    } catch (err) {
      toast(err.message || "Couldn't save the template", 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="New template" full footer={<Button block loading={busy} disabled={!name.trim()} onClick={save}>Save template</Button>}>
      <div className="space-y-4 px-5 pb-4">
        <Field label="Template name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bug report" autoFocus />
        <Field label="Task title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Defaults to the template name" />
        <Field label="Description" multiline value={description} onChange={(e) => setDescription(e.target.value)} />
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-text-2">Priority</p>
          <PriorityPicker value={priority} onChange={setPriority} />
        </div>
        <Field label="Subtasks (one per line)" multiline value={subtasks} onChange={(e) => setSubtasks(e.target.value)} placeholder={'Reproduce\nFix\nAdd a test'} />
      </div>
    </Sheet>
  );
}

function UseTemplateSheet({ template, onClose }) {
  const ws = useSession((s) => s.workspaceId);
  const me = useSession((s) => s.user?.id);
  const [title, setTitle] = useState(template?.title || '');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    try {
      const id = await api().createTaskFromTemplate(ws, template, { title: title.trim(), due: fromDateInput(due), me });
      invalidate('tasks', 'planning');
      toast('Task created', 'success');
      onClose(true);
      if (id) nav.open('tasks', 'task', { id });
    } catch (err) {
      toast(err.message || "Couldn't create the task", 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={Boolean(template)} onClose={() => onClose(false)} title={template ? `New from “${template.name}”` : ''} footer={<Button block loading={busy} disabled={!title.trim()} onClick={create}>Create task</Button>}>
      <div className="space-y-4 px-5 pb-4">
        <Field label="Title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <Field label="Due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        {template?.subtaskTitles?.length > 0 && (
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-text-2">Subtasks</p>
            <ul className="space-y-1 text-sm text-text-2">
              {template.subtaskTitles.map((s) => (
                <li key={s}>· {s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function useTemplates() {
  const ws = useSession((s) => s.workspaceId);
  return useQuery(ws && `templates:${ws}`, () => api().taskTemplates(ws), { staleMs: 60_000 });
}

/** "New task → From a template": pick one, then name it. */
export function TemplatePickerSheet({ open, onClose }) {
  const { data, loading } = useTemplates();
  const [picked, setPicked] = useState(null);
  return (
    <>
      <Sheet open={open && !picked} onClose={onClose} title="Choose a template">
        {loading ? (
          <SkeletonRows count={3} avatar={false} />
        ) : data?.length ? (
          <div className="px-2 pb-3">
            {data.map((t) => (
              <button key={t.id} type="button" onClick={() => setPicked(t)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left active:bg-surface-2">
                <LayoutTemplate size={20} className="shrink-0 text-text-2" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{t.name}</span>
                  <span className="block truncate text-[13px] text-text-2">{t.subtaskTitles.length ? `${t.subtaskTitles.length} subtasks` : t.description || 'No subtasks'}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState icon={LayoutTemplate} title="No templates yet" body="Save a template under Tasks → Planning → Templates." className="py-8" />
        )}
      </Sheet>
      {picked && (
        <UseTemplateSheet
          template={picked}
          onClose={(done) => {
            setPicked(null);
            if (done) onClose();
          }}
        />
      )}
    </>
  );
}

function TemplatesView() {
  const { data, loading } = useTemplates();
  const [creating, setCreating] = useState(false);
  const [using, setUsing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const remove = async () => {
    try {
      await api().deleteTaskTemplate(removing.id);
      invalidate('templates');
      toast('Template deleted');
    } catch (err) {
      toast(err.message || "Couldn't delete the template", 'danger');
    }
    setRemoving(null);
  };
  return (
    <>
      <div className="flex justify-end px-4 pt-1">
        <Button size="sm" variant="secondary" icon={Plus} onClick={() => setCreating(true)}>
          New template
        </Button>
      </div>
      {loading ? (
        <SkeletonRows count={3} avatar={false} />
      ) : data?.length ? (
        <RowGroup className="mt-3">
          {data.map((t) => (
            <div key={t.id} className="flex items-center pr-2">
              <button type="button" onClick={() => setUsing(t)} className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left active:bg-surface-2">
                <LayoutTemplate size={20} className="shrink-0 text-accent-ink" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{t.name}</span>
                  <span className="block truncate text-[13px] text-text-2">
                    {PRIORITY_META[t.priority]?.label} · {t.subtaskTitles.length} subtasks
                  </span>
                </span>
              </button>
              <IconButton icon={Trash2} size="sm" label={`Delete ${t.name}`} onClick={() => setRemoving(t)} />
            </div>
          ))}
        </RowGroup>
      ) : (
        <EmptyState icon={LayoutTemplate} title="No templates yet" body="Templates fill in a task's title, details and subtasks for work you do again and again." action={{ label: 'New template', icon: Plus, onClick: () => setCreating(true) }} />
      )}
      {creating && <NewTemplateSheet open onClose={() => setCreating(false)} />}
      {using && <UseTemplateSheet template={using} onClose={() => setUsing(null)} />}
      <Dialog open={Boolean(removing)} onClose={() => setRemoving(null)} title={`Delete “${removing?.name}”?`} body="Tasks created from it stay." confirmLabel="Delete" danger onConfirm={remove} />
    </>
  );
}

// ---------------------------------------------------------------- screen

export function PlanningScreen({ initial }) {
  const [view, setView] = useState(() => {
    const v = initial || prefs.get('tasks.planning', 'sprints');
    return VIEWS.some((x) => x.value === v) ? v : 'sprints';
  });
  const { data: tasks } = usePlanningTasks();
  const pick = (v) => {
    prefs.set('tasks.planning', v);
    setView(v);
  };
  return (
    <Screen>
      <Header title="Planning" subtitle="Sprints, milestones, time and design reviews">
        <Chips options={VIEWS} value={view} onChange={pick} className="pb-3" />
      </Header>
      <Body fluid={view === 'timeline'} onRefresh={() => invalidate('planning', 'sprints', 'milestones', 'workload', 'templates', 'timereport', 'designReviews')}>
        {view === 'sprints' && <SprintsView tasks={tasks || []} />}
        {view === 'milestones' && <MilestonesView tasks={tasks || []} />}
        {view === 'timeline' && (
          <Section title="Open tasks by due date">
            <TimelineView tasks={tasks || []} />
          </Section>
        )}
        {view === 'workload' && <WorkloadView />}
        {view === 'time' && <TimeReportView />}
        {view === 'reviews' && (
          <Suspense fallback={<SkeletonRows count={4} />}>
            <DesignReviewsView />
          </Suspense>
        )}
        {view === 'templates' && <TemplatesView />}
      </Body>
    </Screen>
  );
}

export const PLANNING_ICON = CalendarRange;
