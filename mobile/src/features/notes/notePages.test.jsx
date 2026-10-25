import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const fake = { addNotePage: vi.fn(async () => ({ id: 'p3' })) };
vi.mock('../../data/session.js', async () => {
  const { create } = await import('zustand');
  return { api: () => fake, useSession: create(() => ({ workspaceId: 'w1' })) };
});

const { NotePages, neighbourPage } = await import('./NotePages.jsx');
const { useNav } = await import('../../app/nav.js');

const note = { id: 'p2', parentId: 'n1', title: 'Second', pages: [{ id: 'n1', title: 'Spec' }, { id: 'p2', title: 'Second' }] };

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  useNav.getState().resetAll();
  useNav.getState().push('note', { id: 'p2' }, { tab: 'notes' });
});

describe('note pages', () => {
  it('finds the previous and next page', () => {
    expect(neighbourPage(note.pages, 'p2', -1).id).toBe('n1');
    expect(neighbourPage(note.pages, 'p2', 1)).toBeNull();
  });

  it('shows the pages, opens one, and adds a page after the last', async () => {
    render(<NotePages note={note} canEdit />);
    expect(screen.getByRole('button', { name: /2 · Second/ }).getAttribute('aria-current')).toBe('page');
    fireEvent.click(screen.getByRole('button', { name: /1 · Spec/ }));
    expect(useNav.getState().stacks.notes.at(-1)).toMatchObject({ name: 'note', params: { id: 'n1' } });
    fireEvent.click(screen.getByTestId('note-add-page'));
    await vi.waitFor(() => expect(fake.addNotePage).toHaveBeenCalledWith('w1', 'n1'));
    await vi.waitFor(() => expect(useNav.getState().stacks.notes.at(-1)).toMatchObject({ params: { id: 'p3' } }));
  });

  it('hides the strip for a one-page note someone can only read', () => {
    render(<NotePages note={{ id: 'n1', title: 'Solo', pages: [{ id: 'n1', title: 'Solo' }] }} canEdit={false} />);
    expect(screen.queryByTestId('note-pages')).toBeNull();
  });
});
