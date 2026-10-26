// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const mockPost = vi.fn();
vi.mock('@services/api', () => ({ default: { post: (...a) => mockPost(...a), delete: vi.fn(), get: vi.fn(async () => ({ data: {} })) } }));
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { _id: 'me' } }) }));

const { matchTickets, LinkedTicketsSection } = await import('../components/tasksComp/TaskDetailSections');

const tasks = [
  { id: 't1', issueKey: 'OR-12', title: 'Fix login', status: 'todo' },
  { id: 't2', issueKey: 'OR-120', title: 'Payments page', status: 'in_progress' },
  { id: 't3', issueKey: 'OR-7', title: 'Login screen copy', status: 'done' },
  { id: 't4', issueKey: 'OR-8', title: 'Old', status: 'todo', deleted: true },
];

describe('ticket linking', () => {
  it('finds tickets by key first, then title', () => {
    expect(matchTickets('OR-12', tasks).map((t) => t.id)).toEqual(['t1', 't2']);
    expect(matchTickets('12', tasks).map((t) => t.id)).toEqual(['t1']);
    expect(matchTickets('login', tasks).map((t) => t.id)).toEqual(['t3', 't1']);
    expect(matchTickets('login', tasks, ['t1']).map((t) => t.id)).toEqual(['t3']);
    expect(matchTickets('old', tasks)).toEqual([]);
    expect(matchTickets('', tasks)).toEqual([]);
  });

  it('links a ticket and shows it with its key and status', async () => {
    const task = { id: 't1', linkedIssues: [] };
    const onChange = vi.fn();
    mockPost.mockResolvedValue({ data: { task: { linkedIssues: [{ _id: 'l1', task: { _id: 't3', issueKey: 'OR-7', title: 'Login screen copy', status: 'done' }, linkType: 'blocks' }] } } });
    const { rerender } = render(<LinkedTicketsSection task={task} candidates={tasks} canEdit onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("How they're linked"), { target: { value: 'blocks' } });
    fireEvent.change(screen.getByTestId('link-ticket-search'), { target: { value: 'OR-7' } });
    await act(async () => { fireEvent.click(screen.getByRole('option', { name: /OR-7/ })); });
    expect(mockPost).toHaveBeenCalledWith('/api/v2/tasks/t1/links', { linkedTaskId: 't3', linkType: 'blocks' });
    const links = onChange.mock.calls[0][0];
    rerender(<LinkedTicketsSection task={{ ...task, linkedIssues: links }} candidates={tasks} canEdit onChange={onChange} />);
    expect(screen.getByTestId('task-linked-tickets').textContent).toMatch(/Blocks.*OR-7.*Login screen copy/);
  });
});
