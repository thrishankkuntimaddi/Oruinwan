// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const showToast = vi.fn();
vi.mock('@services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast }) }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ logout: vi.fn() }) }));

import api from '@services/api';
import ComplianceExportCard, { complianceFileName } from '../components/workspace/settings/ComplianceExportCard';
import SessionsTab, { sessionTitle } from '../pages/settingsTabs/SessionsTab';

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
    const sessions = [
        { id: 's1', device: 'Mac', browser: 'Chrome', os: 'desktop', osName: 'macOS', current: true, createdAt: '2026-10-01T10:00:00Z' },
        { id: 's2', device: 'iPhone', browser: 'Safari', os: 'mobile', osName: 'iOS', current: false, lastActive: '2026-10-20T10:00:00Z', createdAt: '2026-09-01T10:00:00Z' },
    ];

    it('titles unknown devices plainly', () => {
        expect(sessionTitle({ device: 'Unknown device', browser: '' })).toBe('Unknown device');
        expect(sessionTitle({ device: 'Mac', browser: 'Firefox' })).toBe('Mac · Firefox');
    });

    it('asks before signing another device out, then revokes it', async () => {
        api.get.mockResolvedValue({ data: sessions });
        api.delete.mockResolvedValue({ data: {} });
        render(<MemoryRouter><SessionsTab /></MemoryRouter>);

        const list = await screen.findByRole('list', { name: 'Signed-in devices' });
        expect(within(list).getAllByText(/Signed in/).length).toBeGreaterThan(0);
        fireEvent.click(screen.getByRole('button', { name: 'Revoke iPhone · Safari' }));
        expect(api.delete).not.toHaveBeenCalled();

        const dialog = await screen.findByRole('dialog', { name: 'Sign out this device?' });
        expect(dialog).toHaveTextContent('iPhone · Safari will need to sign in again.');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Sign out device' }));
        await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/auth/sessions/s2'));
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(screen.queryByText('iPhone · Safari')).toBeNull();
    });
});
