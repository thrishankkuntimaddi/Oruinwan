// Live adapter, part two: planning, meetings, files, knowledge links, workspace admin and
// account security. Merged into liveAdapter (adapter.js), so screens call these through api()
// like everything else. Every server shape is mapped into the app's own models here.
//
// Server contracts (all existing routes):
//   tasks     /v2/tasks/:id/{subtasks,dependency,links,time/start,time/stop}, /v2/tasks/workload
//   planning  /sprints, /milestones, /task-templates
//   meetings  /scheduled-meetings, /v2/meetings/:id/{agenda,summarize,action-items}, /v2/meetings/suggest-time,
//             /v2/collaboration/brainstorm/:meetingId (+ socket meeting:join → brainstorm:update)
//   files     /v2/files/:id/{tags,versions,comments,share}
//   knowledge /v2/knowledge/pages/:id/{backlinks,link,summarize}, /v2/knowledge/{graph,categories}
//   admin     /workspace-templates, /workspace-os/:id/{clone,export,analytics}, /workspace-os/import,
//             /workspaces/:id/{permissions,features}, /channels/:id/{mute,posting-policy,mention-policy},
//             /departments, /teams, /companies/:id/{employees,org-chart}, /permissions/matrix,
//             /v2/audit/:companyId, /compliance-logs, /compliance/{legal-hold,retention-policy,export-user}
//   security  /auth/2fa/{setup,verify-setup,disable}, /v2/devices
import { ApiError, NETWORK_MESSAGE, absolute, accessToken, api, refreshSession, serverUrl } from './http.js';
import { socketRequest, socketEmit } from './realtime.js';
import { conversationKey, decryptPayload, encryptText } from './crypto.js';
import { clientPlatform } from '../../native/index.js';
import { fileIconKind } from '../../lib/files.js';

const idOf = (v) => (v && typeof v === 'object' ? String(v._id || v.id || '') : v ? String(v) : null);

function person(u) {
  if (!u || typeof u !== 'object') return u ? { id: String(u), name: 'Someone' } : null;
  const name = u.profile?.name && u.profile.name !== u.username ? u.profile.name : u.name || u.username || u.email || 'Someone';
  return { id: idOf(u), name, username: u.username || null, email: u.email || null, avatarUrl: absolute(u.profilePicture) };
}

/** A feature the server doesn't offer (old server, or switched off) reads as empty. */
const softly = (fallback) => (err) => {
  if (err?.status === 404 || err?.code === 'FEATURE_DISABLED') return fallback;
  throw err;
};

// ---------------------------------------------------------------- tasks

/** Seconds tracked so far, including a running session (`now` for tests). */
export function trackedSeconds(timeTracking, now = Date.now()) {
  const total = Number(timeTracking?.totalTime) || 0;
  const running = (timeTracking?.sessions || []).find((s) => s && s.start && !s.end);
  return total + (running ? Math.max(0, Math.floor((now - new Date(running.start).getTime()) / 1000)) : 0);
}

export function mapPlanningTask(t) {
  const tt = t.timeTracking || {};
  const running = (tt.sessions || []).find((s) => s && s.start && !s.end);
  return {
    id: idOf(t),
    title: t.title,
    status: t.status,
    priority: t.priority || 'medium',
    type: t.type || 'task',
    issueKey: t.issueKey || null,
    parentId: idOf(t.parentTask),
    due: t.dueDate || null,
    start: t.startDate || t.createdAt || null,
    createdAt: t.createdAt || null,
    completedAt: t.completedAt || null,
    assigneeIds: (t.assignedTo || []).map(idOf),
    createdBy: idOf(t.createdBy),
    sprintId: idOf(t.sprintId),
    milestoneId: idOf(t.milestoneId),
    tags: t.tags || [],
    estimatedHours: t.estimatedHours ?? null,
    actualHours: t.actualHours ?? null,
    subtasks: (t.subtasks || [])
      .filter((s) => s && typeof s === 'object')
      .map((s) => ({ id: idOf(s), title: s.title, status: s.status, assigneeIds: (s.assignedTo || []).map(idOf) })),
    dependencyIds: (t.dependencies || []).map(idOf).filter(Boolean),
    links: (t.linkedIssues || []).map((l) => ({
      id: idOf(l),
      taskId: idOf(l.task),
      title: l.task && typeof l.task === 'object' ? l.task.title : null,
      status: l.task && typeof l.task === 'object' ? l.task.status : null,
      type: l.linkType,
    })),
    time: { totalSeconds: Number(tt.totalTime) || 0, runningSince: running ? running.start : null, sessions: (tt.sessions || []).length },
    timeTracking: tt,
    recurring: t.recurring?.isRecurring
      ? { pattern: t.recurring.pattern || 'daily', interval: t.recurring.interval || 1, nextDue: t.recurring.nextDue || null }
      : null,
  };
}

function mapSprint(s) {
  return {
    id: idOf(s),
    name: s.name,
    goal: s.goal || '',
    start: s.startDate || null,
    end: s.endDate || null,
    status: s.status || 'planning',
    columns: (s.boardColumns || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((c) => c.name),
    counts: s.taskCounts || null,
  };
}

function mapMilestone(m) {
  return {
    id: idOf(m),
    name: m.name,
    description: m.description || '',
    due: m.dueDate || null,
    start: m.startDate || null,
    end: m.endDate || null,
    status: m.status || 'not_started',
    counts: m.taskCounts || null,
  };
}

function mapTemplate(t) {
  return {
    id: idOf(t),
    name: t.name,
    title: t.title || t.name,
    description: t.description || '',
    priority: t.priority || 'medium',
    tags: t.tags || [],
    subtaskTitles: t.subtaskTitles || [],
    estimatedHours: t.estimatedHours ?? null,
  };
}

// ---------------------------------------------------------------- meetings

/** suggest-time answers with one slot today; accept a list too (a later server may send several). */
export function normalizeSlots(data) {
  const raw = Array.isArray(data) ? data : Array.isArray(data?.slots) ? data.slots : Array.isArray(data?.suggestions) ? data.suggestions : data ? [data] : [];
  return raw
    .map((s) => {
      const start = s.suggestedStart || s.start || s.startTime;
      if (!start || Number.isNaN(new Date(start).getTime())) return null;
      const minutes = Number(s.durationMinutes || s.duration) || 30;
      const end = s.suggestedEnd || s.end || s.endTime || new Date(new Date(start).getTime() + minutes * 60000).toISOString();
      return { start: new Date(start).toISOString(), end: new Date(end).toISOString(), minutes, note: s.note || s.reason || null };
    })
    .filter(Boolean);
}

export function mapMeeting(m) {
  const start = m.startTime || null;
  const duration = Number(m.duration) || 30;
  return {
    id: idOf(m),
    workspaceId: idOf(m.workspaceId),
    title: m.title || 'Meeting',
    start,
    end: start ? new Date(new Date(start).getTime() + duration * 60000).toISOString() : null,
    duration,
    status: m.status || 'scheduled',
    link: m.meetingLink || null,
    organizer: person(m.createdBy),
    participants: (m.participants || []).map(person).filter(Boolean),
    agenda: (m.agenda || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((a) => ({ id: idOf(a), title: a.title, notes: a.notes || '' })),
    actionItems: (m.actionItems || []).map((a) => ({
      id: idOf(a),
      text: a.text,
      status: a.status || 'pending',
      assignee: person(a.assignedTo),
      taskId: idOf(a.taskId),
    })),
    summary: m.summary || '',
    transcript: m.transcript || '',
    notes: m.sharedNotes || '',
    channelId: idOf(m.channelId),
    raw: m,
  };
}

function mapSticky(i) {
  return { id: idOf(i), text: i.text, color: i.color || '#FBBF24', x: i.position?.x ?? 0, y: i.position?.y ?? 0, by: idOf(i.createdBy), at: i.createdAt };
}

// ---------------------------------------------------------------- files

function mapFile(f) {
  return {
    id: idOf(f),
    name: f.name || f.originalName || 'File',
    description: f.description || '',
    size: f.size,
    mimeType: f.mimeType || '',
    kind: fileIconKind(f),
    owner: idOf(f.createdBy),
    ownerName: f.createdBy && typeof f.createdBy === 'object' ? person(f.createdBy).name : null,
    at: f.createdAt,
    updatedAt: f.updatedAt,
    url: f.url || null,
    gcsPath: f.gcsPath || null,
    tags: f.tags || [],
    permissions: (f.permissions || []).map((p) => ({ userId: idOf(p.user), role: p.role })),
    version: f.currentVersion || 1,
  };
}

/** Multipart POST with the session's token (upload a new file version). */
async function postMultipart(path, form) {
  const send = async () => {
    let res;
    try {
      res = await fetch(`${serverUrl()}/api${path}`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'x-client-platform': clientPlatform, ...(accessToken() ? { Authorization: `Bearer ${accessToken()}` } : {}) },
        body: form,
      });
    } catch {
      throw new ApiError(NETWORK_MESSAGE, 0, null);
    }
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { res, data };
  };
  let { res, data } = await send();
  if (res.status === 401) {
    await refreshSession();
    ({ res, data } = await send());
  }
  if (!res.ok) {
    const msg = (data && typeof data === 'object' && (data.message || data.error)) || (res.status === 413 ? 'That file is too large (the limit is 100 MB).' : "The upload didn't go through. Try again.");
    throw new ApiError(msg, res.status, data);
  }
  return data;
}

// ---------------------------------------------------------------- admin

function mapAuditLog(l) {
  return {
    id: idOf(l),
    action: l.action || l.event || l.type || 'event',
    actor: person(l.userId || l.actorId || l.actor || l.user),
    target: l.resource || l.targetType || l.category || null,
    severity: l.severity || null,
    at: l.createdAt || l.timestamp,
    detail: l.details && typeof l.details === 'object' ? JSON.stringify(l.details).slice(0, 200) : l.description || l.details || null,
    valid: l._hashValid,
  };
}

export const workAdapter = {
  // ---- offline message queue (data/outbox.js)
  /**
   * Encrypts a message now, to send later: { path, body }. The body carries clientMessageId,
   * so a retry after a lost response is deduplicated by the server. Throws when this device
   * has no key for the conversation yet (the queue then encrypts it when it sends).
   */
  async prepareMessage(conv, text, { parentId, clientMessageId, mentionText, workspaceId } = {}) {
    const key = await conversationKey(conv, { workspaceId });
    const body = { ...(await encryptText(key, text)), clientMessageId, clientTempId: clientMessageId, ...(mentionText ? { mentionText } : {}) };
    if (parentId) return { path: `/v2/messages/thread/${parentId}`, body };
    if (conv.kind === 'channel') return { path: '/v2/messages/channel', body: { ...body, channelId: conv.id } };
    return { path: '/v2/messages/direct', body: { ...body, dmSessionId: conv.id } };
  },
  /** Sends a prepared message. Resolves with the server's message. */
  async sendPrepared(prepared) {
    const data = await api.post(prepared.path, prepared.body);
    return data?.message || data?.reply || data;
  },
  /** Marks a conversation read without opening it (a notification's "Mark as read"). */
  async markConversationRead(conv) {
    socketEmit('mark-chat-read', { type: conv.kind, id: conv.id });
    await api.post('/chat/reset-unread', { type: conv.kind, id: conv.id });
  },
  /** The text of a queued message (after a restart, the queue keeps only the ciphertext). */
  async readPrepared(conv, prepared) {
    const key = await conversationKey(conv);
    return decryptPayload(key, prepared.body);
  },

  // ---- tasks: detail extras
  async planningTask(id) {
    const data = await api.get(`/v2/tasks/${id}`);
    return mapPlanningTask(data.task || data);
  },
  /** Every task (subtasks included) with planning fields, for sprints, milestones, timeline. */
  async planningTasks(ws) {
    const data = await api.get('/v2/tasks', { workspaceId: ws, includeSubtasks: 'true' });
    return (data.tasks || []).map(mapPlanningTask);
  },
  /** Subtasks start as To do; assigned to the author so they can tick them off. */
  async addSubtask(parentId, { title, priority, assigneeIds }) {
    const data = await api.post(`/v2/tasks/${parentId}/subtasks`, { title, ...(priority ? { priority } : {}), ...(assigneeIds?.length ? { assignedTo: assigneeIds } : {}) });
    return mapPlanningTask(data.subtask);
  },
  async setTaskStatus(id, status, blockedReason) {
    const data = await api.put(`/v2/tasks/${id}`, { status, ...(blockedReason ? { blockedReason } : {}) });
    return mapPlanningTask(data.task || data);
  },
  async addDependency(id, dependencyTaskId) {
    const data = await api.post(`/v2/tasks/${id}/dependency`, { dependencyTaskId });
    return (data.dependencies || []).map(idOf);
  },
  /** linkType: blocks | is_blocked_by | relates_to | duplicates | is_duplicated_by. */
  async linkTask(id, linkedTaskId, linkType) {
    const data = await api.post(`/v2/tasks/${id}/links`, { linkedTaskId, linkType });
    return mapPlanningTask(data.task || data);
  },
  async unlinkTask(id, linkId) {
    await api.del(`/v2/tasks/${id}/links/${linkId}`);
  },
  async startTimer(id) {
    const data = await api.post(`/v2/tasks/${id}/time/start`);
    return data.timeTracking || null;
  },
  async stopTimer(id) {
    const data = await api.post(`/v2/tasks/${id}/time/stop`);
    return { timeTracking: data.timeTracking || null, elapsed: data.elapsed || 0 };
  },
  async setHours(id, { estimatedHours, actualHours }) {
    const body = {};
    if (estimatedHours !== undefined) body.estimatedHours = estimatedHours;
    if (actualHours !== undefined) body.actualHours = actualHours;
    await api.put(`/v2/tasks/${id}`, body);
  },
  /** Open tasks per person: [{ user, count }]. */
  async workload(ws) {
    const data = await api.get('/v2/tasks/workload', { workspaceId: ws }).catch(softly({ workload: [] }));
    return (data.workload || []).map((w) => ({ userId: idOf(w.userId), count: w.count || 0, user: w.user ? person(w.user) : null }));
  },

  // ---- planning
  async sprints(ws) {
    const data = await api.get('/sprints', { workspaceId: ws }).catch(softly({ sprints: [] }));
    return (data.sprints || []).map(mapSprint);
  },
  async createSprint(ws, { name, goal, start, end }) {
    const data = await api.post('/sprints', { workspaceId: ws, name, goal, startDate: start, endDate: end });
    return mapSprint(data.sprint);
  },
  async updateSprint(id, patch) {
    const body = {};
    if ('name' in patch) body.name = patch.name;
    if ('goal' in patch) body.goal = patch.goal;
    if ('status' in patch) body.status = patch.status;
    if ('start' in patch) body.startDate = patch.start;
    if ('end' in patch) body.endDate = patch.end;
    const data = await api.put(`/sprints/${id}`, body);
    return mapSprint(data.sprint);
  },
  async milestones(ws) {
    const data = await api.get('/milestones', { workspaceId: ws }).catch(softly({ milestones: [] }));
    return (data.milestones || []).map(mapMilestone);
  },
  async createMilestone(ws, { name, description, due }) {
    const data = await api.post('/milestones', { workspaceId: ws, name, description, dueDate: due || undefined });
    return mapMilestone(data.milestone);
  },
  async updateMilestone(id, patch) {
    const body = {};
    for (const [k, v] of Object.entries(patch)) body[k === 'due' ? 'dueDate' : k] = v;
    const data = await api.put(`/milestones/${id}`, body);
    return mapMilestone(data.milestone);
  },
  async taskTemplates(ws) {
    const data = await api.get('/task-templates', { workspaceId: ws }).catch(softly({ templates: [] }));
    return (data.templates || []).map(mapTemplate);
  },
  async createTaskTemplate(ws, { name, title, description, priority, subtaskTitles }) {
    const data = await api.post('/task-templates', { workspaceId: ws, name, title, description, priority, subtaskTitles });
    return mapTemplate(data.template);
  },
  async deleteTaskTemplate(id) {
    await api.del(`/task-templates/${id}`);
  },
  /**
   * A new task from a template: the task, then one subtask per template subtask (there is no
   * server endpoint for this; the web does the same steps). Resolves with the new task's id.
   */
  async createTaskFromTemplate(ws, template, { title, due, me } = {}) {
    const res = await api.post('/v2/tasks', {
      workspaceId: ws,
      title: title || template.title,
      description: template.description,
      priority: template.priority,
      tags: template.tags,
      dueDate: due || undefined,
      assignmentType: 'self',
    });
    const task = res.task || res.tasks?.[0];
    const id = idOf(task);
    for (const sub of template.subtaskTitles || []) {
      await api.post(`/v2/tasks/${id}/subtasks`, { title: sub, priority: template.priority, ...(me ? { assignedTo: [me] } : {}) }).catch(() => null);
    }
    return id;
  },

  // ---- meetings
  async meetingsList(ws, { includeCompleted = true } = {}) {
    const data = await api.get('/v2/meetings', { workspaceId: ws, limit: 50, includeCompleted: String(includeCompleted) });
    return (data.meetings || []).map(mapMeeting);
  },
  async meeting(id) {
    const data = await api.get(`/v2/meetings/${id}`);
    return mapMeeting(data.meeting || data);
  },
  async scheduleMeeting(ws, { title, start, duration, participantIds, link, channelId }) {
    const data = await api.post('/scheduled-meetings', {
      workspaceId: ws,
      title,
      startTime: start,
      duration,
      participants: participantIds || [],
      ...(link ? { meetingLink: link } : {}),
      ...(channelId ? { channelId } : {}),
    });
    return mapMeeting(data.meeting);
  },
  async cancelMeeting(id) {
    await api.patch(`/scheduled-meetings/${id}`, { status: 'cancelled' });
  },
  async saveAgenda(id, agenda) {
    const data = await api.patch(`/v2/meetings/${id}/agenda`, {
      agenda: agenda.map((a, i) => ({ ...(a.id && !String(a.id).startsWith('new') ? { _id: a.id } : {}), title: a.title, notes: a.notes || '', order: i })),
    });
    return mapMeeting(data.meeting);
  },
  async summarizeMeeting(id) {
    const data = await api.post(`/v2/meetings/${id}/summarize`, {});
    return data.summary || '';
  },
  async addActionItem(id, { text, assigneeId }) {
    const data = await api.post(`/v2/meetings/${id}/action-items`, { text, assignedTo: assigneeId || null });
    return mapMeeting(data.meeting);
  },
  async updateActionItem(id, itemId, patch) {
    const body = {};
    if ('text' in patch) body.text = patch.text;
    if ('status' in patch) body.status = patch.status;
    if ('assigneeId' in patch) body.assignedTo = patch.assigneeId;
    if ('taskId' in patch) body.taskId = patch.taskId;
    const data = await api.patch(`/v2/meetings/${id}/action-items/${itemId}`, body);
    return mapMeeting(data.meeting);
  },
  /** Turns an action item into a task (assigned to its owner, or to me) and links them. */
  async actionItemToTask(ws, meeting, item, me) {
    const assignee = item.assignee?.id;
    const onlyMe = !assignee || assignee === me;
    const res = await api.post('/v2/tasks', {
      workspaceId: ws,
      title: item.text,
      description: `From the meeting “${meeting.title}”.`,
      assignmentType: onlyMe ? 'self' : 'members',
      ...(onlyMe ? {} : { assignedToIds: [assignee], assignmentMode: 'shared' }),
    });
    const taskId = idOf(res.task || res.tasks?.[0]);
    const updated = await this.updateActionItem(meeting.id, item.id, { taskId });
    return { taskId, meeting: updated };
  },
  /** Free slots for these people: [{ start, end, minutes, note }]. */
  async suggestTimes({ participantIds = [], minutes = 30 } = {}) {
    const data = await api.post('/v2/meetings/suggest-time', { participantIds, durationMinutes: minutes });
    return normalizeSlots(data);
  },
  async brainstorm(meetingId) {
    const data = await api.get(`/v2/collaboration/brainstorm/${meetingId}`);
    return (data.items || []).map(mapSticky);
  },
  async addSticky(meetingId, { text, color, x, y }) {
    const data = await api.post(`/v2/collaboration/brainstorm/${meetingId}`, { text, ...(color ? { color } : {}), position: { x: x ?? 0, y: y ?? 0 } });
    return mapSticky(data.item);
  },
  async deleteSticky(meetingId, itemId) {
    await api.del(`/v2/collaboration/brainstorm/${meetingId}/${itemId}`);
  },
  /** Live updates for one meeting (brainstorm:update, meeting:agenda_updated). Resolves true when joined. */
  async joinMeetingRoom(meetingId) {
    const ack = await socketRequest('meeting:join', { meetingId });
    return Boolean(ack?.ok);
  },
  leaveMeetingRoom(meetingId) {
    socketEmit('meeting:leave', { meetingId });
  },
  mapSticky,

  // ---- files
  async fileDetail(id) {
    const data = await api.get(`/v2/files/${id}`);
    return mapFile(data.file || data);
  },
  async setFileTags(id, tags) {
    const data = await api.patch(`/v2/files/${id}/tags`, { tags });
    return mapFile(data.file);
  },
  async fileVersions(id) {
    const data = await api.get(`/v2/files/${id}/versions`);
    return {
      current: data.currentVersion || 1,
      versions: (data.versions || []).map((v) => ({
        id: idOf(v),
        number: v.versionNumber,
        size: v.size,
        mimeType: v.mimeType,
        url: v.url,
        gcsPath: v.gcsPath,
        by: person(v.createdBy),
        note: v.changeNote || '',
        at: v.createdAt,
      })),
    };
  },
  async uploadFileVersion(id, file, changeNote) {
    const form = new FormData();
    form.append('file', file, file.name || 'file');
    if (changeNote) form.append('changeNote', changeNote);
    const data = await postMultipart(`/v2/files/${id}/versions`, form);
    return mapFile(data.file);
  },
  async restoreFileVersion(id, versionId) {
    const data = await api.post(`/v2/files/${id}/versions/${versionId}/restore`);
    return mapFile(data.file);
  },
  async fileComments(id) {
    const data = await api.get(`/v2/files/${id}/comments`);
    return (data.comments || []).map((c) => ({ id: idOf(c), text: c.content, author: person(c.author), at: c.createdAt, parentId: idOf(c.parentId) }));
  },
  async addFileComment(id, text) {
    const data = await api.post(`/v2/files/${id}/comments`, { content: text });
    const c = data.comment;
    return { id: idOf(c), text: c.content, author: person(c.author), at: c.createdAt, parentId: null };
  },
  /** permissions: [{ userId, role: 'view' | 'edit' | 'download' }] (adds or changes; the owner only). */
  async shareFile(id, permissions) {
    const data = await api.post(`/v2/files/${id}/share`, { permissions: permissions.map((p) => ({ user: p.userId, role: p.role })) });
    return mapFile(data.file);
  },

  // ---- knowledge
  async pageMeta(id) {
    const data = await api.get(`/v2/knowledge/pages/${id}`);
    const p = data.page || data;
    return { id: idOf(p), categoryId: idOf(p.categoryId), tags: p.tags || [], summary: p.summary || '' };
  },
  async backlinks(id) {
    const data = await api.get(`/v2/knowledge/pages/${id}/backlinks`).catch(softly({ backlinks: [] }));
    return (data.backlinks || []).map((p) => ({ id: idOf(p), title: p.title || 'Untitled page', icon: p.icon || '📄' }));
  },
  /** Pages this page links to (from the workspace's link graph). */
  async outgoingLinks(ws, id) {
    const data = await api.get('/v2/knowledge/graph', { workspaceId: ws }).catch(softly({ nodes: [], edges: [] }));
    const nodes = new Map((data.nodes || []).map((n) => [String(n.id), n]));
    return (data.edges || [])
      .filter((e) => String(e.from) === String(id))
      .map((e) => nodes.get(String(e.to)))
      .filter(Boolean)
      .map((n) => ({ id: String(n.id), title: n.label || 'Untitled page', icon: n.icon || '📄' }));
  },
  async linkPage(ws, fromId, toId) {
    await api.post(`/v2/knowledge/pages/${fromId}/link`, { toPageId: toId, workspaceId: ws });
  },
  async unlinkPage(fromId, toId) {
    await api.del(`/v2/knowledge/pages/${fromId}/link/${toId}`);
  },
  async knowledgeCategories(ws) {
    const data = await api.get('/v2/knowledge/categories', { workspaceId: ws }).catch(softly({ categories: [] }));
    return (data.categories || []).map((c) => ({ id: idOf(c), name: c.name, color: c.color || null, icon: c.icon || null }));
  },
  async createKnowledgeCategory(ws, { name, color }) {
    const data = await api.post('/v2/knowledge/categories', { workspaceId: ws, name, ...(color ? { color } : {}) });
    const c = data.category;
    return { id: idOf(c), name: c.name, color: c.color || null, icon: c.icon || null };
  },
  async setPageCategory(id, categoryId) {
    await api.put(`/v2/knowledge/pages/${id}`, { categoryId: categoryId || null });
  },
  async summarizePage(id) {
    const data = await api.post(`/v2/knowledge/pages/${id}/summarize`, {});
    return { summary: data.summary || '', fallback: Boolean(data.fallback) };
  },

  // ---- workspace admin
  /** The signed-in user's company (departments, teams, org chart and audit logs are company-wide). */
  async companyContext() {
    const u = await api.get('/auth/me');
    const company = u.companyId || u.company;
    return { companyId: idOf(company), companyRole: u.companyRole || null, userId: idOf(u) };
  },
  async workspaceTemplates() {
    const data = await api.get('/workspace-templates').catch(softly({ templates: [] }));
    return (data.templates || []).map((t) => ({
      id: idOf(t),
      name: t.name,
      description: t.description || '',
      icon: t.icon || null,
      category: t.category || null,
      channels: (t.channels || t.defaultChannels || []).map((c) => (typeof c === 'string' ? c : c.name)).filter(Boolean),
    }));
  },
  async createWorkspaceFromTemplate({ name, templateId, icon, color }) {
    const data = await api.post('/workspaces/create', { name, templateId, ...(icon ? { icon } : {}), ...(color ? { color } : {}) });
    return { id: idOf(data.workspace), name: data.workspace?.name, templateError: data.templateError || null };
  },
  async cloneWorkspace(ws, { name, includeMembers }) {
    const data = await api.post(`/workspace-os/${ws}/clone`, { name, includeMembers: Boolean(includeMembers) });
    return { id: idOf(data.workspace), name: data.workspace?.name };
  },
  /** The workspace's structure (settings, channels, toggles; no messages) as a JSON bundle. */
  async exportWorkspace(ws) {
    const data = await api.get(`/workspace-os/${ws}/export`);
    return data.bundle;
  },
  async importWorkspace(bundle) {
    const data = await api.post('/workspace-os/import', { bundle });
    return { id: idOf(data.workspace), name: data.workspace?.name };
  },
  /** Counts only: members, channels, tasks, files, docs, and tasks created/completed per day. */
  async workspaceAnalytics(ws, range = 30) {
    const data = await api.get(`/workspace-os/${ws}/analytics`, { range });
    const a = data.analytics || {};
    return { summary: a.summary || {}, daily: a.charts?.dailyTasks || [], range: a.range || range, computedAt: a.computedAt || null };
  },
  async workspacePermissions(ws) {
    const data = await api.get(`/workspaces/${ws}/permissions`);
    const p = data.permissions || {};
    return { invite: p.invitePermission || 'admin', channelCreation: p.channelCreationPermission || 'member', features: p.featureToggles || {} };
  },
  async saveWorkspacePermissions(ws, { invite, channelCreation }) {
    await api.put(`/workspaces/${ws}/permissions`, {
      ...(invite ? { invitePermission: invite } : {}),
      ...(channelCreation ? { channelCreationPermission: channelCreation } : {}),
    });
  },
  async workspaceFeatures(ws) {
    const data = await api.get(`/workspaces/${ws}/features`);
    return data.featureToggles || {};
  },
  async saveWorkspaceFeatures(ws, featureToggles) {
    const data = await api.put(`/workspaces/${ws}/features`, { featureToggles });
    return data.featureToggles || featureToggles;
  },
  async channelPolicy(id) {
    const data = await api.get(`/channels/${id}/mute`);
    return { posting: data.postingPolicy || 'everyone', mentions: data.broadcastMentions || 'everyone', canManage: Boolean(data.canManage) };
  },
  async setChannelPosting(id, postingPolicy) {
    await api.patch(`/channels/${id}/posting-policy`, { postingPolicy });
  },
  async setChannelMentions(id, broadcastMentions) {
    await api.patch(`/channels/${id}/mention-policy`, { broadcastMentions });
  },
  /** Raw workspace members with roles (the directory). */
  async memberDirectory(ws) {
    const data = await api.get(`/workspaces/${ws}/members`);
    return (data.members || []).map((m) => ({ ...person(m), role: m.role || 'member', title: m.jobTitle || m.profile?.title || null, phone: m.phone || null, joinedAt: m.joinedAt || null, online: Boolean(m.isOnline) }));
  },
  async employees(companyId, { search = '', page = 1 } = {}) {
    const data = await api.get(`/companies/${companyId}/employees`, { search, page, limit: 50 });
    return {
      people: (data.employees || []).map((e) => ({ ...person(e), role: e.companyRole || null, departments: e.departmentNames || [], online: Boolean(e.isOnline) })),
      pages: data.pagination?.pages || 1,
      total: data.pagination?.total || 0,
    };
  },
  async departments() {
    const data = await api.get('/departments');
    return (data.departments || []).map((d) => ({ id: idOf(d), name: d.name, description: d.description || '', memberCount: d.memberCount ?? (d.members || []).length, head: person(d.head) }));
  },
  async createDepartment({ name, description }) {
    const data = await api.post('/departments', { name, description });
    return data.department;
  },
  async teams() {
    const data = await api.get('/teams');
    return (data.teams || []).map((t) => ({ id: idOf(t), name: t.name, description: t.description || '', memberCount: t.memberCount ?? (t.members || []).length, lead: person(t.lead || t.leadId) }));
  },
  async createTeam({ name, description }) {
    const data = await api.post('/teams', { name, description });
    return data.team;
  },
  /** { roots: [{ id, name, role, reports: [...] }], departments: [...] } */
  async orgChart(companyId) {
    const data = await api.get(`/companies/${companyId}/org-chart`);
    const node = (n) => ({ id: idOf(n), name: person(n).name, avatarUrl: absolute(n.profilePicture), role: n.companyRole || null, reports: (n.reports || []).map(node) });
    return {
      company: data.company?.name || null,
      total: data.totalEmployees || 0,
      roots: (data.reportingLines || []).map(node),
      departments: (data.departments || []).map((d) => ({ id: idOf(d), name: d.name, memberCount: d.memberCount || 0, teams: (d.teams || []).map((t) => ({ id: idOf(t), name: t.name, memberCount: t.memberCount || 0 })) })),
    };
  },
  async permissionMatrix() {
    const data = await api.get('/permissions/matrix');
    return data.matrix || {};
  },
  /** Saves one role's whole row (the server stores rows whole). */
  async savePermissionRow(role, row) {
    await api.put('/permissions/matrix', { updates: { [role]: row } });
  },
  async auditLogs(companyId, { page = 1 } = {}) {
    const data = await api.get(`/v2/audit/${companyId}`, { page, limit: 50 });
    return { logs: (data.logs || []).map(mapAuditLog), pages: data.pagination?.pages || 1 };
  },
  async complianceLogs({ page = 1 } = {}) {
    const data = await api.get('/compliance-logs', { page, limit: 50, verify: 'true' });
    return { logs: (data.logs || []).map(mapAuditLog), pages: data.pagination?.pages || 1 };
  },
  async legalHold(userId) {
    const d = await api.get(`/compliance/legal-hold/${userId}`);
    return { on: Boolean(d.legalHold), reason: d.reason || '', setBy: d.setBy?.username || null, at: d.setAt || null };
  },
  async setLegalHold(userId, on, reason) {
    await api.patch(`/compliance/legal-hold/${userId}`, { legalHold: on, ...(reason ? { reason } : {}) });
  },
  /** Personal message retention (days, or null to keep everything). */
  async retentionPolicy() {
    const d = await api.get('/compliance/retention-policy');
    return { days: d.retentionDays ?? null, legalHold: Boolean(d.legalHold) };
  },
  async setRetentionPolicy(days) {
    await api.patch('/compliance/retention-policy', { retentionDays: days });
  },

  // ---- account security
  /** Starts two-factor setup: { secret, otpauthUrl, qrDataUrl }. */
  async twoFactorSetup() {
    const d = await api.post('/auth/2fa/setup', {});
    return { secret: d.secret, otpauthUrl: d.otpauthUrl, qrDataUrl: d.qrDataUrl || null };
  },
  async twoFactorEnable(otp) {
    await api.post('/auth/2fa/verify-setup', { otp });
  },
  async twoFactorDisable(otp) {
    await api.post('/auth/2fa/disable', { otp });
  },
  /** Everything the server holds about you, as JSON (profile, tasks, notes, settings; no message text). */
  async exportMyData() {
    return api.get('/compliance/export-user');
  },
  async devices() {
    const d = await api.get('/v2/devices').catch(softly({ devices: [] }));
    return (d.devices || []).map((x) => ({ id: x.deviceId, name: x.deviceName || 'Device', platform: x.platform || '', at: x.lastActiveAt || x.createdAt, current: Boolean(x.isCurrent), trust: x.trustLevel || null }));
  },
  async revokeDevice(deviceId) {
    await api.post('/v2/devices/revoke', { deviceId });
  },
};
