import api from './api';

/** Roadmap items (/api/v2/roadmap) and the milestones / tasks they link to. See docs/api/roadmap.md. */
const roadmapService = {
    list: (workspaceId, filters = {}) =>
        api.get('/api/v2/roadmap', { params: { workspaceId, ...filters } }).then((r) => r.data),
    get: (id) => api.get(`/api/v2/roadmap/${id}`).then((r) => r.data.item),
    create: (workspaceId, body) => api.post('/api/v2/roadmap', { ...body, workspaceId }).then((r) => r.data.item),
    update: (id, body) => api.patch(`/api/v2/roadmap/${id}`, body).then((r) => r.data.item),
    remove: (id) => api.delete(`/api/v2/roadmap/${id}`).then((r) => r.data),
    reorder: (workspaceId, order) => api.post('/api/v2/roadmap/reorder', { workspaceId, order }).then((r) => r.data),
    milestones: (workspaceId) =>
        api.get('/api/milestones', { params: { workspaceId } }).then((r) => r.data.milestones || []),
    tasks: (workspaceId) =>
        api.get('/api/v2/tasks', { params: { workspaceId } }).then((r) => r.data.tasks || []),
    members: (workspaceId) =>
        api.get(`/api/workspaces/${workspaceId}/members`).then((r) => r.data.members || []),
};

export default roadmapService;
