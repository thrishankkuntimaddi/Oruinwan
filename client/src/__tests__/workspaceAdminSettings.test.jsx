// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const toast = vi.fn();
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast: toast }) }));
vi.mock('@services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import api from '@services/api';
import ChannelsTab, { sortChannels, isLastDefault } from '../components/workspace/settings/ChannelsTab';
import AdvancedTab, { ownerCandidates } from '../components/workspace/settings/AdvancedTab';
import PermissionsTab, { TOGGLES } from '../components/workspace/settings/PermissionsTab';
import { ArchivedCard } from '../pages/workspaceSelectComponents/WorkspaceGrid';

const WS = { id: 'w1', name: 'Acme', type: 'company' };
const MEMBERS = [
    { id: 'me', name: 'Owner', role: 'owner', memberStatus: 'active', isCurrentUser: true },
    { id: 'a', name: 'Asha', role: 'admin', memberStatus: 'active' },
    { id: 'b', name: 'Ben', role: 'member', memberStatus: 'active' },
    { id: 'c', name: 'Cy', role: 'member', memberStatus: 'suspended' },
];

beforeEach(() => {
    toast.mockReset();
    Object.values(api).forEach((fn) => fn.mockReset?.());
});

describe('channel helpers', () => {
    it('puts default channels first, then by name', () => {
        const out = sortChannels([{ name: 'b' }, { name: 'general', isDefault: true }, { name: 'a' }]);
        expect(out.map((c) => c.name)).toEqual(['general', 'a', 'b']);
    });
    it('knows the last default channel', () => {
        const list = [{ _id: 1, isDefault: true }, { _id: 2 }];
        expect(isLastDefault(list, list[0])).toBe(true);
        expect(isLastDefault([...list, { _id: 3, isDefault: true }], list[0])).toBe(false);
        expect(isLastDefault(list, list[1])).toBe(false);
    });
});

describe('ChannelsTab', () => {
    const channels = [
        { _id: 'g', name: 'general', isDefault: true, members: [1, 2] },
        { _id: 'd', name: 'design', members: [1] },
        { _id: 's', name: 'secret', isPrivate: true, members: [1] },
    ];

    it('turns a public channel into a default one', async () => {
        api.get.mockResolvedValue({ data: { channels } });
        api.put.mockResolvedValue({ data: { isDefault: true, added: 3 } });
        render(<ChannelsTab workspaceId="w1" isAdmin />);
        const sw = await screen.findByRole('switch', { name: 'Default channel: design' });
        fireEvent.click(sw);
        await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/workspaces/w1/channels/d/default', { isDefault: true }));
        await waitFor(() => expect(screen.getByRole('switch', { name: 'Default channel: design' })).toHaveAttribute('aria-checked', 'true'));
        expect(toast).toHaveBeenCalledWith(expect.stringContaining('3 people added'), 'success');
    });

    it('locks private channels and the only default channel', async () => {
        api.get.mockResolvedValue({ data: { channels } });
        render(<ChannelsTab workspaceId="w1" isAdmin />);
        expect(await screen.findByRole('switch', { name: 'Default channel: secret' })).toBeDisabled();
        expect(screen.getByRole('switch', { name: 'Default channel: general' })).toBeDisabled();
        expect(screen.getByRole('switch', { name: 'Default channel: design' })).not.toBeDisabled();
    });

    it('is read-only for non-admins', async () => {
        api.get.mockResolvedValue({ data: { channels } });
        render(<ChannelsTab workspaceId="w1" isAdmin={false} />);
        expect(await screen.findByRole('switch', { name: 'Default channel: design' })).toBeDisabled();
    });
});

describe('Danger zone', () => {
    it('offers only active people other than me as the new owner', () => {
        expect(ownerCandidates(MEMBERS).map((m) => m.id)).toEqual(['a', 'b']);
    });

    it('is owner only', () => {
        render(<AdvancedTab isOwner={false} workspace={WS} members={MEMBERS} setShowDeleteConfirm={vi.fn()} />);
        expect(screen.getByText('Owner only')).toBeInTheDocument();
        expect(screen.queryByText('Transfer ownership')).toBeNull();
    });

    it('transfers ownership after confirming', async () => {
        api.post.mockResolvedValue({ data: { ownerId: 'b' } });
        const onChanged = vi.fn();
        render(<AdvancedTab isOwner workspace={WS} members={MEMBERS} setShowDeleteConfirm={vi.fn()} onChanged={onChanged} />);
        fireEvent.click(screen.getByRole('button', { name: 'Transfer…' }));
        fireEvent.change(screen.getByLabelText('New owner'), { target: { value: 'b' } });
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Transfer ownership' }));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/workspaces/w1/transfer-ownership', { userId: 'b' }));
        await waitFor(() => expect(onChanged).toHaveBeenCalledWith('transferred'));
    });

    it('archives after confirming', async () => {
        api.post.mockResolvedValue({ data: { isArchived: true } });
        const onChanged = vi.fn();
        render(<AdvancedTab isOwner workspace={WS} members={MEMBERS} setShowDeleteConfirm={vi.fn()} onChanged={onChanged} />);
        fireEvent.click(screen.getByRole('button', { name: 'Archive…' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Archive workspace' }));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/workspaces/w1/archive'));
        await waitFor(() => expect(onChanged).toHaveBeenCalledWith('archived'));
    });

    it('opens the delete confirmation', () => {
        const del = vi.fn();
        render(<AdvancedTab isOwner workspace={WS} members={MEMBERS} setShowDeleteConfirm={del} />);
        fireEvent.click(screen.getByRole('button', { name: 'Delete…' }));
        expect(del).toHaveBeenCalledWith(true);
    });

    it('keeps personal workspaces from being transferred or archived', () => {
        render(<AdvancedTab isOwner workspace={{ ...WS, type: 'personal' }} members={MEMBERS} setShowDeleteConfirm={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Transfer…' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Archive…' })).toBeDisabled();
    });
});

describe('Permissions', () => {
    it('shows only the settings the server enforces', () => {
        expect(TOGGLES.map((t) => t.key)).toEqual(['allowMemberChannelCreation', 'membersMayInvite']);
        const change = vi.fn();
        render(<PermissionsTab isAdmin permissions={{ allowMemberChannelCreation: true, membersMayInvite: false }} savingPermissions={false} handlePermissionChange={change} />);
        fireEvent.click(screen.getByRole('switch', { name: 'Members can invite people' }));
        expect(change).toHaveBeenCalledWith('membersMayInvite', true);
        expect(screen.queryByText(/Admin Approval/i)).toBeNull();
    });
});

describe('Archived workspaces', () => {
    it('can be restored from the workspace list', () => {
        const restore = vi.fn();
        const ws = { id: 'w9', name: 'Old', isArchived: true };
        render(<ArchivedCard ws={ws} onRestore={restore} />);
        expect(screen.getByText('Archived')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Restore/ }));
        expect(restore).toHaveBeenCalledWith(ws);
    });
});
