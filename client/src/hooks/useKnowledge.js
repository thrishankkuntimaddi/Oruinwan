// client/src/hooks/useKnowledge.js
import { useState, useCallback } from 'react';
import api from '../services/api';

const API = '/api/v2/knowledge';

export function useKnowledge() {
    const [pages, setPages] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const listPages = useCallback(async (workspaceId, filters = {}) => {
        setLoading(true);
        try {
            const { data } = await api.get(`${API}/pages`, { params: { workspaceId, ...filters } });
            setPages(data.pages || []);
            return data.pages || [];
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load pages');
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const createPage = useCallback(async (workspaceId, pageData) => {
        const { data } = await api.post(`${API}/pages`, { workspaceId, ...pageData });
        setPages(prev => [data.page, ...prev]);
        return data.page;
    }, []);

    const getPage = useCallback(async (pageId) => {
        const { data } = await api.get(`${API}/pages/${pageId}`);
        return data.page;
    }, []);

    const updatePage = useCallback(async (pageId, updates) => {
        const { data } = await api.put(`${API}/pages/${pageId}`, updates);
        setPages(prev => prev.map(p => p._id === pageId ? { ...p, ...data.page } : p));
        return data.page;
    }, []);

    const deletePage = useCallback(async (pageId) => {
        await api.delete(`${API}/pages/${pageId}`);
        setPages(prev => prev.filter(p => p._id !== pageId));
    }, []);

    const linkPages = useCallback(async (fromId, toPageId, workspaceId) => {
        const { data } = await api.post(`${API}/pages/${fromId}/link`, { toPageId, workspaceId });
        return data;
    }, []);

    const unlinkPages = useCallback(async (fromId, toId) => {
        const { data } = await api.delete(`${API}/pages/${fromId}/link/${toId}`);
        return data;
    }, []);

    const getBacklinks = useCallback(async (pageId) => {
        const { data } = await api.get(`${API}/pages/${pageId}/backlinks`);
        return data.backlinks || [];
    }, []);

    const getGraph = useCallback(async (workspaceId) => {
        const { data } = await api.get(`${API}/graph`, { params: { workspaceId } });
        return data;
    }, []);

    const searchKnowledge = useCallback(async (workspaceId, q) => {
        const { data } = await api.get(`${API}/search`, { params: { workspaceId, q } });
        return data.results || [];
    }, []);

    const summarizePage = useCallback(async (pageId) => {
        const { data } = await api.post(`${API}/pages/${pageId}/summarize`);
        return data.summary;
    }, []);

    const listCategories = useCallback(async (workspaceId) => {
        const { data } = await api.get(`${API}/categories`, { params: { workspaceId } });
        setCategories(data.categories || []);
        return data.categories || [];
    }, []);

    const createCategory = useCallback(async (workspaceId, catData) => {
        const { data } = await api.post(`${API}/categories`, { workspaceId, ...catData });
        setCategories(prev => [...prev, data.category]);
        return data.category;
    }, []);

    return { pages, categories, loading, error, listPages, createPage, getPage, updatePage, deletePage, linkPages, unlinkPages, getBacklinks, getGraph, searchKnowledge, summarizePage, listCategories, createCategory };
}
