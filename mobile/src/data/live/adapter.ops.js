// Live adapter part: automations, devices, account notification settings and SSO discovery.
// Merged into liveAdapter (adapter.js), so screens call these through api().
//
// Server contracts:
//   automations  /v2/automations, /v2/automations/:id, /v2/automations/:id/run, /v2/automations/:id/runs  (docs/api/automations.md)
//   devices      /v2/devices, /v2/devices/:deviceId (PATCH rename, DELETE revoke), /v2/devices/revoke-others  (docs/api/security.md)
//   account      /auth/me/preferences/notifications  (digestFrequency, emailDigest; docs/api/notifications.md)
//   workspace    /notifications/preferences  (aiSuggestions)
//   sso          /auth/sso/discover?email=  (docs/api/security.md)
import { api, configure, deviceId } from './http.js';
import { normalizeServerUrl } from './server.js';

const idOf = (v) => (v && typeof v === 'object' ? String(v._id || v.id || '') : v ? String(v) : null);

/** A feature the server doesn't offer (old server, or switched off) reads as empty. */
const softly = (fallback) => (err) => {
  if (err?.status === 404 || err?.code === 'FEATURE_DISABLED') return fallback;
  throw err;
};

// ---------------------------------------------------------------- automations

export const TRIGGER_LABEL = {
  'task.created': 'A task is created',
  'task.completed': 'A task is completed',
  'message.sent': 'A message is posted in a public channel',
  'file.uploaded': 'A file is uploaded',
  'meeting.completed': 'A meeting ends',
  'github.pr_merged': 'A GitHub pull request is merged',
  'webhook.received': 'A webhook arrives',
  scheduled: 'On a schedule',
};

export const STEP_LABEL = {
  send_message: 'Post a message',
  create_task: 'Create a task',
  assign_task: 'Assign a task',
  send_notification: 'Send a notification',
  call_webhook: 'Call a webhook',
  post_to_slack: 'Post to Slack',
  trigger_ci_pipeline: 'Start a CI pipeline',
};

/** "Every weekday at 09:30 (Europe/Berlin)"-ish, kept short: the raw rule with its kind. */
export function scheduleLabel(schedule) {
  if (!schedule?.expression) return null;
  if (schedule.type === 'interval') return `Every ${schedule.expression}`;
  return `Cron ${schedule.expression}${schedule.timezone && schedule.timezone !== 'UTC' ? ` · ${schedule.timezone}` : ' · UTC'}`;
}

export function mapAutomation(a) {
  const trigger = a.trigger?.type || 'unknown';
  const steps = (a.actions || []).map((s, i) => ({
    id: s.id || String(i),
    type: s.type,
    label: s.name || STEP_LABEL[s.type] || s.type,
    continueOnError: Boolean(s.continueOnError),
  }));
  return {
    id: idOf(a),
    name: a.name || 'Untitled automation',
    description: a.description || '',
    active: a.isActive !== false,
    trigger,
    triggerLabel: TRIGGER_LABEL[trigger] || trigger,
    schedule: a.schedule || null,
    scheduleLabel: trigger === 'scheduled' ? scheduleLabel(a.schedule) || 'Every 24h' : null,
    nextRunAt: a.nextRunAt || null,
    lastRunAt: a.lastRunAt || a.lastTriggeredAt || null,
    runCount: Number(a.runCount ?? a.executionCount ?? 0) || 0,
    conditions: (a.conditions || []).length,
    conditionLogic: a.conditionLogic || 'all',
    steps,
    updatedAt: a.updatedAt || a.createdAt || null,
  };
}

export function mapRun(r) {
  return {
    id: idOf(r),
    status: r.status || 'success',
    source: r.source || 'event',
    dryRun: Boolean(r.dryRun),
    conditionsMet: r.conditionsMet !== false,
    error: r.error || null,
    durationMs: Number(r.durationMs) || 0,
    at: r.createdAt || r.startedAt || null,
    steps: (r.actionsExecuted || []).map((s, i) => ({
      index: s.index ?? i,
      id: s.stepId || null,
      type: s.type,
      label: STEP_LABEL[s.type] || s.type,
      status: s.status || (s.success ? 'success' : 'failed'),
      error: s.error || null,
      reason: s.reason || null,
      durationMs: Number(s.durationMs) || 0,
    })),
  };
}

// ---------------------------------------------------------------- devices

export function mapDevice(d) {
  return {
    id: d.deviceId,
    name: d.deviceName || d.customName || d.reportedName || 'Device',
    reportedName: d.reportedName || null,
    customName: d.customName || null,
    platform: d.platform || 'unknown',
    ip: d.ipAddress || null,
    lastActive: d.lastActiveAt || d.createdAt || null,
    createdAt: d.createdAt || null,
    current: Boolean(d.isCurrent),
    revoked: Boolean(d.revoked),
    sessions: Number(d.sessionCount ?? d.sessions?.length ?? 0) || 0,
    pushTokens: Number(d.pushTokenCount) || 0,
  };
}

/** Current device first, then most recently active. */
export function sortDevices(list) {
  return [...list].sort((a, b) => (b.current - a.current) || (new Date(b.lastActive || 0) - new Date(a.lastActive || 0)));
}

export const DIGEST_FREQUENCIES = ['daily', 'weekly', 'off'];

export const opsAdapter = {
  // ---- automations
  async automations(ws) {
    const d = await api.get('/v2/automations', { workspaceId: ws, limit: 100 }).catch(softly({ automations: [] }));
    return (d.automations || []).map(mapAutomation);
  },
  async automation(ws, id) {
    const d = await api.get(`/v2/automations/${id}`, { workspaceId: ws });
    return mapAutomation(d.automation || d);
  },
  async setAutomationActive(ws, id, active) {
    const d = await api.patch(`/v2/automations/${id}`, { workspaceId: ws, isActive: Boolean(active) });
    return mapAutomation(d.automation || d);
  },
  /** Run now (executes the steps), or `dryRun` to test without doing anything. */
  async runAutomation(ws, id, { dryRun = false } = {}) {
    const d = await api.post(`/v2/automations/${id}/run`, { workspaceId: ws, dryRun });
    return mapRun(d.run || d);
  },
  async automationRuns(ws, id, { before } = {}) {
    const d = await api.get(`/v2/automations/${id}/runs`, { workspaceId: ws, limit: 30, ...(before ? { before } : {}) });
    return (d.runs || []).map(mapRun);
  },

  // ---- devices (sign-in devices; replaces the session list where the server has it)
  /** Devices, or null when the server has no device API (then the app shows sign-in sessions). */
  async deviceList() {
    const d = await api.get('/v2/devices').catch(softly(null));
    if (!d) return null;
    return sortDevices((d.devices || []).filter((x) => !x.revoked).map(mapDevice));
  },
  async renameDevice(id, name) {
    const d = await api.patch(`/v2/devices/${encodeURIComponent(id)}`, { name: name?.trim() || null });
    return d.device ? mapDevice(d.device) : null;
  },
  async signOutDevice(id) {
    return api.del(`/v2/devices/${encodeURIComponent(id)}`);
  },
  async signOutOtherDevices() {
    return api.post('/v2/devices/revoke-others', {});
  },
  thisDeviceId: () => deviceId(),

  // ---- account notification settings (email digest)
  async accountNotificationPrefs() {
    const d = await api.get('/auth/me/preferences/notifications');
    const p = d.preferences || d.notifications || d || {};
    const freq = DIGEST_FREQUENCIES.includes(p.digestFrequency) ? p.digestFrequency : p.emailDigest === false ? 'off' : 'daily';
    return { digestFrequency: p.emailDigest === false ? 'off' : freq };
  },
  async saveDigestFrequency(value) {
    if (!DIGEST_FREQUENCIES.includes(value)) throw new Error('Pick daily, weekly or off');
    await api.put('/auth/me/preferences/notifications', { digestFrequency: value, emailDigest: value !== 'off' });
  },

  // ---- SSO
  /** { enabled, protocol, startUrl } for a work email; enabled false when the company has no SSO. */
  async ssoDiscover({ server, email }) {
    if (server) configure(normalizeServerUrl(server));
    const d = await api.get('/auth/sso/discover', { email: email.trim() }).catch(softly({ enabled: false }));
    return { enabled: Boolean(d.enabled && d.startUrl), protocol: d.protocol || null, startUrl: d.startUrl || null };
  },
};
