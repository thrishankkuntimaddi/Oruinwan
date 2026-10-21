// Renders the roadmap and design review screens with a fake adapter in the phone, split and wide
// layouts, and drives pins, threads, decisions and live events.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { create } from 'zustand';
import { mapAnnotation, mapReview } from '../../data/live/adapter.design.js';

const me = { id: 'me', name: 'Me', username: 'me' };
const members = [me, { id: 'u1', name: 'Ana Silva', username: 'ana' }];

const reviewRaw = {
  _id: 'd1', workspaceId: 'w1', fileId: 'f1', versionNumber: 1, title: 'Home screen', status: 'open',
  createdBy: { _id: 'u1', username: 'Ana Silva' }, reviewers: [{ user: { _id: 'me', username: 'me' }, decision: 'pending' }],
  rounds: [{ versionNumber: 1 }], annotationCounts: { total: 1, open: 1 },
  file: { _id: 'f1', name: 'home.png', mimeType: 'image/png', currentVersion: 1, kind: 'image' },
  version: { versionNumber: 1, url: '/api/v2/uploads/file?path=x', mimeType: 'image/png', current: true },
  permissions: { canManage: false, canDecide: true },
};
const annotation = { _id: 'a1', versionNumber: 1, x: 0.4, y: 0.2, body: 'Align with the grid', authorId: { _id: 'u1', username: 'Ana Silva' }, replies: [], createdAt: '2026-10-01T00:00:00Z' };

const roadmapItem = {
  id: 'r1', title: 'Self-serve onboarding', description: 'Signup without sales', status: 'in_progress', start: '2026-10-01', end: '2026-12-15',
  quarter: '2026-Q4', color: 'accent', order: 0, ownerId: 'me', owner: { id: 'me', name: 'Me' }, createdById: 'me', taskIds: [], milestoneIds: [],
  canEdit: true, progress: { percent: 40, tasks: { total: 5, done: 2, open: 3 }, milestones: { total: 1, completed: 0, items: [{ id: 'm1', name: 'Beta', percent: 50, status: 'in_progress' }] } },
};

const fake = {
  members: vi.fn(async () => members),
  tasks: vi.fn(async () => []),
  milestones: vi.fn(async () => []),
  mediaUrl: vi.fn(async () => 'blob:design'),
  roadmap: vi.fn(async () => ({ items: [roadmapItem, { ...roadmapItem, id: 'r2', title: 'Mobile parity', quarter: '2027-Q1', start: null, end: null, status: 'planned', progress: { percent: 0 } }], canCreate: true })),
  roadmapItem: vi.fn(async () => roadmapItem),
  updateRoadmapItem: vi.fn(async (id, patch) => ({ ...roadmapItem, ...patch })),
  designReviews: vi.fn(async () => [mapReview(reviewRaw)]),
  designReview: vi.fn(async () => ({ review: mapReview(reviewRaw), annotations: [mapAnnotation(annotation)] })),
  joinDesignReview: vi.fn(async () => ['u1']),
  leaveDesignReview: vi.fn(),
  addAnnotation: vi.fn(async (id, a) => mapAnnotation({ _id: 'a2', versionNumber: 1, ...a, authorId: { _id: 'me' }, createdAt: '2026-10-02T00:00:00Z' })),
  replyAnnotation: vi.fn(async () => mapAnnotation({ ...annotation, replies: [{ _id: 'rp', body: 'Done', authorId: { _id: 'me' } }] })),
  resolveAnnotation: vi.fn(async (id, aid, resolved) => mapAnnotation({ ...annotation, resolved })),
  decideDesignReview: vi.fn(async (id, decision) => mapReview({ ...reviewRaw, status: decision === 'approved' ? 'approved' : 'changes_requested', reviewers: [{ user: { _id: 'me' }, decision }] })),
  mapAnnotation,
  mapReview,
};

const mockSession = create(() => ({ user: me, workspaceId: 'w1', workspaces: [{ id: 'w1', role: 'member' }] }));
vi.mock('../../data/session.js', () => ({
  api: () => fake,
  useSession: mockSession,
  useWorkspace: () => ({ id: 'w1', role: 'member' }),
}));

const { useLayout } = await import('../../app/layout.js');
const { DesignReviewsScreen, DesignReviewScreen } = await import('./screens.jsx');
const { RoadmapScreen, RoadmapItemScreen } = await import('../roadmap/screens.jsx');
const { clearQueries, getQueryData } = await import('../../data/query.js');
const { emit } = await import('../../lib/bus.js');

const LAYOUTS = { phone: { wide: false, split: false }, split: { wide: false, split: true }, wide: { wide: true, split: true } };

beforeEach(() => {
  cleanup();
  clearQueries();
  vi.clearAllMocks();
});

describe.each(Object.keys(LAYOUTS))('roadmap and design review (%s layout)', (layout) => {
  beforeEach(() => useLayout.setState(LAYOUTS[layout]));

  it('lists the roadmap by quarter, or as a timeline on wide windows', async () => {
    render(<RoadmapScreen />);
    expect(await screen.findAllByText('Self-serve onboarding')).not.toHaveLength(0);
    if (layout === 'wide') {
      expect(screen.getByLabelText(/Self-serve onboarding, In progress, 40% done/)).toBeTruthy();
      fireEvent.click(screen.getByLabelText('List by quarter'));
    }
    expect(await screen.findByText('Q4 2026 · 1')).toBeTruthy();
    expect(screen.getByText('Q1 2027 · 1')).toBeTruthy();
    expect(screen.getByLabelText('New roadmap item')).toBeTruthy();
  });

  it('shows an item with progress and lets an editor change its status', async () => {
    render(<RoadmapItemScreen id="r1" />);
    expect(await screen.findByText('40%')).toBeTruthy();
    expect(screen.getByText('2 of 5 tasks done')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('tab', { name: 'Done' })[0]);
    await waitFor(() => expect(fake.updateRoadmapItem).toHaveBeenCalledWith('r1', { status: 'done' }));
  });

  it('lists reviews with status and counts', async () => {
    render(<DesignReviewsScreen />);
    expect(await screen.findByText('Home screen')).toBeTruthy();
    expect(screen.getByText(/1 open · 1 comment/)).toBeTruthy();
    expect(screen.getAllByText('In review').length).toBeGreaterThan(0);
  });

  it('drops a pin, opens a thread, replies, resolves and approves', async () => {
    render(<DesignReviewScreen id="d1" />);
    const img = await screen.findByAltText('Home screen');
    await waitFor(() => expect(fake.joinDesignReview).toHaveBeenCalledWith('d1'));
    img.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 });
    fireEvent.click(img, { clientX: 100, clientY: 50 });
    const box = await screen.findByPlaceholderText('What should change here?');
    fireEvent.change(box, { target: { value: 'Bigger button' } });
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
    await waitFor(() => expect(fake.addAnnotation).toHaveBeenCalledWith('d1', { x: 0.5, y: 0.5, body: 'Bigger button' }));

    fireEvent.click(screen.getByLabelText(/Comment 1: Align with the grid/));
    fireEvent.change(await screen.findByPlaceholderText('Reply'), { target: { value: 'Done' } });
    fireEvent.click(screen.getByLabelText('Send reply'));
    await waitFor(() => expect(fake.replyAnnotation).toHaveBeenCalledWith('d1', 'a1', 'Done'));
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    await waitFor(() => expect(fake.resolveAnnotation).toHaveBeenCalledWith('d1', 'a1', true));

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(fake.decideDesignReview).toHaveBeenCalledWith('d1', 'approved', undefined));
  });

  it('applies live annotation events from the room', async () => {
    render(<DesignReviewScreen id="d1" />);
    await screen.findByAltText('Home screen');
    act(() => emit('socket', { event: 'design-review:annotation', payload: { reviewId: 'd1', action: 'created', annotation: { _id: 'a9', versionNumber: 1, x: 0.1, y: 0.1, body: 'From Ana', createdAt: '2026-10-03T00:00:00Z' } } }));
    expect(await screen.findByText('From Ana')).toBeTruthy();
    act(() => emit('socket', { event: 'design-review:annotation', payload: { reviewId: 'd1', action: 'deleted', annotation: { _id: 'a9' } } }));
    await waitFor(() => expect(getQueryData('designReview:d1').annotations.map((a) => a.id)).toEqual(['a1']));
  });
});
