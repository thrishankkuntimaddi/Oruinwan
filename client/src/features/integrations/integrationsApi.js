import api from '../../services/api';

// Client for the developer-integration endpoints (/api/v2/integrations/*).
// Every call resolves with plain data or throws an Error whose `.code` is
// 'not_connected' | 'forbidden' | 'not_found' | 'unavailable' | 'error'
// and whose message is safe to show to the user.

const BASE = '/api/v2/integrations';

export const PROVIDER_LABEL = { github: 'GitHub', gitlab: 'GitLab', jira: 'Jira', zoom: 'Zoom' };

export const notConnectedMessage = (type) =>
    `${PROVIDER_LABEL[type] || type} isn't connected — an admin can connect it in Settings → Integrations.`;

// Server error codes with friendlier wording.
const KNOWN_CODES = {
    AI_DISABLED: 'Oruinwan AI is turned off in this workspace. An admin can turn it on in Settings.',
    REVIEW_IN_PROGRESS: 'Oruinwan AI is already reviewing this pull request — the review will appear in its thread.',
    REVIEW_RATE_LIMITED: 'This workspace has reached its limit for AI reviews. Try again a little later.',
};

export function toIntegrationError(err, type, fallback = 'Something went wrong. Try again.') {
    const status = err?.response?.status;
    const data = err?.response?.data || {};
    const serverMsg = data.message || data.error;
    let code = 'error';
    let message = serverMsg || fallback;
    const known = KNOWN_CODES[data.code];
    if (known) {
        const e = new Error(known);
        e.code = data.code;
        e.status = status;
        return e;
    }
    if (status === 404 && /not.?connected|no integration|not configured/i.test(String(serverMsg || ''))) code = 'not_connected';
    else if (status === 412 || status === 409 || data.code === 'NOT_CONNECTED' || data.code === 'not_connected') code = 'not_connected';
    else if (status === 403) { code = 'forbidden'; message = serverMsg || 'Only workspace admins can do that.'; }
    else if (status === 404) { code = 'not_found'; message = serverMsg || 'Not found.'; }
    else if (!status) { code = 'unavailable'; message = 'Could not reach the server. Check your connection and try again.'; }
    else if (status === 502 || status === 503 || status === 504) { code = 'unavailable'; message = serverMsg || `${PROVIDER_LABEL[type] || 'The service'} did not respond. Try again in a moment.`; }
    if (code === 'not_connected') message = notConnectedMessage(type);
    const e = new Error(message);
    e.code = code;
    e.status = status;
    return e;
}

const call = async (type, fn, fallback) => {
    try {
        const { data } = await fn();
        return data;
    } catch (err) {
        throw toIntegrationError(err, type, fallback);
    }
};

/* ── Config ───────────────────────────────────────────────────────────── */

export const getIntegrationConfig = (type, workspaceId) =>
    call(type, () => api.get(`${BASE}/${type}/config`, { params: { workspaceId } }), `Could not load ${PROVIDER_LABEL[type]} settings.`);

export const saveIntegrationConfig = (type, workspaceId, partial) =>
    call(type, () => api.put(`${BASE}/${type}/config`, { workspaceId, ...partial }), `Could not save ${PROVIDER_LABEL[type]} settings.`);

export const rotateIntegrationSecret = (type, workspaceId) =>
    call(type, () => api.post(`${BASE}/${type}/rotate-secret`, { workspaceId }), 'Could not rotate the secret.');

/** Test the saved connection, or unsaved values passed as `overrides` (e.g. { token }). */
export const testIntegration = (type, workspaceId, overrides = {}) =>
    call(type, () => api.post(`${BASE}/${type}/test`, { workspaceId, ...overrides }), 'The connection test failed.');

export const disconnectDevIntegration = (type, workspaceId) =>
    call(type, () => api.post(`${BASE}/disconnect`, { workspaceId, type }), `Could not disconnect ${PROVIDER_LABEL[type]}.`);

/** Cheap "is it connected?" check, cached per workspace for a minute. */
const statusCache = new Map();
export async function isConnected(type, workspaceId) {
    const key = `${type}:${workspaceId}`;
    const hit = statusCache.get(key);
    if (hit && Date.now() - hit.at < 60_000) return hit.value;
    try {
        const data = await getIntegrationConfig(type, workspaceId);
        const value = { connected: !!data?.connected, config: data?.config || {} };
        statusCache.set(key, { at: Date.now(), value });
        return value;
    } catch (err) {
        if (err.code === 'not_connected' || err.code === 'not_found') return { connected: false, config: {} };
        throw err;
    }
}
export const clearConnectionCache = () => statusCache.clear();

/* ── GitHub ───────────────────────────────────────────────────────────── */

export const getPullRequest = (workspaceId, repo, number) =>
    call('github', () => api.get(`${BASE}/github/pr`, { params: { workspaceId, repo, number } }), 'Could not load the pull request.');

/** Whole file at a ref: { text, language, truncated }. */
export async function getRepoFile(workspaceId, repo, ref, path) {
    try {
        const res = await api.get(`${BASE}/github/file`, { params: { workspaceId, repo, ref, path }, responseType: 'text', transformResponse: (d) => d });
        const h = res.headers || {};
        const get = (k) => (typeof h.get === 'function' ? h.get(k) : h[k] ?? h[k.toLowerCase()]);
        return {
            text: typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2),
            language: get('x-file-language') || null,
            truncated: String(get('x-file-truncated') || '') === 'true' || String(get('x-file-truncated') || '') === '1',
        };
    } catch (err) {
        const status = err?.response?.status;
        if (status === 415) { const e = new Error('This is a binary file, so it can’t be shown here. Open it on GitHub.'); e.code = 'binary'; throw e; }
        if (status === 413) { const e = new Error('This file is too large to show here. Open it on GitHub.'); e.code = 'too_large'; throw e; }
        throw toIntegrationError(err, 'github', 'Could not load the file.');
    }
}

export const requestPrReview = (workspaceId, repo, number, messageId) =>
    call('github', () => api.post(`${BASE}/github/pr/review`, { workspaceId, repo, number, ...(messageId ? { messageId } : {}) }, { timeout: 180_000 }),
        'Oruinwan AI could not review this pull request.');

export const listPullRequests = (workspaceId, repo) =>
    call('github', () => api.get(`${BASE}/github/prs`, { params: { workspaceId, ...(repo ? { repo } : {}) } }), 'Could not load pull requests.');

export const createGithubIssue = (payload) =>
    call('github', () => api.post(`${BASE}/github/issue`, payload), 'Could not create the GitHub issue.');

/* ── Jira / Zoom ──────────────────────────────────────────────────────── */

export const createJiraIssue = (payload) =>
    call('jira', () => api.post(`${BASE}/jira/issue`, payload), 'Could not create the Jira issue.');

export const createZoomMeeting = (payload) =>
    call('zoom', () => api.post(`${BASE}/zoom/meeting`, payload), 'Could not create the Zoom meeting.');

/* ── Reviews shared between the card and the panel ────────────────────── */

const reviews = new Map(); // prKey -> { status: 'running'|'done'|'error', result?, error?, startedAt }
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());
export const reviewStore = {
    get: (key) => reviews.get(key) || null,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    /** Start (or join) a review for a PR; resolves with the result. */
    run(key, starter) {
        const cur = reviews.get(key);
        if (cur?.status === 'running') return cur.promise;
        const promise = starter()
            .then((result) => { reviews.set(key, { status: 'done', result, finishedAt: Date.now() }); emit(); return result; })
            .catch((error) => { reviews.set(key, { status: 'error', error }); emit(); throw error; });
        reviews.set(key, { status: 'running', startedAt: Date.now(), promise });
        emit();
        return promise;
    },
};
