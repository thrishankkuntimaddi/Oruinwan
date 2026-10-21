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

import SsoSignIn, { workDomain, workEmail, discoverSso, ssoErrorMessage, ssoStartWithDevice } from '../components/loginpage/SsoSignIn';
import SsoCallback, { readSsoToken } from '../pages/LoginPageComp/SsoCallback';

const SAML = 'https://api.example.test/api/auth/sso/saml/c1/login';

beforeEach(() => {
    vi.clearAllMocks();
    flags.sso = true;
    localStorage.clear();
});

describe('SSO helpers', () => {
    it('reads a work domain and a full work email', () => {
        expect(workDomain('Ada@Acme.co.uk')).toBe('acme.co.uk');
        expect(workDomain('ada')).toBeNull();
        expect(workEmail(' Ada@Acme.com ')).toBe('ada@acme.com');
        expect(workEmail('acme.com')).toBeNull();
        expect(workEmail('')).toBeNull();
    });

    it('adds the device id to the start URL', () => {
        expect(ssoStartWithDevice(SAML, 'dev 1')).toBe(`${SAML}?deviceId=dev%201`);
        expect(ssoStartWithDevice(`${SAML}?x=1`, 'd')).toBe(`${SAML}?x=1&deviceId=d`);
        expect(ssoStartWithDevice(SAML, null)).toBe(SAML);
        expect(ssoStartWithDevice(null, 'd')).toBeNull();
    });

    it('discovers SAML / OIDC, nothing, a disabled feature and errors', async () => {
        const client = { get: vi.fn() };
        client.get.mockResolvedValueOnce({ data: { enabled: true, protocol: 'saml', startUrl: SAML } });
        expect(await discoverSso('ada@acme.com', client)).toEqual({ protocol: 'saml', startUrl: SAML });
        expect(client.get).toHaveBeenCalledWith('/api/auth/sso/discover', { params: { email: 'ada@acme.com' } });
        client.get.mockResolvedValueOnce({ data: { enabled: true, protocol: 'oidc', startUrl: 'https://api.example.test/api/auth/sso/okta' } });
        expect((await discoverSso('a@b.com', client)).protocol).toBe('oidc');
        client.get.mockResolvedValueOnce({ data: { enabled: false } });
        expect(await discoverSso('a@b.com', client)).toBe('none');
        client.get.mockResolvedValueOnce({ data: { enabled: true, startUrl: 'javascript:alert(1)' } });
        expect(await discoverSso('a@b.com', client)).toBe('none');
        client.get.mockRejectedValueOnce({ response: { status: 404 } });
        expect(await discoverSso('a@b.com', client)).toBe('disabled');
        client.get.mockRejectedValueOnce(new Error('offline'));
        expect(await discoverSso('a@b.com', client)).toBe('error');
    });

    it('explains SSO errors (OIDC and SAML) and ignores others', () => {
        expect(ssoErrorMessage('sso_state_mismatch')).toMatch(/expired/);
        expect(ssoErrorMessage('sso_saml_no_account')).toMatch(/invite/);
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

    it('asks for a full work email, then navigates to the discovered start URL with the device id', async () => {
        const discover = vi.fn(async () => ({ protocol: 'saml', startUrl: SAML }));
        const navigateTo = vi.fn();
        render(<SsoSignIn discover={discover} navigateTo={navigateTo} deviceId={() => 'dev-1'} />);

        fireEvent.click(screen.getByTestId('sign-in-with-sso'));
        fireEvent.change(screen.getByLabelText(/Work email/), { target: { value: 'acme.com' } });
        fireEvent.click(screen.getByRole('button', { name: /Continue with SSO/ }));
        expect(await screen.findByRole('alert')).toHaveTextContent(/full work email/);
        expect(discover).not.toHaveBeenCalled();

        fireEvent.change(screen.getByLabelText(/Work email/), { target: { value: 'ada@acme.com' } });
        fireEvent.click(screen.getByRole('button', { name: /Continue with SSO/ }));
        await waitFor(() => expect(navigateTo).toHaveBeenCalledWith(`${SAML}?deviceId=dev-1`));
        expect(discover).toHaveBeenCalledWith('ada@acme.com');
        expect(screen.getByRole('status')).toHaveTextContent(/SAML/);
    });

    it('says so when the company has no SSO, and hides itself when the feature is off', async () => {
        const { unmount } = render(<SsoSignIn initialEmail="ada@acme.com" discover={async () => 'none'} />);
        fireEvent.click(screen.getByTestId('sign-in-with-sso'));
        fireEvent.click(screen.getByRole('button', { name: /Continue with SSO/ }));
        expect(await screen.findByRole('alert')).toHaveTextContent(/isn’t set up/);
        unmount();

        const { container } = render(<SsoSignIn initialEmail="ada@acme.com" discover={async () => 'disabled'} />);
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
