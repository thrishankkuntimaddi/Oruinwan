// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const auth = { user: { _id: 'u1' }, requiresPassword: false, unlockEncryption: vi.fn(), resetEncryptionKeys: vi.fn(), retryEncryption: vi.fn() };
const handlers = {};
const socket = { on: (e, fn) => { handlers[e] = fn; }, off: (e) => { delete handlers[e]; } };
const svc = { getProtectionType: vi.fn(), sealWithPassword: vi.fn() };

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../contexts/SocketContext', () => ({ useOptionalSocket: () => ({ socket }) }));
vi.mock('@services/api', () => ({ default: { post: vi.fn(), get: vi.fn() } }));
vi.mock('../services/identityKeyService', () => ({ default: svc }));

import api from '@services/api';
import ApprovalPrompt from '../components/security/ApprovalPrompt';
import MessagesLockedBanner from '../components/security/MessagesLockedBanner';

const signinRequest = { id: 'a1', kind: 'signin', status: 'pending', requester: { deviceName: 'Edge on Windows', platform: 'web', location: 'Pune, IN', ip: '203.0.113.9' }, createdAt: new Date().toISOString() };

beforeEach(() => {
    vi.clearAllMocks();
    auth.requiresPassword = false;
    api.get.mockResolvedValue({ data: { approvals: [] } });
    api.post.mockResolvedValue({ data: {} });
});

describe('ApprovalPrompt', () => {
    it('shows a sign-in request from the list and approves it', async () => {
        api.get.mockResolvedValue({ data: { approvals: [signinRequest] } });
        render(<ApprovalPrompt />);
        expect(await screen.findByText('Edge on Windows near Pune, IN is trying to sign in to your account.')).toBeTruthy();
        fireEvent.click(screen.getByTestId('approval-approve'));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/auth/approvals/a1/decision', { approve: true }));
        await waitFor(() => expect(screen.queryByText(/is trying to sign in/)).toBeNull());
    });

    it('requests arriving over the socket pop up; Deny answers no; resolved elsewhere closes it', async () => {
        render(<ApprovalPrompt />);
        await waitFor(() => expect(handlers['auth:approval-request']).toBeTruthy());
        act(() => handlers['auth:approval-request'](signinRequest));
        expect(await screen.findByText('Sign-in request')).toBeTruthy();
        act(() => handlers['auth:approval-resolved']({ id: 'a1' }));
        await waitFor(() => expect(screen.queryByText('Sign-in request')).toBeNull());

        act(() => handlers['auth:approval-request']({ ...signinRequest, id: 'a2' }));
        fireEvent.click(await screen.findByTestId('approval-deny'));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/auth/approvals/a2/decision', { approve: false }));
    });

    it('an unlock request on a password-protected account asks the password once, seals, then approves', async () => {
        svc.getProtectionType.mockResolvedValue('PASSWORD');
        svc.sealWithPassword.mockResolvedValue('SERVER_KEK');
        api.get.mockResolvedValue({ data: { approvals: [{ ...signinRequest, id: 'u9', kind: 'unlock' }] } });
        render(<ApprovalPrompt />);
        const field = await screen.findByLabelText('Your password, once');
        fireEvent.change(field, { target: { value: 'Passw0rd!' } });
        fireEvent.click(screen.getByTestId('approval-approve'));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v2/crypto/unlock-requests/u9/decision', { approve: true }));
        expect(svc.sealWithPassword).toHaveBeenCalledWith('Passw0rd!');
    });
});

describe('MessagesLockedBanner', () => {
    it('is not shown when messages are unlocked', () => {
        render(<MessagesLockedBanner />);
        expect(screen.queryByTestId('messages-locked-banner')).toBeNull();
    });

    it('does not block: dismissible, password once, or ask another device', async () => {
        vi.useFakeTimers();
        try {
            auth.requiresPassword = true;
            api.post.mockResolvedValue({ data: { id: 'r1' } });
            api.get.mockResolvedValue({ data: { status: 'approved', umekProtectionType: 'SERVER_KEK' } });
            render(<MessagesLockedBanner pollMs={3000} />);
            expect(screen.getByText('Messages are locked on this device')).toBeTruthy();
            await act(async () => { fireEvent.click(screen.getByTestId('ask-another-device')); });
            expect(api.post).toHaveBeenCalledWith('/api/v2/crypto/unlock-requests', {});
            await act(async () => { await vi.advanceTimersByTimeAsync(3100); });
            expect(auth.retryEncryption).toHaveBeenCalled();

            fireEvent.click(screen.getByRole('button', { name: /Enter password once/ }));
            expect(screen.getByText('Unlock your messages')).toBeTruthy();
            fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
            expect(screen.queryByText('Unlock your messages')).toBeNull();
            fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
            expect(screen.queryByTestId('messages-locked-banner')).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    it('retries when another device sealed the key', () => {
        auth.requiresPassword = true;
        render(<MessagesLockedBanner />);
        act(() => handlers['crypto:umek-sealed']?.({ version: 4 }));
        expect(auth.retryEncryption).toHaveBeenCalled();
    });
});
