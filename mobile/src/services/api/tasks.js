import http from '../http';

export const TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'blocked', 'done', 'cancelled'];
export const TASK_PRIORITIES = ['lowest', 'low', 'medium', 'high', 'highest'];

/** Mirrors server/utils/workflowValidator.js. */
export const TASK_TRANSITIONS = {
  backlog: ['todo', 'in_progress', 'review', 'cancelled'],
  todo: ['in_progress', 'review', 'backlog', 'cancelled'],
  in_progress: ['review', 'blocked', 'todo', 'backlog', 'done', 'cancelled'],
  review: ['done', 'in_progress', 'blocked', 'todo'],
  blocked: ['in_progress', 'todo', 'review', 'done'],
  done: ['todo', 'in_progress'],
  cancelled: ['backlog', 'todo'],
};

export const fetchTasks = (workspaceId, params = {}) =>
  http.get('/v2/tasks', { params: { workspaceId, ...params } });
export const fetchMyTasks = (params = {}) => http.get('/v2/tasks/my', { params });
export const createTask = (payload) => http.post('/v2/tasks', payload);
export const updateTask = (taskId, updates) => http.put(`/v2/tasks/${taskId}`, updates);
