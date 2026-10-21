// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../contexts/WorkspaceContext', () => ({ useWorkspace: () => ({ activeWorkspace: { id: 'w1' } }) }));
vi.mock('../hooks/useChannels', () => ({ useChannels: () => ({ joinDiscoverableChannel: vi.fn() }) }));

import api from '@services/api';
import JoinChannelModal from '../features/messaging/JoinChannelModal';

describe('Join public channel', () => {
  it('lists only discoverable public channels the user is not in (members are { user } sub-documents)', async () => {
    api.get.mockResolvedValue({ data: { channels: [
      { _id: 'c1', name: 'general', isPrivate: false, isDiscoverable: true, isMember: true, members: [{ user: 'me', joinedAt: 'x' }] },
      { _id: 'c2', name: 'random', isPrivate: false, isDiscoverable: true, isMember: false, members: [{ user: 'other' }] },
      { _id: 'c3', name: 'design', isPrivate: false, isDiscoverable: true, members: [{ user: { _id: 'me' } }] },
      { _id: 'c4', name: 'secret', isPrivate: true, isDiscoverable: true, members: [] },
      { _id: 'c5', name: 'hidden', isPrivate: false, isDiscoverable: false, members: [] },
    ] } });
    render(<MemoryRouter><JoinChannelModal onClose={() => {}} currentUserId="me" /></MemoryRouter>);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/workspaces/w1/channels'));
    expect(await screen.findByText(/random/)).toBeTruthy();
    for (const name of ['general', 'design', 'secret', 'hidden']) expect(screen.queryByText(new RegExp(name))).toBeNull();
  });
});
