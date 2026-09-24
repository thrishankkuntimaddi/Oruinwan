/** Barrel for the domain API modules (kept for backwards-compatible imports). */
export { default } from './http';
export { errorMessage, isNetworkError } from './http';
export * from './api/auth';
export * from './api/workspaces';
export * from './api/messages';
export * from './api/tasks';
export * from './api/notes';
export * from './api/files';
export * from './api/knowledge';
export * from './api/notifications';
