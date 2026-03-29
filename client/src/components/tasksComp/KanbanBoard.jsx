// client/src/components/tasksComp/KanbanBoard.jsx
/**
 * KanbanBoard — Drag-and-drop Kanban view for tasks
 * Uses native HTML5 drag and drop (no extra library).
 * On drop calls PUT /api/tasks/:id with new backend status,
 * then calls refreshTasks() from TasksContext to sync state.
 */
import React, { useState } from 'react';
import api from '@services/api';
import { useTasks } from '../../contexts/TasksContext';
import { useToast } from '../../contexts/ToastContext';

const JIRA_BLUE = '#0052CC';
const BOARD_BG = '#F4F5F7';
const CARD_SHADOW = '0 1px 2px rgba(9,30,66,0.25)';

const COLUMNS = [
  { key: 'To Do',      backendKey: 'todo',        label: 'TO DO',        color: '#42526E', headerBg: '#DFE1E6', topColor: '#42526E' },
  { key: 'In Progress', backendKey: 'in_progress', label: 'IN PROGRESS',  color: '#0052CC', headerBg: '#DEEBFF', topColor: '#0052CC' },
  { key: 'In Review',  backendKey: 'review',       label: 'IN REVIEW',    color: '#6554C0', headerBg: '#EAE6FF', topColor: '#6554C0' },
  { key: 'Completed',  backendKey: 'done',         label: 'DONE',         color: '#00875A', headerBg: '#E3FCEF', topColor: '#00875A' },
];

const PRIORITY_COLORS = {
  Highest: '#CD1317', High: '#E97F33', Medium: '#E2B203', Low: '#3E7FC1', Lowest: '#7A869A',
  Emergency: '#CD1317'
};

function KanbanCard({ task, onDragStart, onClick }) {
  const pColor = PRIORITY_COLORS[task.priority] || '#E2B203';
  const [dragging, setDragging] = useState(false);

  return (
    <div
      draggable
      onDragStart={() => { setDragging(true); onDragStart(task); }}
      onDragEnd={() => setDragging(false)}
      onClick={() => onClick(task)}
      className="bg-white rounded-sm cursor-pointer mb-2 select-none transition-all"
      style={{
        boxShadow: dragging ? 'none' : CARD_SHADOW,
        borderLeft: `3px solid ${pColor}`,
        opacity: dragging ? 0.5 : 1,
      }}
    >
      <div className="px-3 pt-2 pb-2.5">
        {/* Issue key */}
        {task.issueKey && (
          <span className="text-[9px] font-mono font-semibold text-gray-400 block mb-0.5">{task.issueKey}</span>
        )}
        <p className={`text-sm leading-snug ${task.status === 'Completed' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
          {task.title}
        </p>

        <div className="flex items-center gap-2 mt-2">
          {/* Priority dot */}
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: pColor }} title={task.priority} />
          {/* Due date */}
          {task.dueDate && (
            <span className="text-[9px] text-gray-400">
              {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          {/* Time tracking badge */}
          {task.timeTracking?.totalTime > 0 && (
            <span className="ml-auto text-[9px] font-medium" style={{ color: JIRA_BLUE }}>
              ⏱ {Math.floor(task.timeTracking.totalTime / 60)}m
            </span>
          )}
          {/* Assignee avatar */}
          {task.assignees?.[0] && (
            <div
              className="ml-auto w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
              style={{ background: '#6554C0' }}
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
      className="flex-1 flex flex-col min-w-[200px] max-w-[280px]"
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
      onDrop={() => { setDragOver(false); onDrop(col); }}
    >
      {/* Column header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0"
        style={{ borderTop: `3px solid ${col.topColor}` }}
      >
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: col.color }}>
          {col.label}
        </span>
        <span
          className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: col.headerBg, color: col.color }}
        >
          {tasks.length}
        </span>
      </div>

      {/* Cards drop zone */}
      <div
        className="flex-1 overflow-y-auto px-2 pb-2 min-h-[80px] rounded-sm transition-colors"
        style={{
          background: dragOver ? 'rgba(0,82,204,0.06)' : BOARD_BG,
          border: dragOver ? `2px dashed ${JIRA_BLUE}` : '2px solid transparent',
          scrollbarWidth: 'thin'
        }}
      >
        {tasks.map(t => (
          <KanbanCard key={t.id} task={t} onDragStart={onDragStart} onClick={onClick} />
        ))}
        {tasks.length === 0 && (
          <div className="h-16 flex items-center justify-center text-[10px] text-gray-400 opacity-60 select-none">
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

  // Group by frontend status (already mapped by TasksContext)
  const groups = COLUMNS.reduce((acc, col) => {
    acc[col.key] = tasks.filter(t => t.status === col.key);
    return acc;
  }, {});

  const handleDrop = async (targetCol) => {
    if (!draggingTask) return;
    if (draggingTask.status === targetCol.key) {
      setDraggingTask(null);
      return;
    }

    setUpdating(true);
    try {
      await api.put(`/api/v2/tasks/${draggingTask.id}`, { status: targetCol.backendKey });
      await refreshTasks();
      showToast(`Moved to ${targetCol.label}`, 'success');
    } catch (err) {
      showToast('Failed to update task status', 'error');
    } finally {
      setUpdating(false);
      setDraggingTask(null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Updating overlay indicator */}
      {updating && (
        <div className="flex-shrink-0 h-0.5 bg-blue-200 overflow-hidden">
          <div className="h-full bg-blue-500 animate-pulse" style={{ width: '60%' }} />
        </div>
      )}

      <div className="flex-1 flex gap-3 p-3 overflow-x-auto" style={{ background: BOARD_BG }}>
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
