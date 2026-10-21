import api from './api';

const API_BASE = '/api/v2/automations';

export const getAutomations = (workspaceId, params = {}) =>
    api.get(API_BASE, { params: { workspaceId, ...params } });

export const getAutomation = (id, workspaceId) =>
    api.get(`${API_BASE}/${id}`, { params: { workspaceId } });

export const getTemplates = () =>
    api.get(`${API_BASE}/templates`);

export const createAutomation = (data) =>
    api.post(API_BASE, data);

export const updateAutomation = (id, data) =>
    api.patch(`${API_BASE}/${id}`, data);

export const deleteAutomation = (id, workspaceId) =>
    api.delete(`${API_BASE}/${id}`, { params: { workspaceId } });

/** Next run times for a schedule: { schedule, nextRuns: [ISO] } (400 when invalid). */
export const previewSchedule = ({ expression, type = 'cron', timezone = 'UTC', count = 5 }) =>
    api.get(`${API_BASE}/schedule/preview`, { params: { expression, type, timezone, count } });

/** Run now (dryRun false) or Test (dryRun true): { run }. */
export const runAutomation = (id, workspaceId, { eventData, dryRun = false } = {}) =>
    api.post(`${API_BASE}/${id}/run`, { workspaceId, eventData, dryRun });

/** Run history, newest first: { runs }. */
export const getAutomationRuns = (id, workspaceId, { limit = 20, before } = {}) =>
    api.get(`${API_BASE}/${id}/runs`, { params: { workspaceId, limit, ...(before ? { before } : {}) } });
