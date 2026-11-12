// Shared domain constants. Task statuses, the workflow and labels come from platform/tasks/taskRules.js
// (the same file the web app uses; the server's workflow is checked against it in taskRules.test.js).
import { STATUS_LABELS, TASK_STATUSES, TASK_TRANSITIONS } from '../../../platform/tasks/taskRules.js';

export { TASK_STATUSES, TASK_TRANSITIONS };

// Colours match client/src/utils/taskMeta.js.
export const STATUS_META = {
  backlog: { label: STATUS_LABELS.backlog, color: '#8c8c8c' },
  todo: { label: STATUS_LABELS.todo, color: '#a8a8a8' },
  in_progress: { label: STATUS_LABELS.in_progress, color: '#6ea8fe' },
  review: { label: STATUS_LABELS.review, color: '#b59cff' },
  blocked: { label: STATUS_LABELS.blocked, color: '#e05252' },
  done: { label: STATUS_LABELS.done, color: '#5aba8a' },
  cancelled: { label: STATUS_LABELS.cancelled, color: '#626262' },
};

export const TASK_PRIORITIES = ['lowest', 'low', 'medium', 'high', 'highest'];

export const PRIORITY_META = {
  lowest: { label: 'Lowest', color: '#7a7a7a' },
  low: { label: 'Low', color: '#6ea8fe' },
  medium: { label: 'Medium', color: '#f5c46b' },
  high: { label: 'High', color: '#f39a6b' },
  highest: { label: 'Highest', color: '#e05252' },
};

// Note type labels: the same words as the web (client/src/pages/SidebarComp/notesComponents/
// noteTypes.js, checked by constants.test.js). `documentation` is an older alias of `note`.
export const NOTE_TYPES = {
  note: 'Document',
  documentation: 'Document',
  brainstorm: 'Brainstorm',
  meeting: 'Meeting',
  sop: 'SOP',
  projectspec: 'Project spec',
  techdesign: 'Tech design',
  announcement: 'Announcement',
};

/** Types to pick from (no aliases), in the web's order. */
export const NOTE_TYPE_OPTIONS = Object.entries(NOTE_TYPES).filter(([value]) => value !== 'documentation');

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

/** The composer's emoji picker: the same set as the web composer (footer/emojiPicker.jsx). */
export const COMPOSER_EMOJIS = [
  '😀', '😁', '😂', '🤣', '😅', '😊', '😍', '😘', '😎', '🤔', '🤩', '🙌',
  '👍', '👎', '👏', '🙏', '🔥', '🎉', '😢', '😮', '😴', '🤯', '🤝', '💯',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔', '❣️', '💕', '💞', '💓',
  '💪', '🧠', '👀', '👁️', '👄', '💋', '👅', '👃', '👂', '🦶', '🦵',
  '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙',
];
