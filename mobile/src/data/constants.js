// Shared domain constants. Task statuses and transitions mirror server/utils/workflowValidator.js.

export const TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'blocked', 'done', 'cancelled'];

// Colours match client/src/utils/taskMeta.js.
export const STATUS_META = {
  backlog: { label: 'Backlog', color: '#8c8c8c' },
  todo: { label: 'To do', color: '#a8a8a8' },
  in_progress: { label: 'In progress', color: '#6ea8fe' },
  review: { label: 'In review', color: '#b59cff' },
  blocked: { label: 'Blocked', color: '#e05252' },
  done: { label: 'Done', color: '#5aba8a' },
  cancelled: { label: 'Cancelled', color: '#626262' },
};

export const TASK_TRANSITIONS = {
  backlog: ['todo', 'in_progress', 'review', 'cancelled'],
  todo: ['in_progress', 'review', 'backlog', 'cancelled'],
  in_progress: ['review', 'blocked', 'todo', 'backlog', 'done', 'cancelled'],
  review: ['done', 'in_progress', 'blocked', 'todo'],
  blocked: ['in_progress', 'todo', 'review', 'done'],
  done: ['todo', 'in_progress'],
  cancelled: ['backlog', 'todo'],
};

export const TASK_PRIORITIES = ['lowest', 'low', 'medium', 'high', 'highest'];

export const PRIORITY_META = {
  lowest: { label: 'Lowest', color: '#7a7a7a' },
  low: { label: 'Low', color: '#6ea8fe' },
  medium: { label: 'Medium', color: '#f5c46b' },
  high: { label: 'High', color: '#f39a6b' },
  highest: { label: 'Highest', color: '#e05252' },
};

export const NOTE_TYPES = {
  note: 'Note',
  meeting: 'Meeting',
  documentation: 'Docs',
  brainstorm: 'Brainstorm',
  sop: 'SOP',
  projectspec: 'Project spec',
  techdesign: 'Tech design',
  announcement: 'Announcement',
};

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
