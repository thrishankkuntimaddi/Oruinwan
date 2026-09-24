import http from '../http';

export const fetchFiles = (workspaceId, { folderId, search } = {}) =>
  http.get('/v2/files', {
    params: { workspaceId, folderId: folderId || 'root', ...(search ? { search } : {}) },
  });
