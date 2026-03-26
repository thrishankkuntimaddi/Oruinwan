// client/src/hooks/useKnowledge.js
import { useState, useCallback } from 'react';
import axios from 'axios';

const API = '/api/v2/knowledge';

export function useKnowledge() {
    const [pages, setPages] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const listPages = useCallback(async (workspaceId, filters = {}) => {
        setLoading(true);
        try {
            const { data } = await axios.get(`${API}/pages`, { params: { workspaceId, ...filters }, withCredentials: true });
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
        const { data } = await axios.post(`${API}/pages`, { workspaceId, ...pageData }, { withCredentials: true });
        setPages(prev => [data.page, ...prev]);
        return data.page;
    }, []);

    const getPage = useCallback(async (pageId) => {
        const { data } = await axios.get(`${API}/pages/${pageId}`, { withCredentials: true });
        return data.page;
    }, []);

    const updatePage = useCallback(async (pageId, updates) => {
        const { data } = await axios.put(`${API}/pages/${pageId}`, updates, { withCredentials: true });
        setPages(prev => prev.map(p => p._id === pageId ? { ...p, ...data.page } : p));
        return data.page;
    }, []);

    const deletePage = useCallback(async (pageId) => {
        await axios.delete(`${API}/pages/${pageId}`, { withCredentials: true });
        setPages(prev => prev.filter(p => p._id !== pageId));
    }, []);

    const linkPages = useCallback(async (fromId, toPageId, workspaceId) => {
        const { data } = await axios.post(`${API}/pages/${fromId}/link`, { toPageId, workspaceId }, { withCredentials: true });
        return data;
    }, []);

    const unlinkPages = useCallback(async (fromId, toId) => {
        const { data } = await axios.delete(`${API}/pages/${fromId}/link/${toId}`, { withCredentials: true });
        return data;
    }, []);

    const getBacklinks = useCallback(async (pageId) => {
        const { data } = await axios.get(`${API}/pages/${pageId}/backlinks`, { withCredentials: true });
        return data.backlinks || [];
    }, []);

    const getGraph = useCallback(async (workspaceId) => {
        const { data } = await axios.get(`${API}/graph`, { params: { workspaceId }, withCredentials: true });
        return data;
    }, []);

    const searchKnowledge = useCallback(async (workspaceId, q) => {
        const { data } = await axios.get(`${API}/search`, { params: { workspaceId, q }, withCredentials: true });
        return data.results || [];
    }, []);

    const summarizePage = useCallback(async (pageId) => {
        const { data } = await axios.post(`${API}/pages/${pageId}/summarize`, {}, { withCredentials: true });
        return data.summary;
    }, []);

    const listCategories = useCallback(async (workspaceId) => {
        const { data } = await axios.get(`${API}/categories`, { params: { workspaceId }, withCredentials: true });
        setCategories(data.categories || []);
        return data.categories || [];
    }, []);

    const createCategory = useCallback(async (workspaceId, catData) => {
        const { data } = await axios.post(`${API}/categories`, { workspaceId, ...catData }, { withCredentials: true });
        setCategories(prev => [...prev, data.category]);
        return data.category;
    }, []);

    return { pages, categories, loading, error, listPages, createPage, getPage, updatePage, deletePage, linkPages, unlinkPages, getBacklinks, getGraph, searchKnowledge, summarizePage, listCategories, createCategory };
}
