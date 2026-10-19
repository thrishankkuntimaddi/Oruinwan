// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const loadUser = vi.fn(async () => {});
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ loadUser }) }));
vi.mock('@services/api', () => ({ default: { post: vi.fn() } }));
vi.mock('../utils/tokenUtils', () => ({ saveAccessToken: vi.fn() }));
vi.mock('../components/public/AuthShell', () => ({ default: ({ children }) => <div>{children}</div> }));

import api from '@services/api';
import { saveAccessToken } from '../utils/tokenUtils';
import OAuthSuccess from '../pages/LoginPageComp/OAuthSuccess';

function renderAt(hash) {
  window.history.replaceState({}, '', `/oauth-success${hash}`);
  return render(
    <MemoryRouter initialEntries={['/oauth-success']}>
      <Routes>
        <Route path="/oauth-success" element={<OAuthSuccess />} />
        <Route path="/workspaces" element={<p>Workspaces page</p>} />
        <Route path="/set-password" element={<p>Set password page</p>} />
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const reject = (status, data) => Promise.reject(Object.assign(new Error('x'), { response: { status, data } }));

beforeEach(() => {
  api.post.mockReset();
  loadUser.mockClear();
  saveAccessToken.mockClear();
});

describe('OAuth sign-in landing page', () => {
  it('swaps the code for a session and opens the workspaces', async () => {
    api.post.mockResolvedValueOnce({ data: { accessToken: 'jwt', requiresPasswordSetup: false } });
    renderAt('#code=abc123abc123abc123abc123');
    expect(await screen.findByText('Workspaces page')).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/api/auth/oauth/exchange', { code: 'abc123abc123abc123abc123' });
    expect(saveAccessToken).toHaveBeenCalledWith('jwt');
    expect(loadUser).toHaveBeenCalled();
    expect(window.location.hash).toBe('');
  });

  it('asks new accounts to set a password', async () => {
    api.post.mockResolvedValueOnce({ data: { accessToken: 'jwt', requiresPasswordSetup: true } });
    renderAt('#code=abc123abc123abc123abc123');
    expect(await screen.findByText('Set password page')).toBeTruthy();
  });

  it('asks for the two-factor code and sends it with the same hand-off code', async () => {
    api.post
      .mockImplementationOnce(() => reject(401, { requires2FA: true, message: 'Enter the code' }))
      .mockResolvedValueOnce({ data: { accessToken: 'jwt', requiresPasswordSetup: false } });
    renderAt('#code=abc123abc123abc123abc123');
    const input = await screen.findByLabelText('Authentication code');
    fireEvent.change(input, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /Verify and sign in/ }));
    expect(await screen.findByText('Workspaces page')).toBeTruthy();
    expect(api.post).toHaveBeenLastCalledWith('/api/auth/oauth/exchange', { code: 'abc123abc123abc123abc123', otp: '123456' });
  });

  it('explains an expired link instead of failing silently', async () => {
    api.post.mockImplementationOnce(() => reject(400, { message: 'This sign-in link has expired. Sign in again.' }));
    renderAt('#code=abc123abc123abc123abc123');
    expect(await screen.findByText('This sign-in link has expired. Sign in again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Back to sign in/ }));
    await waitFor(() => expect(screen.getByText('Login page')).toBeTruthy());
  });

  it('goes back to sign-in when there is no code', async () => {
    renderAt('');
    expect(await screen.findByText('Login page')).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });
});
