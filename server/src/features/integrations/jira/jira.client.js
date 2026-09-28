'use strict';

/** Jira Cloud REST v3 client (basic auth: account email + API token). */

const axios = require('axios');

function httpError(status, message, code) {
  return Object.assign(new Error(message), { statusCode: status, status, ...(code && { code }) });
}

function mapError(err) {
  const status = err.response?.status;
  const data = err.response?.data || {};
  const detail = (data.errorMessages || []).concat(Object.values(data.errors || {})).join('; ') || data.message || err.message;
  if (status === 401) return httpError(502, 'Jira rejected the credentials (401). Check the email and API token.', 'JIRA_BAD_CREDENTIALS');
  if (status === 403) return httpError(403, `Jira denied access: ${detail}`, 'JIRA_FORBIDDEN');
  if (status === 404) return httpError(404, `Not found in Jira: ${detail}`, 'JIRA_NOT_FOUND');
  if (status === 400) return httpError(400, `Jira: ${detail}`, 'JIRA_INVALID');
  return httpError(502, `Jira request failed: ${detail}`, 'JIRA_ERROR');
}

/** Atlassian Document Format for plain text (one paragraph per line). */
function toAdf(text) {
  const lines = String(text || '').split(/\r?\n/);
  return {
    type: 'doc',
    version: 1,
    content: lines.map(line => (line ? { type: 'paragraph', content: [{ type: 'text', text: line }] } : { type: 'paragraph', content: [] })),
  };
}

/** Plain text from an ADF document (best effort) or a string. */
function fromAdf(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.type === 'text') return node.text || '';
  const inner = (node.content || []).map(fromAdf).join(node.type === 'doc' ? '\n' : '');
  return inner;
}

function createClient({ baseUrl, email, apiToken }) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  const auth = { username: email, password: apiToken };
  async function request(method, path, { data, params } = {}) {
    try {
      const res = await axios({ method, url: `${base}${path}`, auth, data, params, timeout: 10_000, headers: { Accept: 'application/json', 'Content-Type': 'application/json' } });
      return res.data;
    } catch (err) {
      throw mapError(err);
    }
  }
  return {
    myself: () => request('get', '/rest/api/3/myself'),
    async createIssue({ projectKey, summary, description, issueType = 'Task' }) {
      const data = await request('post', '/rest/api/3/issue', {
        data: { fields: { project: { key: projectKey }, summary, description: toAdf(description), issuetype: { name: issueType } } },
      });
      return { id: data.id, key: data.key, url: `${base}/browse/${data.key}` };
    },
    issueUrl: (key) => `${base}/browse/${key}`,
  };
}

module.exports = { createClient, toAdf, fromAdf, mapError };
