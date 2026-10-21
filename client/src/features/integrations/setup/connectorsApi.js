import api from '../../../services/api';
import { toIntegrationError } from '../integrationsApi';

// Settings-side client for the token-based connectors and the generic incoming
// webhooks (docs/api/integrations.md). Every call resolves with plain data or
// throws an Error whose message is safe to show.

const BASE = '/api/v2/integrations';

const call = async (type, fn, fallback) => {
    try {
        const { data } = await fn();
        return data;
    } catch (err) {
        throw toIntegrationError(err, type, fallback);
    }
};

/** The connectors the settings page renders: [{ type, label, category, form, … }]. */
export const getConnectorCatalog = (workspaceId) =>
    call(null, () => api.get(`${BASE}/catalog`, { params: { workspaceId } }), 'Could not load the list of apps.')
        .then((d) => (Array.isArray(d?.connectors) ? d.connectors : []));

/** GET or POST /:type/actions/:action. */
export const runConnectorAction = (type, action, workspaceId, { method = 'GET', params = {} } = {}) =>
    call(type, () => (method === 'GET'
        ? api.get(`${BASE}/${type}/actions/${action}`, { params: { workspaceId, ...params } })
        : api.post(`${BASE}/${type}/actions/${action}`, { workspaceId, ...params })), 'That didn’t work. Try again.');

/* ── Generic incoming webhooks (admins) ───────────────────────────────── */

export const listIncomingWebhooks = (workspaceId) =>
    call('webhook', () => api.get(`${BASE}/incoming-webhooks`, { params: { workspaceId } }), 'Could not load incoming webhooks.')
        .then((d) => (Array.isArray(d?.webhooks) ? d.webhooks : []));

export const createIncomingWebhook = (workspaceId, { name, channelId }) =>
    call('webhook', () => api.post(`${BASE}/incoming-webhooks`, { workspaceId, name, channelId }), 'Could not create the incoming webhook.')
        .then((d) => d?.webhook || null);

export const updateIncomingWebhook = (workspaceId, hookId, patch) =>
    call('webhook', () => api.patch(`${BASE}/incoming-webhooks/${hookId}`, { workspaceId, ...patch }), 'Could not update the incoming webhook.')
        .then((d) => d?.webhook || null);

export const rotateIncomingWebhook = (workspaceId, hookId) =>
    call('webhook', () => api.post(`${BASE}/incoming-webhooks/${hookId}/rotate`, { workspaceId }), 'Could not create a new URL.')
        .then((d) => d?.webhook || null);

export const deleteIncomingWebhook = (workspaceId, hookId) =>
    call('webhook', () => api.delete(`${BASE}/incoming-webhooks/${hookId}`, { params: { workspaceId } }), 'Could not delete the incoming webhook.');
