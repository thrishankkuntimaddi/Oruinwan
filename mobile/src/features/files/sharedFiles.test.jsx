// Files on the phone: everything shared with the person (channel / DM attachments and uploads),
// with type and place filters, search, and Open / Go to message.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { create } from 'zustand';
import { mapSharedFile, messageTarget, sharedQuery, whereLabel } from './filesUi.js';

const NOW = new Date().toISOString();
const raw = [
  { id: 'msg:m1:0', source: 'channel', name: 'roadmap.pdf', mimeType: 'application/pdf', size: 2048, type: 'file', url: '/api/v2/uploads/file?path=a', kind: 'document', sharedBy: { _id: 'u2', username: 'bob' }, sharedAt: NOW, messageId: 'm1', parentId: null, conversation: { id: 'c1', type: 'channel', name: 'general' } },
  { id: 'msg:m2:0', source: 'dm', name: 'photo.png', mimeType: 'image/png', size: 900, type: 'image', url: '/api/v2/uploads/file?path=b', kind: 'image', sharedBy: { _id: 'u2', username: 'bob' }, sharedAt: NOW, messageId: 'm2', parentId: 'p1', conversation: { id: 'd1', type: 'dm', name: 'bob' } },
  { id: 'lib:f1', source: 'library', fileId: 'f1', name: 'brand.zip', mimeType: 'application/zip', size: 5000, kind: 'other', sharedBy: { _id: 'me', username: 'me' }, sharedAt: NOW, conversation: null },
];

const fake = {
  sharedFiles: vi.fn(async () => ({ items: raw.map(mapSharedFile), total: 3, hasMore: false, conversations: [] })),
};
const mockSession = create(() => ({ user: { id: 'me' }, workspaceId: 'w1', workspaces: [{ id: 'w1', role: 'member' }] }));
vi.mock('../../data/session.js', () => ({
  api: () => fake,
  useSession: mockSession,
  useWorkspace: () => ({ id: 'w1', role: 'member' }),
}));
const push = vi.fn();
vi.mock('../../app/nav.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, nav: { ...actual.nav, push: (...a) => push(...a) } };
});
const openFile = vi.fn();
vi.mock('../media/media.js', async (importOriginal) => ({ ...(await importOriginal()), openFile: (...a) => openFile(...a), downloadFile: vi.fn() }));

const { FilesScreen } = await import('../more/index.jsx');
const { clearQueries } = await import('../../data/query.js');

beforeEach(() => {
  cleanup();
  clearQueries();
  vi.clearAllMocks();
});

describe('shared file helpers', () => {
  it('builds the query', () => {
    expect(sharedQuery('w1')).toEqual({ workspaceId: 'w1', sort: 'newest', limit: 50, offset: 0 });
    expect(sharedQuery('w1', { kind: 'media', source: 'conv:c1', q: ' x ' })).toMatchObject({ kind: 'media', conversationId: 'c1', q: 'x' });
    expect(sharedQuery('w1', { source: 'dms' })).toMatchObject({ source: 'dms' });
  });

  it('maps items and says where they were shared', () => {
    const [pdf, photo, zip] = raw.map(mapSharedFile);
    expect(pdf).toMatchObject({ name: 'roadmap.pdf', byName: 'bob', conv: { id: 'c1', kind: 'channel' }, url: '/api/v2/uploads/file?path=a' });
    expect(whereLabel(pdf)).toBe('#general');
    expect(whereLabel(photo)).toBe('bob');
    expect(whereLabel(zip)).toBe('Files');
  });

  it('goes to the message, or its thread for replies', () => {
    const [pdf, photo, zip] = raw.map(mapSharedFile);
    expect(messageTarget(pdf)).toEqual({ route: 'conversation', params: { kind: 'channel', id: 'c1', highlight: 'm1' } });
    expect(messageTarget(photo)).toEqual({ route: 'thread', params: { kind: 'dm', convId: 'd1', messageId: 'p1' } });
    expect(messageTarget(zip)).toBeNull();
  });
});

describe('FilesScreen', () => {
  it('lists chat attachments and uploads with who and where', async () => {
    render(<FilesScreen />);
    expect(await screen.findByText('roadmap.pdf')).toBeTruthy();
    expect(screen.getByText(/bob · #general/)).toBeTruthy();
    expect(screen.getByText(/me · Files/)).toBeTruthy();
    expect(screen.getByText('3 shared with you')).toBeTruthy();
  });

  it('filters by type and place', async () => {
    render(<FilesScreen />);
    await screen.findByText('roadmap.pdf');
    fireEvent.click(screen.getByRole('button', { name: 'Images' }));
    await waitFor(() => expect(fake.sharedFiles).toHaveBeenLastCalledWith('w1', expect.objectContaining({ kind: 'image' })));
    fireEvent.click(screen.getByRole('button', { name: 'Direct messages' }));
    await waitFor(() => expect(fake.sharedFiles).toHaveBeenLastCalledWith('w1', expect.objectContaining({ kind: 'image', source: 'dms' })));
  });

  it('opens chat files in the viewer and uploads in their details', async () => {
    render(<FilesScreen />);
    fireEvent.click(await screen.findByText('roadmap.pdf'));
    expect(openFile).toHaveBeenCalledWith(expect.objectContaining({ name: 'roadmap.pdf' }), undefined);
    fireEvent.click(screen.getByText('brand.zip'));
    expect(push).toHaveBeenCalledWith('file', { id: 'f1' });
  });

  it('goes to the message from the row menu', async () => {
    render(<FilesScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'More for roadmap.pdf' }));
    fireEvent.click(await screen.findByText('Go to message'));
    expect(push).toHaveBeenCalledWith('conversation', { kind: 'channel', id: 'c1', highlight: 'm1' }, { tab: 'chats' });
  });

  it('explains where files come from when nothing is shared', async () => {
    fake.sharedFiles.mockResolvedValueOnce({ items: [], total: 0, hasMore: false, conversations: [] });
    render(<FilesScreen />);
    expect(await screen.findByText('Nothing shared yet')).toBeTruthy();
  });
});
