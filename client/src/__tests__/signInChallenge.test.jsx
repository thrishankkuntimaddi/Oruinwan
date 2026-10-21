// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navigate = vi.fn();
const adoptSession = vi.fn();
const login = vi.fn();
const showToast = vi.fn();

vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => navigate }));
vi.mock('../contexts/AuthContext', async () => {
    const { createContext } = await import('react');
    return { AuthContext: createContext({ setUser: vi.fn(), login: (...a) => login(...a), adoptSession: (...a) => adoptSession(...a) }) };
});
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast }) }));
vi.mock('@services/api', () => ({ default: { post: vi.fn(), get: vi.fn() } }));
vi.mock('../appMode/env', () => ({ IS_APP: false, IS_SITE: false }));
vi.mock('@react-oauth/google', () => ({ useGoogleLogin: () => () => {} }));
vi.mock('@simplewebauthn/browser', () => ({ startAuthentication: vi.fn() }));

import api from '@services/api';
import SignInChallenge, { signInChallengeFrom, lastActiveText } from '../components/loginpage/SignInChallenge';
import LoginForm from '../components/loginpage/LoginForm';

const TOKEN = 'p'.repeat(43);
const fail = (status, data) => Object.assign(new Error(data.message || 'x'), { response: { status, data } });
const MFA = { code: 'MFA_REQUIRED', pendingToken: TOKEN, methods: { approve: true, totp: true, email: true }, emailHint: 'al••@example.com', approvalId: 'a1' };
const LIMIT = {
    code: 'DEVICE_LIMIT', pendingToken: TOKEN, limit: 4,
    devices: [
        { id: 'd1', name: 'Chrome on macOS', platform: 'web', lastActiveAt: new Date().toISOString(), location: 'Hyderabad, IN' },
        { id: 'd2', name: 'iPhone', platform: 'ios', lastActiveAt: null, location: null },
    ],
};

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    api.get.mockResolvedValue({ data: {} });
});

describe('signInChallengeFrom', () => {
    it('recognises the two sign-in steps only', () => {
        expect(signInChallengeFrom(MFA)).toBe(MFA);
        expect(signInChallengeFrom(LIMIT)).toBe(LIMIT);
        expect(signInChallengeFrom({ requires2FA: true })).toBeNull();
        expect(signInChallengeFrom({ code: 'DEVICE_LIMIT' })).toBeNull();
        expect(lastActiveText(new Date(Date.now() - 3 * 3600000).toISOString())).toBe('Active 3 h ago');
    });
});

describe('device limit', () => {
    it('lists the devices and signs one out to continue', async () => {
        const onSession = vi.fn();
        api.post.mockResolvedValue({ data: { accessToken: 'tok', user: { id: 'u1' } } });
        render(<SignInChallenge challenge={LIMIT} onSession={onSession} onCancel={vi.fn()} />);
        expect(screen.getByText(/You're signed in on 4 devices. Sign out of one to continue/)).toBeTruthy();
        expect(screen.getByText(/Hyderabad, IN/)).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Sign out of iPhone' }));
        await waitFor(() => expect(onSession).toHaveBeenCalledWith({ accessToken: 'tok', user: { id: 'u1' } }));
        expect(api.post).toHaveBeenCalledWith('/api/auth/signin/continue', { pendingToken: TOKEN, signOutDeviceIds: ['d2'] });
    });

    it('"Sign out everywhere and sign in here"', async () => {
        api.post.mockResolvedValue({ data: { accessToken: 'tok', user: {} } });
        render(<SignInChallenge challenge={LIMIT} onSession={vi.fn()} onCancel={vi.fn()} />);
        fireEvent.click(screen.getByTestId('sign-out-everywhere'));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/auth/signin/continue', { pendingToken: TOKEN, signOutAll: true }));
    });

    it('an expired sign-in goes back to the form', async () => {
        const onCancel = vi.fn();
        api.post.mockRejectedValue(fail(410, { code: 'SIGNIN_EXPIRED', message: 'This sign-in has expired. Sign in again.' }));
        render(<SignInChallenge challenge={LIMIT} onSession={vi.fn()} onCancel={onCancel} />);
        fireEvent.click(screen.getByTestId('sign-out-everywhere'));
        await waitFor(() => expect(onCancel).toHaveBeenCalledWith('This sign-in has expired. Sign in again.'));
    });
});

describe('two-step verification', () => {
    it('shows all three ways; the authenticator code finishes it', async () => {
        const onSession = vi.fn();
        api.post.mockResolvedValue({ data: { accessToken: 'tok', user: {} } });
        render(<SignInChallenge challenge={MFA} onSession={onSession} onCancel={vi.fn()} pollMs={100000} />);
        expect(screen.getByText('Approve on another device')).toBeTruthy();
        expect(screen.getByText('Email code')).toBeTruthy();
        fireEvent.change(screen.getByTestId('login-otp'), { target: { value: '123 456' } });
        fireEvent.click(screen.getAllByRole('button', { name: 'Verify' })[0]);
        await waitFor(() => expect(onSession).toHaveBeenCalled());
        expect(api.post).toHaveBeenCalledWith('/api/auth/signin/continue', { pendingToken: TOKEN, otp: '123456' });
    });

    it('a wrong code says so; then the device limit follows with the same token', async () => {
        api.post
            .mockRejectedValueOnce(fail(401, { ...MFA, invalidCode: true, message: "That code didn't work. Try again." }))
            .mockRejectedValueOnce(fail(409, LIMIT));
        render(<SignInChallenge challenge={{ ...MFA, methods: { totp: true } }} onSession={vi.fn()} onCancel={vi.fn()} />);
        fireEvent.change(screen.getByTestId('login-otp'), { target: { value: '000000' } });
        fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
        expect(await screen.findByText("That code didn't work. Try again.")).toBeTruthy();
        fireEvent.change(screen.getByTestId('login-otp'), { target: { value: '123456' } });
        fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
        expect(await screen.findByTestId('device-limit')).toBeTruthy();
    });

    it('email code: asks for one, then verifies it', async () => {
        api.post.mockImplementation(async (url, body) => {
            if (url === '/api/auth/signin/email-code') return { data: { sent: true, emailHint: 'al••@example.com' } };
            if (url === '/api/auth/signin/continue' && body.emailCode === '654321') return { data: { accessToken: 'tok', user: {} } };
            throw new Error(`unexpected ${url}`);
        });
        const onSession = vi.fn();
        render(<SignInChallenge challenge={{ ...MFA, methods: { email: true } }} onSession={onSession} onCancel={vi.fn()} />);
        fireEvent.click(screen.getByTestId('send-email-code'));
        fireEvent.change(await screen.findByTestId('email-code'), { target: { value: '654321' } });
        fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
        await waitFor(() => expect(onSession).toHaveBeenCalled());
    });

    it('waits for approval on another device, then finishes', async () => {
        vi.useFakeTimers();
        try {
            let approved = false;
            api.post.mockImplementation(async (url) => {
                if (url === '/api/auth/signin/status') return { data: { approval: { status: approved ? 'approved' : 'pending' } } };
                if (url === '/api/auth/signin/continue') return { data: { accessToken: 'tok', user: {} } };
                throw new Error(url);
            });
            const onSession = vi.fn();
            render(<SignInChallenge challenge={MFA} onSession={onSession} onCancel={vi.fn()} pollMs={2000} />);
            await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
            expect(onSession).not.toHaveBeenCalled();
            approved = true;
            await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
            expect(onSession).toHaveBeenCalledWith({ accessToken: 'tok', user: {} });
        } finally {
            vi.useRealTimers();
        }
    });

    it('a denied request is shown', async () => {
        vi.useFakeTimers();
        try {
            api.post.mockResolvedValue({ data: { approval: { status: 'denied' } } });
            render(<SignInChallenge challenge={MFA} onSession={vi.fn()} onCancel={vi.fn()} pollMs={2000} />);
            await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
            expect(screen.getByText('This sign-in was denied on another device.')).toBeTruthy();
            expect(screen.queryByText('Approve on another device')).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('LoginForm', () => {
    it('a password sign-in over the device limit finishes with the password for the key migration', async () => {
        login.mockRejectedValue(fail(409, LIMIT));
        api.post.mockResolvedValue({ data: { accessToken: 'tok', user: { id: 'u1' }, redirectTo: '/workspaces' } });
        render(<MemoryRouter><LoginForm /></MemoryRouter>);
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@example.com' } });
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Passw0rd!' } });
        fireEvent.click(screen.getByRole('button', { name: /^Sign in$/ }));
        fireEvent.click(await screen.findByRole('button', { name: 'Sign out of Chrome on macOS' }));
        await waitFor(() => expect(adoptSession).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'tok' }), { password: 'Passw0rd!' }));
        expect(navigate).toHaveBeenCalledWith('/workspaces');
    });

    it('a password sign-in with 2FA shows the two-step screen', async () => {
        login.mockRejectedValue(fail(401, MFA));
        render(<MemoryRouter><LoginForm /></MemoryRouter>);
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@example.com' } });
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Passw0rd!' } });
        fireEvent.click(screen.getByRole('button', { name: /^Sign in$/ }));
        expect(await screen.findByTestId('two-step')).toBeTruthy();
    });
});
