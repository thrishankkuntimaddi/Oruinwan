// client/src/services/integrations.service.js
import api from './api';

const BASE = '/api/v2/integrations';

// ── Integrations ──────────────────────────────────────────────────────────────
export const getIntegrations = (workspaceId) =>
  api.get(`${BASE}?workspaceId=${workspaceId}`).then(r => r.data.integrations);

export const connectIntegration = (payload) =>
  api.post(`${BASE}/connect`, payload).then(r => r.data.integration);

export const disconnectIntegration = (workspaceId, type) =>
  api.post(`${BASE}/disconnect`, { workspaceId, type }).then(r => r.data.integration);

// ── Webhooks ──────────────────────────────────────────────────────────────────
export const getWebhooks = (workspaceId) =>
  api.get(`${BASE}/webhooks?workspaceId=${workspaceId}`).then(r => r.data.webhooks);

export const createWebhook = (payload) =>
  api.post(`${BASE}/webhooks`, payload).then(r => r.data.webhook);

export const deleteWebhook = (id) =>
  api.delete(`${BASE}/webhooks/${id}`).then(r => r.data);

// ── AI Providers ──────────────────────────────────────────────────────────────
export const getAIProviders = (workspaceId) =>
  api.get(`${BASE}/ai-providers?workspaceId=${workspaceId}`).then(r => r.data.providers);

export const connectAIProvider = (payload) =>
  api.post(`${BASE}/ai-providers/connect`, payload).then(r => r.data.provider);

export const switchAIProvider = (workspaceId, provider) =>
  api.post(`${BASE}/ai-providers/switch`, { workspaceId, provider }).then(r => r.data.provider);

export const disconnectAIProvider = (workspaceId, provider) =>
  api.post(`${BASE}/ai-providers/disconnect`, { workspaceId, provider }).then(r => r.data.provider);
