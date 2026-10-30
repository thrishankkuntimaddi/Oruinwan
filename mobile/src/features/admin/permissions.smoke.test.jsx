// The Permissions screen renders for a workspace owner, with and without a company role matrix.
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { create } from 'zustand';

const ws = { id: 'w1', name: 'Acme', role: 'owner' };
const fake = {
  workspacePermissions: vi.fn(async () => ({ invite: 'admin', channelCreation: 'member' })),
  companyContext: vi.fn(async () => ({ companyId: 'c1', companyRole: 'owner' })),
  permissionMatrix: vi.fn(async () => ({ owner: { inviteUsers: true }, member: { sendMessages: true } })),
};
const mockSession = create(() => ({ user: { id: 'me' }, workspaceId: 'w1', workspaces: [ws], mode: 'live' }));
vi.mock('../../data/session.js', () => ({ api: () => fake, useSession: mockSession, useWorkspace: () => ws }));

const { AdminPermissionsScreen } = await import('./screens.jsx');
const { clearQueries } = await import('../../data/query.js');

afterEach(() => {
  cleanup();
  clearQueries();
});

describe('AdminPermissionsScreen', () => {
  it('shows the workspace settings and the company matrix', async () => {
    render(<AdminPermissionsScreen />);
    await waitFor(() => expect(screen.getByText('Who can invite people')).toBeTruthy());
    await waitFor(() => expect(screen.getByText('Invite people')).toBeTruthy());
  });

  it('copes with a matrix the server sends in another shape', async () => {
    fake.permissionMatrix.mockResolvedValueOnce(null);
    fake.companyContext.mockResolvedValueOnce({ companyId: 'c1', companyRole: 'member' });
    render(<AdminPermissionsScreen />);
    await waitFor(() => expect(screen.getByText('Who can create channels')).toBeTruthy());
  });
});
