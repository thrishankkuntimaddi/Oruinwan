import React, { useState } from 'react';
import { Calendar, Lock, Ban } from 'lucide-react';
import { BOARD_STATUSES, STATUS_META, statusLabel, canTransition } from '../../utils/taskMeta';
import { PriorityIcon, AvatarStack, fmtDate, isOverdue, tint, FONT } from './taskUi';

/**
 * Status board. Moving a card calls onStatusChange(task, status); the page
 * decides whether a note/reason is needed and saves it. While a card is
 * dragged, columns it cannot move to (see taskMeta TRANSITIONS) are greyed out
 * and refuse the drop. Cards the viewer may not move are not draggable.
 */
function KanbanCard({ task, draggable, onDragStart, onDragEnd, onClick, dragging }) {
  const overdue = isOverdue(task);
  const done = task.status === 'done';
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', task.id); } catch { /* ignore */ }
        onDragStart(task);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onClick(task)}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(task); }}
      role="button"
      tabIndex={0}
      title={draggable ? undefined : 'Only the creator, assignees or workspace admins can move this task'}
      style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px',
        marginBottom: '6px', cursor: draggable ? 'grab' : 'pointer', userSelect: 'none',
        opacity: dragging ? 0.4 : 1, transition: 'border-color 120ms ease, opacity 120ms ease', fontFamily: FONT,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
    >
      <div style={{ padding: '9px 10px 10px' }}>
        {task.issueKey && (
          <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>{task.issueKey}</span>
        )}
        <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.45, color: done ? 'var(--text-secondary)' : 'var(--text-primary)', textDecoration: done ? 'line-through' : 'none', wordBreak: 'break-word' }}>
          {task.title}
        </p>
        {task.status === 'blocked' && task.blockedReason && (
          <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--state-danger)', display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
            <Ban size={11} style={{ flexShrink: 0, marginTop: '2px' }} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{task.blockedReason}</span>
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', minHeight: '20px' }}>
          <PriorityIcon priority={task.priority} size={13} />
          {task.channel?.name && (
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90px' }}>#{task.channel.name}</span>
          )}
          {task.dueDate && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', whiteSpace: 'nowrap', color: overdue ? 'var(--state-danger)' : 'var(--text-secondary)', fontWeight: overdue ? 700 : 500 }}>
              <Calendar size={10} /> {fmtDate(task.dueDate, { month: 'short', day: 'numeric' })}
            </span>
          )}
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            {!draggable && <Lock size={10} style={{ color: 'var(--text-muted)' }} aria-label="Read-only" />}
            {task.assignees.length > 0 && <AvatarStack users={task.assignees} size={18} max={3} />}
          </span>
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ status, tasks, dragTask, blocked, onDrop, children }) {
  const [over, setOver] = useState(false);
  const meta = STATUS_META[status];
  const allowed = dragTask && !blocked && dragTask.status !== status;
  return (
    <div
      data-status={status}
      style={{ flex: '1 1 0', minWidth: '168px', maxWidth: '320px', display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '2px', opacity: dragTask && blocked ? 0.4 : 1, transition: 'opacity 120ms ease' }}
      onDragOver={(e) => { if (!allowed) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!over) setOver(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); }}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (allowed) onDrop(status); }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderTop: `2px solid ${meta.color}`, flexShrink: 0 }}>
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-primary)', fontFamily: FONT }}>
          {statusLabel(status)}
        </span>
        <span style={{ fontSize: '11px', fontWeight: 700, minWidth: '20px', padding: '1px 6px', borderRadius: '2px', background: 'var(--bg-active)', color: 'var(--text-secondary)', textAlign: 'center' }}>
          {tasks.length}
        </span>
        {dragTask && blocked && <Lock size={11} style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }} aria-label="Not allowed" />}
      </div>
      <div style={{
        flex: 1, overflowY: 'auto', padding: '8px', minHeight: '90px', scrollbarWidth: 'thin',
        background: over ? tint('var(--accent)', 8) : 'transparent',
        outline: over ? '1px dashed var(--accent)' : '1px dashed transparent', outlineOffset: '-4px',
        transition: 'background 120ms ease',
      }}>
        {children}
        {tasks.length === 0 && (
          <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--text-secondary)', fontFamily: FONT }}>
            {dragTask ? (blocked ? `Can't move to ${statusLabel(status)}` : over ? 'Release to drop' : 'Drop here') : 'No issues'}
          </div>
        )}
      </div>
    </div>
  );
}

export default function KanbanBoard({ tasks = [], onTaskClick, onStatusChange, canMove = () => true }) {
  const [dragTask, setDragTask] = useState(null);

  const groups = BOARD_STATUSES.reduce((acc, s) => { acc[s] = tasks.filter((t) => t.status === s); return acc; }, {});

  const handleDrop = (status) => {
    const t = dragTask;
    setDragTask(null);
    if (!t || t.status === status || !canTransition(t.status, status)) return;
    onStatusChange?.(t, status);
  };

  return (
    <div className="tasks-ui" style={{ height: '100%', display: 'flex', gap: '10px', padding: '12px', overflowX: 'auto', overflowY: 'hidden', background: 'var(--bg-base)', boxSizing: 'border-box' }}>
      {BOARD_STATUSES.map((status) => (
        <KanbanColumn
          key={status}
          status={status}
          tasks={groups[status]}
          dragTask={dragTask}
          blocked={dragTask ? !canTransition(dragTask.status, status) : false}
          onDrop={handleDrop}
        >
          {groups[status].map((t) => (
            <KanbanCard
              key={t.id}
              task={t}
              draggable={canMove(t)}
              dragging={dragTask?.id === t.id}
              onDragStart={setDragTask}
              onDragEnd={() => setDragTask(null)}
              onClick={onTaskClick}
            />
          ))}
        </KanbanColumn>
      ))}
    </div>
  );
}
