// @vitest-environment jsdom
// Knowledge on first visit: a welcome with ways to start, import from Markdown/text, and a real
// error (with retry) when the pages can't load instead of an empty "No pages yet".
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
const toast = vi.fn();
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast: toast }) }));
vi.mock('../contexts/WorkspaceContext', () => ({ useWorkspace: () => ({ activeWorkspace: { name: 'Acme' } }) }));
vi.mock('../hooks/useIsMobile', () => ({ useIsMobile: () => false }));

import { MemoryRouter, Routes, Route } from 'react-router-dom';
import KnowledgePage from '../pages/SidebarComp/KnowledgePage';
import api from '@services/api';
import { knowledgeLoadError } from '../hooks/useKnowledge';
import { importProblem, pageFromImport, readImportFiles } from '../pages/SidebarComp/knowledgeImport';

beforeEach(() => { Object.values(api).forEach((fn) => fn.mockReset()); toast.mockReset(); });

describe('knowledge import helpers', () => {
    it('takes the title from a leading # heading, else from the file name', () => {
        expect(pageFromImport('notes.md', '# On-call guide\n\nPage the lead.')).toEqual({ title: 'On-call guide', content: 'Page the lead.' });
        expect(pageFromImport('team_handbook.txt', 'Just text')).toEqual({ title: 'team handbook', content: 'Just text' });
        expect(pageFromImport('x.md', '\uFEFF## Not a title\r\nbody').title).toBe('x');
        expect(pageFromImport('.md', '').title).toBe('Imported page');
    });

    it('accepts Markdown and text files up to 1 MB', () => {
        expect(importProblem({ name: 'a.md', size: 10 })).toBeNull();
        expect(importProblem({ name: 'a', type: 'text/plain', size: 10 })).toBeNull();
        expect(importProblem({ name: 'a.pdf', type: 'application/pdf', size: 10 })).toMatch(/isn’t a Markdown/);
        expect(importProblem({ name: 'big.md', size: 2 * 1024 * 1024 })).toMatch(/larger than 1 MB/);
    });

    it('reads files and reports the ones it skipped', async () => {
        const good = new File(['# Hello\nworld'], 'hello.md', { type: 'text/markdown' });
        const bad = new File(['x'], 'pic.png', { type: 'image/png' });
        const { pages, problems } = await readImportFiles([good, bad]);
        expect(pages).toEqual([{ title: 'Hello', content: 'world' }]);
        expect(problems).toHaveLength(1);
    });
});

describe('knowledgeLoadError', () => {
    it('explains 403s and network failures', () => {
        expect(knowledgeLoadError({ response: { status: 403 } })).toMatch(/not an active member/);
        expect(knowledgeLoadError(new Error('Network Error'))).toMatch(/Couldn’t reach the server/);
        expect(knowledgeLoadError({ response: { status: 500, data: { message: 'boom' } } })).toBe('boom');
    });
});

describe('Knowledge home', () => {
    const renderHome = () => render(
        <MemoryRouter initialEntries={['/workspace/ws/knowledge']}>
            <Routes>
                <Route path="/workspace/:workspaceId/knowledge" element={<KnowledgePage />} />
                <Route path="/workspace/:workspaceId/knowledge/:id" element={<div>page opened</div>} />
            </Routes>
        </MemoryRouter>,
    );
    const empty = (url) => Promise.resolve({ data: url.endsWith('/categories') ? { categories: [] } : { pages: [] } });

    it('welcomes a new workspace with ways to start', async () => {
        api.get.mockImplementation(empty);
        renderHome();
        expect(await screen.findByText('Start your team’s knowledge base')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Write a page/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Import Markdown or text/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Set up categories/ })).toBeInTheDocument();
        expect(screen.getByText('Team handbook')).toBeInTheDocument();
    });

    it('shows the load error with a retry instead of an empty list', async () => {
        api.get.mockImplementation((url) => (url.endsWith('/pages')
            ? Promise.reject({ response: { status: 500, data: { message: 'Database unavailable' } } })
            : empty(url)));
        renderHome();
        expect(await screen.findByText('Couldn’t load the knowledge base')).toBeInTheDocument();
        expect(screen.getByText('Database unavailable')).toBeInTheDocument();
        expect(screen.queryByText('Start your team’s knowledge base')).toBeNull();
        api.get.mockImplementation(empty);
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(await screen.findByText('Start your team’s knowledge base')).toBeInTheDocument();
    });

    it('imports a Markdown file as a page and opens it', async () => {
        api.get.mockImplementation(empty);
        api.post.mockResolvedValue({ data: { page: { _id: 'p9', title: 'Runbook' } } });
        renderHome();
        await screen.findByText('Start your team’s knowledge base');
        const file = new File(['# Runbook\n\n1. Restart'], 'runbook.md', { type: 'text/markdown' });
        fireEvent.change(screen.getByTestId('kb-import-input'), { target: { files: [file] } });
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v2/knowledge/pages', { workspaceId: 'ws', title: 'Runbook', content: '1. Restart' }));
        expect(await screen.findByText('page opened')).toBeInTheDocument();
    });
});
