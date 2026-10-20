// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';

// Stand-ins for the real pages: each shows where it is and can navigate.
function FakePage({ name }) {
    const { pathname } = useLocation();
    const params = useParams();
    const navigate = useNavigate();
    return (
        <div>
            <span data-testid={`page-${name}`}>{name}:{pathname}:{params.id || ''}</span>
            <button type="button" onClick={() => navigate(`/workspace/${params.workspaceId}/notes/n2`)}>go-note-2</button>
        </div>
    );
}
vi.mock('../pages/SidebarComp/Home', () => ({ default: () => <FakePage name="home" /> }));
vi.mock('../pages/SidebarComp/Notes', () => ({ default: () => <FakePage name="notes" /> }));
vi.mock('../pages/SidebarComp/MyTasks', () => ({ default: () => <FakePage name="tasks" /> }));
vi.mock('../pages/SidebarComp/FileLibrary', () => ({ default: () => <FakePage name="files" /> }));
vi.mock('../pages/SidebarComp/KnowledgePage', () => ({ default: () => <FakePage name="knowledge" /> }));

import SplitPane from '../features/split/SplitPane';
import { clampPaneWidth, split } from '../features/split/splitStore';

function MainPage() {
    const { pathname } = useLocation();
    return (
        <div>
            <span data-testid="main">{pathname}</span>
            <SplitPane workspaceId="w1" />
        </div>
    );
}

const renderApp = (start = '/workspace/w1/tasks') => render(
    <MemoryRouter initialEntries={[start]}>
        <Routes><Route path="*" element={<MainPage />} /></Routes>
    </MemoryRouter>,
);

beforeEach(() => {
    sessionStorage.clear();
    act(() => split.close());
});

describe('split view', () => {
    it('shows a second page beside the main one; navigating inside the pane changes only the pane', async () => {
        renderApp();
        act(() => split.open('/workspace/w1/notes/n1', 'w1'));
        expect((await screen.findByTestId('page-notes')).textContent).toBe('notes:/workspace/w1/notes/n1:n1');

        fireEvent.click(screen.getByText('go-note-2'));
        expect((await screen.findByTestId('page-notes')).textContent).toBe('notes:/workspace/w1/notes/n2:n2');
        expect(screen.getByTestId('main').textContent).toBe('/workspace/w1/tasks');
    });

    it('swaps the pane with the main view', async () => {
        renderApp();
        act(() => split.open('/workspace/w1/home/channel/c1', 'w1'));
        await screen.findByTestId('page-home');
        fireEvent.click(screen.getByRole('button', { name: 'Swap with the main view' }));
        expect(screen.getByTestId('main').textContent).toBe('/workspace/w1/home/channel/c1');
        expect((await screen.findByTestId('page-tasks')).textContent).toContain('/workspace/w1/tasks');
    });

    it('closes when the workspace changes, and keeps the main view roomy', () => {
        renderApp();
        act(() => split.open('/workspace/other/tasks', 'other'));
        expect(screen.queryByTestId('split-pane')).toBeNull();
        expect(clampPaneWidth(100, 1400)).toBe(320);
        expect(clampPaneWidth(5000, 1400)).toBe(980);
    });
});
