/**
 * Pure helpers for the workflow builder: step ids, template variables, condition
 * operators and the save payload. Mirrors docs/api/automations.md.
 */

export const MAX_STEPS = 10;
export const MAX_CONDITIONS = 20;
export const STEP_ID_RE = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/;

/** Fields each trigger's event data carries (metadata only — messages have no text). */
export const TRIGGER_FIELDS = {
  'task.created': ['taskId', 'title', 'status', 'priority', 'type', 'tags', 'channelId', 'assigneeId', 'assigneeIds', 'assigneeUsernames', 'createdBy', 'userId', 'dueDate', 'storyPoints', 'issueKey', 'parentTaskId'],
  'task.completed': ['taskId', 'title', 'status', 'priority', 'type', 'tags', 'channelId', 'assigneeId', 'assigneeIds', 'createdBy', 'userId', 'dueDate', 'issueKey', 'completedAt'],
  'message.sent': ['messageId', 'channelId', 'channelName', 'senderId', 'senderUsername', 'type', 'isThreadReply', 'parentId', 'hasAttachments', 'attachmentCount', 'attachmentTypes', 'createdAt'],
  'file.uploaded': ['fileId', 'fileName', 'extension', 'mimeType', 'size', 'sizeMB', 'folderId', 'tags', 'userId', 'uploadedBy'],
  'meeting.completed': ['meetingId', 'title', 'kind', 'durationMinutes', 'participantCount', 'actionItemCount'],
  'github.pr_merged': ['repo', 'title', 'actor', 'event'],
  'webhook.received': ['webhookType', 'event'],
  scheduled: ['automationId', 'scheduledAt', 'userId'],
};

/** The trigger's noun alias ({{task.title}} …). */
export const TRIGGER_NOUN = {
  'task.created': 'task', 'task.completed': 'task', 'message.sent': 'message', 'file.uploaded': 'file',
  'meeting.completed': 'meeting', 'github.pr_merged': 'github', 'webhook.received': 'webhook',
};

/** What each step type outputs for later steps. */
export const STEP_OUTPUTS = {
  send_message: ['messageId', 'channelId', 'channelName'],
  create_task: ['taskId', 'taskTitle', 'issueKey'],
  assign_task: ['taskId', 'assigneeId'],
  send_notification: ['notified'],
  call_webhook: ['status', 'data'],
  post_to_slack: ['posted'],
  trigger_ci_pipeline: ['status'],
};

const STEP_ID_BASE = {
  send_message: 'message', create_task: 'task', assign_task: 'assign', send_notification: 'notify',
  call_webhook: 'webhook', post_to_slack: 'slack', trigger_ci_pipeline: 'ci',
};

/** A free, valid step id for a new step of `type` ("task", "task2", …). */
export function suggestStepId(type, existingIds = []) {
  const base = STEP_ID_BASE[type] || 'step';
  const taken = new Set(existingIds.filter(Boolean));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 100; n += 1) if (!taken.has(`${base}${n}`)) return `${base}${n}`;
  return `${base}${Date.now() % 10000}`;
}

/** Per-step id problems: [{ index, message }]. Empty ids are allowed (the server accepts them). */
export function validateStepIds(actions = []) {
  const errors = [];
  const seen = new Set();
  actions.forEach((a, index) => {
    const id = (a?.id || '').trim();
    if (!id) return;
    if (!STEP_ID_RE.test(id)) errors.push({ index, message: 'Start with a letter; use letters, digits, _ or -' });
    else if (seen.has(id)) errors.push({ index, message: `“${id}” is used by an earlier step` });
    seen.add(id);
  });
  return errors;
}

/**
 * Variables a field in step `stepIndex` may use, grouped for the picker:
 * [{ group, items: [{ token, label }] }]
 */
export function variablesFor(triggerType, actions = [], stepIndex = actions.length) {
  const groups = [];
  const fields = TRIGGER_FIELDS[triggerType] || [];
  const noun = TRIGGER_NOUN[triggerType];
  if (fields.length) {
    groups.push({
      group: 'Trigger',
      items: fields.map((f) => ({ token: `{{${noun ? `${noun}.` : ''}${f}}}`, label: `${noun ? `${noun}.` : ''}${f}` })),
    });
  }
  if (triggerType === 'github.pr_merged' || triggerType === 'webhook.received') {
    groups.push({ group: 'Raw payload', items: [{ token: '{{event.}}', label: 'event.<field> (raw payload)' }] });
  }
  if (stepIndex > 0) {
    const prev = actions[stepIndex - 1];
    groups.push({
      group: 'Previous step',
      items: (STEP_OUTPUTS[prev?.type] || []).map((f) => ({ token: `{{previous.${f}}}`, label: `previous.${f}` })),
    });
    for (let i = 0; i < stepIndex; i += 1) {
      const a = actions[i];
      const key = (a?.id || '').trim() && STEP_ID_RE.test(a.id.trim()) ? a.id.trim() : String(i);
      const outs = STEP_OUTPUTS[a?.type] || [];
      if (!outs.length) continue;
      groups.push({
        group: `Step ${i + 1}${key !== String(i) ? ` · ${key}` : ''}`,
        items: outs.map((f) => ({ token: `{{steps.${key}.${f}}}`, label: `steps.${key}.${f}` })),
      });
    }
  }
  groups.push({ group: 'Other', items: [{ token: '{{now}}', label: 'now (time of the run)' }] });
  return groups;
}

/** Insert `token` into `text` at [start, end) (defaults to the end). Returns { value, caret }. */
export function insertToken(text = '', token, start, end) {
  const s = Number.isInteger(start) ? start : text.length;
  const e = Number.isInteger(end) ? end : s;
  const value = text.slice(0, s) + token + text.slice(e);
  return { value, caret: s + token.length };
}

/** Template references in a string that point at steps that don't exist before `stepIndex`. */
export function unknownStepRefs(text, actions = [], stepIndex = actions.length) {
  if (typeof text !== 'string') return [];
  const known = new Set();
  for (let i = 0; i < stepIndex; i += 1) {
    known.add(String(i));
    if (actions[i]?.id) known.add(String(actions[i].id).trim());
  }
  const bad = [];
  const re = /\{\{\s*steps\.([^.}\s]+)\./g;
  let m;
  while ((m = re.exec(text))) if (!known.has(m[1])) bad.push(m[1]);
  if (stepIndex === 0 && /\{\{\s*previous\./.test(text)) bad.push('previous');
  return bad;
}

export const OPERATORS = [
  { value: 'equals', label: 'equals', kind: 'text' },
  { value: 'not_equals', label: 'does not equal', kind: 'text' },
  { value: 'contains', label: 'contains', kind: 'text' },
  { value: 'not_contains', label: 'does not contain', kind: 'text' },
  { value: 'greater_than', label: 'is greater than', kind: 'number' },
  { value: 'less_than', label: 'is less than', kind: 'number' },
  { value: 'in', label: 'is one of', kind: 'list' },
  { value: 'exists', label: 'exists', kind: 'bool' },
  { value: 'matches', label: 'matches pattern', kind: 'regex' },
];
export const operatorOf = (v) => OPERATORS.find((o) => o.value === v) || OPERATORS[0];

/** Convert the builder's editable condition into what the API expects. */
export function normaliseCondition(c) {
  const field = String(c.field || '').trim();
  const op = operatorOf(c.operator);
  let value = c.value;
  if (op.kind === 'list') {
    value = Array.isArray(value) ? value : String(value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  } else if (op.kind === 'bool') {
    value = !(value === false || value === 'false');
  } else if (op.kind === 'number') {
    const s = String(value ?? '').trim();
    value = s !== '' && !Number.isNaN(Number(s)) ? Number(s) : s;
  } else {
    value = value == null ? '' : String(value);
  }
  return { field, operator: op.value, value };
}

/** Display string of a stored condition value for an input. */
export function conditionInputValue(c) {
  if (Array.isArray(c.value)) return c.value.join(', ');
  if (c.value === undefined || c.value === null) return '';
  return String(c.value);
}

export function conditionComplete(c) {
  if (!String(c.field || '').trim()) return false;
  if (operatorOf(c.operator).kind === 'bool') return true;
  return String(conditionInputValue(c)).trim().length > 0;
}

/** Common cron schedules for quick picking. */
export const CRON_PRESETS = [
  { expression: '0 9 * * 1-5', label: 'Weekdays at 09:00' },
  { expression: '30 9 * * 1', label: 'Mondays at 09:30' },
  { expression: '0 * * * *', label: 'Every hour, on the hour' },
  { expression: '*/15 * * * *', label: 'Every 15 minutes' },
  { expression: '0 17 * * 5', label: 'Fridays at 17:00' },
  { expression: '0 9 1 * *', label: 'First of the month, 09:00' },
];

export const INTERVAL_PRESETS = [
  { value: '15m', label: 'Every 15 minutes' },
  { value: '30m', label: 'Every 30 minutes' },
  { value: '1h', label: 'Every hour' },
  { value: '6h', label: 'Every 6 hours' },
  { value: '12h', label: 'Every 12 hours' },
  { value: '24h', label: 'Every 24 hours' },
  { value: '7d', label: 'Every 7 days' },
];

/** Cheap local check before asking the server; the server is the real validator. */
export function looksLikeSchedule(schedule) {
  if (!schedule) return false;
  const expr = String(schedule.expression || '').trim();
  if (schedule.type === 'interval') return /^\d+\s*[mhd]$/i.test(expr);
  if (/^@(hourly|daily|midnight|weekly|monthly|yearly|annually)$/i.test(expr)) return true;
  return expr.split(/\s+/).length === 5;
}

export function browserTimezone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

export function timezoneList() {
  try {
    if (typeof Intl.supportedValuesOf === 'function') return Intl.supportedValuesOf('timeZone');
  } catch { /* older runtimes */ }
  return ['UTC', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney'];
}

/** Body for POST / PATCH. */
export function buildAutomationPayload(form, workspaceId) {
  const actions = (form.actions || []).map((a) => {
    const out = { type: a.type, config: a.config || {} };
    const id = (a.id || '').trim();
    if (id) out.id = id;
    if (a.name && a.name.trim()) out.name = a.name.trim();
    if (a.continueOnError) out.continueOnError = true;
    return out;
  });
  const conditions = (form.conditions || []).filter(conditionComplete).map(normaliseCondition);
  const payload = {
    workspaceId,
    name: (form.name || '').trim(),
    description: form.description || '',
    trigger: form.trigger,
    conditions,
    conditionLogic: form.conditionLogic === 'any' ? 'any' : 'all',
    actions,
    isActive: form.isActive !== false,
  };
  if (form.trigger?.type === 'scheduled') {
    const s = form.schedule || { type: 'interval', expression: '24h' };
    payload.schedule = s.type === 'cron'
      ? { type: 'cron', expression: String(s.expression || '').trim(), timezone: s.timezone || 'UTC' }
      : { type: 'interval', expression: String(s.expression || '24h').trim() };
  } else {
    payload.schedule = null;
  }
  return payload;
}

/** Move an item in an array; returns a new array. */
export function moveItem(list, from, to) {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export const RUN_TONE = { success: 'success', partial: 'warning', failed: 'danger', skipped: undefined };
export const RUN_LABEL = { success: 'Succeeded', partial: 'Partly failed', failed: 'Failed', skipped: 'Skipped' };
export const SOURCE_LABEL = { event: 'Event', schedule: 'Schedule', manual: 'Run now', test: 'Test' };

/** Parse the "sample event data" JSON box. Returns { data } or { error }. */
export function parseSampleData(text) {
  const s = String(text || '').trim();
  if (!s) return { data: {} };
  try {
    const data = JSON.parse(s);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { error: 'Sample data must be a JSON object' };
    return { data };
  } catch {
    return { error: 'Sample data isn’t valid JSON' };
  }
}

/** A starter sample for the test box, from the trigger's fields. */
export function sampleEventFor(triggerType) {
  const samples = {
    'task.created': { title: 'Write release notes', priority: 'high', status: 'todo', tags: ['release'] },
    'task.completed': { title: 'Write release notes', priority: 'high', status: 'done' },
    'message.sent': { channelName: 'general', senderUsername: 'ana', hasAttachments: false },
    'file.uploaded': { fileName: 'spec.pdf', extension: 'pdf', sizeMB: 1.2 },
    'meeting.completed': { title: 'Weekly sync', durationMinutes: 30, participantCount: 4, actionItemCount: 2 },
    'github.pr_merged': { repo: 'web', title: 'Fix login', actor: 'ana' },
    'webhook.received': { webhookType: 'generic', event: 'deploy' },
    scheduled: {},
  };
  return samples[triggerType] || {};
}
