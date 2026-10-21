// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const WS = 'a'.repeat(24);
const ME = 'me';
const handlers = {};
const socket = {
    on: vi.fn((e, fn) => { handlers[e] = fn; }),
    off: vi.fn(),
    emit: vi.fn((event, payload, ack) => { if (event === 'design-review:join' && ack) ack({ ok: true, viewers: [ME, 'bob'] }); }),
};

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { _id: ME, username: 'alice' } }) }));
const toast = vi.fn();
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast: toast }) }));
vi.mock('../contexts/WorkspaceContext', () => ({ useWorkspace: () => ({ activeWorkspace: { name: 'Acme' } }) }));
vi.mock('../contexts/SocketContext', () => ({ useOptionalSocket: () => ({ socket }) }));
vi.mock('../utils/mediaUrl', () => ({ useMediaUrl: (a) => ({ url: a ? 'blob:signed' : null, error: null, refresh: () => {} }) }));
vi.mock('../services/designReviewService', () => ({
    default: {
        list: vi.fn(), get: vi.fn(), create: vi.fn(), decide: vi.fn(), annotate: vi.fn(), reply: vi.fn(),
        resolve: vi.fn(), deleteAnnotation: vi.fn(), newRound: vi.fn(), remove: vi.fn(), compare: vi.fn(), members: vi.fn(), files: vi.fn(),
    },
}));

import { MemoryRouter, Routes, Route } from 'react-router-dom';
import DesignReviewPage from '../pages/designReview/DesignReviewPage';
import DesignReviewsPage, { filterReviews } from '../pages/designReview/DesignReviewsPage';
import svc from '../services/designReviewService';

const review = {
    _id: 'rv1', workspaceId: WS, fileId: 'f1', versionNumber: 2, title: 'Home screen', status: 'open',
    createdBy: { _id: 'bob', username: 'bob' },
    reviewers: [{ user: { _id: ME, username: 'alice' }, decision: 'pending' }],
    rounds: [{ versionNumber: 2 }],
    file: { _id: 'f1', name: 'home.png', mimeType: 'image/png', currentVersion: 2, kind: 'image' },
    version: { versionNumber: 2, url: '/api/v2/uploads/file?path=x', current: true },
    permissions: { canManage: false, canDecide: true },
};
const ann = (id, extra = {}) => ({ _id: id, versionNumber: 2, x: 0.1, y: 0.1, w: 0.2, h: 0.2, body: `note ${id}`, resolved: false, replies: [], authorId: { _id: 'bob', username: 'bob' }, createdAt: '2026-10-01T00:00:00Z', ...extra });

const renderAt = (path) => render(
    <MemoryRouter initialEntries={[path]}>
        <Routes>
            <Route path="/workspace/:workspaceId/reviews" element={<DesignReviewsPage />} />
            <Route path="/workspace/:workspaceId/reviews/:reviewId" element={<DesignReviewPage />} />
        </Routes>
    </MemoryRouter>,
);

beforeEach(() => { Object.keys(handlers).forEach((k) => delete handlers[k]); socket.emit.mockClear(); });

describe('DesignReviewPage', () => {
    it('loads the review, joins the room and lists open comments', async () => {
        svc.get.mockResolvedValue({ review, annotations: [ann('a1'), ann('a2', { resolved: true })] });
        renderAt(`/workspace/${WS}/reviews/rv1`);
        expect(await screen.findByText('Home screen')).toBeTruthy();
        expect(screen.getAllByText('note a1').length).toBeGreaterThan(0);
        expect(screen.queryByText('note a2', { selector: 'p' })).toBeNull();
        expect(socket.emit).toHaveBeenCalledWith('design-review:join', { reviewId: 'rv1' }, expect.any(Function));
        expect(screen.getByText('viewing')).toBeTruthy();
    });

    it('applies live annotation events', async () => {
        svc.get.mockResolvedValue({ review, annotations: [] });
        renderAt(`/workspace/${WS}/reviews/rv1`);
        await screen.findByText('Home screen');
        await act(async () => { handlers['design-review:annotation']({ reviewId: 'rv1', action: 'created', annotation: ann('live') }); });
        expect(screen.getByText('note live', { selector: 'p' })).toBeTruthy();
        await act(async () => { handlers['design-review:annotation']({ reviewId: 'rv1', action: 'deleted', annotation: { _id: 'live' } }); });
        expect(screen.queryByText('note live', { selector: 'p' })).toBeNull();
    });

    it('lets a reviewer approve', async () => {
        svc.get.mockResolvedValue({ review, annotations: [] });
        svc.decide.mockResolvedValue({ ...review, status: 'approved', reviewers: [{ user: { _id: ME, username: 'alice' }, decision: 'approved' }] });
        renderAt(`/workspace/${WS}/reviews/rv1`);
        await screen.findByText('Home screen');
        fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
        const dialogButtons = await screen.findAllByRole('button', { name: 'Approve' });
        fireEvent.click(dialogButtons[dialogButtons.length - 1]);
        await waitFor(() => expect(svc.decide).toHaveBeenCalledWith('rv1', 'approved', undefined));
        expect(await screen.findAllByText('Approved')).toBeTruthy();
    });

    it('draws a box and posts an annotation in normalised coordinates', async () => {
        svc.get.mockResolvedValue({ review, annotations: [] });
        svc.annotate.mockImplementation(async (_id, body) => ann('n1', body));
        renderAt(`/workspace/${WS}/reviews/rv1`);
        await screen.findByText('Home screen');
        fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
        const overlay = screen.getByLabelText(/Click to pin a comment/);
        overlay.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 });
        fireEvent.pointerDown(overlay, { clientX: 20, clientY: 10, button: 0 });
        fireEvent.pointerMove(overlay, { clientX: 120, clientY: 60 });
        fireEvent.pointerUp(overlay, { clientX: 120, clientY: 60 });
        fireEvent.change(await screen.findByLabelText('Comment'), { target: { value: 'Tighten spacing' } });
        fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
        await waitFor(() => expect(svc.annotate).toHaveBeenCalled());
        expect(svc.annotate.mock.calls[0][1]).toEqual({ x: 0.1, y: 0.1, w: 0.5, h: 0.5, body: 'Tighten spacing' });
    });
});

describe('DesignReviewsPage', () => {
    it('lists reviews with status and opens the empty state with a start action', async () => {
        svc.list.mockResolvedValue([{ _id: 'rv1', title: 'Home screen', status: 'changes_requested', versionNumber: 2, reviewers: [], annotationCounts: { total: 3, open: 1 } }]);
        renderAt(`/workspace/${WS}/reviews`);
        expect(await screen.findByText('Home screen')).toBeTruthy();
        expect(svc.list).toHaveBeenCalledWith({ workspaceId: WS });
    });

    it('filters by status and search', () => {
        const list = [{ title: 'Home', status: 'open' }, { title: 'Pricing', status: 'approved' }];
        expect(filterReviews(list, { status: 'approved' }).map((r) => r.title)).toEqual(['Pricing']);
        expect(filterReviews(list, { query: 'ho' }).map((r) => r.title)).toEqual(['Home']);
        expect(filterReviews(list, {}).length).toBe(2);
    });
});
