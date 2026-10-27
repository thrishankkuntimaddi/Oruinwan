// @vitest-environment jsdom
// Where things live: Roadmap is a tab of Notes, Design reviews sit in Tasks → Planning, the
// task layout is in the URL, and every screen uses the same note type names.
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const WS = 'a'.repeat(24);

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { _id: 'me', username: 'alice' } }) }));
vi.mock('../contexts/WorkspaceContext', () => ({
    useWorkspace: () => ({ workspaces: [], activeWorkspace: { id: WS, name: 'Acme', role: 'member' }, setActiveWorkspace: () => {} }),
}));
vi.mock('../features/notifications/NotificationsContext', () => ({ useNotifications: () => ({ unreadTotals: { dm: 0, channel: 0 } }) }));
vi.mock('../hooks/useWorkspaceFeatures', () => ({ useWorkspaceFeatures: () => ({ tasks: true, notes: true, huddles: true }) }));

import IconSidebar from '../components/layout/IconSidebar';
import { notesPanelTabs } from '../components/layout/panels/NotesPanel';
import { roadmapPanelGroups } from '../components/layout/panels/RoadmapPanelList';
import { viewModeFromSearch } from '../pages/SidebarComp/MyTasks';
import { NOTE_TYPE_LIST, noteTypeGroup, noteTypeOf } from '../pages/SidebarComp/notesComponents/noteTypes';

const rail = (path) => render(<MemoryRouter initialEntries={[path]}><IconSidebar /></MemoryRouter>);

describe('workspace rail', () => {
    it('has no separate Roadmap or Design reviews entries', () => {
        rail(`/workspace/${WS}/home`);
        expect(screen.getByRole('button', { name: 'Tasks' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Notes' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Roadmap' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Design reviews' })).toBeNull();
    });

    it('lists Knowledge on the desktop rail and highlights it on knowledge pages', () => {
        rail(`/workspace/${WS}/knowledge/${'c'.repeat(24)}`);
        expect(screen.getByRole('button', { name: 'Knowledge' }).getAttribute('aria-current')).toBe('page');
    });

    it('lists Files on the desktop rail and highlights it on file pages', () => {
        rail(`/workspace/${WS}/files/${'d'.repeat(24)}`);
        expect(screen.getByRole('button', { name: 'Files' }).getAttribute('aria-current')).toBe('page');
    });

    it('keeps Files, Knowledge and Agents under More until one of them is open', () => {
        rail(`/workspace/${WS}/home`);
        expect(screen.queryByRole('button', { name: 'Files' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Knowledge' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: /^More/ }));
        expect(screen.getByRole('menuitem', { name: /Files/ })).toBeTruthy();
        expect(screen.getByRole('menuitem', { name: /Knowledge/ })).toBeTruthy();
        expect(screen.getByRole('menuitem', { name: /Agents & tools/ })).toBeTruthy();
    });

    it('highlights Tasks on design review pages', () => {
        rail(`/workspace/${WS}/reviews/${'b'.repeat(24)}`);
        expect(screen.getByRole('button', { name: 'Tasks' }).getAttribute('aria-current')).toBe('page');
        expect(screen.getByRole('button', { name: 'Notes' }).getAttribute('aria-current')).toBeNull();
    });

    it('highlights Notes on the roadmap', () => {
        rail(`/workspace/${WS}/roadmap`);
        expect(screen.getByRole('button', { name: 'Notes' }).getAttribute('aria-current')).toBe('page');
        expect(screen.getByRole('button', { name: 'Tasks' }).getAttribute('aria-current')).toBeNull();
    });
});

describe('Notes panel tabs', () => {
    it('adds Roadmap after Notes and Canvases when Tasks is on', () => {
        expect(notesPanelTabs().map((t) => t.label)).toEqual(['Notes', 'Canvases', 'Roadmap']);
        expect(notesPanelTabs({ roadmap: false }).map((t) => t.id)).toEqual(['workspace', 'canvas']);
    });

    it('groups roadmap items by status and filters them by the panel search', () => {
        const items = [
            { _id: '1', title: 'Billing v2', status: 'planned' },
            { _id: '2', title: 'Onboarding', status: 'in_progress' },
            { _id: '3', title: 'Billing exports' },
        ];
        expect(roadmapPanelGroups(items).map((g) => [g.label, g.items.length])).toEqual([['Planned', 2], ['In progress', 1]]);
        expect(roadmapPanelGroups(items, 'billing').flatMap((g) => g.items.map((i) => i._id))).toEqual(['1', '3']);
        expect(roadmapPanelGroups(items, 'nothing')).toEqual([]);
    });
});

describe('task layouts in the URL', () => {
    it('reads ?view= and falls back to the list', () => {
        expect(viewModeFromSearch('?view=board')).toBe('board');
        expect(viewModeFromSearch('?tab=all-tasks&view=timeline')).toBe('timeline');
        expect(viewModeFromSearch('?view=milestones')).toBe('milestones');
        expect(viewModeFromSearch('?view=time')).toBe('time');
        expect(viewModeFromSearch('?view=nope')).toBe('list');
        expect(viewModeFromSearch('')).toBe('list');
    });
});

describe('note types', () => {
    it('one label per type, with documentation listed as a Document', () => {
        const labels = NOTE_TYPE_LIST.map((t) => t.label);
        expect(new Set(labels).size).toBe(labels.length);
        expect(labels).toEqual(['Document', 'Brainstorm', 'Meeting', 'SOP', 'Project spec', 'Tech design', 'Announcement']);
        expect(noteTypeGroup('documentation')).toBe('note');
        expect(noteTypeGroup('meeting')).toBe('meeting');
        expect(noteTypeGroup('whatever')).toBe('note');
        expect(noteTypeOf('documentation').label).toBe('Document');
    });
});
