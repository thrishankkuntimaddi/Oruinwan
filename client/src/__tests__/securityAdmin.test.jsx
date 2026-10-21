// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const showToast = vi.fn();
vi.mock('@services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast }) }));

import api from '@services/api';
import SamlSSO, { validateSamlForm, samlPayload } from '../pages/admin/settings/sections/SamlSSO';
import Backups, { parseBackupFile, backupFileName, backupFileContent, restoreTotals } from '../pages/admin/settings/sections/Backups';
import RetentionPolicyCard, { presetFor, parseRetentionDays } from '../components/workspace/settings/RetentionPolicyCard';
import { notificationTypeMeta, notificationBody } from '../features/notifications/notificationTypes';
import { digestValue } from '../pages/settingsTabs/NotificationsTab';

const SP = { entityId: 'https://api/x/metadata', metadataUrl: 'https://api/x/metadata', acsUrl: 'https://api/x/acs', loginUrl: 'https://api/x/login' };

beforeEach(() => {
    vi.clearAllMocks();
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
    globalThis.URL.revokeObjectURL = vi.fn();
});

describe('SAML configuration', () => {
    it('validates the form and only sends a new certificate', () => {
        expect(validateSamlForm({ entryPoint: '', issuer: '', cert: '' }, { certRequired: true })).toEqual({
            entryPoint: 'Required', issuer: 'Required', cert: expect.any(String),
        });
        expect(validateSamlForm({ entryPoint: 'idp.example.com', issuer: 'x', cert: '' }, { certRequired: false }).entryPoint).toMatch(/full URL/);
        expect(validateSamlForm({ entryPoint: 'https://idp/sso', issuer: 'x', cert: 'nope' }, { certRequired: false }).cert).toMatch(/PEM/);
        expect(validateSamlForm({ entryPoint: 'https://idp/sso', issuer: 'x', cert: '' }, { certRequired: false })).toEqual({});
        expect(samlPayload({ entryPoint: ' https://idp/sso ', issuer: 'i', cert: '  ', enabled: 1, jitProvisioning: 0 }))
            .toEqual({ entryPoint: 'https://idp/sso', issuer: 'i', enabled: true, jitProvisioning: false });
        expect(samlPayload({ entryPoint: 'e', issuer: 'i', cert: '-----BEGIN CERTIFICATE-----x' }).cert).toMatch(/BEGIN/);
    });

    it('shows our metadata URL and ACS before setup, and saves the IdP settings', async () => {
        api.get.mockResolvedValue({ data: { configured: false, ...SP } });
        api.put.mockResolvedValue({ data: { configured: true, enabled: true, entryPoint: 'https://idp/sso', issuer: 'idp', certFingerprint: 'AB:CD', ...SP } });
        render(<SamlSSO />);
        expect(await screen.findByTitle('https://api/x/acs')).toBeTruthy();
        expect(screen.getByText('Not set up')).toBeTruthy();

        fireEvent.change(screen.getByLabelText(/IdP sign-in URL/), { target: { value: 'https://idp/sso' } });
        fireEvent.change(screen.getByLabelText(/IdP entity ID/), { target: { value: 'idp' } });
        fireEvent.change(screen.getByLabelText(/IdP signing certificate/), { target: { value: '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/auth/sso/saml/config', expect.objectContaining({ entryPoint: 'https://idp/sso', issuer: 'idp', cert: expect.stringContaining('BEGIN') })));
        expect(await screen.findByText('On')).toBeTruthy();
        expect(screen.getByText(/SHA-256 AB:CD/)).toBeTruthy();
    });

    it('maps server validation codes to the field', async () => {
        api.get.mockResolvedValue({ data: { configured: true, enabled: true, entryPoint: 'https://idp/sso', issuer: 'idp', ...SP } });
        api.put.mockRejectedValue({ response: { status: 400, data: { code: 'invalid_cert' } } });
        render(<SamlSSO />);
        await screen.findByDisplayValue('https://idp/sso');
        fireEvent.change(screen.getByLabelText(/IdP signing certificate/), { target: { value: '-----BEGIN CERTIFICATE-----bad' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(await screen.findByText(/not a valid PEM/)).toBeTruthy();
    });

    it('explains when SSO is off on the server', async () => {
        api.get.mockRejectedValue({ response: { status: 404 } });
        render(<SamlSSO />);
        expect(await screen.findByText(/off on this server/)).toBeTruthy();
    });
});

describe('Backups', () => {
    it('reads saved backup files and sums restore numbers', () => {
        const file = backupFileContent({ meta: { checksum: 'c1', createdAt: '2026-10-21T10:30:00Z' }, encryptedPayload: 'xyz' });
        expect(parseBackupFile(file)).toEqual({ encryptedPayload: 'xyz', checksum: 'c1', meta: expect.any(Object) });
        expect(() => parseBackupFile('nope')).toThrow(/not JSON/);
        expect(() => parseBackupFile('{}')).toThrow(/no encrypted backup/);
        expect(backupFileName({ createdAt: '2026-10-21T10:30:00Z' })).toBe('oruinwan-backup-2026-10-21-10-30.json');
        expect(restoreTotals({ a: { inBackup: 3, toRestore: 1 }, b: { inBackup: 2, toRestore: 2, restored: 2 } })).toEqual({ inBackup: 5, toRestore: 3, restored: 2 });
    });

    it('creates and downloads a backup', async () => {
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        api.post.mockResolvedValue({ data: { meta: { createdAt: '2026-10-21T10:00:00Z', checksum: 'abcdef0123456789xyz', recordCount: { tasks: 4 } }, encryptedPayload: 'p' } });
        render(<Backups />);
        fireEvent.click(screen.getByRole('button', { name: /Create backup/ }));
        await waitFor(() => expect(click).toHaveBeenCalled());
        expect(api.post).toHaveBeenCalledWith('/api/security/backup', {});
        expect(await screen.findByText('tasks')).toBeTruthy();
        click.mockRestore();
    });

    it('verifies a file, dry-runs, then restores only after typing RESTORE', async () => {
        const plan = { dryRun: true, collections: { tasks: { inBackup: 4, existing: 3, toRestore: 1, restored: 0, skipped: {} } }, notRestored: ['audit logs'] };
        api.post.mockImplementation(async (url, body) => {
            if (url.endsWith('/verify')) return { data: { valid: true, format: 'oruinwan-backup-v2', backedUpAt: '2026-10-20T10:00:00Z', recordCount: { tasks: 4 } } };
            if (url.endsWith('/restore') && body.dryRun) return { data: plan };
            return { data: { dryRun: false, collections: { tasks: { ...plan.collections.tasks, restored: 1 } } } };
        });
        const { container } = render(<Backups />);
        const input = container.querySelector('input[type="file"]');
        const file = new File([backupFileContent({ meta: { checksum: 'c' }, encryptedPayload: 'p' })], 'b.json', { type: 'application/json' });
        fireEvent.change(input, { target: { files: [file] } });
        expect(await screen.findByText('Valid')).toBeTruthy();
        expect(api.post).toHaveBeenCalledWith('/api/security/backup/verify', { encryptedPayload: 'p', checksum: 'c' });

        fireEvent.click(screen.getByRole('button', { name: /Dry run/ }));
        expect(await screen.findByText(/1 of 4 records would be re-created/)).toBeTruthy();
        expect(api.post).toHaveBeenCalledWith('/api/security/backup/restore', expect.objectContaining({ dryRun: true }));

        fireEvent.click(screen.getByRole('button', { name: /Restore…/ }));
        const dialog = await screen.findByRole('dialog');
        const go = within(dialog).getByRole('button', { name: 'Restore' });
        expect(go).toBeDisabled();
        fireEvent.change(within(dialog).getByLabelText(/Type RESTORE/), { target: { value: 'RESTORE' } });
        fireEvent.click(go);
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/security/backup/restore', expect.objectContaining({ dryRun: false, confirm: 'RESTORE' })));
        expect(await screen.findByText(/Restored 1 records/)).toBeTruthy();
    });

    it('explains a checksum mismatch', async () => {
        api.post.mockRejectedValue({ response: { status: 400, data: { valid: false, code: 'checksum_mismatch' } } });
        const { container } = render(<Backups />);
        const file = new File([backupFileContent({ meta: { checksum: 'c' }, encryptedPayload: 'p' })], 'b.json');
        fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });
        expect(await screen.findByText(/checksum mismatch/)).toBeTruthy();
    });
});

describe('Workspace retention policy', () => {
    it('maps stored days to presets and validates input', () => {
        expect(presetFor(null)).toBe('');
        expect(presetFor(90)).toBe('90');
        expect(presetFor(45)).toBe('custom');
        expect(parseRetentionDays('', '')).toBeNull();
        expect(parseRetentionDays('custom', '45')).toBe(45);
        expect(() => parseRetentionDays('custom', '0')).toThrow(/1 to 3650/);
        expect(() => parseRetentionDays('custom', '4000')).toThrow();
    });

    it('loads and saves the policy', async () => {
        api.get.mockResolvedValue({ data: { workspaceId: 'w1', retentionDays: null } });
        api.patch.mockResolvedValue({ data: { workspaceId: 'w1', retentionDays: 90, setAt: '2026-10-21T00:00:00Z' } });
        render(<RetentionPolicyCard workspaceId="w1" />);
        const select = await screen.findByLabelText('Keep messages for');
        await waitFor(() => expect(select).not.toBeDisabled());
        fireEvent.change(select, { target: { value: '90' } });
        fireEvent.click(screen.getByRole('button', { name: /Save retention/ }));
        await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api/compliance/workspaces/w1/retention-policy', { retentionDays: 90 }));
        expect(await screen.findByRole('status')).toHaveTextContent(/older than 90 days/);
    });
});

describe('Notification types and preferences', () => {
    it('knows design reviews, meeting reminders and AI suggestions', () => {
        expect(notificationTypeMeta('design_review').label).toBe('Review');
        expect(notificationTypeMeta('meeting_reminder').label).toBe('Meeting');
        expect(notificationTypeMeta('ai_suggestion').label).toBe('AI');
    });

    it('shows a meeting reminder start time in local time', () => {
        const body = notificationBody({ type: 'meeting_reminder', body: 'Standup', meta: { startTime: '2026-10-21T09:00:00Z' } }, 'en-US');
        expect(body).toMatch(/^Standup · starts at \d{1,2}:\d{2}/);
        expect(notificationBody({ type: 'dm', body: 'hi' })).toBe('hi');
    });

    it('derives the digest cadence from old and new account prefs', () => {
        expect(digestValue({ emailDigest: true })).toBe('daily');
        expect(digestValue({ emailDigest: true, digestFrequency: 'weekly' })).toBe('weekly');
        expect(digestValue({ emailDigest: false, digestFrequency: 'weekly' })).toBe('off');
        expect(digestValue({ emailDigest: true, digestFrequency: 'off' })).toBe('off');
    });
});
