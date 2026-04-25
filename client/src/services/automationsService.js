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
