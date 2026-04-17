// client/src/components/tasksComp/KanbanBoard.jsx
import React, { useState } from 'react';
import api from '@services/api';
import { useTasks } from '../../contexts/TasksContext';
import { useToast } from '../../contexts/ToastContext';

const T = {
  bg: '#0c0c0c',
  cardBg: 'rgba(255,255,255,0.04)',
  cardBorder: 'rgba(255,255,255,0.08)',
  colBg: 'rgba(255,255,255,0.02)',
  text: '#e4e4e4',
  muted: 'rgba(228,228,228,0.35)',
  accent: '#b8956a',
  font: 'Inter, system-ui, sans-serif',
};

const COLUMNS = [
  { key: 'To Do',       backendKey: 'todo',        label: 'TO DO',       topColor: 'rgba(228,228,228,0.2)' },
  { key: 'In Progress', backendKey: 'in_progress', label: 'IN PROGRESS', topColor: '#3b82f6' },
  { key: 'In Review',   backendKey: 'review',      label: 'IN REVIEW',   topColor: '#8b5cf6' },
  { key: 'Completed',   backendKey: 'done',        label: 'DONE',        topColor: '#22c55e' },
];

const PRIORITY_COLORS = {
  Highest: '#ef4444', High: '#f97316', Medium: '#b8956a',
  Low: '#3b82f6', Lowest: 'rgba(228,228,228,0.3)', Emergency: '#ef4444'
};

function KanbanCard({ task, onDragStart, onClick }) {
  const pColor = PRIORITY_COLORS[task.priority] || T.accent;
  const [dragging, setDragging] = useState(false);

  return (
    <div
      draggable
      onDragStart={() => { setDragging(true); onDragStart(task); }}
      onDragEnd={() => setDragging(false)}
      onClick={() => onClick(task)}
      style={{
        background: T.cardBg, border: `1px solid ${T.cardBorder}`,
        borderLeft: `3px solid ${pColor}`,
        marginBottom: '6px', cursor: 'pointer', userSelect: 'none',
        transition: 'all 150ms ease', opacity: dragging ? 0.45 : 1,
        fontFamily: T.font,
      }}
      onMouseEnter={e => { if (!dragging) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; e.currentTarget.style.borderLeftColor = pColor; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = T.cardBorder; e.currentTarget.style.borderLeftColor = pColor; }}
    >
      <div style={{ padding: '8px 12px 10px' }}>
        {task.issueKey && (
          <span style={{ fontSize: '9px', fontFamily: 'monospace', fontWeight: 700, color: T.muted, display: 'block', marginBottom: '2px' }}>{task.issueKey}</span>
        )}
        <p style={{ fontSize: '13px', lineHeight: 1.45, color: task.status === 'Completed' ? 'rgba(228,228,228,0.3)' : T.text, textDecoration: task.status === 'Completed' ? 'line-through' : 'none' }}>
          {task.title}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: pColor, flexShrink: 0 }} title={task.priority} />
          {task.dueDate && (
            <span style={{ fontSize: '9px', color: T.muted }}>
              {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          {task.assignees?.[0] && (
            <div
              style={{ marginLeft: 'auto', width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(184,149,106,0.25)', border: '1px solid rgba(184,149,106,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: 700, color: T.accent }}
              title={task.assignees[0].username}
            >
              {(task.assignees[0].username || '?').charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ col, tasks, onDragStart, onDrop, onClick }) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: '200px', maxWidth: '280px' }}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
      onDrop={() => { setDragOver(false); onDrop(col); }}
    >
      {/* Column header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderTop: `3px solid ${col.topColor}`, flexShrink: 0, background: T.colBg }}>
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: col.topColor, fontFamily: T.font }}>
          {col.label}
        </span>
        <span style={{ fontSize: '10px', fontWeight: 700, width: '20px', height: '20px', borderRadius: '50%', background: 'var(--bg-active)', color: T.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.font }}>
          {tasks.length}
        </span>
      </div>

      {/* Cards drop zone */}
      <div
        style={{
          flex: 1, overflowY: 'auto', padding: '8px', minHeight: '80px',
          background: dragOver ? 'rgba(184,149,106,0.05)' : T.colBg,
          border: dragOver ? '2px dashed rgba(184,149,106,0.4)' : '2px solid transparent',
          transition: 'all 150ms ease', scrollbarWidth: 'thin',
        }}
      >
        {tasks.map(t => (
          <KanbanCard key={t.id} task={t} onDragStart={onDragStart} onClick={onClick} />
        ))}
        {tasks.length === 0 && (
          <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: T.muted, fontFamily: T.font }}>
            {dragOver ? 'Release to drop' : 'No issues'}
          </div>
        )}
      </div>
    </div>
  );
}

export default function KanbanBoard({ tasks = [], onTaskClick }) {
  const { refreshTasks } = useTasks();
  const { showToast } = useToast();
  const [draggingTask, setDraggingTask] = useState(null);
  const [updating, setUpdating] = useState(false);

  const groups = COLUMNS.reduce((acc, col) => {
    acc[col.key] = tasks.filter(t => t.status === col.key);
    return acc;
  }, {});

  const handleDrop = async (targetCol) => {
    if (!draggingTask) return;
    if (draggingTask.status === targetCol.key) { setDraggingTask(null); return; }
    setUpdating(true);
    try {
      await api.put(`/api/v2/tasks/${draggingTask.id}`, { status: targetCol.backendKey });
      await refreshTasks();
      showToast(`Moved to ${targetCol.label}`, 'success');
    } catch {
      showToast('Failed to update task status', 'error');
    } finally {
      setUpdating(false);
      setDraggingTask(null);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg }}>
      {/* Updating indicator */}
      {updating && (
        <div style={{ flexShrink: 0, height: '2px', background: 'var(--bg-active)', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: T.accent, width: '60%', animation: 'pulse 1s ease-in-out infinite' }} />
        </div>
      )}
      <div style={{ flex: 1, display: 'flex', gap: '10px', padding: '12px', overflowX: 'auto', background: T.bg }}>
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.key}
            col={col}
            tasks={groups[col.key] || []}
            onDragStart={setDraggingTask}
            onDrop={handleDrop}
            onClick={onTaskClick}
          />
        ))}
      </div>
    </div>
  );
}
