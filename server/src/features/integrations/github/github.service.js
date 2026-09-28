'use strict';

/**
 * GitHub data for the code-review side panel, pickers and slash commands,
 * fetched with the workspace's token (never the viewer's).
 */

const path = require('path');
const Integration = require('../integration.model');
const Message = require('../../../modules/messages/message.model.js');
const { readSecret, isRepo } = require('../integration.config');
const { createClient, summarizeChecks } = require('./github.client');
const links = require('../integration.tasks');
const { prState } = require('./github.events');

const PR_CACHE_TTL_MS = 60_000;
const PR_CACHE_MAX = 300;
const MAX_PATCH_CHARS = 200_000;       // per file in the viewer
const MAX_TOTAL_PATCH_CHARS = 2_000_000;
const MAX_FILE_BYTES = 1024 * 1024;    // whole-file view

const prCache = new Map(); // `${workspaceId}:${repo}#${number}` -> { at, value }

function httpError(status, message, code) {
  return Object.assign(new Error(message), { statusCode: status, status, ...(code && { code }) });
}

/** The workspace's connected integration of `type`, or a 404/400 error. */
async function requireIntegration(workspaceId, type, { needs } = {}) {
  const integration = await Integration.findOne({ workspaceId, type }).lean();
  const label = { github: 'GitHub', jira: 'Jira', zoom: 'Zoom' }[type] || type;
  if (!integration || integration.status !== 'connected') {
    throw httpError(404, `${label} is not connected for this workspace`, 'INTEGRATION_NOT_CONNECTED');
  }
  if (needs && !readSecret(integration.config, needs)) {
    throw httpError(400, `${label} is connected but has no credentials yet. Add them in the integration settings.`, 'INTEGRATION_NOT_CONFIGURED');
  }
  return integration;
}

async function githubClientFor(workspaceId) {
  const integration = await requireIntegration(workspaceId, 'github', { needs: 'token' });
  return { integration, gh: createClient(readSecret(integration.config, 'token')) };
}

function parseRepoNumber(repo, number) {
  if (!isRepo(repo)) throw httpError(400, 'repo must be owner/name');
  const n = Number(number);
  if (!Number.isInteger(n) || n <= 0 || n > 1e9) throw httpError(400, 'number must be a positive integer');
  return { repo, number: n };
}

const LANGUAGES = {
  js: 'javascript', jsx: 'jsx', mjs: 'javascript', cjs: 'javascript', ts: 'typescript', tsx: 'tsx',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java', kt: 'kotlin', kts: 'kotlin', swift: 'swift',
  c: 'c', h: 'c', cc: 'cpp', cpp: 'cpp', hpp: 'cpp', cs: 'csharp', php: 'php', scala: 'scala', dart: 'dart',
  sh: 'bash', bash: 'bash', zsh: 'bash', ps1: 'powershell', sql: 'sql', html: 'html', htm: 'html', vue: 'vue', svelte: 'svelte',
  css: 'css', scss: 'scss', sass: 'sass', less: 'less', json: 'json', yml: 'yaml', yaml: 'yaml', toml: 'toml', xml: 'xml',
  md: 'markdown', mdx: 'markdown', graphql: 'graphql', gql: 'graphql', proto: 'protobuf', tf: 'hcl', lua: 'lua', r: 'r',
  ex: 'elixir', exs: 'elixir', erl: 'erlang', hs: 'haskell', clj: 'clojure', ml: 'ocaml', pl: 'perl', gradle: 'groovy', groovy: 'groovy',
};
const LANGUAGE_BY_NAME = { dockerfile: 'dockerfile', makefile: 'makefile', gemfile: 'ruby', rakefile: 'ruby', jenkinsfile: 'groovy' };

function languageOf(filename) {
  const base = path.posix.basename(String(filename || '')).toLowerCase();
  if (LANGUAGE_BY_NAME[base]) return LANGUAGE_BY_NAME[base];
  const ext = base.includes('.') ? base.split('.').pop() : '';
  return LANGUAGES[ext] || 'text';
}

function cacheGet(key) {
  const hit = prCache.get(key);
  if (hit && Date.now() - hit.at < PR_CACHE_TTL_MS) return hit.value;
  if (hit) prCache.delete(key);
  return null;
}

function cacheSet(key, value) {
  if (prCache.size >= PR_CACHE_MAX) prCache.delete(prCache.keys().next().value);
  prCache.set(key, { at: Date.now(), value });
}

function clearCache() {
  prCache.clear();
}

/** PR metadata + files from GitHub (cached ~60s per PR per workspace). */
async function fetchPullBundle(workspaceId, repo, number) {
  const key = `${workspaceId}:${repo.toLowerCase()}#${number}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const { gh } = await githubClientFor(workspaceId);
  const pr = await gh.getPull(repo, number);
  const [files, checkRuns] = await Promise.all([
    gh.listPullFiles(repo, number),
    gh.listCheckRuns(repo, pr.head?.sha).catch(() => null),
  ]);
  const value = { pr, files, checks: summarizeChecks(checkRuns) };
  cacheSet(key, value);
  return value;
}

function shapePr(pr, checks) {
  return {
    number: pr.number,
    title: pr.title,
    body: pr.body || '',
    state: prState(pr),
    draft: !!pr.draft,
    merged: !!(pr.merged || pr.merged_at),
    author: pr.user?.login || null,
    authorAvatar: pr.user?.avatar_url || null,
    branch: pr.head?.ref || null,
    base: pr.base?.ref || null,
    headSha: pr.head?.sha || null,
    url: pr.html_url,
    additions: pr.additions ?? 0,
    deletions: pr.deletions ?? 0,
    changedFiles: pr.changed_files ?? 0,
    commits: pr.commits ?? 0,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    checks,
  };
}

function shapeFiles(files) {
  let budget = MAX_TOTAL_PATCH_CHARS;
  return files.map((f) => {
    let patch = typeof f.patch === 'string' ? f.patch : null;
    let truncated = false;
    if (patch && (patch.length > MAX_PATCH_CHARS || patch.length > budget)) {
      const cut = Math.max(0, Math.min(MAX_PATCH_CHARS, budget));
      patch = cut ? patch.slice(0, cut) : null;
      truncated = true;
    }
    budget -= patch ? patch.length : 0;
    return {
      filename: f.filename,
      previousFilename: f.previous_filename || null,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      changes: f.changes,
      patch,
      truncated,
      language: languageOf(f.filename),
    };
  });
}

/** Linked tasks the viewer can see (by key in title/branch/body, or by an externalLinks entry). */
async function linkedTasksFor(workspaceId, pr, userId) {
  const keys = links.extractTaskKeys(pr.title, pr.head?.ref, pr.body);
  const [byKey, byLink] = await Promise.all([
    links.findTasksByKeys(workspaceId, keys),
    links.findTasksByLinkUrl(workspaceId, pr.html_url),
  ]);
  const map = new Map();
  [...byKey, ...byLink].forEach(t => map.set(String(t._id), t));
  const tasks = [...map.values()];
  if (!tasks.length) return [];
  const { canViewTask } = require('../../tasks/tasks.shared');
  const Channel = require('../../channels/channel.model');
  const channels = userId
    ? (await Channel.find({ workspace: workspaceId, 'members.user': userId }).select('_id').lean()).map(c => String(c._id))
    : [];
  return tasks
    .filter(t => !userId || canViewTask(t, userId, channels))
    .map(t => ({ id: String(t._id), issueKey: t.issueKey, title: t.title, status: t.status }));
}

async function getPullView({ workspaceId, repo, number, userId }) {
  ({ repo, number } = parseRepoNumber(repo, number));
  const { pr, files, checks } = await fetchPullBundle(workspaceId, repo, number);
  return {
    pr: shapePr(pr, checks),
    files: shapeFiles(files),
    linkedTasks: await linkedTasksFor(workspaceId, pr, userId),
  };
}

/** Whole file at a ref, as text (size-capped; binary refused). */
async function getFileText({ workspaceId, repo, ref, path: filePath }) {
  if (!isRepo(repo)) throw httpError(400, 'repo must be owner/name');
  const p = String(filePath || '').replace(/^\/+/, '');
  if (!p || p.length > 1000 || p.split('/').some(seg => seg === '..' || seg === '.')) throw httpError(400, 'Invalid path');
  if (ref !== undefined && ref !== null && ref !== '' && !/^[\w./-]{1,250}$/.test(String(ref))) throw httpError(400, 'Invalid ref');
  const { gh } = await githubClientFor(workspaceId);
  let text;
  try {
    text = await gh.getRawFile(repo, p, ref || undefined);
  } catch (err) {
    if (/maxContentLength/i.test(err.message)) throw httpError(413, 'File is too large to view here');
    throw err;
  }
  if (typeof text !== 'string') text = text == null ? '' : (Buffer.isBuffer(text) ? text.toString('utf8') : JSON.stringify(text, null, 2));
  if (text.includes('\u0000')) throw httpError(415, 'Binary file', 'BINARY_FILE');
  const truncated = Buffer.byteLength(text) > MAX_FILE_BYTES;
  if (truncated) text = text.slice(0, MAX_FILE_BYTES);
  return { text, truncated, language: languageOf(p) };
}

/** Repos to scan for open PRs: explicit routes + repos seen on cards in this workspace. */
async function candidateRepos(workspaceId, config) {
  const fromRoutes = (config.routes || []).map(r => r.repo).filter(r => r && r !== '*');
  const fromCards = await Message.distinct('integration.repo', {
    workspace: workspaceId, type: 'integration', 'integration.provider': 'github', 'integration.kind': 'pull_request',
  }).catch(() => []);
  const seen = new Map();
  [...fromRoutes, ...fromCards].filter(isRepo).forEach(r => { if (!seen.has(r.toLowerCase())) seen.set(r.toLowerCase(), r); });
  return [...seen.values()].slice(0, 10);
}

async function listOpenPulls({ workspaceId, repo }) {
  const { integration, gh } = await githubClientFor(workspaceId);
  let repos;
  if (repo) {
    if (!isRepo(repo)) throw httpError(400, 'repo must be owner/name');
    repos = [repo];
  } else {
    repos = await candidateRepos(workspaceId, integration.config || {});
  }
  const prs = [];
  const errors = [];
  await Promise.all(repos.map(async (r) => {
    try {
      const list = await gh.listPulls(r, { state: 'open', perPage: 20 });
      (list || []).forEach(pr => prs.push({
        repo: pr.base?.repo?.full_name || r,
        number: pr.number,
        title: pr.title,
        author: pr.user?.login || null,
        authorAvatar: pr.user?.avatar_url || null,
        url: pr.html_url,
        draft: !!pr.draft,
        state: prState(pr),
        branch: pr.head?.ref || null,
        base: pr.base?.ref || null,
        updatedAt: pr.updated_at,
      }));
    } catch (err) {
      errors.push({ repo: r, message: err.message });
    }
  }));
  prs.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  if (repo && errors.length && !prs.length) throw Object.assign(new Error(errors[0].message), { statusCode: 404 });
  return { prs: prs.slice(0, 50), repos, errors };
}

/** Create a GitHub issue; when taskId is given, link it to that task. */
async function createIssue({ workspaceId, repo, title, body, taskId, user, io }) {
  if (!isRepo(repo)) throw httpError(400, 'repo must be owner/name');
  const t = String(title || '').trim();
  if (!t) throw httpError(400, 'title is required');
  let task = null;
  if (taskId) task = await loadVisibleTask(workspaceId, taskId, user.id);
  const { gh } = await githubClientFor(workspaceId);
  const footer = user.name ? `\n\n---\n_Created from Oruinwan by ${user.name}_` : '';
  const issue = await gh.createIssue(repo, { title: t.slice(0, 256), body: `${String(body || '').slice(0, 60_000)}${footer}` });
  const result = { issue: { number: issue.number, url: issue.html_url, title: issue.title, repo } };
  if (task) {
    await require('../../tasks/tasks.service').applyExternalUpdate(String(task._id), {
      actorId: user.id,
      link: { provider: 'github', kind: 'issue', url: issue.html_url, repo, number: issue.number, title: issue.title, state: 'open' },
      note: `GitHub issue #${issue.number} created${user.name ? ` by ${user.name}` : ''}`,
    }, io);
    result.task = { id: String(task._id), issueKey: task.issueKey };
  }
  return result;
}

/** A task of this workspace the user can see (404 otherwise). */
async function loadVisibleTask(workspaceId, taskId, userId) {
  const Task = require('../../../../models/Task');
  const mongoose = require('mongoose');
  if (!mongoose.Types.ObjectId.isValid(String(taskId))) throw httpError(400, 'Invalid taskId');
  const task = await Task.findOne({ _id: taskId, workspace: workspaceId, deleted: { $ne: true } })
    .select('_id issueKey title status visibility channel createdBy assignedTo').lean();
  if (!task) throw httpError(404, 'Task not found');
  const { canViewTask } = require('../../tasks/tasks.shared');
  const Channel = require('../../channels/channel.model');
  const channels = (await Channel.find({ workspace: workspaceId, 'members.user': userId }).select('_id').lean()).map(c => String(c._id));
  if (!canViewTask(task, userId, channels)) throw httpError(404, 'Task not found');
  return task;
}

module.exports = {
  requireIntegration,
  githubClientFor,
  parseRepoNumber,
  fetchPullBundle,
  getPullView,
  getFileText,
  listOpenPulls,
  createIssue,
  loadVisibleTask,
  languageOf,
  clearCache,
  httpError,
};
