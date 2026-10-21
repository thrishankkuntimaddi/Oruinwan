// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const showToast = vi.fn();
vi.mock('@services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast }) }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { _id: 'u1' } }) }));

import api from '@services/api';
import BackupTab from '../pages/settingsTabs/BackupTab';
import { shouldOffer } from '../components/backup/BackupRestoreOffer';
import { connectResultMessage, formatBytes, restoreRows, statusSummary } from '../pages/settingsTabs/backupInfo';

const connected = {
    configured: true, connected: true, googleEmail: 'ada@gmail.com', autoBackup: true, status: 'ok',
    lastBackupAt: '2026-10-21T08:00:00Z', lastBackupSize: 48211, fileName: 'oruinwan-backup.bin', hold: null,
};

const renderTab = (path = '/settings?tab=backup') => render(<MemoryRouter initialEntries={[path]}><BackupTab /></MemoryRouter>);

beforeEach(() => {
    vi.clearAllMocks();
});

describe('backup helpers', () => {
    it('formats sizes and connect results', () => {
        expect(formatBytes(500)).toBe('500 B');
        expect(formatBytes(48211)).toBe('47 KB');
        expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
        expect(connectResultMessage('connected')[1]).toBe('success');
        expect(connectResultMessage('scope_denied')[0]).toMatch(/permission/);
    });

    it('explains holds and failures', () => {
        expect(statusSummary({ ...connected, hold: 'existing-backup' }).text).toMatch(/already had a backup/);
        expect(statusSummary({ ...connected, status: 'reauth' }).tone).toBe('danger');
        expect(statusSummary(connected)).toBeNull();
    });

    it('lists only restore sections with something in them', () => {
        const rows = restoreRows({ sections: { notes: { inBackup: 3, present: 2, restore: 1, skipped: 0 }, files: { inBackup: 0, restore: 0 } } });
        expect(rows).toEqual([expect.objectContaining({ key: 'notes', label: 'Notes', restore: 1 })]);
    });

    it('offers a restore only for a connected, empty account with a backup', () => {
        expect(shouldOffer({ ...connected, accountLooksEmpty: true })).toBe(true);
        expect(shouldOffer({ ...connected, accountLooksEmpty: false })).toBe(false);
        expect(shouldOffer({ ...connected, lastBackupAt: null, accountLooksEmpty: true })).toBe(false);
    });
});

describe('Settings → Backup', () => {
    it('says so when the server has no backup configured', async () => {
        api.get.mockResolvedValue({ data: { configured: false, connected: false } });
        renderTab();
        expect(await screen.findByText(/Backup isn't configured on this server/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Connect Google Drive/ })).toBeNull();
    });

    it('connects: asks the server for the Google address and goes there', async () => {
        api.get.mockResolvedValue({ data: { configured: true, connected: false } });
        api.post.mockResolvedValue({ data: { url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' } });
        const assign = vi.fn();
        const loc = window.location;
        delete window.location;
        window.location = { ...loc, assign };
        try {
            renderTab();
            fireEvent.click(await screen.findByRole('button', { name: /Connect Google Drive/ }));
            await waitFor(() => expect(assign).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?x=1'));
            expect(api.post).toHaveBeenCalledWith('/api/v2/backup/google/connect', { client: 'web' });
        } finally {
            window.location = loc;
        }
    });

    it('shows the connected account, last backup and backs up now', async () => {
        api.get.mockResolvedValue({ data: connected });
        api.post.mockResolvedValue({ data: { ...connected, lastBackupAt: '2026-10-21T09:00:00Z' } });
        renderTab();
        expect(await screen.findByText('ada@gmail.com')).toBeInTheDocument();
        expect(screen.getByText(/47 KB/)).toBeInTheDocument();
        expect(screen.getByText(/Messages you sent, still end-to-end encrypted/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Back up now/ }));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v2/backup/run'));
        expect(showToast).toHaveBeenCalledWith('Backed up to Google Drive', 'success');
    });

    it('turns automatic backup off', async () => {
        api.get.mockResolvedValue({ data: connected });
        api.patch.mockResolvedValue({ data: { ...connected, autoBackup: false } });
        renderTab();
        await screen.findByText('ada@gmail.com');
        fireEvent.click(screen.getByRole('switch', { name: /Back up automatically/ }));
        await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api/v2/backup/settings', { autoBackup: false }));
    });

    it('previews a restore before applying it', async () => {
        api.get.mockImplementation(async (url) => {
            if (url.endsWith('/restore/preview')) {
                return { data: { backup: { createdAt: '2026-10-20T08:00:00Z', size: 48211 }, dryRun: true, total: 2, sections: { notes: { inBackup: 3, present: 1, restore: 2, skipped: 0 } } } };
            }
            return { data: connected };
        });
        api.post.mockResolvedValue({ data: { dryRun: false, total: 2 } });
        renderTab();
        fireEvent.click(await screen.findByRole('button', { name: /Restore…/ }));
        const dialog = await screen.findByRole('dialog', { name: /Restore from Google Drive/ });
        expect(within(dialog).getByText(/2 items will be added back/)).toBeInTheDocument();
        expect(api.post).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Restore 2 items' }));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v2/backup/restore', { confirm: true }));
    });

    it('disconnects and can delete the backup from Drive', async () => {
        api.get.mockResolvedValue({ data: connected });
        api.post.mockResolvedValue({ data: { configured: true, connected: false, deleted: true } });
        renderTab();
        fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));
        const dialog = await screen.findByRole('dialog', { name: /Disconnect Google Drive/ });
        fireEvent.click(within(dialog).getByLabelText(/Also delete the backup/));
        fireEvent.click(within(dialog).getByRole('button', { name: 'Disconnect and delete' }));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v2/backup/disconnect', { deleteBackup: true }));
    });

    it('reports how connecting went when Google sends the person back', async () => {
        api.get.mockResolvedValue({ data: connected });
        renderTab('/settings?tab=backup&backup=connected');
        await screen.findByText('ada@gmail.com');
        expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/connected/), 'success', 6000);
    });
});
