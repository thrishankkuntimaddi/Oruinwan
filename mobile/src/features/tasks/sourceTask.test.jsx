// "Make a task" from a note or a file on the phone: the menu entries, the pre-filled sheet,
// "Open task" once linked, and the task's "From note / From file" row.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { create } from 'zustand';

const me = { id: 'me', name: 'Me', username: 'me' };
const note = { id: 'n1', title: 'Launch plan', type: 'note', content: '<p>Ship the beta</p>', ownerId: 'me', sharedWith: [], visibility: 'private', updatedAt: new Date().toISOString(), linkedTaskId: null };
const file = { id: 'f1', name: 'budget.xlsx', size: 10, kind: 'sheet', version: 1, tags: [], permissions: [], access: 'workspace', owner: 'me', linkedTaskId: null };

const fake = {
  kind: 'live',
  note: vi.fn(async () => note),
  notes: vi.fn(async () => [note]),
  members: vi.fn(async () => [me]),
  updateNote: vi.fn(async (id, patch) => ({ ...note, ...patch })),
  fileDetail: vi.fn(async () => file),
  fileVersions: vi.fn(async () => ({ current: 1, versions: [] })),
  fileComments: vi.fn(async () => []),
  // Like the server: the note / file keeps the new task's id.
  makeTaskFrom: vi.fn(async (kind) => {
    (kind === 'note' ? note : file).linkedTaskId = 't9';
    return { id: 't9', title: 'x', status: 'todo' };
  }),
};

vi.mock('../../data/live/realtime.js', () => ({ realtimeSocket: () => null }));
vi.mock('../../data/session.js', () => ({
  api: () => fake,
  useSession: create(() => ({ user: me, workspaceId: 'w1' })),
  useWorkspace: () => ({ id: 'w1', role: 'member' }),
}));

const { NoteScreen } = await import('../notes/screens.jsx');
const { FileScreen } = await import('../files/FileScreen.jsx');
const { TaskSourceRow, taskSource } = await import('./TaskSource.jsx');
const { noteTaskInitial, fileTaskInitial, fileTaskTitle, sourceTaskAction } = await import('./sourceTask.js');
const { clearQueries } = await import('../../data/query.js');
const { useNav } = await import('../../app/nav.js');

beforeEach(() => {
  cleanup();
  clearQueries?.();
  vi.clearAllMocks();
  note.linkedTaskId = null;
  file.linkedTaskId = null;
  useNav.getState().resetAll();
});

const lastScreen = () => {
  const { stacks } = useNav.getState();
  return Object.values(stacks).flat().at(-1);
};

describe('drafts', () => {
  it('pre-fills from the note and the file', () => {
    expect(noteTaskInitial(note, '<p>Ship the beta</p>')).toEqual({ title: 'Launch plan', description: 'Ship the beta\n\nFrom note: Launch plan' });
    expect(noteTaskInitial({ title: '' }, '')).toEqual({ title: 'Untitled', description: 'From note: Untitled' });
    expect(noteTaskInitial(note, `<p>${'a'.repeat(800)}</p>`).description.startsWith(`${'a'.repeat(500)}…`)).toBe(true);
    expect(fileTaskTitle('spec.final.pdf')).toBe('spec.final');
    expect(fileTaskInitial(file)).toEqual({ title: 'budget', description: 'From file: budget.xlsx' });
    expect(sourceTaskAction(null)).toBe('Make a task');
    expect(sourceTaskAction('t1')).toBe('Open task');
  });
});

describe('note menu', () => {
  it('"Make a task" opens the sheet pre-filled and makes the task from the note', async () => {
    render(<NoteScreen id="n1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'More' }));
    fireEvent.click(await screen.findByRole('button', { name: /Make a task/ }));
    const title = await screen.findByLabelText('Title');
    expect(title.value).toBe('Launch plan');
    expect(screen.getByLabelText('Description').value).toBe('Ship the beta\n\nFrom note: Launch plan');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Make task' })); });
    expect(fake.makeTaskFrom).toHaveBeenCalledWith('note', 'n1', expect.objectContaining({ title: 'Launch plan', priority: 'medium' }));
  });

  it('a note that is already a task offers "Open task"', async () => {
    note.linkedTaskId = 't1';
    render(<NoteScreen id="n1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'More' }));
    fireEvent.click(await screen.findByRole('button', { name: /Open task/ }));
    expect(lastScreen()).toMatchObject({ name: 'task', params: { id: 't1' } });
    expect(fake.makeTaskFrom).not.toHaveBeenCalled();
  });

  it('a second attempt opens the existing task', async () => {
    fake.makeTaskFrom.mockResolvedValueOnce({ id: 't7', existing: true });
    render(<NoteScreen id="n1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'More' }));
    fireEvent.click(await screen.findByRole('button', { name: /Make a task/ }));
    await screen.findByLabelText('Title');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Make task' })); });
    await waitFor(() => expect(lastScreen()).toMatchObject({ name: 'task', params: { id: 't7' } }));
  });
});

describe('file screen', () => {
  it('"Make a task" names the task after the file and then offers "Open task"', async () => {
    render(<FileScreen id="f1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Make a task/ }));
    expect((await screen.findByLabelText('Title')).value).toBe('budget');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Make task' })); });
    expect(fake.makeTaskFrom).toHaveBeenCalledWith('file', 'f1', expect.objectContaining({ title: 'budget', description: 'From file: budget.xlsx' }));
    fireEvent.click(await screen.findByRole('button', { name: /Open task/ }));
    expect(lastScreen()).toMatchObject({ name: 'task', params: { id: 't9' } });
  });
});

describe('task source row', () => {
  it('shows "From note" with the note title and opens it', async () => {
    render(<TaskSourceRow task={{ id: 't1', linkedNote: 'n1' }} />);
    const row = await screen.findByRole('button', { name: /From note.*Launch plan/ });
    fireEvent.click(row);
    expect(lastScreen()).toMatchObject({ name: 'note', params: { id: 'n1' } });
  });

  it('shows "From file", and "Can\'t open" when the file is out of reach', async () => {
    fake.fileDetail.mockRejectedValueOnce(Object.assign(new Error('File not found'), { status: 404 }));
    render(<TaskSourceRow task={{ id: 't1', linkedFile: 'f1' }} />);
    expect(await screen.findByText("Can't open")).toBeTruthy();
    expect(screen.getByText('From file')).toBeTruthy();
    expect(taskSource({ linkedMessage: 'm1' })).toBe(null);
  });
});
