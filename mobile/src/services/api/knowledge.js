import http from '../http';

export const fetchKnowledgePages = (workspaceId, parentId) =>
  http.get('/v2/knowledge/pages', { params: { workspaceId, parentId: parentId || 'root' } });
export const fetchKnowledgePage = (id) => http.get(`/v2/knowledge/pages/${id}`);
