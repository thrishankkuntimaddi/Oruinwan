/**
 * MyTasks.jsx — Jira-Grade Workspace Task Dashboard
 *
 * Scope: ENTIRE workspace — personal, incoming, delegated, across ALL channels
 *
 * Views:
 *  - My Issues       (self-created self-assigned)
 *  - Incoming        (assigned to me by others)
 *  - Given           (I delegated to others)
 *  - All Issues      (everything I can see — filterable by channel)
 *  - Completed       (done tasks)
 *  - Trash           (deleted tasks with restore/permanent delete)
 *
 * Modes: List view (default) | Board view (Jira Kanban)
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Plus, Search, X, Loader2, CheckCircle2, Clock, Circle,
  ChevronUp, ChevronDown, Minus, Calendar, User, Flag,
  AlertTriangle, Trash2, RotateCcw, Activity, ListTodo,
  LayoutGrid, List, SlidersHorizontal, ChevronRight,
  BookOpen, Inbox, Send, Eye, Archive, Hash, Bell, Zap,
  GitBranch, Timer, Users
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import TaskModal from '../../components/tasksComp/TaskModal';
import WorkspaceTaskDetailPanel from '../../components/tasksComp/WorkspaceTaskDetailPanel';
import TransferRequestModal from '../../components/tasksComp/TransferRequestModal';
import TaskCompletionModal from '../../components/tasksComp/TaskCompletionModal';
import KanbanBoard from '../../components/tasksComp/KanbanBoard';
import SprintBoard from '../../components/tasksComp/SprintBoard';
import TimelineView from '../../components/tasksComp/TimelineView';
import WorkloadPanel from '../../components/tasksComp/WorkloadPanel';
import { useTasks } from '../../contexts/TasksContext';
import { useAuth } from '../../contexts/AuthContext';
import { useContacts } from '../../contexts/ContactsContext';
import api from '../../services/api';

// ─── Design tokens (Jira Atlas palette) ─────────────────────────────────────-

const JIRA_BLUE = '#0052CC';
const BOARD_BG = '#F4F5F7';
const CARD_SHADOW = '0 1px 2px rgba(9,30,66,0.25)';

const STATUS_META = {
  'To Do': { bg: '#DFE1E6', color: '#42526E', border: '#DFE1E6' },
  'In Progress': { bg: '#DEEBFF', color: '#0052CC', border: '#0052CC' },
  'Completed': { bg: '#E3FCEF', color: '#00875A', border: '#00875A' },
  'Cancelled': { bg: '#FFE9E9', color: '#DE350B', border: '#DE350B' },
  'Blocked': { bg: '#FFE9E9', color: '#FF5630', border: '#FF5630' },
  'In Review': { bg: '#EAE6FF', color: '#6554C0', border: '#6554C0' },
};

const PRIORITY_META = {
  Highest: { color: '#CD1317', bg: 'rgba(205,19,23,0.08)' },
  High: { color: '#E97F33', bg: 'rgba(233,127,51,0.08)' },
  Medium: { color: '#E2B203', bg: 'rgba(226,178,3,0.08)' },
  Low: { color: '#3E7FC1', bg: 'rgba(62,127,193,0.08)' },
  Lowest: { color: '#7A869A', bg: 'rgba(122,134,154,0.08)' },
  // Legacy values
  Emergency: { color: '#CD1317', bg: 'rgba(205,19,23,0.08)' },
};

const BOARD_COLUMNS = [
  { key: 'To Do', label: 'TO DO', color: '#42526E', headerBg: '#DFE1E6', topColor: '#42526E' },
  { key: 'In Progress', label: 'IN PROGRESS', color: '#0052CC', headerBg: '#DEEBFF', topColor: '#0052CC' },
  { key: 'In Review', label: 'IN REVIEW', color: '#6554C0', headerBg: '#EAE6FF', topColor: '#6554C0' },
  { key: 'Completed', label: 'DONE', color: '#00875A', headerBg: '#E3FCEF', topColor: '#00875A' },
];

const SIDEBAR_VIEWS = [
  { key: 'my-tasks', label: 'My Issues', icon: <Circle size={15} /> },
  { key: 'shared-tasks', label: 'Incoming', icon: <Inbox size={15} /> },
  { key: 'assigned-tasks', label: 'Given', icon: <Send size={15} /> },
  { key: 'all-tasks', label: 'All Issues', icon: <Eye size={15} /> },
  null, // separator
  { key: 'completed-tasks', label: 'Completed', icon: <CheckCircle2 size={15} /> },
  { key: 'deleted-tasks', label: 'Trash', icon: <Trash2 size={15} /> },
];

const SORT_OPTIONS = [
  { id: 'priority', label: 'Priority' },
  { id: 'dueDate', label: 'Due Date' },
  { id: 'status', label: 'Status' },
  { id: 'a-z', label: 'Alphabetical' },
  { id: 'newest', label: 'Newest First' },
];

const PRIORITY_ORDER = { Emergency: 5, Highest: 5, High: 4, Medium: 3, Low: 2, Lowest: 1 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function PriorityIcon({ priority, size = 14 }) {
  const p = priority?.toLowerCase();
  const color = PRIORITY_META[priority]?.color || '#E2B203';
  if (p === 'highest' || p === 'emergency') return <ChevronUp size={size} strokeWidth={3} style={{ color }} />;
  if (p === 'high') return <ChevronUp size={size} strokeWidth={2} style={{ color }} />;
  if (p === 'low') return <ChevronDown size={size} strokeWidth={2} style={{ color }} />;
  if (p === 'lowest') return <ChevronDown size={size} strokeWidth={3} style={{ color }} />;
  return <Minus size={size} strokeWidth={2.5} style={{ color }} />;
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META['To Do'];
  return (
    <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-sm"
      style={{ background: m.bg, color: m.color }}>
      {status === 'To Do' && <Circle size={8} className="mr-1" strokeWidth={2.5} />}
      {status === 'In Progress' && <Clock size={8} className="mr-1" strokeWidth={2.5} />}
      {status === 'Completed' && <CheckCircle2 size={8} className="mr-1" strokeWidth={2.5} />}
      {status}
    </span>
  );
}

function avatarColor(name) {
  const colors = ['#6554C0', '#0052CC', '#00875A', '#FF5630', '#FF991F', '#36B37E', '#00B8D9', '#8777D9'];
  if (!name) return colors[0];
  return colors[name.charCodeAt(0) % colors.length];
}
function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}
function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function isOverdue(task) {
  return task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'Completed' && task.status !== 'Cancelled';
}

// ─── Issue Type Icon (Jira-discipline) ────────────────────────────────

const ISSUE_TYPE_META = {
  epic: { label: 'Epic', color: '#6554C0', bg: '#EAE6FF', Icon: Zap },
  bug: { label: 'Bug', color: '#FF5630', bg: '#FFEBE6', Icon: AlertTriangle },
  subtask: { label: 'Subtask', color: '#00B8D9', bg: '#E6FCFF', Icon: CheckCircle2 },
  task: { label: 'Task', color: '#0052CC', bg: '#DEEBFF', Icon: CheckCircle2 },
};

function IssueTypeIcon({ type = 'task', size = 11 }) {
  const meta = ISSUE_TYPE_META[type] || ISSUE_TYPE_META.task;
  const { Icon, color, bg } = meta;
  return (
    <span title={meta.label}
      className="inline-flex items-center justify-center rounded-sm flex-shrink-0"
      style={{ width: 16, height: 16, background: bg }}>
      <Icon size={size} style={{ color }} strokeWidth={2.5} />
    </span>
  );
}

// ─── Transfer Request Banner ───────────────────────────────────────────────

function TransferBanner({ task, onApprove, onReject, onRequest }) {
  if (task.transferRequest?.status === 'pending') {
    return (
      <div className="flex items-start gap-2 px-3 py-2 rounded-sm mt-2 text-xs"
        style={{ background: '#EAE6FF', border: '1px solid #C0B6F2' }}>
        <Bell size={12} className="mt-0.5 flex-shrink-0" style={{ color: '#6554C0' }} />
        <div className="flex-1">
          <span className="font-semibold" style={{ color: '#6554C0' }}>Transfer Pending</span>
          <span className="text-gray-500 ml-1">→ {task.transferRequest.requestedTo?.username || '?'}</span>
          {task.transferRequest.note && <p className="text-gray-500 italic mt-0.5">"{task.transferRequest.note}"</p>}
        </div>
        {onApprove && (
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={e => { e.stopPropagation(); onApprove(); }}
              className="px-2 py-1 text-[10px] font-bold text-white rounded-sm"
              style={{ background: '#6554C0' }}>Approve</button>
            <button onClick={e => { e.stopPropagation(); onReject(); }}
              className="px-2 py-1 text-[10px] font-medium text-gray-600 bg-white border border-gray-200 rounded-sm">Reject</button>
          </div>
        )}
      </div>
    );
  }
  return null;
}

// ─── List Row ─────────────────────────────────────────────────────────────────

function ListRow({ task, view, onEdit, onDelete, onRestore, onPermanentDelete, onTransferRequest, onTransferApprove, onTransferReject, onStatusChange }) {
  const isDeleted = task.deleted;
  const isCompleted = task.status === 'Completed';
  const overdue = isOverdue(task);
  const pMeta = PRIORITY_META[task.priority] || PRIORITY_META.Medium;
  const isIncoming = view === 'shared-tasks';
  const isGiven = view === 'assigned-tasks';

  return (
    <div
      className="group relative bg-white hover:bg-gray-50 transition-colors cursor-pointer border-b"
      style={{ borderColor: '#DFE1E6' }}
      onClick={() => onEdit(task)}
    >
      {/* Priority strip */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r-full"
        style={{ background: pMeta.color }} />

      <div className="flex items-center gap-4 px-4 py-3 pl-5">
        {/* Issue type icon (replaces plain status dot) */}
        <div className="flex-shrink-0">
          <IssueTypeIcon type={task.issueType || 'task'} size={11} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            {/* Issue key */}
            {task.issueKey && (
              <span className="text-[10px] font-mono font-semibold flex-shrink-0 mt-0.5" style={{ color: '#7A869A' }}>
                {task.issueKey}
              </span>
            )}
            <p className={`text-sm font-medium leading-snug flex-1 truncate ${isCompleted || isDeleted ? 'line-through text-gray-400' : 'text-gray-900'}`}>
              {task.title}
            </p>
          </div>

          {/* Labels chips */}
          {task.labels?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {task.labels.slice(0, 4).map(l => (
                <span key={l} className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium"
                  style={{ background: '#F4F5F7', color: '#42526E' }}>{l}</span>
              ))}
            </div>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {/* Channel / Project */}
            <span className="flex items-center gap-1 text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
              <Hash size={9} /> {task.project || 'General'}
            </span>

            {/* Priority */}
            <span className="flex items-center gap-0.5 text-[10px] font-semibold"
              style={{ color: PRIORITY_META[task.priority]?.color || '#E2B203' }}>
              <PriorityIcon priority={task.priority} size={10} />
              {task.priority}
            </span>

            {/* Due date */}
            {task.dueDate && (
              <span className={`flex items-center gap-1 text-[10px] font-medium ${isOverdue(task) ? 'text-red-600' : 'text-gray-400'}`}>
                <Calendar size={9} />
                {fmtDate(task.dueDate)}
                {isOverdue(task) && ' · Overdue'}
              </span>
            )}

            {/* From/To */}
            {isIncoming && (
              <span className="text-[10px] text-gray-400">
                From: <span className="font-medium text-gray-600">{task.assigner}</span>
              </span>
            )}
            {isGiven && (
              <span className="text-[10px] text-gray-400">
                To: <span className="font-medium text-gray-600">{task.assignee}</span>
              </span>
            )}
          </div>
        </div>

        {/* Status badge */}
        <div className="flex-shrink-0">
          <StatusBadge status={task.status} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {isDeleted ? (
            <>
              <button onClick={e => { e.stopPropagation(); onRestore(task.id); }}
                className="p-1.5 rounded text-green-600 hover:bg-green-50 transition-colors"
                title="Restore">
                <RotateCcw size={13} />
              </button>
              <button onClick={e => { e.stopPropagation(); onPermanentDelete(task.id); }}
                className="p-1.5 rounded text-red-500 hover:bg-red-50 transition-colors"
                title="Delete forever">
                <Trash2 size={13} />
              </button>
            </>
          ) : isIncoming && !isCompleted ? (
            <>
              {task.transferRequest?.status !== 'pending' && (
                <button onClick={e => { e.stopPropagation(); onTransferRequest(task); }}
                  title="Request transfer"
                  className="p-1.5 rounded text-purple-500 hover:bg-purple-50 transition-colors">
                  <RotateCcw size={13} />
                </button>
              )}
            </>
          ) : (
            <button onClick={e => { e.stopPropagation(); onDelete(task.id); }}
              className="p-1.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Delete">
              <Trash2 size={13} />
            </button>
          )}
        </div>

        {/* Assignee avatar */}
        {task.assignee && task.assignee !== 'Self' && (
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
            style={{ background: avatarColor(task.assignee) }}
            title={task.assignee}>
            {initials(task.assignee)}
          </div>
        )}
      </div>

      {/* Transfer request banner (for given tasks) */}
      {isGiven && task.transferRequest?.status === 'pending' && (
        <div className="px-5 pb-2">
          <TransferBanner
            task={task}
            onApprove={() => onTransferApprove(task.id)}
            onReject={() => onTransferReject(task.id)}
          />
        </div>
      )}
    </div>
  );
}

// ─── Board Card ───────────────────────────────────────────────────────────────

function BoardCard({ task, view, onEdit, onDelete, onRestore }) {
  const overdue = isOverdue(task);
  const pMeta = PRIORITY_META[task.priority] || PRIORITY_META.Medium;

  return (
    <div
      onClick={() => onEdit(task)}
      className="group bg-white rounded-sm cursor-pointer mb-2 relative"
      style={{
        boxShadow: CARD_SHADOW,
        borderLeft: `3px solid ${pMeta.color}`,
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = `${CARD_SHADOW}, 0 0 0 1px rgba(0,82,204,0.4)`; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = CARD_SHADOW; }}
    >
      <div className="px-3 pt-2 pb-2.5">
        <div className="flex items-start gap-2">
          <div className="w-3.5 h-3.5 rounded-sm flex items-center justify-center mt-0.5 flex-shrink-0"
            style={{ background: STATUS_META[task.status]?.color || '#42526E' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-white opacity-90" />
          </div>
          <p className={`text-sm leading-snug flex-1 ${task.status === 'Completed' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
            {task.title}
          </p>
          <button onClick={e => { e.stopPropagation(); onDelete(task.id); }}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-300 hover:text-red-500 transition-all flex-shrink-0">
            <X size={11} />
          </button>
        </div>

        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className="flex items-center gap-1 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
            <Hash size={8} /> {task.project || 'General'}
          </span>
          <PriorityIcon priority={task.priority} size={12} />
          {task.dueDate && (
            <span className={`flex items-center gap-0.5 text-[10px] ${overdue ? 'text-red-600' : 'text-gray-400'}`}>
              <Calendar size={9} />
              {fmtDate(task.dueDate).slice(0, 6)}
            </span>
          )}
          <div className="flex-1" />
          {task.assignee && task.assignee !== 'Self' && (
            <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
              style={{ background: avatarColor(task.assignee) }}>
              {initials(task.assignee)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Board Column ─────────────────────────────────────────────────────────────

function BoardColumn({ col, tasks, view, onEdit, onDelete }) {
  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0" style={{ background: BOARD_BG }}>
      <div className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0"
        style={{ borderTop: `3px solid ${col.topColor}` }}>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: col.color }}>
          {col.label}
        </span>
        <span className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: col.headerBg, color: col.color }}>
          {tasks.length}
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2"
        style={{ scrollbarWidth: 'thin' }}>
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-16 opacity-40">
            <p className="text-xs text-gray-400">No issues</p>
          </div>
        ) : (
          tasks.map(t => (
            <BoardCard key={t.id} task={t} view={view} onEdit={onEdit} onDelete={() => { }} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Stats Strip ──────────────────────────────────────────────────────────────

function StatsStrip({ tasks, currentUserId }) {
  const active = tasks.filter(t => !t.deleted && t.status !== 'Completed');
  const overdue = active.filter(t => isOverdue(t));
  const mine = active.filter(t => String(t.assigneeId) === String(currentUserId) || String(t.assignerId) === String(currentUserId));
  const completed = tasks.filter(t => t.status === 'Completed').length;

  const stats = [
    { label: 'Active', value: active.length, color: JIRA_BLUE },
    { label: 'Overdue', value: overdue.length, color: '#FF5630' },
    { label: 'Mine', value: mine.length, color: '#6554C0' },
    { label: 'Completed', value: completed, color: '#00875A' },
  ];

  return (
    <div className="flex gap-3 px-5 pb-3 flex-shrink-0">
      {stats.map(s => (
        <div key={s.label} className="flex items-center gap-2 bg-white rounded-sm px-3 py-2"
          style={{ boxShadow: CARD_SHADOW, border: '1px solid #DFE1E6' }}>
          <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
          <span className="text-[11px] text-gray-500 font-medium">{s.label}</span>
          <span className="text-sm font-bold" style={{ color: s.color }}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Create / Edit Task Modal (wrapper) ───────────────────────────────────────

function CreateTaskModal({ initialData, channels, members, onClose, onSubmit, onUpdate }) {
  return (
    <TaskModal
      onClose={onClose}
      onAddTask={onSubmit}
      onUpdateTask={onUpdate}
      initialData={initialData}
      channels={channels}
      teamMembers={members}
    />
  );
}

// ─── Main MyTasks ─────────────────────────────────────────────────────────────

export default function MyTasks() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeView = new URLSearchParams(location.search).get('tab') || 'my-tasks';

  const { tasks, loading, createTask, updateTask, deleteTask, restoreTask, permanentlyDeleteTask, handleTransferResponse } = useTasks();
  const { user } = useAuth();
  const { members, channels } = useContacts();
  // Extract workspaceId from URL for workload/sprint endpoints
  const pathMatch = window.location.pathname.match(/\/workspace\/([^/]+)/);
  const workspaceId = pathMatch ? pathMatch[1] : null;

  const [viewMode, setViewMode] = useState('list'); // list | board | sprint | timeline | workload
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('priority');
  const [channelFilter, setChannelFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  // Right-side detail panel (replaces click-to-edit modal)
  const [selectedTask, setSelectedTask] = useState(null);
  const [completionTask, setCompletionTask] = useState(null);
  const [deletionTask, setDeletionTask] = useState(null);
  const [transferTask, setTransferTask] = useState(null);

  const currentUserId = user?._id || user?.id;


  // Filter logic by view — declared BEFORE channelCounts so it can be used as dependency
  const viewFiltered = useMemo(() => {
    const isAssignee = (t) => {
      if (t.assignees?.length > 0) return t.assignees.some(a => String(a._id || a.id) === String(currentUserId));
      return String(t.assigneeId) === String(currentUserId);
    };

    const active = tasks.filter(t => !t.deleted);

    switch (activeView) {
      case 'my-tasks':
        return active.filter(t => isAssignee(t) && String(t.assignerId) === String(currentUserId) && t.status !== 'Completed');
      case 'shared-tasks':
        return active.filter(t => isAssignee(t) && String(t.assignerId) !== String(currentUserId) && t.status !== 'Completed');
      case 'assigned-tasks':
        return active.filter(t => String(t.assignerId) === String(currentUserId) && !isAssignee(t) && t.status !== 'Completed');
      case 'all-tasks':
        return active.filter(t => t.status !== 'Completed');
      case 'completed-tasks':
        return active.filter(t => t.status === 'Completed');
      case 'deleted-tasks':
        return tasks.filter(t => t.deleted);
      default:
        return active;
    }
  }, [tasks, activeView, currentUserId]);

  // channelCounts: channels that have tasks in the current view, sorted by count
  const channelCounts = useMemo(() => {
    const counts = {};
    viewFiltered.forEach(t => {
      const ch = t.project || 'General';
      counts[ch] = (counts[ch] || 0) + 1;
    });
    return counts;
  }, [viewFiltered]);

  // channelNames: only channels that appear in this view, sorted by task count desc
  const channelNames = useMemo(() => {
    return Object.keys(channelCounts).sort((a, b) => channelCounts[b] - channelCounts[a]);
  }, [channelCounts]);

  // Second-pass filters: search + channel + priority + sort
  const filtered = useMemo(() => {
    let list = [...viewFiltered];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      );
    }

    if (channelFilter !== 'all') {
      list = list.filter(t => (t.project || 'General') === channelFilter);
    }

    if (priorityFilter !== 'all') {
      list = list.filter(t => t.priority === priorityFilter);
    }

    return list.sort((a, b) => {
      if (sortOrder === 'priority') return (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0);
      if (sortOrder === 'dueDate') return new Date(a.dueDate || '2099') - new Date(b.dueDate || '2099');
      if (sortOrder === 'status') return (a.status || '').localeCompare(b.status || '');
      if (sortOrder === 'a-z') return (a.title || '').localeCompare(b.title || '');
      if (sortOrder === 'newest') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      return 0;
    });
  }, [viewFiltered, search, channelFilter, priorityFilter, sortOrder]);

  // Board grouped by status
  const boardGroups = useMemo(() =>
    Object.fromEntries(BOARD_COLUMNS.map(c => [c.key, filtered.filter(t => t.status === c.key)])),
    [filtered]
  );

  // --- Handlers ---
  // Clicking a task row opens the right-side detail panel
  const handleEdit = useCallback((task) => {
    setSelectedTask(task);
  }, []);

  // Panel save handler — updates task in context and refreshes selectedTask
  const handlePanelUpdate = useCallback(async (id, updates) => {
    const updated = await updateTask(id, updates);
    // Keep selectedTask in sync (updateTask returns updated task)
    setSelectedTask(prev => prev?.id === id ? { ...prev, ...updates } : prev);
  }, [updateTask]);

  // Panel delete handler
  const handlePanelDelete = useCallback((id) => {
    const task = tasks.find(t => t.id === id);
    setSelectedTask(null);
    setDeletionTask(task);
  }, [tasks]);

  const handleCreate = useCallback(async (data) => {
    await createTask(data);
    setShowModal(false);
    setEditingTask(null);
  }, [createTask]);

  const handleUpdate = useCallback(async (id, updates) => {
    await updateTask(id, updates);
    setShowModal(false);
    setEditingTask(null);
  }, [updateTask]);

  const handleDelete = useCallback((id) => {
    const task = tasks.find(t => t.id === id);
    setDeletionTask(task);
  }, [tasks]);

  const handleConfirmDelete = useCallback(() => {
    if (deletionTask) { deleteTask(deletionTask.id); setDeletionTask(null); }
  }, [deleteTask, deletionTask]);

  const handleRestore = useCallback((id) => restoreTask(id), [restoreTask]);

  const handlePermanentDelete = useCallback((id) => {
    if (window.confirm('Delete permanently? This cannot be undone.')) permanentlyDeleteTask(id);
  }, [permanentlyDeleteTask]);

  const handleTransferApprove = useCallback((id) => handleTransferResponse(id, 'approve'), [handleTransferResponse]);
  const handleTransferReject = useCallback((id) => handleTransferResponse(id, 'reject'), [handleTransferResponse]);

  const setView = (key) => {
    const params = new URLSearchParams(location.search);
    params.set('tab', key);
    navigate(`?${params.toString()}`, { replace: true });
  };

  const isDeleted = activeView === 'deleted-tasks';
  const isCompleted = activeView === 'completed-tasks';
  const canCreate = !isDeleted && !isCompleted;

  const viewLabel = {
    'my-tasks': 'My Issues',
    'shared-tasks': 'Incoming',
    'assigned-tasks': 'Given',
    'all-tasks': 'All Issues',
    'completed-tasks': 'Completed',
    'deleted-tasks': 'Trash',
  }[activeView] || 'Tasks';

  const viewDesc = {
    'my-tasks': 'Tasks you created and own.',
    'shared-tasks': 'Tasks assigned to you by others.',
    'assigned-tasks': 'Tasks you delegated to others.',
    'all-tasks': 'All workspace tasks visible to you.',
    'completed-tasks': 'Finished tasks.',
    'deleted-tasks': 'Trash — restore or delete permanently.',
  }[activeView] || '';

  // Keep selectedTask in sync when tasks array updates (e.g. after socket push)
  // Must be BEFORE any early returns to satisfy React hooks rules
  useEffect(() => {
    if (!selectedTask) return;
    const fresh = tasks.find(t => t.id === selectedTask.id);
    if (fresh) setSelectedTask(fresh);
  }, [tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="flex h-full overflow-hidden" style={{ background: '#F4F5F7' }}>
        <div className="w-52 flex-shrink-0 bg-white border-r" style={{ borderColor: '#DFE1E6' }}>
          <div className="p-4 space-y-2 animate-pulse">
            {[100, 80, 90, 70, 85].map((w, i) => (
              <div key={i} className="h-8 rounded" style={{ background: '#F4F5F7', width: `${w}%` }} />
            ))}
          </div>
        </div>
        <div className="flex-1 flex flex-col p-5 gap-3 animate-pulse">
          <div className="h-6 w-48 bg-gray-200 rounded" />
          {[90, 75, 85, 65, 80].map((w, i) => (
            <div key={i} className="bg-white rounded-sm h-14 shadow-sm" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden" style={{ background: '#F4F5F7' }}>

      {/* ── Left sidebar ── */}
      <div className="w-52 flex-shrink-0 bg-white border-r flex flex-col overflow-y-auto" style={{ borderColor: '#DFE1E6' }}>
        <div className="px-3 py-4">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3 px-2" style={{ color: '#7A869A' }}>Tasks</p>
          <nav className="space-y-0.5">
            {SIDEBAR_VIEWS.map((v, i) =>
              v === null
                ? <div key={i} className="my-2 border-t" style={{ borderColor: '#DFE1E6' }} />
                : (
                  <button key={v.key} onClick={() => setView(v.key)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-sm font-medium transition-all"
                    style={{
                      background: activeView === v.key ? '#DEEBFF' : 'transparent',
                      color: activeView === v.key ? JIRA_BLUE : '#42526E',
                      fontWeight: activeView === v.key ? 700 : 500,
                    }}>
                    <span style={{ color: activeView === v.key ? JIRA_BLUE : '#7A869A' }}>
                      {v.icon}
                    </span>
                    {v.label}
                    <span className="ml-auto text-[10px] font-bold tabular-nums"
                      style={{ color: activeView === v.key ? JIRA_BLUE : '#7A869A' }}>
                      {v.key === 'my-tasks' && tasks.filter(t => !t.deleted && String(t.assignerId) === String(currentUserId) && String(t.assigneeId) === String(currentUserId) && t.status !== 'Completed').length}
                      {v.key === 'shared-tasks' && tasks.filter(t => !t.deleted && String(t.assignerId) !== String(currentUserId) && t.assignees?.some(a => String(a._id) === String(currentUserId)) && t.status !== 'Completed').length}
                      {v.key === 'assigned-tasks' && tasks.filter(t => !t.deleted && String(t.assignerId) === String(currentUserId) && String(t.assigneeId) !== String(currentUserId) && t.status !== 'Completed').length}
                      {v.key === 'all-tasks' && tasks.filter(t => !t.deleted && t.status !== 'Completed').length}
                      {v.key === 'completed-tasks' && tasks.filter(t => t.status === 'Completed').length}
                      {v.key === 'deleted-tasks' && tasks.filter(t => t.deleted).length || undefined}
                    </span>
                  </button>
                )
            )}
          </nav>

          {/* Channel filter in sidebar — only channels with tasks in current view */}
          {channelNames.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2 px-2" style={{ color: '#7A869A' }}>By Channel</p>
              <div className="space-y-0.5">
                {/* All Channels reset button */}
                <button onClick={() => setChannelFilter('all')}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs transition-all"
                  style={{
                    background: channelFilter === 'all' ? '#DEEBFF' : 'transparent',
                    color: channelFilter === 'all' ? JIRA_BLUE : '#42526E',
                  }}>
                  <Hash size={10} style={{ opacity: 0.5 }} />
                  <span className="flex-1 text-left">All Channels</span>
                  <span className="text-[10px] font-bold tabular-nums" style={{ color: channelFilter === 'all' ? JIRA_BLUE : '#7A869A' }}>
                    {viewFiltered.length}
                  </span>
                </button>
                {/* Per-channel buttons — only channels with tasks */}
                {channelNames.map(ch => (
                  <button key={ch} onClick={() => setChannelFilter(ch)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs transition-all"
                    style={{
                      background: channelFilter === ch ? '#DEEBFF' : 'transparent',
                      color: channelFilter === ch ? JIRA_BLUE : '#42526E',
                    }}>
                    <Hash size={10} style={{ opacity: 0.5 }} />
                    <span className="flex-1 text-left truncate">{ch}</span>
                    <span className="text-[10px] font-bold tabular-nums" style={{ color: channelFilter === ch ? JIRA_BLUE : '#7A869A' }}>
                      {channelCounts[ch] || 0}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Main content + optional right panel ── */}
      <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">

          {/* ── Toolbar ── */}
          <div className="flex-shrink-0 bg-white border-b px-5 py-3" style={{ borderColor: '#DFE1E6' }}>
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-base font-bold" style={{ color: '#172B4D' }}>{viewLabel}</h1>
                <p className="text-xs" style={{ color: '#7A869A' }}>{viewDesc}</p>
              </div>

              <div className="flex-1" />

              {/* Search */}
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search issues…"
                  className="pl-8 pr-3 py-1.5 text-xs border rounded-sm focus:outline-none w-44"
                  style={{ borderColor: '#DFE1E6' }}
                  onFocus={e => e.target.style.borderColor = JIRA_BLUE}
                  onBlur={e => e.target.style.borderColor = '#DFE1E6'}
                />
              </div>

              {/* Sort */}
              <select value={sortOrder} onChange={e => setSortOrder(e.target.value)}
                className="text-xs border rounded-sm px-2 py-1.5 bg-white focus:outline-none text-gray-700"
                style={{ borderColor: '#DFE1E6' }}>
                {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>

              {/* Priority filter */}
              <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
                className="text-xs border rounded-sm px-2 py-1.5 bg-white focus:outline-none text-gray-700"
                style={{ borderColor: '#DFE1E6' }}>
                <option value="all">All Priorities</option>
                {['Highest', 'High', 'Medium', 'Low', 'Lowest', 'Emergency'].map(p =>
                  <option key={p} value={p}>{p}</option>
                )}
              </select>

              {/* View toggle — expanded for new views */}
              <div className="flex rounded-sm overflow-hidden border" style={{ borderColor: '#DFE1E6' }}>
                {[
                  { key: 'list',      Icon: List,         title: 'List view' },
                  { key: 'board',     Icon: LayoutGrid,   title: 'Kanban board' },
                  { key: 'sprint',    Icon: Activity,     title: 'Sprint board' },
                  { key: 'timeline',  Icon: GitBranch,    title: 'Timeline' },
                  { key: 'workload',  Icon: Users,        title: 'Workload' },
                ].map(({ key, Icon, title }, idx) => (
                  <button
                    key={key}
                    onClick={() => setViewMode(key)}
                    title={title}
                    className={`px-2.5 py-1.5 flex items-center transition-all ${idx > 0 ? 'border-l' : ''}`}
                    style={{
                      borderColor: '#DFE1E6',
                      background: viewMode === key ? '#DEEBFF' : 'white',
                      color: viewMode === key ? JIRA_BLUE : '#42526E'
                    }}
                  >
                    <Icon size={14} />
                  </button>
                ))}
              </div>

              {canCreate && (
                <button onClick={() => { setEditingTask(null); setShowModal(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-sm transition-opacity hover:opacity-90"
                  style={{ background: JIRA_BLUE }}>
                  <Plus size={13} strokeWidth={2.5} /> Create
                </button>
              )}
            </div>
          </div>

          {/* ── Stats strip ── */}
          {activeView === 'all-tasks' && (
            <div className="flex-shrink-0 bg-white border-b px-4 py-2.5 flex items-center gap-3" style={{ borderColor: '#DFE1E6' }}>
              {[
                { label: 'Active', count: tasks.filter(t => !t.deleted && t.status !== 'Completed').length, color: JIRA_BLUE },
                { label: 'Overdue', count: tasks.filter(t => isOverdue(t)).length, color: '#FF5630' },
                { label: 'Completed', count: tasks.filter(t => t.status === 'Completed').length, color: '#00875A' },
                { label: 'In Review', count: tasks.filter(t => t.status === 'In Review').length, color: '#6554C0' },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-1.5 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                  <span style={{ color: '#7A869A' }}>{s.label}</span>
                  <span className="font-bold" style={{ color: s.color }}>{s.count}</span>
                </div>
              ))}
              <div className="flex-1" />
              <span className="text-xs" style={{ color: '#7A869A' }}>{filtered.length} showing</span>
            </div>
          )}

          {/* ── Content area ── */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {filtered.length === 0 && viewMode !== 'workload' ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 opacity-60">
                <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center">
                  {isDeleted ? <Trash2 size={24} className="text-gray-400" /> : <CheckCircle2 size={24} className="text-gray-400" />}
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm text-gray-600">
                    {isDeleted ? 'Trash is empty' : search ? 'No matching issues' : 'No issues here'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {isDeleted ? 'Deleted items will appear here.' : canCreate ? 'Click Create to add your first issue.' : ''}
                  </p>
                </div>
              </div>
            ) : viewMode === 'board' ? (
              /* Kanban board view */
              <KanbanBoard
                tasks={filtered}
                onTaskClick={handleEdit}
                onTasksUpdate={() => {}}
              />
            ) : viewMode === 'sprint' ? (
              /* Sprint board view */
              <SprintBoard
                tasks={filtered}
                workspaceId={workspaceId}
                onTaskClick={handleEdit}
              />
            ) : viewMode === 'timeline' ? (
              /* Timeline / Gantt view */
              <TimelineView
                tasks={filtered}
                onTaskClick={handleEdit}
              />
            ) : viewMode === 'workload' ? (
              /* Workload panel */
              <WorkloadPanel workspaceId={workspaceId} />
            ) : (
              /* List view (default) */
              <div className="h-full overflow-y-auto" style={{ background: BOARD_BG }}>
                {/* Table header */}
                <div className="sticky top-0 flex items-center gap-4 px-5 py-2 text-[10px] font-bold uppercase tracking-wider bg-white border-b"
                  style={{ color: '#7A869A', borderColor: '#DFE1E6' }}>
                  <span className="w-4 flex-shrink-0" />
                  <span className="flex-1">Summary</span>
                  <span className="w-28 text-center">Channel</span>
                  <span className="w-20 text-center">Priority</span>
                  <span className="w-24 text-center">Due Date</span>
                  <span className="w-24 text-center">Status</span>
                  <span className="w-12" />
                </div>

                <div>
                  {filtered.map(task => (
                    <ListRow
                      key={task.id}
                      task={task}
                      view={activeView}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onRestore={handleRestore}
                      onPermanentDelete={handlePermanentDelete}
                      onTransferRequest={setTransferTask}
                      onTransferApprove={handleTransferApprove}
                      onTransferReject={handleTransferReject}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right task detail panel ── */}
        {selectedTask && (
          <WorkspaceTaskDetailPanel
            task={selectedTask}
            members={members || []}
            onClose={() => setSelectedTask(null)}
            onUpdate={handlePanelUpdate}
            onDelete={handlePanelDelete}
          />
        )}

      </div>{/* end main content + right panel wrapper */}

      {/* ── Modals ── */}
      {showModal && (
        <CreateTaskModal
          initialData={editingTask}
          channels={channels || []}
          members={members || []}
          onClose={() => { setShowModal(false); setEditingTask(null); }}
          onSubmit={handleCreate}
          onUpdate={(id, updates) => handleUpdate(id, updates)}
        />
      )}

      {completionTask && (
        <TaskCompletionModal
          task={completionTask}
          onClose={() => setCompletionTask(null)}
          onConfirm={(note) => { updateTask(completionTask.id, { status: 'Completed', completionNote: note, completedAt: new Date().toISOString() }); setCompletionTask(null); }}
          mode="completion"
        />
      )}

      {deletionTask && (
        <TaskCompletionModal
          task={deletionTask}
          onClose={() => setDeletionTask(null)}
          onConfirm={handleConfirmDelete}
          mode="deletion"
        />
      )}

      {transferTask && (
        <TransferRequestModal
          task={transferTask}
          members={members || []}
          onClose={() => setTransferTask(null)}
          onConfirm={async (newAssigneeId, note) => {
            try {
              await api.post(`/api/v2/tasks/${transferTask.id}/transfer-request`, { newAssigneeId, note });
              setTransferTask(null);
            } catch (e) { console.error(e); }
          }}
        />
      )}
    </div>
  );
}
