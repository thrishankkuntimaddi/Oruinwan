// Knowledge on the phone: a welcome with ways to start when there are no pages, a real error
// (with retry) when they can't load, and importing Markdown / text files as pages.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { create } from 'zustand';
import { importProblem, pageFromImport } from './importPages.js';

const fake = {
  knowledge: vi.fn(async () => []),
  createPage: vi.fn(async (ws, d) => ({ id: 'p9', title: d.title, icon: '📄' })),
};

const mockSession = create(() => ({ user: { id: 'me' }, workspaceId: 'w1', workspaces: [{ id: 'w1', role: 'owner' }] }));
vi.mock('../../data/session.js', () => ({
  api: () => fake,
  useSession: mockSession,
  useWorkspace: () => ({ id: 'w1', role: 'owner' }),
}));

const { KnowledgeScreen } = await import('./screens.jsx');
const { clearQueries } = await import('../../data/query.js');

beforeEach(() => {
  cleanup();
  clearQueries();
  vi.clearAllMocks();
  fake.knowledge.mockImplementation(async () => []);
});

describe('import helpers', () => {
  it('uses a leading # heading as the title, else the file name', () => {
    expect(pageFromImport('a.md', '# Runbook\n\nSteps')).toEqual({ title: 'Runbook', content: 'Steps' });
    expect(pageFromImport('how-we-work.txt', 'Plain')).toEqual({ title: 'how we work', content: 'Plain' });
  });

  it('only takes Markdown and text files up to 1 MB', () => {
    expect(importProblem({ name: 'a.md', size: 1 })).toBeNull();
    expect(importProblem({ name: 'a.png', type: 'image/png', size: 1 })).toMatch(/isn’t a Markdown/);
    expect(importProblem({ name: 'a.md', size: 5 * 1024 * 1024 })).toMatch(/larger than 1 MB/);
  });
});

describe('KnowledgeScreen', () => {
  it('welcomes an empty workspace with ways to start', async () => {
    render(<KnowledgeScreen />);
    expect(await screen.findByTestId('knowledge-welcome')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Write a page/ })).toBeTruthy();
    // The welcome card and the header both offer import.
    expect(screen.getAllByRole('button', { name: /Import Markdown or text/ })).toHaveLength(2);
    expect(screen.getAllByTestId('welcome-template')).toHaveLength(3);
  });

  it('creates a page from a template on the welcome screen', async () => {
    render(<KnowledgeScreen />);
    fireEvent.click((await screen.findAllByTestId('welcome-template'))[0]);
    await waitFor(() => expect(fake.createPage).toHaveBeenCalledWith('w1', expect.objectContaining({ title: 'Team handbook' })));
  });

  it('shows why the pages did not load, and retries', async () => {
    fake.knowledge.mockImplementationOnce(async () => {
      throw new Error('Not a member of this workspace');
    });
    render(<KnowledgeScreen />);
    expect(await screen.findByText('Couldn’t load the knowledge base')).toBeTruthy();
    expect(screen.getByText('Not a member of this workspace')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('knowledge-welcome')).toBeTruthy();
  });

  it('imports a Markdown file as a page', async () => {
    render(<KnowledgeScreen />);
    await screen.findByTestId('knowledge-welcome');
    const file = new File(['# Runbook\n\n1. Restart'], 'runbook.md', { type: 'text/markdown' });
    fireEvent.change(screen.getByTestId('knowledge-import'), { target: { files: [file] } });
    await waitFor(() => expect(fake.createPage).toHaveBeenCalledWith('w1', { title: 'Runbook', content: '1. Restart' }));
  });
});
