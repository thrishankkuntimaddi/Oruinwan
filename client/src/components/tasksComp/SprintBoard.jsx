// client/src/components/tasksComp/SprintBoard.jsx
/**
 * SprintBoard — Groups tasks by sprint with a sprint selector dropdown.
 * Fetches sprints from GET /api/sprints?workspaceId=...
 * Uses the same `api` axios instance (auto-includes auth token + baseURL).
 */
import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Activity, Calendar, Clock } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';

const JIRA_BLUE = '#0052CC';

const STATUS_META = {
  'To Do':       { bg: '#DFE1E6', color: '#42526E' },
  'In Progress': { bg: '#DEEBFF', color: '#0052CC' },
  'In Review':   { bg: '#EAE6FF', color: '#6554C0' },
  'Completed':   { bg: '#E3FCEF', color: '#00875A' },
  'Blocked':     { bg: '#FFEBE6', color: '#FF5630' },
  'Cancelled':   { bg: '#FFE9E9', color: '#DE350B' },
};

const PRIORITY_COLORS = {
  Highest: '#CD1317', High: '#E97F33', Medium: '#E2B203', Low: '#3E7FC1', Lowest: '#7A869A', Emergency: '#CD1317'
};

function SprintTaskRow({ task, onClick }) {
  const sm = STATUS_META[task.status] || STATUS_META['To Do'];
  const pColor = PRIORITY_COLORS[task.priority] || '#E2B203';
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'Completed';

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 bg-white border-b hover:bg-gray-50 cursor-pointer transition-colors"
      style={{ borderColor: '#DFE1E6' }}
      onClick={() => onClick(task)}
    >
      {/* Priority dot */}
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: pColor }} />

      {/* Title */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${task.status === 'Completed' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
          {task.title}
        </p>
        {task.issueKey && (
          <span className="text-[10px] font-mono text-gray-400">{task.issueKey}</span>
        )}
      </div>

      {/* Due date */}
      {task.dueDate && (
        <span className={`text-[10px] flex items-center gap-1 flex-shrink-0 ${isOverdue ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
          <Calendar size={9} />
          {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {isOverdue && ' · Overdue'}
        </span>
      )}

      {/* Assignee */}
      {task.assignees?.[0]?.username && (
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
          style={{ background: '#6554C0' }}
          title={task.assignees[0].username}
        >
          {task.assignees[0].username.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Status badge */}
      <span
        className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-sm flex-shrink-0"
        style={{ background: sm.bg, color: sm.color }}
      >
        {task.status}
      </span>
    </div>
  );
}

function SprintProgress({ sprint, tasks }) {
  const sprintTasks = tasks.filter(t =>
    (t.sprintId && t.sprintId === sprint._id) ||
    (t.sprint && (t.sprint._id === sprint._id || t.sprint === sprint._id))
  );
  const done = sprintTasks.filter(t => t.status === 'Completed').length;
  const pct = sprintTasks.length > 0 ? Math.round((done / sprintTasks.length) * 100) : 0;
  return { pct, done, total: sprintTasks.length };
}

export default function SprintBoard({ tasks = [], workspaceId, onTaskClick }) {
  const { showToast } = useToast();
  const [sprints, setSprints] = useState([]);
  const [selectedSprint, setSelectedSprint] = useState('all');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    api.get(`/api/sprints?workspaceId=${workspaceId}`)
      .then(res => setSprints(res.data.sprints || []))
      .catch(err => {
        // Sprints may not exist yet — not an error
        if (err.response?.status !== 404) {
          showToast('Could not load sprints', 'error');
        }
      })
      .finally(() => setLoading(false));
  }, [workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredTasks = selectedSprint === 'all'
    ? tasks
    : tasks.filter(t =>
        (t.sprintId && t.sprintId === selectedSprint) ||
        (t.sprint && (t.sprint._id === selectedSprint || t.sprint === selectedSprint))
      );

  const activeSprint = sprints.find(s => s._id === selectedSprint);
  const selectedLabel = selectedSprint === 'all'
    ? `All Tasks (${tasks.length})`
    : activeSprint?.name || 'Sprint';

  // Stats for the current sprint
  const doneCount = filteredTasks.filter(t => t.status === 'Completed').length;
  const inProgressCount = filteredTasks.filter(t => t.status === 'In Progress').length;
  const blockedCount = filteredTasks.filter(t => t.status === 'Blocked').length;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div
        className="flex-shrink-0 bg-white border-b px-4 py-2.5 flex items-center gap-3"
        style={{ borderColor: '#DFE1E6' }}
      >
        <Activity size={14} style={{ color: JIRA_BLUE }} />
        <span className="text-xs font-semibold" style={{ color: '#172B4D' }}>Sprint</span>

        {/* Sprint selector dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen(v => !v)}
            className="flex items-center gap-2 text-xs border rounded px-2.5 py-1.5 bg-white hover:bg-gray-50 transition-colors min-w-[160px]"
            style={{ borderColor: '#DFE1E6', color: '#42526E' }}
          >
            <span className="flex-1 text-left truncate">{loading ? 'Loading…' : selectedLabel}</span>
            <ChevronDown size={12} className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div
              className="absolute top-full left-0 mt-1 z-50 bg-white rounded-sm shadow-lg border min-w-[220px]"
              style={{ borderColor: '#DFE1E6' }}
            >
              <button
                onClick={() => { setSelectedSprint('all'); setOpen(false); }}
                className="w-full text-left px-3 py-2.5 text-xs hover:bg-gray-50 border-b"
                style={{ color: selectedSprint === 'all' ? JIRA_BLUE : '#42526E', borderColor: '#DFE1E6' }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">All Tasks</span>
                  <span className="text-gray-400">{tasks.length}</span>
                </div>
              </button>
              {sprints.map(s => {
                const { pct, done, total } = SprintProgress({ sprint: s, tasks });
                const statusColor = s.status === 'active' ? '#00875A' : s.status === 'planning' ? '#0052CC' : '#7A869A';
                return (
                  <button
                    key={s._id}
                    onClick={() => { setSelectedSprint(s._id); setOpen(false); }}
                    className="w-full text-left px-3 py-2.5 text-xs hover:bg-gray-50 border-b"
                    style={{ color: selectedSprint === s._id ? JIRA_BLUE : '#42526E', borderColor: '#DFE1E6' }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: statusColor }} />
                        <span className="font-medium truncate">{s.name}</span>
                      </div>
                      <span className="text-gray-400 flex-shrink-0">{done}/{total}</span>
                    </div>
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#00875A' }} />
                    </div>
                    {s.startDate && s.endDate && (
                      <p className="text-[9px] text-gray-400 mt-0.5 flex items-center gap-1">
                        <Clock size={8} />
                        {new Date(s.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} →{' '}
                        {new Date(s.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    )}
                  </button>
                );
              })}
              {sprints.length === 0 && !loading && (
                <div className="px-3 py-3 text-xs text-gray-400 text-center">
                  No sprints yet. Create them from the Sprints API.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stats strip */}
        {filteredTasks.length > 0 && (
          <div className="flex items-center gap-3 ml-2">
            {[
              { label: 'Total', count: filteredTasks.length, color: '#42526E' },
              { label: 'Done', count: doneCount, color: '#00875A' },
              { label: 'In Progress', count: inProgressCount, color: JIRA_BLUE },
              { label: 'Blocked', count: blockedCount, color: '#FF5630' },
            ].filter(s => s.count > 0).map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                <span className="text-[10px] text-gray-500">{s.label}</span>
                <span className="text-[10px] font-bold" style={{ color: s.color }}>{s.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', background: '#F4F5F7' }}>
        {/* Table header */}
        <div
          className="sticky top-0 flex items-center gap-3 px-4 py-2 text-[10px] font-bold uppercase tracking-wider bg-white border-b"
          style={{ color: '#7A869A', borderColor: '#DFE1E6' }}
        >
          <span className="w-2" />
          <span className="flex-1">Summary</span>
          <span className="w-24 text-center">Due Date</span>
          <span className="w-6" />
          <span className="w-24 text-center">Status</span>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
            <Activity size={24} className="opacity-30" />
            <p className="text-sm">
              {selectedSprint === 'all' ? 'No tasks' : 'No tasks in this sprint'}
            </p>
            {selectedSprint !== 'all' && (
              <p className="text-xs text-gray-300">Tasks can be added to sprints via the Sprint API</p>
            )}
          </div>
        ) : (
          filteredTasks.map(task => (
            <SprintTaskRow key={task.id || task._id} task={task} onClick={onTaskClick} />
          ))
        )}
      </div>
    </div>
  );
}
