// A task's page in the phone, split and wide layouts: completing a blocked task, the repeat
// editor, moving between sprints, removing a dependency, per-person time and logging time.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { create } from 'zustand';

const me = { id: 'me', name: 'Me', username: 'me' };
const task = { id: 't1', title: 'Ship it', description: '', status: 'review', priority: 'medium', due: '2026-10-21T17:00:00.000Z', assigneeIds: ['me'], createdBy: 'me', channelId: null };
const plan = {
  id: 't1', title: 'Ship it', status: 'review', type: 'task', priority: 'medium', parentId: null, due: task.due,
  sprintId: 's1', milestoneId: null, subtasks: [], dependencyIds: ['t2'], links: [],
  time: { totalSeconds: 600, runningSince: null, sessions: 1 }, timeTracking: { totalTime: 600, sessions: [{ start: '2026-01-01T00:00:00Z', end: '2026-01-01T00:10:00Z', user: 'me' }] },
  recurring: null,
};

class Blocked extends Error {
  constructor() {
    super('Blocked');
    this.status = 409;
    this.code = 'TASK_BLOCKED';
    this.data = { code: 'TASK_BLOCKED', blockers: [{ _id: 't2', title: 'Write the API', issueKey: 'OR-2', status: 'in_progress' }] };
  }
}

const fake = {
  task: vi.fn(async () => task),
  tasks: vi.fn(async () => [task, { ...task, id: 't2', title: 'Write the API', status: 'in_progress' }]),
  members: vi.fn(async () => [me, { id: 'u2', name: 'Ana Silva', username: 'ana' }]),
  channels: vi.fn(async () => []),
  planningTask: vi.fn(async () => plan),
  sprints: vi.fn(async () => [
    { id: 's1', name: 'Sprint 1', status: 'active', start: '2026-10-01' },
    { id: 's2', name: 'Sprint 2', status: 'planning', start: '2026-10-15' },
  ]),
  milestones: vi.fn(async () => []),
  taskTime: vi.fn(async () => ({ estimatedHours: 2, totalSeconds: 600, runningSeconds: 0, byUser: [{ userId: 'u2', seconds: 3600, running: true, sessions: 1, user: null }, { userId: 'me', seconds: 600, running: false, sessions: 1 }] })),
  updateTask: vi.fn(),
  setTaskPlanning: vi.fn(async () => ({ ...plan, sprintId: 's2' })),
  setTaskRecurring: vi.fn(async () => ({ ...plan, recurring: { isRecurring: true, pattern: 'weekly', interval: 1, daysOfWeek: [1] } })),
  removeDependency: vi.fn(async () => []),
  logTime: vi.fn(async () => ({ totalTime: 2400, sessions: [{}, {}] })),
};

const mockSession = create(() => ({ user: me, workspaceId: 'w1' }));
vi.mock('../../data/session.js', () => ({ api: () => fake, useSession: mockSession, useWorkspace: () => ({ id: 'w1', role: 'member' }) }));

const { useLayout } = await import('../../app/layout.js');
const { TaskScreen } = await import('./screens.jsx');
const { clearQueries } = await import('../../data/query.js');

const LAYOUTS = { phone: { wide: false, split: false }, split: { wide: false, split: true }, wide: { wide: true, split: true } };

beforeEach(() => {
  cleanup();
  clearQueries();
  vi.clearAllMocks();
});

describe.each(Object.keys(LAYOUTS))('task page (%s layout)', (layout) => {
  beforeEach(() => useLayout.setState(LAYOUTS[layout]));

  it('asks before completing a task with open blockers, then completes it anyway', async () => {
    fake.updateTask.mockRejectedValueOnce(new Blocked()).mockResolvedValueOnce({ ...task, status: 'done' });
    render(<TaskScreen id="t1" />);
    await screen.findByText('Ship it');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Done' })));
    expect(await screen.findByText('Blocked by an open task')).toBeTruthy();
    expect(screen.getByTestId('blockers-list').textContent).toContain('Write the API');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Complete anyway' })));
    expect(fake.updateTask).toHaveBeenLastCalledWith('t1', expect.objectContaining({ status: 'done', ignoreBlockers: true }));
  });

  it('sets a weekly repeat', async () => {
    render(<TaskScreen id="t1" />);
    fireEvent.click(await screen.findByText('Does not repeat'));
    fireEvent.click(screen.getByRole('tab', { name: 'Weekly' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mon' }));
    expect(screen.getByTestId('repeat-summary').textContent).toMatch(/^Weekly on Mon/);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    expect(fake.setTaskRecurring).toHaveBeenCalledWith('t1', expect.objectContaining({ isRecurring: true, pattern: 'weekly', interval: 1, daysOfWeek: [1] }));
  });

  it('moves the task to another sprint', async () => {
    render(<TaskScreen id="t1" />);
    await screen.findByText('Sprint 1');
    fireEvent.click(screen.getByText('Sprint'));
    await act(async () => fireEvent.click(screen.getByText('Sprint 2')));
    expect(fake.setTaskPlanning).toHaveBeenCalledWith('t1', { sprintId: 's2' });
  });

  it('removes a dependency and shows everyone’s time', async () => {
    render(<TaskScreen id="t1" />);
    await act(async () => fireEvent.click(await screen.findByRole('button', { name: 'Remove dependency' })));
    expect(fake.removeDependency).toHaveBeenCalledWith('t1', 't2');
    expect(await screen.findByText('Ana Silva')).toBeTruthy();
    expect(screen.getByText('Timer running')).toBeTruthy();
  });

  it('logs time by hand', async () => {
    render(<TaskScreen id="t1" />);
    fireEvent.click(await screen.findByText('Log time'));
    fireEvent.change(screen.getByLabelText('Hours'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Review' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Log 1h 30m' })));
    await waitFor(() => expect(fake.logTime).toHaveBeenCalledWith('t1', { minutes: 90, note: 'Review' }));
  });
});
