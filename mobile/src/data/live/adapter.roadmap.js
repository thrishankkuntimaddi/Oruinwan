// Live adapter part: roadmap items, /api/v2/roadmap (docs/api/roadmap.md).
// Merged into liveAdapter (adapter.js), so screens call these through api().
// Socket: `roadmap:updated` to workspace:<id> after every change (screens refetch).
import { absolute, api } from './http.js';

const idOf = (v) => (v && typeof v === 'object' ? String(v._id || v.id || '') : v ? String(v) : null);
const dateOnly = (v) => (v ? String(v).slice(0, 10) : null);

function person(u) {
  if (!u) return null;
  if (typeof u !== 'object') return { id: String(u), name: null, avatarUrl: null };
  return { id: idOf(u), name: u.profile?.name || u.name || u.username || null, avatarUrl: absolute(u.profilePicture) || null };
}

export const ROADMAP_STATUSES = ['planned', 'in_progress', 'at_risk', 'done'];
export const ROADMAP_COLORS = ['accent', 'color-primary', 'color-success', 'color-warning', 'color-danger', 'text-muted'];

function mapProgress(p) {
  if (!p || typeof p !== 'object') return { percent: 0, tasks: null, milestones: null };
  return {
    percent: Math.max(0, Math.min(100, Math.round(Number(p.percent) || 0))),
    tasks: p.tasks ? { total: p.tasks.total || 0, done: p.tasks.done || 0, open: p.tasks.open || 0, remainingHours: p.tasks.remainingHours ?? null, estimatedHours: p.tasks.estimatedHours ?? null } : null,
    milestones: p.milestones
      ? {
          total: p.milestones.total || 0,
          completed: p.milestones.completed || 0,
          items: (p.milestones.items || []).map((m) => ({ id: idOf(m), name: m.name || 'Milestone', status: m.status || 'not_started', due: m.dueDate || null, percent: Math.round(Number(m.percent) || 0), done: m.done || 0, total: m.total || 0 })),
        }
      : null,
  };
}

export function mapRoadmapItem(r) {
  if (!r) return null;
  const owner = person(r.ownerId);
  const creator = person(r.createdBy);
  return {
    id: idOf(r),
    workspaceId: idOf(r.workspaceId),
    title: r.title || 'Untitled',
    description: r.description || '',
    status: ROADMAP_STATUSES.includes(r.status) ? r.status : 'planned',
    start: dateOnly(r.startDate),
    end: dateOnly(r.endDate),
    ownerId: owner?.id || null,
    owner,
    createdById: creator?.id || null,
    milestoneIds: (r.milestoneIds || []).map(idOf).filter(Boolean),
    taskIds: (r.taskIds || []).map(idOf).filter(Boolean),
    projectId: idOf(r.projectId),
    channelId: idOf(r.channelId),
    quarter: r.quarter || null,
    order: Number(r.order) || 0,
    color: ROADMAP_COLORS.includes(r.color) ? r.color : 'accent',
    progress: mapProgress(r.progress),
    canEdit: Boolean(r.canEdit),
    updatedAt: r.updatedAt || null,
  };
}

/** App fields → request body (only what was given; empty dates become null). */
export function roadmapBody(fields) {
  const body = {};
  const copy = { title: 'title', description: 'description', status: 'status', ownerId: 'ownerId', milestoneIds: 'milestoneIds', taskIds: 'taskIds', quarter: 'quarter', color: 'color', order: 'order', channelId: 'channelId' };
  for (const [k, to] of Object.entries(copy)) if (fields[k] !== undefined) body[to] = fields[k];
  if (fields.start !== undefined) body.startDate = fields.start || null;
  if (fields.end !== undefined) body.endDate = fields.end || null;
  if (body.quarter === '') body.quarter = null;
  if (typeof body.title === 'string') body.title = body.title.trim();
  return body;
}

export const roadmapAdapter = {
  /** { items, canCreate } for the workspace, in lane order. */
  async roadmap(ws, { quarter, status } = {}) {
    const data = await api.get('/v2/roadmap', { workspaceId: ws, ...(quarter ? { quarter } : {}), ...(status ? { status } : {}) });
    return { items: (data.items || []).map(mapRoadmapItem), canCreate: Boolean(data.canCreate) };
  },
  async roadmapItem(id) {
    const data = await api.get(`/v2/roadmap/${id}`);
    return mapRoadmapItem(data.item);
  },
  async createRoadmapItem(ws, fields) {
    const data = await api.post('/v2/roadmap', { workspaceId: ws, ...roadmapBody(fields) });
    return mapRoadmapItem(data.item);
  },
  async updateRoadmapItem(id, patch) {
    const data = await api.patch(`/v2/roadmap/${id}`, roadmapBody(patch));
    return mapRoadmapItem(data.item);
  },
  async deleteRoadmapItem(id) {
    await api.del(`/v2/roadmap/${id}`);
  },
  async reorderRoadmap(ws, order) {
    await api.post('/v2/roadmap/reorder', { workspaceId: ws, order });
  },
};
