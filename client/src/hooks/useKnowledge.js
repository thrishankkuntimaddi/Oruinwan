import { useState, useCallback } from 'react';
import api from '@services/api';

const API = '/api/v2/knowledge';

/** A readable reason the page list didn't load (shown instead of an empty "No pages yet"). */
export function knowledgeLoadError(err) {
    const status = err?.response?.status;
    if (status === 403) return 'You are not an active member of this workspace, so its pages can’t be shown.';
    if (!err?.response) return 'Couldn’t reach the server. Check your connection and try again.';
    return err.response?.data?.message || 'Couldn’t load the pages.';
}

export function useKnowledge() {
    const [pages, setPages] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    // True once a list request has answered (successfully or not): until then an empty
    // list means "not loaded yet", not "no pages".
    const [loaded, setLoaded] = useState(false);

    const listPages = useCallback(async (workspaceId, filters = {}) => {
        setLoading(true);
        try {
            const { data } = await api.get(`${API}/pages`, { params: { workspaceId, ...filters } });
            setPages(data.pages || []);
            setError(null);
            return data.pages || [];
        } catch (err) {
            setError(knowledgeLoadError(err));
            return [];
        } finally {
            setLoading(false);
            setLoaded(true);
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

    /**
     * Rename / recolour a category. The server needs PATCH /api/v2/knowledge/categories/:id;
     * callers show a clear message when it answers 404/405 (older servers only list and create).
     */
    const updateCategory = useCallback(async (categoryId, updates) => {
        const { data } = await api.patch(`${API}/categories/${categoryId}`, updates);
        const next = data?.category || { _id: categoryId, ...updates };
        setCategories(prev => prev.map(c => c._id === categoryId ? { ...c, ...next } : c));
        return next;
    }, []);

    /** Delete a category (DELETE /api/v2/knowledge/categories/:id). Its pages become uncategorised. */
    const deleteCategory = useCallback(async (categoryId) => {
        await api.delete(`${API}/categories/${categoryId}`);
        setCategories(prev => prev.filter(c => c._id !== categoryId));
        setPages(prev => prev.map(p => String(p.categoryId || '') === String(categoryId) ? { ...p, categoryId: null } : p));
    }, []);

    return { pages, categories, loading, loaded, error, listPages, createPage, getPage, updatePage, deletePage, linkPages, unlinkPages, getBacklinks, getGraph, searchKnowledge, summarizePage, listCategories, createCategory, updateCategory, deleteCategory };
}
