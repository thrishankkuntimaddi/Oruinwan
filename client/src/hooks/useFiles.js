// client/src/hooks/useFiles.js
import { useState, useCallback } from 'react';
import api from '@services/api';

const API = '/api/v2/files';

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
        setFiles(prev => prev.map(f => f._id === fileId ? { ...f, ...data.file } : f));
        return data.file;
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
        return data;
    }, []);

    const restoreVersion = useCallback(async (fileId, versionId) => {
        const { data } = await api.post(`${API}/${fileId}/versions/${versionId}/restore`);
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
        return data;
    }, []);

    const updateTags = useCallback(async (fileId, tags) => {
        const { data } = await api.patch(`${API}/${fileId}/tags`, { tags });
        setFiles(prev => prev.map(f => f._id === fileId ? { ...f, tags: data.file.tags } : f));
        return data.file;
    }, []);

    return { files, loading, error, listFiles, uploadFile, getFile, updateFile, deleteFile, getVersions, uploadVersion, restoreVersion, getComments, addComment, shareFile, updateTags };
}
