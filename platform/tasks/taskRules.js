// Task statuses, the status workflow and labels: one copy for the web/desktop and phone apps.
// The server enforces the same workflow (server/utils/workflowValidator.js); a test compares
// them (mobile/src/data/taskRules.test.js). Colours stay in each app (CSS variables vs hex).

export const TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'blocked', 'done', 'cancelled'];
export const OPEN_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'blocked'];
export const CLOSED_STATUSES = ['done', 'cancelled'];
/** Board columns, left to right. */
export const BOARD_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'blocked', 'done'];

const others = (s) => OPEN_STATUSES.filter((x) => x !== s);
/** Open work moves freely between open states and straight to done or cancelled; done reopens; cancelled restores. */
export const TASK_TRANSITIONS = Object.freeze({
  backlog: [...others('backlog'), 'done', 'cancelled'],
  todo: [...others('todo'), 'done', 'cancelled'],
  in_progress: [...others('in_progress'), 'done', 'cancelled'],
  review: [...others('review'), 'done', 'cancelled'],
  blocked: [...others('blocked'), 'done', 'cancelled'],
  done: ['todo', 'in_progress', 'review'],
  cancelled: ['backlog', 'todo'],
});

export const canTransition = (from, to) => from === to || (TASK_TRANSITIONS[from] || []).includes(to);
export const isClosedStatus = (s) => CLOSED_STATUSES.includes(s);

export const STATUS_LABELS = Object.freeze({
  backlog: 'Backlog', todo: 'To do', in_progress: 'In progress', review: 'In review',
  blocked: 'Blocked', done: 'Done', cancelled: 'Cancelled',
});
export const statusLabel = (s) => STATUS_LABELS[s] || String(s || '').replace(/_/g, ' ');

/** Highest first (pickers and sorting). */
export const TASK_PRIORITIES = ['highest', 'high', 'medium', 'low', 'lowest'];
export const PRIORITY_LABELS = Object.freeze({ highest: 'Highest', high: 'High', medium: 'Medium', low: 'Low', lowest: 'Lowest' });
export const priorityLabel = (p) => PRIORITY_LABELS[p] || 'Medium';
