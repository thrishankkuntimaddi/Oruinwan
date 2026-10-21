// QR sign-in from the start screen, the two-step / device-limit screens, and approvals on a
// signed-in phone. The session and the scanner are stand-ins; the scanner falls back to "paste".
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';

const live = vi.hoisted(() => ({}));
const mockSession = vi.hoisted(() => ({ store: null }));
vi.mock('../../data/session.js', () => {
  mockSession.store = create(() => ({ status: 'signed-out', challenge: null }));
  return { api: () => live, useSession: mockSession.store };
});
vi.mock('../../native/index.js', () => ({
  hideKeyboard: vi.fn(), tap: vi.fn(), deviceNoun: 'phone', platformLabel: 'Android', isAndroid: false, isNative: false, clientPlatform: 'android',
  onAppState: vi.fn(async () => () => {}),
}));
vi.mock('../../native/scanner.js', () => ({
  usesNativeScanner: () => false, cameraAvailable: () => false, nativeScan: vi.fn(), createDetector: vi.fn(), openCamera: vi.fn(),
}));
vi.mock('../../config/env.js', () => ({ SERVER_URL: 'https://oru.test' }));

const { QrSignIn } = await import('./QrSignIn.jsx');
const { SignInChallenge } = await import('./SignInChallenge.jsx');
const { ApprovalHost } = await import('./ApprovalHost.jsx');
const { emit } = await import('../../lib/bus.js');

const CODE = 'B'.repeat(32);

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

async function pasteCode(text) {
  fireEvent.change(await screen.findByLabelText('Sign-in code'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
}

describe('<QrSignIn> (start screen)', () => {
  it('claims the scanned code, waits for the computer, then is signed in', async () => {
    const qrClaim = vi.fn(async () => ({ secret: 's', approver: { deviceName: 'Chrome on macOS' } }));
    const qrPoll = vi.fn(async () => ({ status: 'done' }));
    mockSession.store.setState({ qrClaim, qrPoll, qrForget: vi.fn() });
    render(<QrSignIn onBack={() => {}} />);
    await pasteCode(`oruinwan://signin?c=${CODE}`);
    await waitFor(() => expect(qrClaim).toHaveBeenCalledWith({ server: 'https://oru.test', code: CODE }));
    expect((await screen.findByTestId('qr-waiting')).textContent).toContain('Chrome on macOS');
    expect((screen.getByTestId('qr-waiting')).textContent).toContain('Allow Android to sign in?');
    await waitFor(() => expect(qrPoll).toHaveBeenCalledWith({ code: CODE, secret: 's' }), { timeout: 4000 });
  });

  it('a login-screen code points to Scan to sign in; other text is refused', async () => {
    const qrClaim = vi.fn(async () => {
      throw Object.assign(new Error('x'), { code: 'QR_WRONG_SIDE' });
    });
    mockSession.store.setState({ qrClaim, qrPoll: vi.fn(), qrForget: vi.fn() });
    render(<QrSignIn onBack={() => {}} />);
    await pasteCode('hello');
    expect(await screen.findByText("That isn't an Oruinwan sign-in code.")).toBeTruthy();
    await pasteCode(CODE);
    expect(await screen.findByText(/Settings → Scan to sign in/)).toBeTruthy();
  });

  it('a decline on the computer is shown', async () => {
    mockSession.store.setState({
      qrClaim: vi.fn(async () => ({ secret: 's' })),
      qrPoll: vi.fn(async () => {
        throw Object.assign(new Error('x'), { code: 'QR_DENIED' });
      }),
      qrForget: vi.fn(),
    });
    render(<QrSignIn onBack={() => {}} />);
    await pasteCode(CODE);
    expect(await screen.findByText(/declined on your other device/, {}, { timeout: 4000 })).toBeTruthy();
  });
});

describe('<SignInChallenge>', () => {
  const devices = [
    { id: 'd1', name: 'Chrome on Windows', platform: 'web', lastActiveAt: new Date().toISOString(), location: 'Hyderabad, IN' },
    { id: 'd2', name: 'Pixel 8', platform: 'android', lastActiveAt: null },
  ];

  it('device limit: sign one out, or everywhere', async () => {
    const continueChallenge = vi.fn(async () => {});
    mockSession.store.setState({ challenge: { code: 'DEVICE_LIMIT', limit: 4, devices, pendingToken: 't' }, continueChallenge, cancelChallenge: vi.fn() });
    render(<SignInChallenge />);
    expect(screen.getByText("You're signed in on 4 devices")).toBeTruthy();
    expect((screen.getByTestId('device-limit-list')).textContent).toContain('Hyderabad, IN');
    fireEvent.click(screen.getAllByRole('button', { name: 'Sign out' })[0]);
    await waitFor(() => expect(continueChallenge).toHaveBeenCalledWith({ signOutDeviceIds: ['d1'] }));
    fireEvent.click(screen.getByRole('button', { name: /Sign out everywhere and sign in here/ }));
    await waitFor(() => expect(continueChallenge).toHaveBeenLastCalledWith({ signOutAll: true }));
  });

  it('two-step: authenticator code and email code', async () => {
    const continueChallenge = vi.fn(async () => {});
    const challengeEmailCode = vi.fn(async () => ({ emailHint: 'al••@example.com' }));
    mockSession.store.setState({
      challenge: { code: 'MFA_REQUIRED', pendingToken: 't', methods: { approve: false, totp: true, email: true }, emailHint: 'al••@example.com' },
      continueChallenge, challengeEmailCode, challengeStatus: vi.fn(), cancelChallenge: vi.fn(),
    });
    render(<SignInChallenge />);
    fireEvent.change(screen.getByLabelText('Authenticator app code'), { target: { value: '123456' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Verify' })[0]);
    await waitFor(() => expect(continueChallenge).toHaveBeenCalledWith({ otp: '123456' }));

    fireEvent.click(screen.getByRole('button', { name: /Email me a code/ }));
    const field = await screen.findByLabelText('Code sent to al••@example.com');
    fireEvent.change(field, { target: { value: '654321' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Verify' })[1]);
    await waitFor(() => expect(continueChallenge).toHaveBeenLastCalledWith({ emailCode: '654321' }));
  });

  it('two-step: finishes by itself once another device approves; a denial ends it', async () => {
    const continueChallenge = vi.fn(async () => {
      throw Object.assign(new Error('This sign-in was denied on another device.'), { code: 'SIGNIN_DENIED' });
    });
    const challengeStatus = vi.fn(async () => ({ approval: { status: 'denied' } }));
    mockSession.store.setState({
      challenge: { code: 'MFA_REQUIRED', pendingToken: 't', methods: { approve: true, totp: true, email: false } },
      continueChallenge, challengeStatus, challengeEmailCode: vi.fn(), cancelChallenge: vi.fn(),
    });
    render(<SignInChallenge />);
    expect((screen.getByTestId('mfa-approve')).textContent).toContain('Waiting for approval');
    await waitFor(() => expect(continueChallenge).toHaveBeenCalledWith({}), { timeout: 4000 });
    expect(await screen.findByText('This sign-in was denied on another device.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back to sign in' })).toBeTruthy();
  });
});

describe('<ApprovalHost> (signed in)', () => {
  beforeEach(() => {
    mockSession.store.setState({ status: 'signed-in' });
    live.approvals = vi.fn(async () => []);
    live.decideSignInApproval = vi.fn(async () => ({}));
    live.decideUnlockApproval = vi.fn(async () => {});
  });

  it('a sign-in request from another device can be approved', async () => {
    render(<ApprovalHost />);
    await waitFor(() => expect(live.approvals).toHaveBeenCalled());
    act(() => {
      emit('socket', { event: 'auth:approval-request', payload: { id: 'a1', kind: 'signin', status: 'pending', requester: { deviceName: 'Chrome on Windows', location: 'Hyderabad, IN' } } });
    });
    expect(await screen.findByText(/Sign-in request from Chrome on Windows near Hyderabad, IN/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(live.decideSignInApproval).toHaveBeenCalledWith('a1', true));
  });

  it('an unlock request asks for the password once when the key is still password-protected', async () => {
    live.decideUnlockApproval = vi.fn(async (id, approve, password) => {
      if (!password) throw Object.assign(new Error('Enter your password'), { code: 'PASSWORD_NEEDED' });
    });
    live.approvals = vi.fn(async () => [{ id: 'u1', kind: 'unlock', status: 'pending', requester: { deviceName: 'Firefox on Linux' } }]);
    render(<ApprovalHost />);
    fireEvent.click(await screen.findByRole('button', { name: 'Unlock' }));
    fireEvent.change(await screen.findByLabelText('Your password'), { target: { value: 'Passw0rd!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(live.decideUnlockApproval).toHaveBeenLastCalledWith('u1', true, 'Passw0rd!'));
  });

  it('Scan to sign in: scanned login-screen code → approve that computer', async () => {
    live.qrScan = vi.fn(async () => ({ requester: { deviceName: 'Safari on macOS', location: 'Pune, IN' } }));
    live.qrDecide = vi.fn(async () => ({ status: 'approved' }));
    render(<ApprovalHost />);
    act(() => emit('qr:scan-to-sign-in'));
    await pasteCode(`oruinwan://signin?c=${CODE}`);
    expect(await screen.findByText(/Sign in on Safari on macOS near Pune, IN\?/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(live.qrDecide).toHaveBeenCalledWith(CODE, true));
  });
});
