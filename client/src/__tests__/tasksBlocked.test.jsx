// @vitest-environment jsdom
import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const mockApi = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('@services/api', () => ({ default: mockApi }));
vi.mock('../services/api', () => ({ default: mockApi }));
const showToast = vi.hoisted(() => vi.fn());
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast }) }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { _id: 'me' } }) }));

import { useBlockedPrompt } from '../components/tasksComp/BlockedTaskDialog';
import { DependenciesSection, TimeTrackingSection } from '../components/tasksComp/TaskDetailSections';
import TimeReportView from '../components/tasksComp/TimeReportView';

beforeEach(() => {
  Object.values(mockApi).forEach((f) => f.mockReset());
  showToast.mockReset();
  mockApi.get.mockResolvedValue({ data: {} });
});

const task = (over = {}) => ({
  id: 't1', title: 'Ship it', status: 'todo', dependencies: [], timeTracking: null, estimatedHours: null, ...over,
});

function PromptHarness({ onAnswer }) {
  const { ask, dialog } = useBlockedPrompt();
  return (
    <>
      <button type="button" onClick={async () => onAnswer(await ask({ message: 'Blocked', blockers: [{ id: 'b1', title: 'Design', issueKey: 'OR-7', status: 'in_progress' }] }, 'Ship it'))}>complete</button>
      {dialog}
    </>
  );
}

describe('blocked completion dialog', () => {
  it('lists blockers and resolves true on "Complete anyway"', async () => {
    const onAnswer = vi.fn();
    render(<PromptHarness onAnswer={onAnswer} />);
    fireEvent.click(screen.getByText('complete'));
    expect(await screen.findByText('This task is still blocked')).toBeInTheDocument();
    expect(screen.getByTestId('task-blockers')).toHaveTextContent('OR-7 · Design');
    fireEvent.click(screen.getByRole('button', { name: /Complete anyway/ }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(true));
    expect(screen.queryByText('This task is still blocked')).toBeNull();
  });

  it('resolves false when the person keeps it open', async () => {
    const onAnswer = vi.fn();
    render(<PromptHarness onAnswer={onAnswer} />);
    fireEvent.click(screen.getByText('complete'));
    fireEvent.click(await screen.findByRole('button', { name: 'Keep it open' }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false));
  });
});

describe('dependencies', () => {
  it('removes a dependency', async () => {
    mockApi.delete.mockResolvedValue({ data: { dependencies: [] } });
    function Harness() {
      const [t, setT] = useState(task({ dependencies: [{ id: 'd1', title: 'Design', status: 'todo' }] }));
      return <DependenciesSection task={t} canAdd onAdded={(dependencies) => setT((x) => ({ ...x, dependencies }))} />;
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove dependency Design' }));
    await waitFor(() => expect(screen.getByText('No dependencies')).toBeInTheDocument());
    expect(mockApi.delete).toHaveBeenCalledWith('/api/v2/tasks/t1/dependency/d1');
  });

  it('hides remove when the viewer cannot edit', () => {
    render(<DependenciesSection task={task({ dependencies: [{ id: 'd1', title: 'Design', status: 'todo' }] })} />);
    expect(screen.queryByRole('button', { name: /Remove dependency/ })).toBeNull();
  });
});

describe('time tracking', () => {
  it('shows my timer only, other people tracking and a per-person breakdown', async () => {
    mockApi.get.mockResolvedValue({ data: { totalSeconds: 3600, byUser: [
      { userId: 'me', seconds: 1800, running: false, user: { username: 'me' } },
      { userId: 'u2', seconds: 1800, running: true, user: { username: 'ana' } },
    ] } });
    const tt = { totalTime: 3600, sessions: [{ start: new Date().toISOString(), end: null, user: 'u2' }] };
    render(<TimeTrackingSection task={task({ timeTracking: tt })} />);
    expect(screen.getByRole('button', { name: /Start timer/ })).toBeInTheDocument();
    expect(await screen.findByText(/Also tracking: ana/)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Time by person' })).toHaveTextContent('You');
    expect(mockApi.get).toHaveBeenCalledWith('/api/v2/tasks/t1/time');
  });

  it('stops my own running timer', async () => {
    const tt = { totalTime: 0, sessions: [{ start: new Date().toISOString(), end: null, user: 'me' }] };
    mockApi.post.mockResolvedValue({ data: { elapsed: 30, timeTracking: { totalTime: 30, sessions: [] } } });
    const onChange = vi.fn();
    render(<TimeTrackingSection task={task({ timeTracking: tt })} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Stop my timer/ }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ totalTime: 30, sessions: [] }));
    expect(mockApi.post).toHaveBeenCalledWith('/api/v2/tasks/t1/time/stop');
  });

  it('logs time manually and validates the duration', async () => {
    mockApi.post.mockResolvedValue({ data: { timeTracking: { totalTime: 5400, sessions: [] } } });
    const onChange = vi.fn();
    render(<TimeTrackingSection task={task({ timeTracking: { totalTime: 0, sessions: [] } })} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Log time/ }));
    fireEvent.change(screen.getByLabelText('Time spent'), { target: { value: 'later' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/duration/);
    expect(mockApi.post).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Time spent'), { target: { value: '1h 30m' } });
    fireEvent.change(screen.getByLabelText('Time log note'), { target: { value: 'pairing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log' }));
    await waitFor(() => expect(mockApi.post).toHaveBeenCalledWith('/api/v2/tasks/t1/time/log', { seconds: 5400, note: 'pairing' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ totalTime: 5400, sessions: [] }));
  });
});

describe('workspace time report', () => {
  it('loads the report for the chosen period and opens tasks', async () => {
    mockApi.get.mockResolvedValue({ data: {
      totalSeconds: 7200,
      byUser: [{ userId: 'u1', seconds: 7200, tasks: 2, running: true, user: { username: 'ana' } }],
      byTask: [{ taskId: 't9', title: 'Login page', issueKey: 'OR-9', estimatedHours: 1, seconds: 7200 }],
    } });
    const onOpenTask = vi.fn();
    render(<TimeReportView workspaceId="ws1" onOpenTask={onOpenTask} />);
    expect(await screen.findByText('ana')).toBeInTheDocument();
    expect(screen.getAllByText('2h 00m').length).toBeGreaterThan(0);
    expect(screen.getByText('200% of 1h')).toBeInTheDocument();
    const [, opts] = mockApi.get.mock.calls[0];
    expect(mockApi.get.mock.calls[0][0]).toBe('/api/v2/tasks/time/report');
    expect(opts.params.workspaceId).toBe('ws1');
    expect(opts.params.from).toBeTruthy();
    fireEvent.click(screen.getByText('Login page'));
    expect(onOpenTask).toHaveBeenCalledWith('t9');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'All time' })); });
    await waitFor(() => expect(mockApi.get).toHaveBeenCalledTimes(2));
    expect(mockApi.get.mock.calls[1][1].params.from).toBeUndefined();
  });

  it('shows an empty state when nothing was logged', async () => {
    mockApi.get.mockResolvedValue({ data: { totalSeconds: 0, byUser: [], byTask: [] } });
    render(<TimeReportView workspaceId="ws1" />);
    expect(await screen.findByText('No time logged in this period')).toBeInTheDocument();
  });
});
