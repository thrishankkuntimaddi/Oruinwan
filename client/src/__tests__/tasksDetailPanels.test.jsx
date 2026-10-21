// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const mockApi = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('@services/api', () => ({ default: mockApi }));
vi.mock('../services/api', () => ({ default: mockApi }));
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../contexts/WorkspaceContext', () => ({ useWorkspace: () => ({ activeWorkspace: { id: 'ws1', role: 'member' } }) }));
vi.mock('../contexts/AIContext', () => ({ useAIContext: () => null }));
vi.mock('../components/tasksComp/AITaskAssist', () => ({ default: () => null }));
vi.mock('../features/integrations/LinkedPullRequests', () => ({ default: () => null }));

import WorkspaceTaskDetailPanel from '../components/tasksComp/WorkspaceTaskDetailPanel';
import ChannelTaskDetail from '../features/messaging/chatWindowComp/tabs/channelTasks/ChannelTaskDetail';
import { mapTask } from '../utils/taskMeta';
import { taskAbilities } from '../utils/taskPermissions';
import { mapChannelTask, taskPerms } from '../features/messaging/chatWindowComp/tabs/channelTasks/channelTaskUtils';

const ME = 'a'.repeat(24);
const raw = {
    _id: 'b'.repeat(24), title: 'Launch page', status: 'todo', priority: 'high', createdBy: { _id: ME, username: 'me' },
    assignedTo: [{ _id: ME, username: 'me' }], channel: { _id: 'c'.repeat(24), name: 'web' }, workspace: 'ws1',
    subtasks: [{ _id: 'd'.repeat(24), title: 'Copy', status: 'todo', assignedTo: [{ _id: ME, username: 'me' }] }],
    dependencies: [], timeTracking: { totalTime: 0, sessions: [] },
    recurring: { isRecurring: true, pattern: 'weekly', interval: 1, daysOfWeek: [1] }, milestoneId: 'm1',
};
const milestones = [{ id: 'm1', name: 'Beta', status: 'in_progress' }];

beforeEach(() => {
    Object.values(mockApi).forEach((f) => f.mockReset());
    mockApi.get.mockResolvedValue({ data: { activities: [] } });
});

/** Both panels must offer the same task sections. */
const SECTIONS = ['task-subtasks', 'task-dependencies', 'task-time', 'task-repeat', 'task-milestone'];

describe('task detail panels are consistent', () => {
    it('Tasks page panel shows every section and adds a child issue', async () => {
        const task = mapTask(raw);
        const onFetch = vi.fn().mockResolvedValue(null);
        mockApi.post.mockResolvedValue({ data: { subtask: {} } });
        render(<WorkspaceTaskDetailPanel task={task} allTasks={[task]} milestones={milestones}
            can={taskAbilities(task, { userId: ME, role: 'member' })}
            onClose={() => {}} onUpdate={vi.fn()} onStatusChange={vi.fn()} onDelete={vi.fn()} onFetch={onFetch} onPatchLocal={vi.fn()} />);
        SECTIONS.forEach((id) => expect(screen.getByTestId(id)).toBeInTheDocument());
        expect(screen.getByTestId('repeat-badge')).toBeInTheDocument();
        expect(screen.getByLabelText('Milestone')).toHaveValue('m1');

        fireEvent.click(screen.getByText('+ Add'));
        fireEvent.change(screen.getByLabelText('Child issue title'), { target: { value: 'Images' } });
        fireEvent.click(within(screen.getByTestId('task-subtasks')).getByRole('button', { name: 'Add' }));
        await waitFor(() => expect(mockApi.post).toHaveBeenCalledWith(`/api/v2/tasks/${raw._id}/subtasks`, { title: 'Images', priority: 'high', assignedTo: [ME] }));
        await waitFor(() => expect(onFetch).toHaveBeenCalledWith(raw._id));
    });

    it('channel panel shows the same sections', () => {
        const task = mapChannelTask(raw);
        render(<ChannelTaskDetail task={task} perms={taskPerms(task, ME, false)} members={[]} currentUserId={ME} isManager={false}
            onClose={() => {}} onUpdate={vi.fn()} onDelete={vi.fn()} onRequestBlock={vi.fn()} onToggleSubtask={vi.fn()} onAddSubtask={vi.fn()}
            milestones={milestones} boardTasks={[task]} onPatchLocal={vi.fn()} />);
        // Channel panel keeps its own child-issue list (data-testid="channel-task-subtask").
        expect(screen.getAllByTestId('channel-task-subtask')).toHaveLength(1);
        SECTIONS.filter((id) => id !== 'task-subtasks').forEach((id) => expect(screen.getByTestId(id)).toBeInTheDocument());
        expect(screen.getByTestId('repeat-badge')).toBeInTheDocument();
    });
});
