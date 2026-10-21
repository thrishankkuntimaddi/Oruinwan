// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act, renderHook } from '@testing-library/react';

vi.mock('@services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../contexts/WorkspaceContext', () => ({ useWorkspace: () => ({ activeWorkspace: { name: 'Acme' } }) }));
vi.mock('../hooks/useIsMobile', () => ({ useIsMobile: () => false }));

import { MemoryRouter, Routes, Route } from 'react-router-dom';
import KnowledgePage from '../pages/SidebarComp/KnowledgePage';
import api from '@services/api';
import { useKnowledge } from '../hooks/useKnowledge';
import { filterByCategory, countByCategory, catKey, UNCATEGORISED } from '../pages/SidebarComp/knowledgeCategories';
import KnowledgeCategoriesDialog, { categoryErrorMessage, cleanCategoryName } from '../pages/SidebarComp/KnowledgeCategoriesDialog';

const pages = [
    { _id: 'p1', title: 'A', categoryId: 'c1' },
    { _id: 'p2', title: 'B', categoryId: { _id: 'c1' } },
    { _id: 'p3', title: 'C', categoryId: null },
    { _id: 'p4', title: 'D', categoryId: 'c2' },
];
const cats = [{ _id: 'c1', name: 'Engineering' }, { _id: 'c2', name: 'People' }];

beforeEach(() => { Object.values(api).forEach((fn) => fn.mockReset()); });

describe('category helpers', () => {
    it('reads populated and plain category ids', () => {
        expect(catKey(pages[1])).toBe('c1');
        expect(catKey(pages[2])).toBe(UNCATEGORISED);
    });

    it('filters and counts pages by category', () => {
        expect(filterByCategory(pages, '').length).toBe(4);
        expect(filterByCategory(pages, 'c1').map((p) => p._id)).toEqual(['p1', 'p2']);
        expect(filterByCategory(pages, UNCATEGORISED).map((p) => p._id)).toEqual(['p3']);
        expect(countByCategory(pages)).toEqual({ c1: 2, c2: 1, none: 1 });
    });

    it('cleans names and explains servers without rename/delete', () => {
        expect(cleanCategoryName('  Eng   team ')).toBe('Eng team');
        expect(categoryErrorMessage({ response: { status: 404 } }, 'rename')).toMatch(/can’t rename categories yet/);
        expect(categoryErrorMessage({ response: { status: 500, data: { message: 'boom' } } }, 'delete')).toBe('boom');
    });
});

describe('useKnowledge categories', () => {
    it('lists, creates, renames and deletes', async () => {
        api.get.mockResolvedValueOnce({ data: { categories: cats } });
        api.post.mockResolvedValueOnce({ data: { category: { _id: 'c3', name: 'Ops' } } });
        api.patch.mockResolvedValueOnce({ data: { category: { _id: 'c1', name: 'Eng' } } });
        api.delete.mockResolvedValueOnce({ data: {} });
        const { result } = renderHook(() => useKnowledge());
        await act(() => result.current.listCategories('ws'));
        expect(api.get).toHaveBeenCalledWith('/api/v2/knowledge/categories', { params: { workspaceId: 'ws' } });
        await act(() => result.current.createCategory('ws', { name: 'Ops' }));
        expect(api.post).toHaveBeenCalledWith('/api/v2/knowledge/categories', { workspaceId: 'ws', name: 'Ops' });
        await act(() => result.current.updateCategory('c1', { name: 'Eng' }));
        expect(api.patch).toHaveBeenCalledWith('/api/v2/knowledge/categories/c1', { name: 'Eng' });
        await act(() => result.current.deleteCategory('c2'));
        expect(api.delete).toHaveBeenCalledWith('/api/v2/knowledge/categories/c2');
        expect(result.current.categories.map((c) => c.name)).toEqual(['Eng', 'Ops']);
    });
});

describe('KnowledgeCategoriesDialog', () => {
    const setup = (over = {}) => {
        const props = {
            open: true, onClose: vi.fn(), categories: cats, counts: { c1: 2, c2: 1 },
            onCreate: vi.fn().mockResolvedValue({}), onRename: vi.fn().mockResolvedValue({}), onDelete: vi.fn().mockResolvedValue(),
            showToast: vi.fn(), ...over,
        };
        render(<KnowledgeCategoriesDialog {...props} />);
        return props;
    };

    it('creates a category and refuses duplicates', async () => {
        const p = setup();
        fireEvent.change(screen.getByLabelText('New category name'), { target: { value: ' Design ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add' }));
        await waitFor(() => expect(p.onCreate).toHaveBeenCalledWith('Design'));
        fireEvent.change(screen.getByLabelText('New category name'), { target: { value: 'engineering' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add' }));
        expect(p.showToast).toHaveBeenCalledWith('“engineering” already exists', 'error');
        expect(p.onCreate).toHaveBeenCalledTimes(1);
    });

    it('renames inline', async () => {
        const p = setup();
        fireEvent.click(screen.getByLabelText('Rename Engineering'));
        const input = screen.getByLabelText('Rename Engineering');
        fireEvent.change(input, { target: { value: 'Platform' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() => expect(p.onRename).toHaveBeenCalledWith('c1', 'Platform'));
    });

    it('shows a clear message when the server cannot rename', async () => {
        const p = setup({ onRename: vi.fn().mockRejectedValue({ response: { status: 404 } }) });
        fireEvent.click(screen.getByLabelText('Rename People'));
        const input = screen.getByLabelText('Rename People');
        fireEvent.change(input, { target: { value: 'Team' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() => expect(p.showToast).toHaveBeenCalledWith(expect.stringMatching(/can’t rename/), 'error'));
    });

    it('confirms before deleting and mentions the page count', async () => {
        const p = setup();
        fireEvent.click(screen.getByLabelText('Delete Engineering'));
        const dialog = await screen.findByRole('dialog');
        expect(dialog).toHaveTextContent('Its 2 pages stay where they are');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete category' }));
        await waitFor(() => expect(p.onDelete).toHaveBeenCalledWith('c1'));
    });
});

describe('KnowledgePage categories', () => {
    const routeGet = (pageList) => (url) => {
        if (url.endsWith('/categories')) return Promise.resolve({ data: { categories: cats } });
        if (url.endsWith('/pages')) return Promise.resolve({ data: { pages: pageList } });
        if (url.endsWith('/backlinks')) return Promise.resolve({ data: { backlinks: [] } });
        if (url.includes('/pages/')) return Promise.resolve({ data: { page: { _id: 'p1', title: 'A', content: '', tags: [], categoryId: 'c1' } } });
        return Promise.resolve({ data: {} });
    };
    const renderAt = (path) => render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/workspace/:workspaceId/knowledge" element={<KnowledgePage />} />
                <Route path="/workspace/:workspaceId/knowledge/:id" element={<KnowledgePage />} />
            </Routes>
        </MemoryRouter>,
    );

    it('browses pages by category from the URL', async () => {
        api.get.mockImplementation(routeGet(pages.map((p) => ({ ...p, updatedAt: new Date().toISOString() }))));
        renderAt('/workspace/ws/knowledge?category=c2');
        expect(await screen.findByText('D')).toBeInTheDocument();
        expect(screen.queryByText('A')).toBeNull();
        expect(screen.getByRole('heading', { name: 'People' })).toBeInTheDocument();
    });

    it('assigns a page to a category from the page bar', async () => {
        api.get.mockImplementation(routeGet(pages));
        api.put.mockResolvedValue({ data: { page: { _id: 'p1', categoryId: 'c2' } } });
        renderAt('/workspace/ws/knowledge/p1');
        const select = await screen.findByLabelText('Category');
        await waitFor(() => expect(select).toHaveValue('c1'));
        fireEvent.change(select, { target: { value: 'c2' } });
        await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v2/knowledge/pages/p1', { categoryId: 'c2' }));
        fireEvent.change(select, { target: { value: '' } });
        await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v2/knowledge/pages/p1', { categoryId: null }));
    });
});
