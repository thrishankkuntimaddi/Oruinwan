/**
 * automationsService.js
 * refactor(consistency): replace raw axios with canonical api.js client.
 * Auth token injection, withCredentials, and 401 handling now
 * managed by api.js interceptors — no need to pass withCredentials per-call.
 */

import api from './api';

const API_BASE = '/api/v2/automations';

// List automations for a workspace
export const getAutomations = (workspaceId, params = {}) =>
    api.get(API_BASE, { params: { workspaceId, ...params } });

// Get a single automation
export const getAutomation = (id, workspaceId) =>
    api.get(`${API_BASE}/${id}`, { params: { workspaceId } });

// Fetch predefined templates
export const getTemplates = () =>
    api.get(`${API_BASE}/templates`);

// Create a new automation
export const createAutomation = (data) =>
    api.post(API_BASE, data);

// Update an automation (including toggling isActive)
export const updateAutomation = (id, data) =>
    api.patch(`${API_BASE}/${id}`, data);

// Delete an automation
export const deleteAutomation = (id, workspaceId) =>
    api.delete(`${API_BASE}/${id}`, { params: { workspaceId } });
