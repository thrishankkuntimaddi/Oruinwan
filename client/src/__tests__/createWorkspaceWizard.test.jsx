// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockApi = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock('@services/api', () => ({ default: mockApi }));
vi.mock('../services/api', () => ({ default: mockApi }));

const setUser = vi.fn();
let mockUser = {};
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser, setUser }) }));
vi.mock('../components/InvitePeopleModal', () => ({ default: ({ isOpen }) => (isOpen ? <div data-testid="invite-modal" /> : null) }));
vi.mock('../contexts/WorkspaceContext', () => ({ useWorkspace: () => ({ activeWorkspace: { id: 'ws1', memberCount: 1 } }) }));

const api = mockApi;
import CreateWorkspaceModal from '../pages/workspaceSelectComponents/CreateWorkspaceModal';
import { projectChannelName } from '../pages/workspaceSelectComponents/projectChannelName';
import GettingStarted from '../pages/SidebarComp/states/GettingStarted';

beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: { templates: [] } });
    api.put.mockResolvedValue({ data: {} });
    mockUser = { username: 'Sam', preferences: { gettingStarted: { done: [], hidden: false } } };
});

describe('project channel names', () => {
    it('match the server', () => {
        expect(projectChannelName('Website redesign!')).toBe('website-redesign');
        expect(projectChannelName('Café menu')).toBe('cafe-menu');
        expect(projectChannelName('')).toBe('');
    });
});

describe('create-workspace wizard', () => {
    it('name → project → teammates, creating the workspace with its project channel', async () => {
        api.post.mockImplementation(async (url, body) => {
            if (url === '/api/workspaces/create') return { data: { workspace: { id: 'ws9', name: body.name, channels: [] } } };
            if (url === '/api/workspaces/ws9/invite' && body.inviteType === 'link') return { data: { inviteLink: 'http://x/join-workspace?token=abc' } };
            if (url === '/api/workspaces/ws9/invite') return { data: {} };
            throw new Error(`unexpected ${url}`);
        });
        const onCreated = vi.fn();
        const onOpen = vi.fn();
        render(<CreateWorkspaceModal isOpen onClose={vi.fn()} onCreated={onCreated} onOpen={onOpen} showToast={vi.fn()} />);

        // Step 1: a name is required.
        fireEvent.click(screen.getByTestId('wizard-next'));
        expect(screen.getByRole('alert').textContent).toMatch(/name/);
        fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: 'Acme' } });
        fireEvent.click(screen.getByTestId('wizard-next'));

        // Step 2: the project becomes a channel next to #general and #random.
        fireEvent.change(screen.getByLabelText('Project'), { target: { value: 'Website redesign' } });
        expect(screen.getByTestId('channel-preview').textContent).toMatch(/general.*random.*website-redesign/);
        fireEvent.click(screen.getByTestId('wizard-next'));

        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/workspaces/create', expect.objectContaining({ name: 'Acme', project: 'Website redesign' })));
        expect(onCreated).toHaveBeenCalled();

        // Step 3: a reusable team link, plus email invites.
        await waitFor(() => expect(screen.getByTestId('team-invite-link').value).toBe('http://x/join-workspace?token=abc'));
        expect(api.post).toHaveBeenCalledWith('/api/workspaces/ws9/invite', expect.objectContaining({ inviteType: 'link', reusable: true }));
        fireEvent.change(screen.getByLabelText(/Or invite by email/), { target: { value: 'a@x.io, b@x.io' } });
        fireEvent.click(screen.getByTestId('wizard-next'));
        await waitFor(() => expect(onOpen).toHaveBeenCalledWith('ws9'));
        expect(api.post).toHaveBeenCalledWith('/api/workspaces/ws9/invite', { emails: ['a@x.io', 'b@x.io'], inviteType: 'email' });
    });

    it('skipping the project creates the workspace without one', async () => {
        api.post.mockResolvedValue({ data: { workspace: { id: 'ws9', name: 'Acme', channels: [] }, inviteLink: 'l' } });
        render(<CreateWorkspaceModal isOpen onClose={vi.fn()} onCreated={vi.fn()} onOpen={vi.fn()} showToast={vi.fn()} />);
        fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: 'Acme' } });
        fireEvent.click(screen.getByTestId('wizard-next'));
        fireEvent.change(screen.getByLabelText('Project'), { target: { value: 'Something' } });
        fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/workspaces/create', expect.not.objectContaining({ project: expect.anything() })));
    });
});

describe('getting started checklist', () => {
    it('ticks a step when opened, saves it, and can be hidden', async () => {
        const opened = vi.fn();
        window.addEventListener('oruinwan-ai:open', opened);
        render(<MemoryRouter><GettingStarted workspaceId="ws1" /></MemoryRouter>);

        expect(screen.getByText('0 of 6 done')).toBeTruthy();
        fireEvent.click(screen.getByText('Ask Oruinwan AI anything'));
        expect(opened).toHaveBeenCalled();
        expect(screen.getByText('1 of 6 done')).toBeTruthy();
        expect(api.put).toHaveBeenCalledWith('/api/auth/me', { preferences: { gettingStarted: { done: ['ai'] } } });

        fireEvent.click(screen.getByRole('button', { name: 'Hide getting started' }));
        expect(screen.queryByTestId('getting-started')).toBeNull();
        expect(api.put).toHaveBeenLastCalledWith('/api/auth/me', { preferences: { gettingStarted: { hidden: true } } });
        window.removeEventListener('oruinwan-ai:open', opened);
    });

    it('opens the invite window from "Invite your teammates"', () => {
        render(<MemoryRouter><GettingStarted workspaceId="ws1" /></MemoryRouter>);
        fireEvent.click(screen.getByText('Invite your teammates'));
        expect(screen.getByTestId('invite-modal')).toBeTruthy();
    });

    it('stays hidden once hidden, and counts an own photo as done', () => {
        mockUser = { profilePicture: 'https://cdn.example.com/me.png', preferences: { gettingStarted: { done: [], hidden: false } } };
        const { unmount } = render(<MemoryRouter><GettingStarted workspaceId="ws1" /></MemoryRouter>);
        expect(screen.getByText('1 of 6 done')).toBeTruthy();
        unmount();

        mockUser = { preferences: { gettingStarted: { done: [], hidden: true } } };
        render(<MemoryRouter><GettingStarted workspaceId="ws1" /></MemoryRouter>);
        expect(screen.queryByTestId('getting-started')).toBeNull();
    });
});
