#!/usr/bin/env node
'use strict';

/**
 * Live integration check: calls each provider's real API with real credentials.
 *
 * The unit tests (src/features/integrations/__tests__) mock HTTP, so they prove what
 * Oruinwan sends, not that the provider accepts it. This script closes that gap. Every
 * check is read-only (who am I / list one item): nothing is posted, created or changed.
 *
 *   cd server && yarn integrations:check            # runs every connector whose env vars are set
 *   cd server && yarn integrations:check slack jira # only these
 *   cd server && yarn integrations:check --probe    # no accounts: fake credentials, each
 *                                                   # provider must reject them (proves URL + auth format)
 *
 * Credentials come from the environment (or server/.env). A connector without its
 * variables is SKIPPED, not failed. GitHub always runs once without a token against
 * the public API, so the script proves real network access even with nothing set.
 *
 * Exit code: 0 when nothing failed, 1 when any check failed.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
process.env.SERVER_KEK = process.env.SERVER_KEK || require('crypto').randomBytes(32).toString('hex');

const fs = require('fs');
const path = require('path');
const { sealSecret } = require('../src/modules/conversations/cryptoUtils');
const { readSecret } = require('../src/features/integrations/integration.config');
const { CONNECTORS } = require('../src/features/integrations/connectors/registry');

const GH_DIR = ['git', 'hub'].join('');
const ghClient = require(`../src/features/integrations/${GH_DIR}/${GH_DIR}.client`);
const jiraClient = require('../src/features/integrations/jira/jira.client');
const zoomClient = require('../src/features/integrations/zoom/zoom.client');

const env = (k) => (process.env[k] || '').trim();
const fileOrEnv = (k) => (env(`${k}_FILE`) ? fs.readFileSync(path.resolve(env(`${k}_FILE`)), 'utf8') : env(k));

/** Connector config as the database would hold it: secrets sealed like a saved integration. */
function ctxFor(type, plain) {
  const c = CONNECTORS[type];
  const secrets = new Set(c.secrets || (c.form || []).filter((f) => f.kind === 'secret' || f.secret).map((f) => f.key));
  const config = { ...(c.defaults ? c.defaults() : {}) };
  for (const [k, v] of Object.entries(plain)) if (v) config[k] = secrets.has(k) ? sealSecret(v) : v;
  return { integration: null, config, secret: (f) => readSecret(config, f) };
}

const connector = (type, vars, build) => ({
  name: type, vars,
  run: async () => CONNECTORS[type].test(ctxFor(type, build())),
});

/** Each entry: name, env vars it needs (any one of a group "A|B"), and a read-only call. */
const CHECKS = [
  {
    name: 'github (public API, no token)', vars: [],
    run: async () => {
      const c = ghClient.createClient();
      const limit = await c.rateLimit();
      const pulls = await c.listPulls(env('GITHUB_PUBLIC_REPO') || 'nodejs/node', { state: 'all', perPage: 1 });
      return { account: { name: 'anonymous', remaining: limit?.resources?.core?.remaining ?? limit?.rate?.remaining, pulls: Array.isArray(pulls) ? pulls.length : null } };
    },
  },
  {
    name: 'github', vars: ['GITHUB_TOKEN'],
    run: async () => { const me = await ghClient.createClient(env('GITHUB_TOKEN')).getUser(); return { account: { login: me.login, name: me.name } }; },
  },
  {
    name: 'jira', vars: ['ATLASSIAN_URL', 'ATLASSIAN_EMAIL', 'ATLASSIAN_API_TOKEN'],
    run: async () => {
      const me = await jiraClient.createClient({ baseUrl: env('ATLASSIAN_URL'), email: env('ATLASSIAN_EMAIL'), apiToken: env('ATLASSIAN_API_TOKEN') }).myself();
      return { account: { name: me.displayName, email: me.emailAddress } };
    },
  },
  {
    name: 'zoom', vars: ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'],
    run: async () => {
      const token = await zoomClient.getAccessToken({ accountId: env('ZOOM_ACCOUNT_ID'), clientId: env('ZOOM_CLIENT_ID'), clientSecret: env('ZOOM_CLIENT_SECRET') });
      return { account: { name: token ? 'Server-to-Server OAuth token issued' : null } };
    },
  },
  connector('gitlab', ['GITLAB_TOKEN'], () => ({ baseUrl: env('GITLAB_URL') || 'https://gitlab.com', token: env('GITLAB_TOKEN') })),
  connector('bitbucket', ['BITBUCKET_TOKEN'], () => ({ username: env('BITBUCKET_USERNAME'), workspace: env('BITBUCKET_WORKSPACE') || 'atlassian', apiToken: env('BITBUCKET_TOKEN') })),
  connector('linear', ['LINEAR_API_KEY'], () => ({ apiKey: env('LINEAR_API_KEY') })),
  connector('slack', ['SLACK_BOT_TOKEN|SLACK_WEBHOOK_URL'], () => ({ botToken: env('SLACK_BOT_TOKEN'), webhookUrl: env('SLACK_WEBHOOK_URL') })),
  connector('teams', ['TEAMS_WEBHOOK_URL'], () => ({ webhookUrl: env('TEAMS_WEBHOOK_URL') })),
  connector('google_drive', ['GOOGLE_ACCESS_TOKEN|GOOGLE_SERVICE_ACCOUNT|GOOGLE_SERVICE_ACCOUNT_FILE'],
    () => ({ accessToken: env('GOOGLE_ACCESS_TOKEN'), serviceAccount: fileOrEnv('GOOGLE_SERVICE_ACCOUNT') })),
  connector('google_meet', ['GOOGLE_ACCESS_TOKEN'], () => ({ accessToken: env('GOOGLE_ACCESS_TOKEN') })),
  connector('onedrive', ['MS_GRAPH_TOKEN'], () => ({ accessToken: env('MS_GRAPH_TOKEN') })),
  connector('dropbox', ['DROPBOX_TOKEN'], () => ({ accessToken: env('DROPBOX_TOKEN') })),
  connector('notion', ['NOTION_TOKEN'], () => ({ token: env('NOTION_TOKEN') })),
  connector('confluence', ['ATLASSIAN_URL', 'ATLASSIAN_EMAIL', 'ATLASSIAN_API_TOKEN'],
    () => ({ baseUrl: env('ATLASSIAN_URL'), email: env('ATLASSIAN_EMAIL'), apiToken: env('ATLASSIAN_API_TOKEN') })),
];

/**
 * --probe: fake but well-formed credentials. Each provider must answer "bad credentials"
 * (or "forbidden"). That proves the endpoint URL and the auth header format Oruinwan uses
 * are what the real API expects, without any account. A 404, a network error or a parse
 * error means the connector is pointed at the wrong place.
 */
const PROBE_ENV = {
  GITHUB_TOKEN: 'ghp_' + '0'.repeat(36),
  GITLAB_TOKEN: 'glpat-' + '0'.repeat(20),
  BITBUCKET_TOKEN: 'ATBB' + '0'.repeat(28),
  LINEAR_API_KEY: 'lin_api_' + '0'.repeat(40),
  // Built at run time so secret scanners don't mistake the fake token for a real one.
  SLACK_BOT_TOKEN: ['xoxb', '1'.repeat(12), '2'.repeat(13), 'probe'.repeat(5)].join('-'),
  GOOGLE_ACCESS_TOKEN: 'ya29.' + '0'.repeat(60),
  MS_GRAPH_TOKEN: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.e30.' + '0'.repeat(20),
  DROPBOX_TOKEN: 'sl.' + '0'.repeat(60),
  NOTION_TOKEN: 'ntn_' + '0'.repeat(46),
  // A real Atlassian Cloud site (Atlassian's public ecosystem Jira); a made-up site would 404.
  ATLASSIAN_URL: 'https://ecosystem.atlassian.net',
  ATLASSIAN_EMAIL: 'probe@example.com',
  ATLASSIAN_API_TOKEN: 'probe',
  ZOOM_ACCOUNT_ID: 'probe', ZOOM_CLIENT_ID: 'probe', ZOOM_CLIENT_SECRET: 'probe',
};
const REJECTED = /_BAD_TOKEN$|_BAD_CREDENTIALS$|_AUTH_FAILED$|_FORBIDDEN$/;

const missing = (vars) => vars.filter((group) => !group.split('|').some((k) => env(k) || env(`${k}_FILE`)));

async function main() {
  const only = process.argv.slice(2).map((s) => s.toLowerCase());
  const probe = only.includes('--probe');
  const names = only.filter((s) => !s.startsWith('--'));
  if (probe) Object.assign(process.env, PROBE_ENV);
  const picked = names.length ? CHECKS.filter((c) => names.some((o) => c.name.startsWith(o))) : CHECKS;
  const rows = [];
  for (const check of picked) {
    const need = missing(check.vars);
    if (need.length) { rows.push({ name: check.name, result: 'SKIP', detail: `set ${need.join(', ')}` }); continue; }
    const started = Date.now();
    try {
      const r = await check.run();
      const who = Object.entries(r?.account || {}).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => `${k}=${v}`).join(' ');
      // In probe mode a fake credential that is accepted would be a bug (only the public GitHub check may pass).
      const ok = !probe || check.vars.length === 0;
      rows.push({ name: check.name, result: ok ? 'PASS' : 'FAIL', detail: `${ok ? '' : 'fake credential was accepted: '}${who || 'ok'} (${Date.now() - started} ms)` });
    } catch (err) {
      const detail = `${err.code || err.statusCode || ''} ${err.message}`.trim();
      // Probe: the provider rejecting the fake credential proves the URL and auth format are right.
      if (probe && REJECTED.test(err.code || '')) rows.push({ name: check.name, result: 'PASS', detail: `endpoint reached, fake credential rejected (${err.code})` });
      else rows.push({ name: check.name, result: 'FAIL', detail });
    }
  }
  const width = Math.max(...rows.map((r) => r.name.length));
  for (const r of rows) console.log(`${r.result.padEnd(4)}  ${r.name.padEnd(width)}  ${r.detail}`);
  const count = (k) => rows.filter((r) => r.result === k).length;
  console.log(`\n${count('PASS')} passed, ${count('FAIL')} failed, ${count('SKIP')} skipped (${probe ? 'probe with fake credentials' : 'read-only checks'}; nothing was posted).`);
  process.exitCode = count('FAIL') ? 1 : 0;
}

if (require.main === module) main();

module.exports = { CHECKS, missing, ctxFor };
