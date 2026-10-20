// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navigate = vi.fn();
const setUser = vi.fn();
const showToast = vi.fn();

vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => navigate }));
vi.mock('../contexts/AuthContext', async () => {
    const { createContext } = await import('react');
    return { AuthContext: createContext({ setUser: (...a) => setUser(...a), login: vi.fn() }) };
});
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast }) }));
vi.mock('@services/api', () => ({ default: { post: vi.fn(), get: vi.fn() } }));
vi.mock('../appMode/env', () => ({ IS_APP: false, IS_SITE: false }));
vi.mock('@react-oauth/google', () => ({ useGoogleLogin: () => () => {} }));
vi.mock('@simplewebauthn/browser', () => ({ startAuthentication: vi.fn() }));

import api from '@services/api';
import { startAuthentication } from '@simplewebauthn/browser';
import LoginForm from '../components/loginpage/LoginForm';

const renderForm = () => render(<MemoryRouter><LoginForm /></MemoryRouter>);

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    api.get.mockResolvedValue({ data: {} });
    window.PublicKeyCredential = function PublicKeyCredential() {};
});
afterEach(() => { delete window.PublicKeyCredential; });

describe('Sign in with a passkey', () => {
    it('is hidden when the browser has no WebAuthn', async () => {
        delete window.PublicKeyCredential;
        renderForm();
        await act(async () => {}); // let the providers request settle
        expect(screen.queryByTestId('sign-in-with-passkey')).toBeNull();
    });

    it('asks the browser for a passkey and finishes like Google sign-in', async () => {
        api.post.mockImplementation(async (url) => {
            if (url === '/api/auth/passkeys/login/options') return { data: { challenge: 'c1', rpId: 'localhost' } };
            if (url === '/api/auth/passkeys/login/verify') return { data: { accessToken: 'tok', user: { username: 'Ada' } } };
            throw new Error(`unexpected ${url}`);
        });
        startAuthentication.mockResolvedValue({ id: 'cred-1', response: {} });

        renderForm();
        fireEvent.click(screen.getByRole('button', { name: /Sign in with a passkey/ }));

        await waitFor(() => expect(navigate).toHaveBeenCalledWith('/workspaces'));
        expect(startAuthentication).toHaveBeenCalledWith({ optionsJSON: { challenge: 'c1', rpId: 'localhost' } });
        expect(api.post).toHaveBeenCalledWith('/api/auth/passkeys/login/verify', { response: { id: 'cred-1', response: {} } });
        expect(localStorage.getItem('accessToken')).toBe('tok');
        expect(setUser).toHaveBeenCalledWith({ username: 'Ada' });
    });

    it('shows the server’s reason when the passkey is refused', async () => {
        api.post.mockImplementation(async (url) => {
            if (url === '/api/auth/passkeys/login/options') return { data: { challenge: 'c1' } };
            throw { response: { status: 401, data: { message: "This passkey isn't registered with Oruinwan." } } };
        });
        startAuthentication.mockResolvedValue({ id: 'nope', response: {} });

        renderForm();
        fireEvent.click(screen.getByRole('button', { name: /Sign in with a passkey/ }));

        await waitFor(() => expect(showToast).toHaveBeenCalledWith("This passkey isn't registered with Oruinwan.", 'error'));
        expect(navigate).not.toHaveBeenCalled();
    });

    it('stays quiet when the person closes the browser prompt', async () => {
        api.post.mockResolvedValue({ data: { challenge: 'c1' } });
        startAuthentication.mockRejectedValue(Object.assign(new Error('cancelled'), { name: 'NotAllowedError' }));

        renderForm();
        fireEvent.click(screen.getByRole('button', { name: /Sign in with a passkey/ }));

        await waitFor(() => expect(startAuthentication).toHaveBeenCalled());
        await waitFor(() => expect(screen.getByRole('button', { name: /Sign in with a passkey/ }).disabled).toBe(false));
        expect(showToast).not.toHaveBeenCalled();
        expect(api.post).toHaveBeenCalledTimes(1);
    });
});
