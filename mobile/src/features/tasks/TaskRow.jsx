import { CircleDashed, Circle, CircleDot, CircleCheck, CircleX, CirclePause, Eye, MessageSquare, ListChecks } from 'lucide-react';
import { nav, useIsOpen } from '../../app/nav.js';
import { STATUS_META, PRIORITY_META } from '../../data/constants.js';
import { dueLabel } from '../../lib/time.js';
import { Icon } from '../../ui/Icon.jsx';
import { cx } from '../../ui/cx.js';
import { Avatar } from '../../ui/Avatar.jsx';

export const STATUS_ICON = {
  backlog: CircleDashed,
  todo: Circle,
  in_progress: CircleDot,
  review: Eye,
  blocked: CirclePause,
  done: CircleCheck,
  cancelled: CircleX,
};

const DUE_TONE = { overdue: 'text-danger', today: 'text-warning', soon: 'text-text-2', later: 'text-text-3' };

export function StatusIcon({ status, size = 18 }) {
  return <Icon as={STATUS_ICON[status] || Circle} size={size} style={{ color: STATUS_META[status]?.color }} aria-label={STATUS_META[status]?.label} />;
}

export function TaskRow({ task, directory = {}, compact = false, onClick }) {
  const due = dueLabel(task.due);
  const done = task.status === 'done' || task.status === 'cancelled';
  const assignees = task.assigneeIds.map((id) => directory[id]).filter(Boolean);
  const selected = useIsOpen('task', task.id);
  return (
    <button
      type="button"
      onClick={onClick || (() => nav.push('task', { id: task.id }))}
      aria-current={selected ? 'true' : undefined}
      className={cx('relative flex w-full items-start gap-3 py-3 pr-4 pl-4 text-left active:bg-surface-2', selected && 'bg-surface-2')}
    >
      <span className="absolute top-3 bottom-3 left-0 w-0.5 rounded-r" style={{ background: PRIORITY_META[task.priority]?.color }} aria-hidden />
      <span className="mt-0.5">
        <StatusIcon status={task.status} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cx('block text-[15px] leading-snug', done && 'text-text-2 line-through decoration-text-3')}>{task.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-text-2">
          {due && !done && <span className={cx('font-medium', DUE_TONE[due.tone])}>{due.text}</span>}
          {!compact && <span>{STATUS_META[task.status]?.label}</span>}
          {task.project && <span className="truncate">{task.project}</span>}
          {task.subtasks && (
            <span className="inline-flex items-center gap-1">
              <Icon as={ListChecks} size={12} />
              {task.subtasks.done}/{task.subtasks.total}
            </span>
          )}
          {!compact && task.comments > 0 && (
            <span className="inline-flex items-center gap-1">
              <Icon as={MessageSquare} size={12} />
              {task.comments}
            </span>
          )}
        </span>
        {task.status === 'blocked' && task.blockedReason && (
          <span className="mt-1 block truncate text-xs text-danger">Blocked: {task.blockedReason}</span>
        )}
      </span>
      {assignees.length > 0 && (
        <span className="flex shrink-0 -space-x-2 pt-0.5">
          {assignees.slice(0, 3).map((u) => (
            <span key={u.id} className="rounded-full ring-2 ring-surface">
              <Avatar name={u.name} src={u.avatarUrl} size="xs" />
            </span>
          ))}
        </span>
      )}
    </button>
  );
}
