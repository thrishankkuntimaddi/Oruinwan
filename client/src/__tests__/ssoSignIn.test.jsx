// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const flags = { sso: true };
const navigate = vi.fn();
const loadUser = vi.fn(async () => {});

vi.mock('@services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), defaults: { baseURL: 'https://api.example.test' } } }));
vi.mock('../appMode/env', () => ({ IS_APP: false, IS_SITE: false }));
vi.mock('../contexts/FeatureFlagsContext', () => ({ useFlag: (name) => flags[name] === true }));
vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => navigate }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ loadUser }) }));
vi.mock('../components/public/AuthShell', () => ({ default: ({ children }) => <div>{children}</div> }));

import SsoSignIn, { workDomain, rankProviders, probeSsoProvider, ssoErrorMessage, ssoStartUrl, SSO_PROVIDERS } from '../components/loginpage/SsoSignIn';
import SsoCallback, { readSsoToken } from '../pages/LoginPageComp/SsoCallback';

beforeEach(() => {
    vi.clearAllMocks();
    flags.sso = true;
    localStorage.clear();
});

describe('SSO helpers', () => {
    it('reads a work domain from an email or a bare domain', () => {
        expect(workDomain('Ada@Acme.co.uk')).toBe('acme.co.uk');
        expect(workDomain(' acme.com ')).toBe('acme.com');
        expect(workDomain('ada')).toBeNull();
        expect(workDomain('')).toBeNull();
    });

    it('puts the likely provider first', () => {
        expect(rankProviders(SSO_PROVIDERS, 'outlook.com')[0].id).toBe('microsoft');
        expect(rankProviders(SSO_PROVIDERS, 'acme.com').map(p => p.id)).toEqual(['google', 'microsoft', 'okta']);
    });

    it('builds the start URL on the API host', () => {
        expect(ssoStartUrl('okta')).toBe('https://api.example.test/api/auth/sso/okta');
    });

    it('probes a provider without following the redirect', async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce({ type: 'opaqueredirect', status: 0 })
            .mockResolvedValueOnce({ type: 'cors', status: 501 })
            .mockResolvedValueOnce({ type: 'cors', status: 404 })
            .mockRejectedValueOnce(new Error('offline'));
        expect(await probeSsoProvider('google', fetchImpl)).toBe('ready');
        expect(fetchImpl).toHaveBeenCalledWith('https://api.example.test/api/auth/sso/google', expect.objectContaining({ redirect: 'manual' }));
        expect(await probeSsoProvider('microsoft', fetchImpl)).toBe('unconfigured');
        expect(await probeSsoProvider('okta', fetchImpl)).toBe('disabled');
        expect(await probeSsoProvider('okta', fetchImpl)).toBe('error');
    });

    it('explains SSO errors and ignores others', () => {
        expect(ssoErrorMessage('sso_state_mismatch')).toMatch(/expired/);
        expect(ssoErrorMessage('sso_google_failed')).toMatch(/did not complete/);
        expect(ssoErrorMessage('something_else')).toBeNull();
        expect(ssoErrorMessage(null)).toBeNull();
    });
});

describe('SsoSignIn', () => {
    it('is hidden when the server has SSO off', () => {
        flags.sso = false;
        const { container } = render(<SsoSignIn />);
        expect(container.innerHTML).toBe('');
    });

    it('asks for a work email, then offers the providers that are set up', async () => {
        const probe = vi.fn(async (id) => (id === 'okta' ? 'unconfigured' : 'ready'));
        const navigateTo = vi.fn();
        render(<SsoSignIn probe={probe} navigateTo={navigateTo} />);

        fireEvent.click(screen.getByTestId('sign-in-with-sso'));
        fireEvent.change(screen.getByLabelText(/Work email or company domain/), { target: { value: 'nope' } });
        fireEvent.click(screen.getByRole('button', { name: /Continue with SSO/ }));
        expect(await screen.findByRole('alert')).toHaveTextContent(/work email/);
        expect(probe).not.toHaveBeenCalled();

        fireEvent.change(screen.getByLabelText(/Work email or company domain/), { target: { value: 'ada@acme.com' } });
        fireEvent.click(screen.getByRole('button', { name: /Continue with SSO/ }));
        const group = await screen.findByRole('group', { name: /identity provider/ });
        expect(group).toHaveTextContent('acme.com');
        expect(screen.queryByRole('button', { name: 'Okta' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Microsoft Entra ID' }));
        expect(navigateTo).toHaveBeenCalledWith('https://api.example.test/api/auth/sso/microsoft');
    });

    it('goes straight to the only provider that is set up', async () => {
        const navigateTo = vi.fn();
        render(<SsoSignIn initialEmail="ada@acme.com" probe={async (id) => (id === 'google' ? 'ready' : 'unconfigured')} navigateTo={navigateTo} />);
        fireEvent.click(screen.getByTestId('sign-in-with-sso'));
        fireEvent.click(screen.getByRole('button', { name: /Continue with SSO/ }));
        await waitFor(() => expect(navigateTo).toHaveBeenCalledWith('https://api.example.test/api/auth/sso/google'));
    });

    it('says so when no provider is set up, and hides itself when SSO answers 404', async () => {
        const { unmount } = render(<SsoSignIn initialEmail="acme.com" probe={async () => 'unconfigured'} />);
        fireEvent.click(screen.getByTestId('sign-in-with-sso'));
        fireEvent.click(screen.getByRole('button', { name: /Continue with SSO/ }));
        expect(await screen.findByRole('alert')).toHaveTextContent(/isn’t set up/);
        unmount();

        const { container } = render(<SsoSignIn initialEmail="acme.com" probe={async () => 'disabled'} />);
        fireEvent.click(screen.getByTestId('sign-in-with-sso'));
        fireEvent.click(screen.getByRole('button', { name: /Continue with SSO/ }));
        await waitFor(() => expect(container.innerHTML).toBe(''));
    });
});

describe('SsoCallback (/oauth-success)', () => {
    const jwt = 'aaa.bbb.ccc';

    it('reads only a JWT-looking token from the fragment', () => {
        expect(readSsoToken(`#access=${jwt}`)).toBe(jwt);
        expect(readSsoToken('#access=nope')).toBeNull();
        expect(readSsoToken('')).toBeNull();
    });

    it('keeps the token, loads the account and continues to sign-in routing', async () => {
        window.history.replaceState(null, '', `/oauth-success#access=${jwt}`);
        render(<MemoryRouter><SsoCallback /></MemoryRouter>);
        await waitFor(() => expect(navigate).toHaveBeenCalledWith('/login', { replace: true }));
        expect(localStorage.getItem('accessToken')).toBe(jwt);
        expect(loadUser).toHaveBeenCalled();
        expect(window.location.hash).toBe('');
    });

    it('shows an error without a token', async () => {
        window.history.replaceState(null, '', '/oauth-success');
        render(<MemoryRouter><SsoCallback /></MemoryRouter>);
        expect(await screen.findByTestId('sso-callback-error')).toBeTruthy();
        expect(navigate).not.toHaveBeenCalled();
    });
});
