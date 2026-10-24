import api from '../../services/api';

const ROOT = '/api/v2/meetings';
const base = (id) => `${ROOT}/${encodeURIComponent(id)}`;
const item = (id, aid) => `${base(id)}/action-items/${encodeURIComponent(aid)}`;

/** REST side of the one meeting record (docs/api/meetings-unified.md). */
export const meetingApi = {
    get: (id) => api.get(base(id)).then((r) => r.data.meeting),
    byHuddle: (huddleId) => api.get(`${ROOT}/by-huddle/${encodeURIComponent(huddleId)}`).then((r) => r.data.meeting),
    /** { meetings, hasMore, nextBefore | nextAfter } */
    list: ({ workspaceId, status, q, kind, before, after, limit } = {}) => api.get(ROOT, {
        params: {
            workspaceId,
            status,
            ...(q ? { q } : {}),
            ...(kind ? { kind } : {}),
            ...(before ? { before } : {}),
            ...(after ? { after } : {}),
            ...(limit ? { limit } : {}),
        },
    }).then((r) => r.data),

    join: (id) => api.post(`${base(id)}/join`, {}).then((r) => r.data.meeting),
    /** Move / rename / re-prioritise a scheduled meeting: { meeting, conflicts } (clashes re-checked on save). */
    update: (id, patch) => api.patch(`/api/scheduled-meetings/${encodeURIComponent(id)}`, patch).then((r) => r.data),
    end: (id) => api.patch(`${base(id)}/end`, {}).then((r) => r.data.meeting),
    saveAgenda: (id, agenda) => api.patch(`${base(id)}/agenda`, { agenda }).then((r) => r.data.meeting),

    /** { noteId, created } */
    ensureNote: (id) => api.post(`${base(id)}/notes`, {}).then((r) => r.data),

    addActionItem: (id, body) => api.post(`${base(id)}/action-items`, body).then((r) => r.data),
    updateActionItem: (id, aid, patch) => api.patch(item(id, aid), patch).then((r) => r.data),
    toggleActionItem: (id, aid) => api.post(`${item(id, aid)}/toggle`, {}).then((r) => r.data),
    convertActionItem: (id, aid, body = {}) => api.post(`${item(id, aid)}/convert`, body).then((r) => r.data),
    deleteActionItem: (id, aid) => api.delete(item(id, aid)).then((r) => r.data),
    extractActionItems: (id, apply = true) => api.post(`${base(id)}/action-items/extract`, { apply }).then((r) => r.data),

    /** { summary (text), meetingSummary, source, aiFallback } */
    summarize: (id) => api.post(`${base(id)}/summarize`, {}).then((r) => r.data),
    saveSummary: (id, text) => api.put(`${base(id)}/summary`, { text }).then((r) => r.data),
};

export default meetingApi;
