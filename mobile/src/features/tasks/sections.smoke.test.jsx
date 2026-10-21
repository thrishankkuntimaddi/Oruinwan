// Where things live on phones and tablets, matching the web: the roadmap is a section of the
// Notes tab, design reviews and the time report are Planning views in Tasks, Tasks has a Trash
// view, and note types use the web's words.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { create } from 'zustand';

const me = { id: 'me', name: 'Me', username: 'me' };
const roadmapItem = {
  id: 'r1', title: 'Self-serve onboarding', status: 'in_progress', start: '2026-10-01', end: '2026-12-15', quarter: '2026-Q4',
  color: 'accent', order: 0, owner: null, taskIds: [], milestoneIds: [], canEdit: true, progress: { percent: 40 },
};
const review = {
  id: 'd1', title: 'Home screen', status: 'open', versionNumber: 1, createdBy: 'u1', reviewers: [], annotationCounts: { total: 0, open: 0 },
  file: { kind: 'image', name: 'home.png' }, updatedAt: '2026-10-01T00:00:00Z',
};

const fake = {
  members: vi.fn(async () => [me]),
  notes: vi.fn(async () => [{ id: 'n1', title: 'Spec', type: 'documentation', content: '', ownerId: 'me', pinned: true, archived: false, updatedAt: '2026-10-01T00:00:00Z' }]),
  roadmap: vi.fn(async () => ({ items: [roadmapItem], canCreate: false })),
  tasks: vi.fn(async () => []),
  trashedTasks: vi.fn(async () => [{ id: 't9', title: 'Old plan', status: 'todo', priority: 'medium', issueKey: null, deletedAt: null }]),
  restoreTask: vi.fn(async () => {}),
  planningTasks: vi.fn(async () => []),
  sprints: vi.fn(async () => []),
  milestones: vi.fn(async () => []),
  timeReport: vi.fn(async () => ({
    totalSeconds: 5400,
    byUser: [{ userId: 'me', seconds: 5400, tasks: 1, running: false, user: me }],
    byTask: [{ taskId: 't1', title: 'Ship it', issueKey: 'OR-1', estimatedHours: 2, seconds: 5400 }],
  })),
  designReviews: vi.fn(async () => [review]),
};

const mockSession = create(() => ({ user: me, workspaceId: 'w1', server: 'https://api.example', workspaces: [{ id: 'w1', role: 'member' }] }));
vi.mock('../../data/session.js', () => ({ api: () => fake, useSession: mockSession, useWorkspace: () => ({ id: 'w1', name: 'Acme', role: 'member' }) }));

const { useLayout } = await import('../../app/layout.js');
const { useNav } = await import('../../app/nav.js');
const { NotesScreen } = await import('../notes/screens.jsx');
const { TasksScreen, VIEWS } = await import('./screens.jsx');
const { PlanningScreen, PLANNING_VIEWS } = await import('./PlanningScreen.jsx');
const { reportRange, reportRows } = await import('./planning.js');
const { openTarget } = await import('../home/openTarget.js');
const { NOTE_TYPES, NOTE_TYPE_OPTIONS } = await import('../../data/constants.js');
const { clearQueries } = await import('../../data/query.js');
const { prefs } = await import('../../native/storage.js');

beforeEach(() => {
  cleanup();
  clearQueries();
  vi.clearAllMocks();
  useNav.getState().resetAll();
  useLayout.setState({ kind: 'phone', wide: false, split: false });
  prefs.set('notes.section', 'notes');
  prefs.set('tasks.view', 'mine');
  prefs.set('tasks.planning', 'sprints');
});

describe('Notes tab: Notes · Roadmap', () => {
  it('switches to the roadmap and opens items in the Notes stack', async () => {
    useNav.getState().setTab('notes');
    render(<NotesScreen />);
    expect(await screen.findByText('Spec')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Starred' })).toBeTruthy();
    // "documentation" notes read as a Document, like on the web.
    expect(screen.getByText('Document')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Roadmap' }));
    fireEvent.click(await screen.findByText('Self-serve onboarding'));
    expect(useNav.getState().tab).toBe('notes');
    expect(useNav.getState().stacks.notes.at(-1)).toMatchObject({ name: 'roadmapItem', params: { id: 'r1' } });
    expect(prefs.get('notes.section')).toBe('roadmap');
  });
});

describe('Tasks tab', () => {
  it('uses the web view names and lists the Trash', async () => {
    expect(VIEWS.map((v) => v.label)).toEqual(['My tasks', 'Incoming', 'Given', 'All tasks', 'Completed', 'Trash']);
    render(<TasksScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Trash' }));
    fireEvent.click(await screen.findByText('Old plan'));
    fireEvent.click(await screen.findByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(fake.restoreTask).toHaveBeenCalledWith('t9'));
  });

  it('Planning has the time report and design reviews', async () => {
    expect(PLANNING_VIEWS.map((v) => v.label)).toEqual(['Sprints', 'Milestones', 'Timeline', 'Workload', 'Time report', 'Design reviews', 'Templates']);
    useNav.getState().setTab('tasks');
    render(<PlanningScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Time report' }));
    expect(await screen.findByText('Ship it')).toBeTruthy();
    expect(screen.getAllByText('1h 30m').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Design reviews' }));
    fireEvent.click(await screen.findByText('Home screen'));
    expect(useNav.getState().stacks.tasks.at(-1)).toMatchObject({ name: 'designReview', params: { id: 'd1' } });
  });

  it('a design review notification opens in the Tasks tab', () => {
    useNav.getState().setTab('home');
    openTarget({ kind: 'designReview', id: 'd2' });
    expect(useNav.getState().tab).toBe('tasks');
    expect(useNav.getState().stacks.tasks.at(-1)).toMatchObject({ name: 'designReview', params: { id: 'd2' } });
  });
});

describe('time report periods', () => {
  it('starts the week on Monday and the month on the 1st', () => {
    const now = new Date(2026, 9, 21, 15, 0); // Wednesday 21 Oct 2026
    expect(new Date(reportRange('week', now).from).getDate()).toBe(19);
    expect(new Date(reportRange('month', now).from).getDate()).toBe(1);
    expect(new Date(reportRange('7d', now).from).getDate()).toBe(15);
    expect(reportRange('all', now)).toEqual({});
  });

  it('sorts rows and adds their share', () => {
    expect(reportRows([{ seconds: 60 }, { seconds: 180 }], 240).map((r) => r.share)).toEqual([75, 25]);
    expect(reportRows(null)).toEqual([]);
  });
});

describe('note types match the web', () => {
  it('uses the labels of client noteTypes.js', () => {
    const src = readFileSync(resolve(process.cwd(), '../client/src/pages/SidebarComp/notesComponents/noteTypes.js'), 'utf8');
    const web = Object.fromEntries([...src.matchAll(/(\w+): \{ Icon: \w+, label: '([^']+)' \}/g)].map((m) => [m[1], m[2]]));
    expect(Object.keys(web).length).toBeGreaterThan(5);
    expect(NOTE_TYPES).toEqual(web);
    expect(NOTE_TYPE_OPTIONS.map(([v]) => v)).not.toContain('documentation');
  });
});
