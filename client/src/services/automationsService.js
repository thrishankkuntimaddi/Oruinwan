/**
 * automationsService.js
 *
 * Axios wrapper for the /api/v2/automations endpoints.
 */

import axios from 'axios';

const API_BASE = '/api/v2/automations';

// List automations for a workspace
export const getAutomations = (workspaceId, params = {}) =>
    axios.get(API_BASE, { params: { workspaceId, ...params }, withCredentials: true });

// Get a single automation
export const getAutomation = (id, workspaceId) =>
    axios.get(`${API_BASE}/${id}`, { params: { workspaceId }, withCredentials: true });

// Fetch predefined templates
export const getTemplates = () =>
    axios.get(`${API_BASE}/templates`, { withCredentials: true });

// Create a new automation
export const createAutomation = (data) =>
    axios.post(API_BASE, data, { withCredentials: true });

// Update an automation (including toggling isActive)
export const updateAutomation = (id, data) =>
    axios.patch(`${API_BASE}/${id}`, data, { withCredentials: true });

// Delete an automation
export const deleteAutomation = (id, workspaceId) =>
    axios.delete(`${API_BASE}/${id}`, { params: { workspaceId }, withCredentials: true });
