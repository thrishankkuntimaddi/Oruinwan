// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const showToast = vi.fn();
vi.mock('@services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast }) }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ logout: vi.fn() }) }));

import api from '@services/api';
import ComplianceExportCard, { complianceFileName } from '../components/workspace/settings/ComplianceExportCard';
import SessionsTab, { sessionTitle, deviceTitle, deviceMeta } from '../pages/settingsTabs/SessionsTab';

beforeEach(() => {
    vi.clearAllMocks();
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
    globalThis.URL.revokeObjectURL = vi.fn();
});

describe('Workspace compliance export', () => {
    it('names the file after the workspace and date', () => {
        expect(complianceFileName('Acme Team!', new Date('2026-10-21T10:00:00Z'))).toBe('acme-team-compliance-2026-10-21.json');
        expect(complianceFileName('', new Date('2026-10-21T10:00:00Z'))).toBe('workspace-compliance-2026-10-21.json');
    });

    it('downloads GET /api/compliance/export for this workspace', async () => {
        api.get.mockResolvedValue({ data: new Blob(['{}'], { type: 'application/json' }) });
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        render(<ComplianceExportCard workspaceId="ws1" workspaceName="Acme" />);
        fireEvent.click(screen.getByRole('button', { name: /Download compliance export/ }));
        expect(await screen.findByRole('status')).toHaveTextContent(/audit log/);
        expect(api.get).toHaveBeenCalledWith('/api/compliance/export', { params: { workspaceId: 'ws1' }, responseType: 'blob' });
        expect(click).toHaveBeenCalled();
        click.mockRestore();
    });

    it('shows the server message from a blob error, or a role hint on 403', async () => {
        api.get.mockRejectedValueOnce({ response: { status: 500, data: new Blob([JSON.stringify({ message: 'Disk full' })]) } });
        render(<ComplianceExportCard workspaceId="ws1" />);
        fireEvent.click(screen.getByRole('button', { name: /Download compliance export/ }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Disk full');

        api.get.mockRejectedValueOnce({ response: { status: 403, data: {} } });
        fireEvent.click(screen.getByRole('button', { name: /Download compliance export/ }));
        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/owners and admins/));
    });
});

describe('Settings → Devices', () => {
    const devices = [
        { deviceId: 'd1', deviceName: 'Chrome on Mac', reportedName: 'Chrome on Mac', customName: null, platform: 'web', isCurrent: true, createdAt: '2026-10-01T10:00:00Z', sessionCount: 1 },
        { deviceId: 'd2', deviceName: 'Work phone', reportedName: 'iPhone', customName: 'Work phone', platform: 'ios', isCurrent: false, lastActiveAt: '2026-10-20T10:00:00Z', createdAt: '2026-09-01T10:00:00Z', sessionCount: 1 },
    ];

    it('titles devices by custom name, then reported name', () => {
        expect(deviceTitle({ customName: 'Work phone', reportedName: 'iPhone' })).toBe('Work phone');
        expect(deviceTitle({ deviceName: 'Unknown device' })).toBe('Unknown device');
        expect(deviceTitle({ reportedName: 'Pixel 8' })).toBe('Pixel 8');
        expect(deviceMeta({ ...devices[1] })).toMatch(/iOS · iPhone/);
        expect(sessionTitle({ device: 'Mac', browser: 'Firefox' })).toBe('Mac · Firefox');
    });

    it('lists /api/v2/devices, asks before revoking another device, then revokes it', async () => {
        api.get.mockResolvedValue({ data: { totalCount: 2, devices } });
        api.delete.mockResolvedValue({ data: { isCurrentDevice: false } });
        render(<MemoryRouter><SessionsTab /></MemoryRouter>);

        const list = await screen.findByRole('list', { name: 'Signed-in devices' });
        expect(api.get).toHaveBeenCalledWith('/api/v2/devices', expect.objectContaining({ headers: expect.any(Object) }));
        expect(within(list).getByText('This device')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Sign out Work phone' }));
        expect(api.delete).not.toHaveBeenCalled();

        const dialog = await screen.findByRole('dialog', { name: 'Sign out this device?' });
        expect(dialog).toHaveTextContent('Work phone will need to sign in again');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Sign out device' }));
        await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v2/devices/d2', expect.any(Object)));
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(screen.queryByText('Work phone')).toBeNull();
    });

    it('renames a device', async () => {
        api.get.mockResolvedValue({ data: { devices } });
        api.patch.mockResolvedValue({ data: { device: { ...devices[0], customName: 'Studio Mac', deviceName: 'Studio Mac' } } });
        render(<MemoryRouter><SessionsTab /></MemoryRouter>);
        fireEvent.click(await screen.findByRole('button', { name: 'Rename Chrome on Mac' }));
        fireEvent.change(screen.getByLabelText('Name for Chrome on Mac'), { target: { value: 'Studio Mac' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
        await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api/v2/devices/d1', { name: 'Studio Mac' }, expect.any(Object)));
        expect(await screen.findByText('Studio Mac')).toBeTruthy();
    });
});
