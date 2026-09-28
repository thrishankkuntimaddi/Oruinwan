'use strict';

/**
 * Minimal GitHub REST client used with a workspace's personal access token.
 * GITHUB_API_URL points it at GitHub Enterprise (default https://api.github.com).
 */

const axios = require('axios');

const TIMEOUT_MS = 10_000;

function apiBase() {
  return (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/+$/, '');
}

function httpError(status, message, code) {
  return Object.assign(new Error(message), { statusCode: status, status, ...(code && { code }) });
}

/** Map a GitHub API failure to an HTTP error for our API. */
function mapError(err) {
  const status = err.response?.status;
  const ghMessage = err.response?.data?.message;
  if (status === 401) return httpError(502, 'GitHub rejected the workspace token (401). Update it in the GitHub integration settings.', 'GITHUB_BAD_TOKEN');
  if (status === 403 && /rate limit/i.test(ghMessage || '')) return httpError(429, 'GitHub API rate limit reached. Try again later.', 'GITHUB_RATE_LIMITED');
  if (status === 403) return httpError(403, `GitHub denied access: ${ghMessage || 'forbidden'}`, 'GITHUB_FORBIDDEN');
  if (status === 404) return httpError(404, 'Not found on GitHub (or the token cannot access it)', 'GITHUB_NOT_FOUND');
  if (status === 422) return httpError(400, `GitHub: ${ghMessage || 'validation failed'}`, 'GITHUB_INVALID');
  return httpError(502, `GitHub request failed: ${ghMessage || err.message}`, 'GITHUB_ERROR');
}

function createClient(token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Oruinwan-Integration',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  async function request(method, path, { params, data, accept, responseType, maxContentLength } = {}) {
    try {
      const res = await axios({
        method,
        url: `${apiBase()}${path}`,
        params,
        data,
        timeout: TIMEOUT_MS,
        headers: accept ? { ...headers, Accept: accept } : headers,
        ...(responseType && { responseType }),
        ...(maxContentLength && { maxContentLength }),
      });
      return res.data;
    } catch (err) {
      throw mapError(err);
    }
  }

  const repoPath = (repo) => `/repos/${repo.split('/').map(encodeURIComponent).join('/')}`;

  return {
    request,
    getUser: () => request('get', '/user'),
    rateLimit: () => request('get', '/rate_limit'),
    getPull: (repo, number) => request('get', `${repoPath(repo)}/pulls/${number}`),
    async listPullFiles(repo, number, { maxPages = 3 } = {}) {
      const files = [];
      for (let page = 1; page <= maxPages; page += 1) {
        const batch = await request('get', `${repoPath(repo)}/pulls/${number}/files`, { params: { per_page: 100, page } });
        files.push(...(batch || []));
        if (!batch || batch.length < 100) break;
      }
      return files;
    },
    listPulls: (repo, { state = 'open', perPage = 20 } = {}) =>
      request('get', `${repoPath(repo)}/pulls`, { params: { state, per_page: perPage, sort: 'updated', direction: 'desc' } }),
    listCheckRuns: (repo, ref) => request('get', `${repoPath(repo)}/commits/${encodeURIComponent(ref)}/check-runs`, { params: { per_page: 100 } }),
    getRawFile: (repo, path, ref) => request('get', `${repoPath(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
      params: ref ? { ref } : undefined,
      accept: 'application/vnd.github.raw+json',
      responseType: 'text',
      maxContentLength: 2 * 1024 * 1024,
    }),
    createIssue: (repo, { title, body }) => request('post', `${repoPath(repo)}/issues`, { data: { title, body } }),
  };
}

/** Summarise check runs into { status, conclusion, total, failed }. */
function summarizeChecks(runsResponse) {
  const runs = runsResponse?.check_runs || [];
  const total = runs.length;
  if (!total) return { status: 'none', conclusion: null, total: 0, failed: 0 };
  const failedConclusions = ['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure'];
  const failed = runs.filter(r => failedConclusions.includes(r.conclusion)).length;
  const pending = runs.some(r => r.status !== 'completed');
  return {
    status: pending ? 'in_progress' : 'completed',
    conclusion: pending ? null : (failed ? 'failure' : 'success'),
    total,
    failed,
  };
}

module.exports = { createClient, summarizeChecks, mapError, apiBase };
