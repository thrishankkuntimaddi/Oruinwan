import api from './api';

/** Design reviews of library files (/api/v2/design-reviews). See docs/api/design-review.md. */
const base = '/api/v2/design-reviews';

const designReviewService = {
    list: (params) => api.get(base, { params }).then((r) => r.data.reviews || []),
    create: (body) => api.post(base, body).then((r) => r.data.review),
    get: (id) => api.get(`${base}/${id}`).then((r) => r.data),
    update: (id, body) => api.patch(`${base}/${id}`, body).then((r) => r.data.review),
    remove: (id) => api.delete(`${base}/${id}`).then((r) => r.data),
    decide: (id, decision, note) => api.post(`${base}/${id}/decision`, { decision, note }).then((r) => r.data.review),
    newRound: (id, versionNumber) => api.post(`${base}/${id}/rounds`, versionNumber ? { versionNumber } : {}).then((r) => r.data.review),
    compare: (params) => api.get(`${base}/compare`, { params }).then((r) => r.data),
    annotate: (id, body) => api.post(`${base}/${id}/annotations`, body).then((r) => r.data.annotation),
    deleteAnnotation: (id, annotationId) => api.delete(`${base}/${id}/annotations/${annotationId}`).then((r) => r.data),
    resolve: (id, annotationId, resolved = true) =>
        api.post(`${base}/${id}/annotations/${annotationId}/resolve`, { resolved }).then((r) => r.data.annotation),
    reply: (id, annotationId, body) =>
        api.post(`${base}/${id}/annotations/${annotationId}/replies`, { body }).then((r) => r.data),
    files: (workspaceId) =>
        api.get('/api/v2/files', { params: { workspaceId } }).then((r) => r.data.files || []),
    members: (workspaceId) =>
        api.get(`/api/workspaces/${workspaceId}/members`).then((r) => r.data.members || []),
};

export default designReviewService;
