// client/src/hooks/useFiles.js
import { useState, useCallback } from 'react';
import axios from 'axios';

const API = '/api/v2/files';

export function useFiles() {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const listFiles = useCallback(async (workspaceId, filters = {}) => {
        setLoading(true);
        try {
            const params = { workspaceId, ...filters };
            const { data } = await axios.get(API, { params, withCredentials: true });
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
        const { data } = await axios.post(API, form, { withCredentials: true, headers: { 'Content-Type': 'multipart/form-data' } });
        setFiles(prev => [data.file, ...prev]);
        return data.file;
    }, []);

    const getFile = useCallback(async (fileId) => {
        const { data } = await axios.get(`${API}/${fileId}`, { withCredentials: true });
        return data.file;
    }, []);

    const updateFile = useCallback(async (fileId, updates) => {
        const { data } = await axios.patch(`${API}/${fileId}`, updates, { withCredentials: true });
        setFiles(prev => prev.map(f => f._id === fileId ? { ...f, ...data.file } : f));
        return data.file;
    }, []);

    const deleteFile = useCallback(async (fileId) => {
        await axios.delete(`${API}/${fileId}`, { withCredentials: true });
        setFiles(prev => prev.filter(f => f._id !== fileId));
    }, []);

    const getVersions = useCallback(async (fileId) => {
        const { data } = await axios.get(`${API}/${fileId}/versions`, { withCredentials: true });
        return data;
    }, []);

    const uploadVersion = useCallback(async (fileId, file, changeNote) => {
        const form = new FormData();
        form.append('file', file);
        if (changeNote) form.append('changeNote', changeNote);
        const { data } = await axios.post(`${API}/${fileId}/versions`, form, { withCredentials: true, headers: { 'Content-Type': 'multipart/form-data' } });
        return data;
    }, []);

    const restoreVersion = useCallback(async (fileId, versionId) => {
        const { data } = await axios.post(`${API}/${fileId}/versions/${versionId}/restore`, {}, { withCredentials: true });
        return data;
    }, []);

    const getComments = useCallback(async (fileId) => {
        const { data } = await axios.get(`${API}/${fileId}/comments`, { withCredentials: true });
        return data.comments || [];
    }, []);

    const addComment = useCallback(async (fileId, content, parentId) => {
        const { data } = await axios.post(`${API}/${fileId}/comments`, { content, parentId }, { withCredentials: true });
        return data.comment;
    }, []);

    const shareFile = useCallback(async (fileId, permissions) => {
        const { data } = await axios.post(`${API}/${fileId}/share`, { permissions }, { withCredentials: true });
        return data;
    }, []);

    const updateTags = useCallback(async (fileId, tags) => {
        const { data } = await axios.patch(`${API}/${fileId}/tags`, { tags }, { withCredentials: true });
        setFiles(prev => prev.map(f => f._id === fileId ? { ...f, tags: data.file.tags } : f));
        return data.file;
    }, []);

    return { files, loading, error, listFiles, uploadFile, getFile, updateFile, deleteFile, getVersions, uploadVersion, restoreVersion, getComments, addComment, shareFile, updateTags };
}
