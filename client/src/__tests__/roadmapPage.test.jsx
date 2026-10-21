// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const WS = 'a'.repeat(24);
const handlers = {};
const socket = { on: vi.fn((e, fn) => { handlers[e] = fn; }), off: vi.fn(), emit: vi.fn() };

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { _id: 'me', username: 'alice' } }) }));
const toast = vi.fn();
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast: toast }) }));
vi.mock('../contexts/WorkspaceContext', () => ({ useWorkspace: () => ({ activeWorkspace: { name: 'Acme' } }) }));
vi.mock('../contexts/SocketContext', () => ({ useOptionalSocket: () => ({ socket }) }));
vi.mock('../services/roadmapService', () => ({
    default: {
        list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(),
        milestones: vi.fn(), tasks: vi.fn(), members: vi.fn(),
    },
}));

import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RoadmapPage from '../pages/roadmap/RoadmapPage';
import roadmapService from '../services/roadmapService';
import { bodyFromForm, validateForm, formFromItem, emptyForm } from '../pages/roadmap/RoadmapItemDrawer';

const items = [
    { _id: 'r1', title: 'Self-serve onboarding', status: 'in_progress', startDate: '2026-10-01', endDate: '2026-12-15', order: 0, canEdit: true,
        ownerId: { _id: 'u1', username: 'ada' }, progress: { percent: 40, tasks: { total: 5, done: 2 } } },
    { _id: 'r2', title: 'Billing v2', status: 'planned', quarter: '2027-Q1', order: 1, canEdit: false, ownerId: null, progress: { percent: 0 } },
    { _id: 'r3', title: 'Someday', status: 'planned', order: 2, canEdit: true, progress: { percent: 0 } },
];

const renderPage = () => render(
    <MemoryRouter initialEntries={[`/workspace/${WS}/roadmap`]}>
        <Routes><Route path="/workspace/:workspaceId/roadmap" element={<RoadmapPage />} /></Routes>
    </MemoryRouter>,
);

beforeEach(() => {
    Object.keys(handlers).forEach((k) => delete handlers[k]);
    roadmapService.milestones.mockResolvedValue([{ _id: 'm1', name: 'Beta', progress: { percent: 50 } }]);
    roadmapService.tasks.mockResolvedValue([{ _id: 't1', title: 'Write docs', status: 'todo' }]);
    roadmapService.members.mockResolvedValue([{ _id: 'u1', username: 'ada' }]);
});

describe('RoadmapPage', () => {
    it('shows items in status lanes with progress, and unscheduled ones apart', async () => {
        roadmapService.list.mockResolvedValue({ items, canCreate: true });
        renderPage();
        expect(await screen.findByLabelText('Self-serve onboarding, 40% complete')).toBeTruthy();
        expect(screen.getByText('2/5 tasks done', { exact: false })).toBeTruthy();
        expect(screen.getByText('Unscheduled')).toBeTruthy();
        expect(screen.getByText('Someday')).toBeTruthy();
        expect(screen.getByRole('button', { name: /New item/ })).toBeTruthy();
    });

    it('hides create for members who cannot plan', async () => {
        roadmapService.list.mockResolvedValue({ items, canCreate: false });
        renderPage();
        await screen.findByLabelText('Self-serve onboarding, 40% complete');
        expect(screen.queryByRole('button', { name: /New item/ })).toBeNull();
    });

    it('creates an item from the drawer', async () => {
        roadmapService.list.mockResolvedValue({ items: [], canCreate: true });
        roadmapService.create.mockResolvedValue({ _id: 'new', title: 'Mobile app', status: 'planned', quarter: '2026-Q4', canEdit: true });
        renderPage();
        fireEvent.click((await screen.findAllByRole('button', { name: /New item/ }))[0]);
        fireEvent.click(screen.getByRole('button', { name: 'Create item' }));
        expect(await screen.findByText('Give the item a title.')).toBeTruthy();
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Mobile app' } });
        fireEvent.change(screen.getByLabelText(/Quarter/), { target: { value: '2026-Q4' } });
        await waitFor(() => expect(screen.getByText('Write docs')).toBeTruthy());
        fireEvent.click(screen.getByRole('checkbox', { name: /Write docs/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Create item' }));
        await waitFor(() => expect(roadmapService.create).toHaveBeenCalled());
        const [ws, body] = roadmapService.create.mock.calls[0];
        expect(ws).toBe(WS);
        expect(body).toMatchObject({ title: 'Mobile app', quarter: '2026-Q4', taskIds: ['t1'], milestoneIds: [] });
    });

    it('refetches on roadmap:updated for this workspace', async () => {
        roadmapService.list.mockResolvedValue({ items, canCreate: true });
        renderPage();
        await screen.findByLabelText('Self-serve onboarding, 40% complete');
        const calls = roadmapService.list.mock.calls.length;
        await act(async () => { handlers['roadmap:updated']({ workspaceId: WS, action: 'updated' }); });
        await waitFor(() => expect(roadmapService.list.mock.calls.length).toBe(calls + 1));
        await act(async () => { handlers['roadmap:updated']({ workspaceId: 'other', action: 'updated' }); });
        expect(roadmapService.list.mock.calls.length).toBe(calls + 1);
    });
});

describe('roadmap drawer form', () => {
    it('validates and builds the request body', () => {
        expect(validateForm(emptyForm())).toMatch(/title/);
        expect(validateForm({ ...emptyForm(), title: 'x', startDate: '2026-05-01', endDate: '2026-04-01' })).toMatch(/end date/);
        expect(validateForm({ ...emptyForm(), title: 'x', quarter: 'Q4' })).toMatch(/Quarter/);
        const body = bodyFromForm({ ...emptyForm(), title: '  A  ', startDate: '' });
        expect(body).toMatchObject({ title: 'A', startDate: null, endDate: null, quarter: null });
        expect(body.ownerId).toBeUndefined();
        expect(formFromItem(items[0])).toMatchObject({ startDate: '2026-10-01', ownerId: 'u1', status: 'in_progress' });
    });
});
