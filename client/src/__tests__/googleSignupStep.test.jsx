// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navigate = vi.fn();
const setUser = vi.fn();

vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => navigate }));
vi.mock('../contexts/AuthContext', async () => {
    const { createContext } = await import('react');
    return { AuthContext: createContext({ setUser: (...a) => setUser(...a) }) };
});
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('@services/api', () => ({ default: { post: vi.fn() } }));
vi.mock('../appMode/env', () => ({ IS_APP: false, IS_SITE: false }));
vi.mock('@react-oauth/google', () => ({ useGoogleLogin: () => () => {} }));

import api from '@services/api';
import GoogleSignupStep from '../components/loginpage/GoogleSignupStep';
import { latestDob } from '../components/loginpage/googleContinue';

const ticket = { signupToken: 't'.repeat(40), email: 'ada@example.com', name: 'Ada Lovelace' };

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
});

describe('Continue with Google for a new email', () => {
    it('says a new account is being created and asks for a date of birth before creating it', async () => {
        api.post.mockResolvedValue({ data: { accessToken: 'a', user: { username: 'Ada Lovelace' }, isFirstLogin: true, requiresPasswordSetup: true } });
        render(<MemoryRouter><GoogleSignupStep ticket={ticket} onCancel={vi.fn()} /></MemoryRouter>);

        expect(screen.getByText("You're creating a new account")).toBeTruthy();
        expect(screen.getByText('ada@example.com')).toBeTruthy();
        expect(screen.getByLabelText('Username').value).toBe('Ada Lovelace');

        const create = screen.getByRole('button', { name: /Create my account/ });
        expect(create.disabled).toBe(true);

        fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '1990-05-01' } });
        expect(create.disabled).toBe(false);
        fireEvent.click(create);

        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/auth/google-signup', {
            signupToken: ticket.signupToken, username: 'Ada Lovelace', dob: '1990-05-01',
        }));
        await waitFor(() => expect(navigate).toHaveBeenCalledWith('/set-password'));
        expect(setUser).toHaveBeenCalled();
    });

    it('shows the server’s reason when sign-up is refused', async () => {
        api.post.mockRejectedValue({ response: { data: { message: 'Username already in use' } } });
        render(<MemoryRouter><GoogleSignupStep ticket={ticket} onCancel={vi.fn()} /></MemoryRouter>);
        fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '1990-05-01' } });
        fireEvent.click(screen.getByRole('button', { name: /Create my account/ }));
        expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Username already in use');
        expect(navigate).not.toHaveBeenCalled();
    });
});

describe('latestDob', () => {
    it('is the date 13 years ago', () => {
        expect(latestDob(new Date(2026, 9, 20))).toBe('2013-10-20');
    });
});
