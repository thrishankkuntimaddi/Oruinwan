// The media viewer: who sent it, actions, and next / previous on phones too.
import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../data/session.js', () => ({ api: () => ({ mediaUrl: async () => 'blob:x' }), useSession: Object.assign(() => null, { getState: () => ({}) }) }));

const { MediaHost } = await import('./MediaHost.jsx');
const { fileMeta, useViewer } = await import('./media.js');

afterEach(() => {
  cleanup();
  useViewer.setState({ media: null });
});

describe('media viewer', () => {
  it('shows the sender, the actions and moves between files', async () => {
    const a = { name: 'a.jpg', mimeType: 'image/jpeg', url: '/a' };
    const b = { name: 'b.jpg', mimeType: 'image/jpeg', url: '/b' };
    fileMeta.set(a, { messageId: 'm1', authorName: 'Varshitha', at: '2026-10-30T09:00:00Z' });
    render(<MediaHost />);
    act(() => useViewer.getState().openMedia([a, b], 0));
    expect(await screen.findByTestId('media-actions')).toBeTruthy();
    expect(screen.getByText(/Varshitha/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Show in chat/ })).toBeTruthy();
    expect(screen.getByText(/1 of 2/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/2 of 2/)).toBeTruthy();
  });
});
