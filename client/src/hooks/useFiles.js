import { useState, useCallback } from 'react';
import api from '@services/api';

const API = '/api/v2/files';

/** A tag as the server stores it: lower case, trimmed, no leading #. */
export function normalizeTag(raw) {
    return String(raw || '').trim().replace(/^#+/, '').trim().toLowerCase().slice(0, 40);
}

/**
 * Merge a file the server returned into the one we hold. Mutation endpoints answer with
 * the raw document (createdBy is an id there), so keep the hydrated creator we already have.
 */
export function mergeFile(prev, next) {
    if (!prev) return next;
    if (!next) return prev;
    const merged = { ...prev, ...next };
    if (prev.createdBy && typeof prev.createdBy === 'object' && (!next.createdBy || typeof next.createdBy !== 'object')) {
        merged.createdBy = prev.createdBy;
    }
    return merged;
}

export function useFiles() {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const listFiles = useCallback(async (workspaceId, filters = {}) => {
        setLoading(true);
        try {
            const params = { workspaceId, ...filters };
            const { data } = await api.get(API, { params });
            setFiles(data.files || []);
            return data.files || [];
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load files');
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const uploadFile = useCallback(async (workspaceId, file, opts = {}) => {
        const form = new FormData();
        form.append('file', file);
        form.append('workspaceId', workspaceId);
        if (opts.description) form.append('description', opts.description);
        if (opts.folderId) form.append('folderId', opts.folderId);
        if (opts.tags) form.append('tags', JSON.stringify(opts.tags));
        const { data } = await api.post(API, form, { headers: { 'Content-Type': 'multipart/form-data' } });
        setFiles(prev => [data.file, ...prev]);
        return data.file;
    }, []);

    const getFile = useCallback(async (fileId) => {
        const { data } = await api.get(`${API}/${fileId}`);
        return data.file;
    }, []);

    const updateFile = useCallback(async (fileId, updates) => {
        const { data } = await api.patch(`${API}/${fileId}`, updates);
        setFiles(prev => prev.map(f => f._id === fileId ? mergeFile(f, data.file) : f));
        return data.file;
    }, []);

    /** Replace one file in the list with a newer copy (after a version upload, restore or share). */
    const patchFile = useCallback((file) => {
        if (!file?._id) return;
        setFiles(prev => prev.map(f => f._id === file._id ? mergeFile(f, file) : f));
    }, []);

    const deleteFile = useCallback(async (fileId) => {
        await api.delete(`${API}/${fileId}`);
        setFiles(prev => prev.filter(f => f._id !== fileId));
    }, []);

    const getVersions = useCallback(async (fileId) => {
        const { data } = await api.get(`${API}/${fileId}/versions`);
        return data;
    }, []);

    const uploadVersion = useCallback(async (fileId, file, changeNote) => {
        const form = new FormData();
        form.append('file', file);
        if (changeNote) form.append('changeNote', changeNote);
        const { data } = await api.post(`${API}/${fileId}/versions`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
        if (data?.file) setFiles(prev => prev.map(f => f._id === fileId ? mergeFile(f, data.file) : f));
        return data;
    }, []);

    const restoreVersion = useCallback(async (fileId, versionId) => {
        const { data } = await api.post(`${API}/${fileId}/versions/${versionId}/restore`);
        if (data?.file) setFiles(prev => prev.map(f => f._id === fileId ? mergeFile(f, data.file) : f));
        return data;
    }, []);

    const getComments = useCallback(async (fileId) => {
        const { data } = await api.get(`${API}/${fileId}/comments`);
        return data.comments || [];
    }, []);

    const addComment = useCallback(async (fileId, content, parentId) => {
        const { data } = await api.post(`${API}/${fileId}/comments`, { content, parentId });
        return data.comment;
    }, []);

    const shareFile = useCallback(async (fileId, permissions) => {
        const { data } = await api.post(`${API}/${fileId}/share`, { permissions });
        if (data?.file) setFiles(prev => prev.map(f => f._id === fileId ? mergeFile(f, data.file) : f));
        return data;
    }, []);

    const updateTags = useCallback(async (fileId, tags) => {
        const { data } = await api.patch(`${API}/${fileId}/tags`, { tags });
        setFiles(prev => prev.map(f => f._id === fileId ? { ...f, tags: data.file.tags } : f));
        return data.file;
    }, []);

    return { files, loading, error, listFiles, uploadFile, getFile, updateFile, deleteFile, getVersions, uploadVersion, restoreVersion, getComments, addComment, shareFile, updateTags, patchFile };
}
