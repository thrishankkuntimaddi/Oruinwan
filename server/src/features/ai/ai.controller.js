'use strict';

/**
 * HTTP transport for Oruinwan Intelligence. Validates input, passes plain
 * payloads to ai/api/ai.gateway.js with the workspace's provider context, and
 * shapes errors. No model calls happen here.
 */

const logger = require('../../../utils/logger');
const gateway = require('../../../../ai/api/ai.gateway');
const { listProviders, modelsFor } = require('../../../../ai/providers');
const { DECLARATIONS } = require('../../../../ai/tools/registry');
const { NOTE_ACTIONS } = require('../../../../ai/agents/assist.agents');
const aiConfig = require('../../../../ai/config');
const activityService = require('../activity/activity.service');
const aiSummarizer = require('./ai.summarizer.service');
const resolver = require('./ai.provider.resolver');
const AIUsage = require('../../models/AIUsage');
const Workspace = require('../../../models/Workspace');

const isProduction = process.env.NODE_ENV === 'production';

// Every gateway call is recorded (fire and forget) for the usage dashboard.
gateway.configure({
  onUsage: (row) => AIUsage.create({
    workspaceId: row.workspaceId || null,
    userId: row.userId || null,
    intent: row.intent,
    agent: row.agent,
    provider: row.provider,
    model: row.model,
    durationMs: row.durationMs,
    ok: row.ok,
    error: row.error ? String(row.error).slice(0, 300) : null,
  }).catch(() => {}),
});

function ctxFor(req, extra = {}) {
  return {
    userId: req.user.sub,
    workspaceId: req.aiWorkspace?.id || null,
    req,
    io: req.app?.get('io') || null,
    ...(req.aiContext || {}),
    ...extra,
  };
}

function sendError(res, err, label) {
  const code = err?.code;
  if (code === 'AI_NOT_CONFIGURED') {
    return res.status(503).json({ message: 'AI is not configured for this workspace yet. Ask an admin to connect a provider.', code });
  }
  if (code === 'AI_ENGINE_UNAVAILABLE') {
    return res.status(503).json({ message: 'The Oruinwan AI engine is offline right now. Please try again in a moment.', code });
  }
  if (err?.status === 429) return res.status(429).json({ message: 'The AI provider is rate limiting requests. Try again shortly.', code: 'AI_PROVIDER_RATE_LIMITED' });
  if (/required|unknown action|is required/i.test(err?.message || '')) return res.status(400).json({ message: err.message });
  logger.error({ err }, `[AI] ${label} failed`);
  return res.status(502).json({ message: 'AI request failed', code: 'AI_FAILED', ...(isProduction ? {} : { detail: err?.message }) });
}

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const arr = (v, max = 200) => (Array.isArray(v) ? v.slice(-max) : []);

/** Client transcripts: [{ sender, text, isMe }] — plaintext decrypted on the client. */
function cleanMessages(list) {
  return arr(list, 200)
    .filter((m) => m && typeof m === 'object' && typeof (m.text ?? m.content) === 'string')
    .map((m) => ({ sender: str(m.sender || m.senderName, 80) || null, text: str(m.text ?? m.content, 4000), isMe: !!m.isMe }));
}

function emitActivity(req, subtype, payload) {
  activityService.emit(req, { type: 'ai', subtype, workspaceId: req.aiWorkspace?.id || null, actor: req.user.sub, payload }).catch(() => {});
}

/* ── Assistant ─────────────────────────────────────────────────────────── */

/** Whitelist + size-cap the client-supplied screen context (decrypted on the client). */
function cleanChatContext(req, context) {
  if (!context || typeof context !== 'object') return undefined;
  return {
    workspaceName: req.aiWorkspace?.name,
    screen: context.screen && { route: str(context.screen.route, 200), title: str(context.screen.title, 200) },
    conversation: context.conversation && {
      id: str(context.conversation.id, 64), type: context.conversation.type === 'dm' ? 'dm' : 'channel',
      name: str(context.conversation.name, 100), messages: cleanMessages(context.conversation.messages).slice(-40),
    },
    note: context.note && { title: str(context.note.title, 200), text: str(context.note.text, 20_000) },
    task: context.task && { title: str(context.task.title, 200), description: str(context.task.description, 4000), status: str(context.task.status, 40) },
    selection: str(context.selection, 8000) || undefined,
  };
}

function chatPayload(req) {
  const { message, history, context } = req.body || {};
  return { message: str(message, 8000), history: arr(history, 40), workspaceId: req.aiWorkspace?.id || null, context: cleanChatContext(req, context) };
}

exports.chat = async (req, res) => {
  try {
    const payload = chatPayload(req);
    if (!payload.message) return res.status(400).json({ message: 'message is required' });
    const result = await gateway.chat(payload, ctxFor(req));
    emitActivity(req, 'chat', { prompt: str(payload.message, 200), response: str(result.text, 200), actions: (result.actionsExecuted || []).map((a) => a.function) });
    return res.json({ text: result.text, actionsExecuted: result.actionsExecuted || null, provider: result.event?.payload?.provider });
  } catch (err) {
    return sendError(res, err, 'chat');
  }
};

/**
 * Streaming chat (Server-Sent Events). Same input as `chat`; the response is a
 * stream of events:
 *   event: token   data: {"t":"text delta"}
 *   event: tool    data: {"name":"create_task","status":"running"|"done"|"failed"}
 *   event: done    data: {"text":"full answer","actionsExecuted":[...]|null}
 *   event: error   data: {"message":"…","code":"…"}
 * Closing the connection (Stop button, panel closed) cancels generation.
 */
exports.chatStream = async (req, res) => {
  const payload = chatPayload(req);
  if (!payload.message) return res.status(400).json({ message: 'message is required' });

  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // disable proxy buffering (nginx, Cloud Run front ends)
  });
  res.flushHeaders?.();

  const abort = new AbortController();
  let closed = false;
  // `close` on the response fires when the client disconnects before we finish.
  res.on('close', () => { closed = true; if (!res.writableEnded) abort.abort(); });
  const send = (event, data) => {
    if (closed || res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  // Keep intermediaries from timing out while a slow local model warms up.
  const ping = setInterval(() => { if (!closed) res.write(': ping\n\n'); }, 15_000);

  try {
    const result = await gateway.chat(payload, ctxFor(req, {
      signal: abort.signal,
      onToken: (t) => send('token', { t }),
      onEvent: (e) => {
        if (e.type === 'tool') send('tool', { name: e.name, status: 'running' });
        else if (e.type === 'tool_result') send('tool', { name: e.name, status: e.ok ? 'done' : 'failed' });
      },
    }));
    emitActivity(req, 'chat', { prompt: str(payload.message, 200), response: str(result.text, 200), actions: (result.actionsExecuted || []).map((a) => a.function) });
    send('done', { text: result.text, actionsExecuted: result.actionsExecuted || null, provider: result.event?.payload?.provider });
  } catch (err) {
    if (err?.code !== 'AI_ABORTED' && !abort.signal.aborted) {
      logger.error({ err }, '[AI] chat stream failed');
      send('error', streamError(err));
    }
  } finally {
    clearInterval(ping);
    if (!res.writableEnded) res.end();
  }
};

/** Map an AI failure to the `{ message, code }` shape used by the stream's error event. */
function streamError(err) {
  if (err?.code === 'AI_ENGINE_UNAVAILABLE') return { message: 'The Oruinwan AI engine is offline right now. Please try again in a moment.', code: err.code };
  if (err?.code === 'AI_NOT_CONFIGURED') return { message: 'AI is not configured for this workspace yet.', code: err.code };
  if (err?.status === 429) return { message: 'The AI is busy. Try again shortly.', code: 'AI_PROVIDER_RATE_LIMITED' };
  return { message: 'The AI could not answer that. Please try again.', code: 'AI_FAILED', ...(isProduction ? {} : { detail: err?.message }) };
}

exports.clearMemory = async (req, res) => {
  gateway.clearMemory({ userId: req.user.sub, workspaceId: req.aiWorkspace?.id || null });
  return res.json({ ok: true });
};

/* ── One-shot helpers ──────────────────────────────────────────────────── */

exports.summarize = async (req, res) => {
  try {
    const { text, style, title } = req.body;
    if (!str(text, 1)) return res.status(400).json({ message: 'text is required' });
    const result = await gateway.summarize({ text: str(text, 60_000), style: str(style, 20) || 'brief', title: str(title, 200) }, ctxFor(req));
    emitActivity(req, 'summary', { summary: str(result.summary, 200) });
    return res.json({ summary: result.summary });
  } catch (err) {
    return sendError(res, err, 'summarize');
  }
};

exports.generateTask = async (req, res) => {
  try {
    const { context } = req.body;
    if (!str(context, 1)) return res.status(400).json({ message: 'context is required' });
    const result = await gateway.generateTask({ context: str(context, 8000) }, ctxFor(req));
    emitActivity(req, 'task_generated', { title: result.title, priority: result.priority });
    const { event, ...task } = result; // eslint-disable-line no-unused-vars
    return res.json(task);
  } catch (err) {
    return sendError(res, err, 'generateTask');
  }
};

exports.smartReplies = async (req, res) => {
  try {
    if (req.aiWorkspace?.settings?.smartReplies === false) return res.json({ suggestions: [], disabled: true });
    const messages = cleanMessages(req.body.messages);
    if (!messages.length) return res.json({ suggestions: [] });
    const result = await gateway.smartReplies({ messages, tone: str(req.body.tone, 40) || undefined }, ctxFor(req));
    return res.json({ suggestions: result.suggestions });
  } catch (err) {
    // Suggestions are a nicety: degrade to none instead of an error banner.
    if (err?.code === 'AI_NOT_CONFIGURED') return res.json({ suggestions: [] });
    return sendError(res, err, 'smartReplies');
  }
};

exports.translate = async (req, res) => {
  try {
    const { text, targetLang, targetLanguage } = req.body;
    const lang = str(targetLang || targetLanguage, 40);
    if (!str(text, 1) || !lang) return res.status(400).json({ message: 'text and targetLang are required' });
    const result = await gateway.translate({ text: str(text, 20_000), targetLang: lang }, ctxFor(req));
    return res.json({ translated: result.translated, detectedLang: result.detectedLang });
  } catch (err) {
    return sendError(res, err, 'translate');
  }
};

exports.draft = async (req, res) => {
  try {
    const { instruction, messages, tone, replyTo, existing } = req.body;
    if (!str(instruction, 1)) return res.status(400).json({ message: 'instruction is required' });
    const result = await gateway.draft({
      instruction: str(instruction, 2000), messages: cleanMessages(messages).slice(-30),
      tone: str(tone, 40) || undefined, replyTo: str(replyTo, 2000) || undefined, existing: str(existing, 4000) || undefined,
    }, ctxFor(req));
    emitActivity(req, 'chat', { prompt: `draft: ${str(instruction, 120)}` });
    return res.json({ draft: result.draft });
  } catch (err) {
    return sendError(res, err, 'draft');
  }
};

exports.conversation = async (req, res) => {
  try {
    const { messages, mode, question, title, parentText } = req.body;
    const list = cleanMessages(messages);
    if (!list.length && !str(parentText, 1)) return res.status(400).json({ message: 'messages are required' });
    const result = await gateway.conversation({
      messages: list, mode: str(mode, 20) || 'summary', question: str(question, 1000) || undefined,
      title: str(title, 100) || undefined, parentText: str(parentText, 4000) || undefined,
    }, ctxFor(req));
    emitActivity(req, 'summary', { mode: str(mode, 20) || 'summary', summary: str(result.text, 200) });
    return res.json({ text: result.text, items: result.items || null });
  } catch (err) {
    return sendError(res, err, 'conversation');
  }
};

exports.extractTasks = async (req, res) => {
  try {
    const { text, max, create } = req.body;
    if (!str(text, 1)) return res.status(400).json({ message: 'text is required' });
    const result = await gateway.extractTasks({ text: str(text, 20_000), max: Number(max) || 10 }, ctxFor(req));
    let created = [];
    if (create === true && result.tasks.length && req.aiWorkspace) {
      const tasksService = require('../tasks/tasks.service');
      const io = req.app?.get('io');
      for (const t of result.tasks) {
        try {
          const out = await tasksService.createTask(req.user.sub, {
            workspaceId: req.aiWorkspace.id, title: t.title, description: t.description, priority: t.priority,
            dueDate: t.dueDate ? new Date(t.dueDate) : undefined, assignmentType: 'self', source: 'ai',
          }, io, req);
          const task = Array.isArray(out?.tasks) ? out.tasks[0] : (out?.task || out);
          if (task?._id) created.push({ _id: task._id, title: task.title, status: task.status, priority: task.priority, dueDate: task.dueDate || null });
        } catch (err) {
          logger.warn({ err }, '[AI] extractTasks: create failed');
        }
      }
    }
    emitActivity(req, 'task_generated', { count: result.tasks.length, created: created.length });
    return res.json({ tasks: result.tasks, created });
  } catch (err) {
    return sendError(res, err, 'extractTasks');
  }
};

exports.noteAssist = async (req, res) => {
  try {
    const { action, text, title, instruction } = req.body;
    if (!(action in NOTE_ACTIONS)) return res.status(400).json({ message: `action must be one of ${Object.keys(NOTE_ACTIONS).join(', ')}` });
    if (!str(text, 1)) return res.status(400).json({ message: 'text is required' });
    const result = await gateway.noteAssist({ action, text: str(text, 40_000), title: str(title, 200) || undefined, instruction: str(instruction, 2000) || undefined }, ctxFor(req));
    emitActivity(req, 'summary', { note: str(title, 100), action });
    return res.json({ text: result.text, action });
  } catch (err) {
    return sendError(res, err, 'noteAssist');
  }
};

const TASK_ASSIST = {
  describe: 'Write a clear task description (2-5 sentences) for this task. Return only the description.',
  subtasks: 'Break this task into 3-7 concrete subtasks. Return a Markdown checklist (- [ ] item), nothing else.',
  acceptance: 'Write acceptance criteria for this task as a Markdown checklist (- [ ] criterion), nothing else.',
  summary: 'Summarize the task and its current state in 2 sentences.',
  estimate: 'Estimate the effort for this task (S / M / L / XL) with a one-sentence reason. Return only that.',
  custom: null,
};

exports.taskAssist = async (req, res) => {
  try {
    const { action = 'describe', task, instruction } = req.body;
    if (!(action in TASK_ASSIST)) return res.status(400).json({ message: `action must be one of ${Object.keys(TASK_ASSIST).join(', ')}` });
    if (!task || !str(task.title, 1)) return res.status(400).json({ message: 'task.title is required' });
    const text = [
      `Title: ${str(task.title, 200)}`,
      task.description ? `Description: ${str(task.description, 4000)}` : null,
      task.status ? `Status: ${str(task.status, 40)}` : null,
      task.priority ? `Priority: ${str(task.priority, 20)}` : null,
      task.dueDate ? `Due: ${str(task.dueDate, 40)}` : null,
      Array.isArray(task.subtasks) && task.subtasks.length ? `Existing subtasks: ${task.subtasks.map((s) => str(s, 200)).join('; ')}` : null,
    ].filter(Boolean).join('\n');
    const result = await gateway.noteAssist({
      action: 'custom', text, title: str(task.title, 200),
      instruction: action === 'custom' ? str(instruction, 2000) : TASK_ASSIST[action],
    }, ctxFor(req));
    return res.json({ text: result.text, action });
  } catch (err) {
    return sendError(res, err, 'taskAssist');
  }
};

/* ── Settings / capabilities / usage ───────────────────────────────────── */

async function settingsView(workspaceId) {
  const ws = await Workspace.findById(workspaceId).select('settings.ai').lean();
  const ai = { enabled: true, provider: 'default', model: null, smartReplies: true, ...(ws?.settings?.ai || {}) };
  const resolved = await resolver.resolveForWorkspace(workspaceId);
  const aiProviderService = require('../integrations/ai-provider.service');
  const connected = (await aiProviderService.getProviders(workspaceId)).map((p) => ({ provider: p.provider, status: p.status, hasKey: p.hasKey, baseUrl: p.config?.baseUrl || null }));
  return {
    ...ai,
    effective: { provider: resolved.providerName, model: resolved.model || modelsFor(resolved.providerName).chat, source: resolved.source },
    defaultProvider: { name: aiConfig.provider, configured: !!aiConfig.keys[aiConfig.provider] || aiConfig.provider === 'mock', models: modelsFor(aiConfig.provider) },
    available: listProviders().filter((n) => n !== 'mock').map((name) => ({ name, models: modelsFor(name), connected: connected.some((c) => c.provider === name && c.status === 'active') })),
    connected,
  };
}

exports.getSettings = async (req, res) => {
  try {
    return res.json({ settings: await settingsView(req.aiWorkspace.id), canManage: req.aiWorkspace.isAdmin });
  } catch (err) {
    return sendError(res, err, 'getSettings');
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { enabled, provider, model, smartReplies } = req.body;
    const $set = {};
    if (typeof enabled === 'boolean') $set['settings.ai.enabled'] = enabled;
    if (typeof smartReplies === 'boolean') $set['settings.ai.smartReplies'] = smartReplies;
    if (provider !== undefined) {
      const allowed = ['default', ...listProviders().filter((n) => n !== 'mock'), 'claude'];
      if (!allowed.includes(provider)) return res.status(400).json({ message: `provider must be one of ${allowed.join(', ')}` });
      $set['settings.ai.provider'] = provider;
    }
    if (model !== undefined) $set['settings.ai.model'] = model ? str(model, 80) : null;
    if (Object.keys($set).length) await Workspace.updateOne({ _id: req.aiWorkspace.id }, { $set });
    resolver.invalidate(req.aiWorkspace.id);
    return res.json({ settings: await settingsView(req.aiWorkspace.id), canManage: true });
  } catch (err) {
    return sendError(res, err, 'updateSettings');
  }
};

exports.testProvider = async (req, res) => {
  try {
    const result = await gateway.summarize({ text: 'Oruinwan connection test: reply with the single word OK.', style: 'brief' }, ctxFor(req));
    const r = await resolver.resolveForWorkspace(req.aiWorkspace.id);
    return res.json({ ok: true, provider: r.providerName, model: r.model || modelsFor(r.providerName).fast, sample: str(result.summary, 120) });
  } catch (err) {
    return sendError(res, err, 'testProvider');
  }
};

exports.capabilities = async (_req, res) => {
  return res.json({
    intents: gateway.getOrchestrator().listIntents(),
    tools: DECLARATIONS.map((d) => ({ name: d.name, description: d.description })),
    noteActions: Object.keys(NOTE_ACTIONS),
    taskActions: Object.keys(TASK_ASSIST),
    providers: listProviders().filter((n) => n !== 'mock'),
  });
};

exports.usage = async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    const since = new Date(Date.now() - days * 86_400_000);
    const match = { workspaceId: require('mongoose').Types.ObjectId.createFromHexString(req.aiWorkspace.id), createdAt: { $gte: since } };
    if (!req.aiWorkspace.isAdmin) match.userId = require('mongoose').Types.ObjectId.createFromHexString(req.user.sub);
    const [byIntent, byDay, totals] = await Promise.all([
      AIUsage.aggregate([{ $match: match }, { $group: { _id: '$intent', calls: { $sum: 1 }, errors: { $sum: { $cond: ['$ok', 0, 1] } }, avgMs: { $avg: '$durationMs' } } }, { $sort: { calls: -1 } }]),
      AIUsage.aggregate([{ $match: match }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, calls: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      AIUsage.aggregate([{ $match: match }, { $group: { _id: null, calls: { $sum: 1 }, errors: { $sum: { $cond: ['$ok', 0, 1] } }, avgMs: { $avg: '$durationMs' }, users: { $addToSet: '$userId' } } }]),
    ]);
    const t = totals[0] || { calls: 0, errors: 0, avgMs: 0, users: [] };
    return res.json({
      days,
      totals: { calls: t.calls, errors: t.errors, avgMs: Math.round(t.avgMs || 0), users: (t.users || []).filter(Boolean).length },
      byIntent: byIntent.map((r) => ({ intent: r._id, calls: r.calls, errors: r.errors, avgMs: Math.round(r.avgMs || 0) })),
      byDay: byDay.map((r) => ({ day: r._id, calls: r.calls })),
      scope: req.aiWorkspace.isAdmin ? 'workspace' : 'me',
    });
  } catch (err) {
    return sendError(res, err, 'usage');
  }
};

/* ── Document helpers (kept from the previous API) ─────────────────────── */

exports.summarizeDocument = async (req, res) => {
  try {
    const { text, title, type, noCache } = req.body;
    if (!text) return res.status(400).json({ message: 'text is required' });
    return res.json(await aiSummarizer.summarizeDocument(text, { title, type, noCache, context: ctxFor(req) }));
  } catch (err) {
    return sendError(res, err, 'summarizeDocument');
  }
};

exports.semanticSearch = async (req, res) => {
  try {
    const { query, docs, topK, noCache } = req.body;
    if (!query) return res.status(400).json({ message: 'query is required' });
    if (!Array.isArray(docs) || docs.length === 0) return res.status(400).json({ message: 'docs must be a non-empty array' });
    return res.json(await aiSummarizer.semanticSearch(query, docs, { topK, noCache, context: ctxFor(req) }));
  } catch (err) {
    return sendError(res, err, 'semanticSearch');
  }
};

exports.cacheStats = async (_req, res) => res.json(aiSummarizer.cacheStats());
