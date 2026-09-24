import http from '../http';

export const NOTE_TYPES = ['note', 'meeting', 'documentation', 'brainstorm', 'sop', 'projectspec', 'techdesign', 'announcement'];

export const fetchNotes = (workspaceId, type) =>
  http.get('/v2/notes', { params: { workspaceId, ...(type ? { type } : {}) } });
export const createNote = (payload) => http.post('/v2/notes', payload);
export const updateNote = (id, payload) => http.put(`/v2/notes/${id}`, payload);
export const archiveNote = (id) => http.delete(`/v2/notes/${id}`);
