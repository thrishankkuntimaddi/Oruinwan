// @vitest-environment jsdom
import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const mockApi = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('@services/api', () => ({ default: mockApi }));
vi.mock('../services/api', () => ({ default: mockApi }));
const showToast = vi.hoisted(() => vi.fn());
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast }) }));

import RepeatPicker, { RepeatBadge } from '../components/tasksComp/RepeatPicker';
import { SubtasksSection, DependenciesSection, TimeTrackingSection, RepeatSection, MilestoneSection } from '../components/tasksComp/TaskDetailSections';
import TaskTemplatesDialog, { templateFormToBody } from '../components/tasksComp/TaskTemplatesDialog';
import MilestonesView, { milestoneFormToBody, MilestoneProgressStrip } from '../components/tasksComp/MilestonesView';
import { milestoneProgress, templateToTaskDraft, useMilestones } from '../components/tasksComp/useTaskPlanning';
import { EMPTY_RULE } from '../utils/taskRecurrence';
import { mapTask } from '../utils/taskMeta';

beforeEach(() => {
    Object.values(mockApi).forEach((f) => f.mockReset());
    showToast.mockReset();
});

const task = (over = {}) => ({
    id: 't1', title: 'Ship it', status: 'todo', priority: 'medium', dueDate: '2026-10-21T00:00:00.000Z',
    subtasks: [], dependencies: [], assignees: [], assigneeIds: [], timeTracking: null, recurring: null, milestoneId: null, ...over,
});

describe('planning helpers', () => {
    it('counts milestone progress from linked tasks, falling back to server counts', () => {
        const tasks = [
            { id: 'a', milestoneId: 'm1', status: 'done' },
            { id: 'b', milestoneId: 'm1', status: 'todo' },
            { id: 'c', milestoneId: 'm1', status: 'cancelled' },
            { id: 'd', milestoneId: 'm2', status: 'done' },
            { id: 'e', milestoneId: 'm1', status: 'done', deleted: true },
        ];
        expect(milestoneProgress({ _id: 'm1' }, tasks)).toMatchObject({ total: 2, done: 1, pct: 50 });
        expect(milestoneProgress({ _id: 'm3', taskCounts: { total: 4, done: 3 } }, tasks)).toMatchObject({ total: 4, done: 3, pct: 75 });
        expect(milestoneProgress({ _id: 'm4' }, tasks)).toMatchObject({ total: 0, pct: 0 });
    });

    it('turns templates and forms into request bodies', () => {
        expect(templateToTaskDraft({ _id: 'x', name: 'Bug', title: '', priority: 'high', subtaskTitles: ['Repro', ' ', 'Fix'], tags: ['bug'] }))
            .toEqual({ title: 'Bug', description: '', priority: 'high', tags: ['bug'], subtaskTitles: ['Repro', 'Fix'], templateName: 'Bug' });
        expect(templateFormToBody({ name: ' Release ', title: 'Release v', description: 'd', priority: 'nope', tags: 'a, b,', subtasks: 'one\n\n two ' }))
            .toEqual({ name: 'Release', title: 'Release v', description: 'd', priority: 'medium', tags: ['a', 'b'], subtaskTitles: ['one', 'two'] });
        expect(milestoneFormToBody({ name: ' Beta ', description: '', startDate: '', dueDate: '2026-12-01', status: 'at_risk' }))
            .toEqual({ name: 'Beta', description: '', startDate: null, dueDate: '2026-12-01T00:00:00.000Z', status: 'at_risk' });
    });

    it('mapTask keeps milestone and repeat fields', () => {
        const t = mapTask({ _id: 'abc', title: 'x', milestoneId: { _id: 'm1' }, recurring: { isRecurring: true, pattern: 'daily', interval: 1 } });
        expect(t.milestoneId).toBe('m1');
        expect(t.recurring.pattern).toBe('daily');
        expect(mapTask({ _id: 'abc', recurring: { isRecurring: false } }).recurring).toBeNull();
    });
});

describe('RepeatPicker', () => {
    function Harness({ onRule }) {
        const [rule, setRule] = useState({ ...EMPTY_RULE });
        return <RepeatPicker value={rule} onChange={(r) => { setRule(r); onRule(r); }} dueDate="2026-10-21T00:00:00.000Z" />;
    }

    it('weekly starts on the due date weekday, toggles days and shows a summary', () => {
        const onRule = vi.fn();
        render(<Harness onRule={onRule} />);
        expect(screen.queryByTestId('repeat-summary')).toBeNull();
        fireEvent.change(screen.getByLabelText('Repeat'), { target: { value: 'weekly' } });
        expect(onRule).toHaveBeenLastCalledWith(expect.objectContaining({ frequency: 'weekly', daysOfWeek: [3] }));
        fireEvent.click(screen.getByRole('button', { name: 'Mon' }));
        expect(screen.getByTestId('repeat-summary')).toHaveTextContent('Weekly on Mon, Wed');
        fireEvent.change(screen.getByLabelText('Repeat end date'), { target: { value: '2026-12-31' } });
        expect(onRule).toHaveBeenLastCalledWith(expect.objectContaining({ endDate: '2026-12-31' }));
    });

    it('custom shows interval and unit', () => {
        render(<Harness onRule={() => {}} />);
        fireEvent.change(screen.getByLabelText('Repeat'), { target: { value: 'custom' } });
        fireEvent.change(screen.getByLabelText('Repeat interval'), { target: { value: '3' } });
        fireEvent.change(screen.getByLabelText('Repeat unit'), { target: { value: 'week' } });
        expect(screen.getByTestId('repeat-summary')).toHaveTextContent('Every 3 weeks');
    });

    it('RepeatBadge only renders for repeating tasks', () => {
        const { rerender } = render(<RepeatBadge task={task()} />);
        expect(screen.queryByTestId('repeat-badge')).toBeNull();
        rerender(<RepeatBadge task={task({ recurring: { isRecurring: true, pattern: 'daily', interval: 1 } })} />);
        expect(screen.getByTestId('repeat-badge')).toHaveTextContent('Every day');
    });
});

describe('task detail sections', () => {
    it('adds and ticks off child issues', async () => {
        const onAdd = vi.fn().mockResolvedValue(true);
        const onToggle = vi.fn();
        const t = task({ subtasks: [{ id: 's1', title: 'Write tests', status: 'todo', assignees: [] }, { id: 's2', title: 'Done one', status: 'done', assignees: [] }] });
        render(<SubtasksSection task={t} canAdd canToggle={(s) => s.id === 's1'} onAdd={onAdd} onToggle={onToggle} />);
        expect(screen.getByText(/Child issues \(1\/2 done\)/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('checkbox', { name: 'Write tests' }));
        expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }));
        expect(screen.getByRole('checkbox', { name: 'Done one' })).toBeDisabled();
        fireEvent.click(screen.getByText('+ Add'));
        fireEvent.change(screen.getByLabelText('Child issue title'), { target: { value: 'New child' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add' }));
        await waitFor(() => expect(onAdd).toHaveBeenCalledWith('New child'));
        await waitFor(() => expect(screen.queryByLabelText('Child issue title')).toBeNull());
    });

    it('adds a dependency through the API', async () => {
        mockApi.post.mockResolvedValue({ data: { dependencies: ['t2'] } });
        const onAdded = vi.fn();
        const others = [{ id: 't2', title: 'Design', status: 'in_progress' }, { id: 't1', title: 'Ship it', status: 'todo' }];
        render(<DependenciesSection task={task()} candidates={others} canAdd onAdded={onAdded} />);
        const select = screen.getByLabelText('Task this depends on');
        expect(within(select).queryByText('Ship it')).toBeNull(); // not itself
        fireEvent.change(select, { target: { value: 't2' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add' }));
        await waitFor(() => expect(onAdded).toHaveBeenCalledWith([{ id: 't2', title: 'Design', status: 'in_progress' }]));
        expect(mockApi.post).toHaveBeenCalledWith('/api/v2/tasks/t1/dependency', { dependencyTaskId: 't2' });
    });

    it('starts the timer', async () => {
        const tt = { totalTime: 60, sessions: [{ start: new Date().toISOString(), end: null }] };
        mockApi.post.mockResolvedValue({ data: { timeTracking: tt } });
        const onChange = vi.fn();
        render(<TimeTrackingSection task={task({ timeTracking: { totalTime: 60, sessions: [] } })} onChange={onChange} />);
        expect(screen.getByText('1m 0s')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Start timer/ }));
        await waitFor(() => expect(onChange).toHaveBeenCalledWith(tt));
        expect(mockApi.post).toHaveBeenCalledWith('/api/v2/tasks/t1/time/start');
    });

    it('saves a repeat schedule and warns when the server drops it', async () => {
        const onSave = vi.fn().mockResolvedValue({ id: 't1', recurring: null });
        render(<RepeatSection task={task()} canEdit onSave={onSave} />);
        fireEvent.change(screen.getByLabelText('Repeat'), { target: { value: 'daily' } });
        fireEvent.click(screen.getByRole('button', { name: /Save repeat/ }));
        await waitFor(() => expect(onSave).toHaveBeenCalledWith({ recurring: expect.objectContaining({ isRecurring: true, pattern: 'daily', nextDue: '2026-10-22T00:00:00.000Z' }) }));
        expect(await screen.findByRole('status')).toHaveTextContent(/didn’t keep this repeat schedule/);
    });

    it('links a milestone', async () => {
        const onSave = vi.fn().mockResolvedValue({ id: 't1', milestoneId: 'm1' });
        render(<MilestoneSection task={task()} milestones={[{ id: 'm1', name: 'Beta', status: 'in_progress' }]} canEdit onSave={onSave} />);
        fireEvent.change(screen.getByLabelText('Milestone'), { target: { value: 'm1' } });
        await waitFor(() => expect(onSave).toHaveBeenCalledWith({ milestoneId: 'm1' }));
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('hides the milestone picker when the workspace has none', () => {
        const { container } = render(<MilestoneSection task={task()} milestones={[]} canEdit onSave={vi.fn()} />);
        expect(container).toBeEmptyDOMElement();
    });
});

describe('TaskTemplatesDialog', () => {
    it('lists templates, creates one and uses one', async () => {
        mockApi.get.mockResolvedValue({ data: { templates: [{ _id: 'tp1', name: 'Bug report', title: 'Bug: ', priority: 'high', subtaskTitles: ['Repro'], tags: [] }] } });
        mockApi.post.mockResolvedValue({ data: { template: { _id: 'tp2', name: 'Weekly review', subtaskTitles: [], tags: [] } } });
        const onUse = vi.fn();
        render(<TaskTemplatesDialog open workspaceId="ws1" onClose={() => {}} onUse={onUse} />);
        expect(await screen.findByText('Bug report')).toBeInTheDocument();
        expect(mockApi.get).toHaveBeenCalledWith('/api/task-templates', { params: { workspaceId: 'ws1' } });
        expect(screen.getByText(/1 child issue$/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'New template' }));
        fireEvent.change(screen.getByLabelText('Template name'), { target: { value: 'Weekly review' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create template' }));
        await waitFor(() => expect(mockApi.post).toHaveBeenCalledWith('/api/task-templates', expect.objectContaining({ name: 'Weekly review', workspaceId: 'ws1' })));
        expect(await screen.findByText('Weekly review')).toBeInTheDocument();

        fireEvent.click(screen.getAllByRole('button', { name: 'Use' })[1]);
        expect(onUse).toHaveBeenCalledWith(expect.objectContaining({ id: 'tp1', name: 'Bug report' }));
    });

    it('shows an empty state with a create action', async () => {
        mockApi.get.mockResolvedValue({ data: { templates: [] } });
        render(<TaskTemplatesDialog open workspaceId="ws1" onClose={() => {}} />);
        expect(await screen.findByText('No templates yet')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Create a template' })).toBeInTheDocument();
    });
});

describe('MilestonesView', () => {
    function Harness({ tasks, onLink }) {
        const planning = useMilestones('ws1', () => {});
        return <MilestonesView planning={planning} tasks={tasks} onLink={onLink} onOpenTask={() => {}} />;
    }

    it('shows progress, links tasks and creates milestones', async () => {
        mockApi.get.mockResolvedValue({ data: { milestones: [{ _id: 'm1', name: 'Beta launch', status: 'in_progress', dueDate: '2099-01-01T00:00:00.000Z' }] } });
        mockApi.post.mockResolvedValue({ data: { milestone: { _id: 'm2', name: 'GA', status: 'not_started' } } });
        const onLink = vi.fn().mockResolvedValue({});
        const tasks = [
            { id: 'a', title: 'API', status: 'done', milestoneId: 'm1' },
            { id: 'b', title: 'UI', status: 'todo', milestoneId: 'm1' },
            { id: 'c', title: 'Docs', status: 'todo', milestoneId: null },
        ];
        render(<Harness tasks={tasks} onLink={onLink} />);
        expect(await screen.findByText('Beta launch')).toBeInTheDocument();
        expect(screen.getByText('1/2 done · 50%')).toBeInTheDocument();
        expect(screen.getByRole('meter', { name: 'Beta launch progress' })).toHaveAttribute('aria-valuenow', '50');

        fireEvent.click(screen.getByRole('button', { name: 'Show tasks' }));
        fireEvent.change(screen.getByLabelText('Add a task to Beta launch'), { target: { value: 'c' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add' }));
        await waitFor(() => expect(onLink).toHaveBeenCalledWith('c', 'm1'));
        fireEvent.click(screen.getByRole('button', { name: 'Remove UI from milestone' }));
        await waitFor(() => expect(onLink).toHaveBeenCalledWith('b', null));

        fireEvent.click(screen.getByRole('button', { name: 'New milestone' }));
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'GA' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create milestone' }));
        await waitFor(() => expect(mockApi.post).toHaveBeenCalledWith('/api/milestones', expect.objectContaining({ name: 'GA', workspaceId: 'ws1' })));
        expect(await screen.findByText('GA')).toBeInTheDocument();
    });

    it('progress strip lists only milestones with tasks in the list', () => {
        render(<MilestoneProgressStrip milestones={[{ id: 'm1', name: 'Beta' }, { id: 'm2', name: 'Empty' }]} tasks={[{ id: 'a', status: 'done', milestoneId: 'm1' }]} />);
        expect(screen.getByTestId('milestone-strip')).toHaveTextContent('Beta');
        expect(screen.queryByText('Empty')).toBeNull();
    });
});
