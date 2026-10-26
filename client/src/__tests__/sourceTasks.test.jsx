// @vitest-environment jsdom
// "Make a task" from a note or a file: the drafts, the menu entries and the task's source row.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockPost = vi.fn();
const mockGet = vi.fn();
vi.mock('@services/api', () => ({ default: { post: (...a) => mockPost(...a), get: (...a) => mockGet(...a), delete: vi.fn() } }));
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { _id: 'me' } }) }));

const mockNotes = { list: [], setNoteTask: vi.fn() };
vi.mock('../contexts/NotesContext', () => ({
  noteContentToText: (c) => String(c || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  useNotes: () => ({
    allNotes: mockNotes.list, activeNotes: mockNotes.list, archivedNotes: [],
    addNote: vi.fn(), updateNote: vi.fn(), deleteNote: vi.fn(),
    searchQuery: '', setSearchQuery: vi.fn(), togglePin: vi.fn(), toggleArchive: vi.fn(),
    matchesSearch: () => true, getNoteAccess: () => ({ isOwner: true }), setNoteTask: mockNotes.setNoteTask,
  }),
}));
vi.mock('../hooks/useWorkspaceFeatures', () => ({ useWorkspaceFeatures: () => ({ tasks: true }) }));

const { noteTaskDraft, fileTaskTitle, fileTaskDraft, sourceTaskEndpoint, sourceTaskMenuLabel } = await import('../utils/sourceTask');
const { default: FileTaskButton } = await import('../components/tasksComp/FileTaskButton');
const { default: TaskSourceRow, taskSource } = await import('../components/tasksComp/TaskSourceRow');
const { fileTaskSource } = await import('../pages/SidebarComp/FileLibrary');
const { default: NotesPanel } = await import('../components/layout/panels/NotesPanel');

const WS = 'ws1';

beforeEach(() => {
  mockPost.mockReset();
  mockGet.mockReset().mockResolvedValue({ data: {} });
  mockNotes.setNoteTask.mockReset();
  mockNotes.list = [];
  window.history.pushState({}, '', '/');
});

describe('drafts', () => {
  it('a note task gets the note title and the start of its text, then "From note"', () => {
    expect(noteTaskDraft('Launch plan', 'Ship the beta')).toEqual({ title: 'Launch plan', description: 'Ship the beta\n\nFrom note: Launch plan' });
    const long = noteTaskDraft('Long', 'x'.repeat(900));
    expect(long.description.startsWith(`${'x'.repeat(500)}…`)).toBe(true);
    expect(noteTaskDraft('', '')).toEqual({ title: 'Untitled', description: 'From note: Untitled' });
  });

  it('a file task is named after the file without its extension', () => {
    expect(fileTaskTitle('budget-2026.xlsx')).toBe('budget-2026');
    expect(fileTaskTitle('archive.tar.gz')).toBe('archive.tar');
    expect(fileTaskTitle('README')).toBe('README');
    expect(fileTaskDraft('spec.pdf')).toEqual({ title: 'spec', description: 'From file: spec.pdf' });
  });

  it('endpoints and labels', () => {
    expect(sourceTaskEndpoint('note', 'n1')).toBe('/api/v2/notes/n1/task');
    expect(sourceTaskEndpoint('file', 'f1')).toBe('/api/v2/files/f1/task');
    expect(sourceTaskEndpoint('message', 'm1')).toBe('/api/v2/messages/m1/convert-task');
    expect(sourceTaskMenuLabel(null)).toBe('Make a task');
    expect(sourceTaskMenuLabel('t1')).toBe('Open task');
    expect(fileTaskSource({ source: 'library', fileId: 'f1' })).toEqual({ kind: 'file', sourceId: 'f1' });
    expect(fileTaskSource({ source: 'channel', messageId: 'm1' })).toEqual({ kind: 'message', sourceId: 'm1' });
  });
});

describe('notes list menu', () => {
  const renderPanel = () => render(
    <MemoryRouter initialEntries={[`/workspace/${WS}/notes`]}>
      <Routes><Route path="/workspace/:workspaceId/notes" element={<NotesPanel title="Notes" />} /></Routes>
    </MemoryRouter>,
  );
  const openMenu = () => fireEvent.contextMenu(screen.getByText('Launch plan'));

  it('"Make a task" opens the task form pre-filled from the note and links the note', async () => {
    mockNotes.list = [{ id: 'n1', title: 'Launch plan', content: '<p>Ship the beta</p>', tags: [], workspace: WS, linkedTaskId: null }];
    mockPost.mockResolvedValue({ data: { task: { _id: 't9', title: 'Launch plan' } } });
    renderPanel();
    openMenu();
    fireEvent.click(screen.getByTestId('note-menu-task'));
    expect(screen.getByLabelText('Title').value).toBe('Launch plan');
    expect(screen.getByLabelText('Description').value).toBe('Ship the beta\n\nFrom note: Launch plan');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Make task' })); });
    expect(mockPost).toHaveBeenCalledWith('/api/v2/notes/n1/task', expect.objectContaining({ title: 'Launch plan', priority: 'medium' }));
    expect(mockNotes.setNoteTask).toHaveBeenCalledWith('n1', 't9');
  });

  it('a note that is already a task offers "Open task" and opens it', () => {
    mockNotes.list = [{ id: 'n1', title: 'Launch plan', content: '', tags: [], workspace: WS, linkedTaskId: 't1' }];
    renderPanel();
    openMenu();
    const item = screen.getByTestId('note-menu-task');
    expect(item.textContent).toMatch('Open task');
    fireEvent.click(item);
    expect(window.location.pathname).toBe(`/workspace/${WS}/tasks/t1`);
    expect(mockPost).not.toHaveBeenCalled();
  });
});

describe('file "Make a task"', () => {
  it('makes a task from a library file, then offers "Open task"', async () => {
    mockPost.mockResolvedValue({ data: { task: { _id: 't5' } } });
    const onLinked = vi.fn();
    render(<FileTaskButton kind="file" sourceId="f1" name="budget.xlsx" workspaceId={WS} variant="button" onLinked={onLinked} />);
    fireEvent.click(screen.getByRole('button', { name: /Make a task/ }));
    expect(screen.getByLabelText('Title').value).toBe('budget');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Make task' })); });
    expect(mockPost).toHaveBeenCalledWith('/api/v2/files/f1/task', expect.objectContaining({ title: 'budget', description: 'From file: budget.xlsx' }));
    expect(onLinked).toHaveBeenCalledWith('t5');
    expect(screen.getByTestId('file-task-button').textContent).toMatch('Open task');
  });

  it('a second attempt opens the task that already exists', async () => {
    mockPost.mockRejectedValue({ response: { status: 409, data: { message: 'File is already a task', taskId: 't7' } } });
    render(<FileTaskButton kind="file" sourceId="f1" name="spec.pdf" workspaceId={WS} />);
    fireEvent.click(screen.getByTestId('file-task-button'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Make task' })); });
    expect(window.location.pathname).toBe(`/workspace/${WS}/tasks/t7`);
  });

  it('a chat file becomes a task through its message', async () => {
    mockPost.mockResolvedValue({ data: { task: { _id: 't6' } } });
    render(<FileTaskButton kind="message" sourceId="m1" name="photo.png" workspaceId={WS} />);
    fireEvent.click(screen.getByTestId('file-task-button'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Make task' })); });
    expect(mockPost).toHaveBeenCalledWith('/api/v2/messages/m1/convert-task', expect.objectContaining({ title: 'photo' }));
  });
});

describe('task source row', () => {
  it('shows "From note: <title>" and opens the note', async () => {
    mockGet.mockResolvedValue({ data: { note: { title: 'Launch plan' } } });
    render(<TaskSourceRow task={{ id: 't1', linkedNote: 'n1', workspace: WS }} />);
    expect(mockGet).toHaveBeenCalledWith('/api/v2/notes/n1');
    const link = await screen.findByRole('button', { name: 'Launch plan' });
    expect(screen.getByTestId('task-source-row').textContent).toMatch('From note:');
    fireEvent.click(link);
    expect(window.location.pathname).toBe(`/workspace/${WS}/notes/n1`);
  });

  it('shows "From file" and hides the name from people who cannot open it', async () => {
    mockGet.mockRejectedValue({ response: { status: 404 } });
    render(<TaskSourceRow task={{ id: 't1', linkedFile: 'f1', workspace: WS }} />);
    await waitFor(() => expect(screen.getByTestId('task-source-row').textContent).toMatch(/From file:.*can’t open this file/));
  });

  it('tasks without a note or file have no source', () => {
    expect(taskSource({ linkedMessage: 'm1' })).toBe(null);
    expect(taskSource({ linkedNote: { _id: 'n1' } })).toEqual({ kind: 'note', id: 'n1' });
  });
});
