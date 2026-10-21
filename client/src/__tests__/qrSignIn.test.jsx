// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';

vi.mock('@services/api', () => ({ default: { post: vi.fn(), get: vi.fn() } }));
vi.mock('../contexts/SocketContext', () => ({ useOptionalSocket: () => null }));

import api from '@services/api';
import QrSignIn from '../components/loginpage/QrSignIn';
import SignInPhoneDialog from '../components/security/SignInPhoneDialog';

const KEY = { privateKey: { fake: 'private' }, publicKey: 'BPUB' };
const makeKey = vi.fn(async () => KEY);
const fail = (status, data) => Object.assign(new Error('x'), { response: { status, data } });
const tick = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

function codes() {
    let n = 0;
    return () => {
        n += 1;
        return { data: { code: `code-${n}`, secret: `secret-${n}`, qrDataUrl: `data:image/png;base64,${n}`, expiresAt: new Date(Date.now() + 60000).toISOString() } };
    };
}

describe('Sign in with QR (login screen)', () => {
    it('shows a code bound to a one-time key, polls, and hands over the session with that key', async () => {
        const next = codes();
        let polls = 0;
        api.post.mockImplementation(async (url, body) => {
            if (url === '/api/auth/qr/request') { expect(body).toEqual({ publicKey: 'BPUB' }); return next(); }
            if (url === '/api/auth/qr/poll') {
                polls += 1;
                expect(body).toEqual({ code: 'code-1', secret: 'secret-1' });
                if (polls === 1) return { data: { status: 'scanned' } };
                return { data: { accessToken: 'tok', user: { id: 'u1' }, keys: { serverEphemeralPublicKey: 's', rewrappedUmek: 'w' } } };
            }
            throw new Error(url);
        });
        const onSession = vi.fn();
        render(<QrSignIn onSession={onSession} onChallenge={vi.fn()} onBack={vi.fn()} makeKey={makeKey} />);
        await tick(0);
        expect(screen.getByTestId('qr-image').getAttribute('src')).toBe('data:image/png;base64,1');
        expect(screen.getByText(/Settings → Scan to sign in/)).toBeTruthy();
        await tick(2000);
        expect(screen.getByText('Scanned — approve on your phone')).toBeTruthy();
        await tick(2000);
        expect(onSession).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'tok', keys: expect.any(Object) }), { ephemeralPrivateKey: KEY.privateKey });
    });

    it('shows a new code every minute while nobody scans it', async () => {
        const next = codes();
        api.post.mockImplementation(async (url) => (url === '/api/auth/qr/request' ? next() : { data: { status: 'waiting' } }));
        render(<QrSignIn onSession={vi.fn()} onChallenge={vi.fn()} onBack={vi.fn()} makeKey={makeKey} />);
        await tick(0);
        await tick(62000);
        expect(api.post.mock.calls.filter(([u]) => u === '/api/auth/qr/request').length).toBeGreaterThanOrEqual(2);
        expect(screen.getByTestId('qr-image').getAttribute('src')).not.toBe('data:image/png;base64,1');
        // The same one-time key is used for every code.
        expect(makeKey).toHaveBeenCalledTimes(1);
    });

    it('declined on the phone: says so and offers a new code', async () => {
        const next = codes();
        api.post.mockImplementation(async (url) => {
            if (url === '/api/auth/qr/request') return next();
            throw fail(403, { code: 'QR_DENIED', message: 'Sign-in was declined on your other device.' });
        });
        render(<QrSignIn onSession={vi.fn()} onChallenge={vi.fn()} onBack={vi.fn()} makeKey={makeKey} />);
        await tick(0);
        await tick(2000);
        expect(screen.getByText('Sign-in was declined on your other device.')).toBeTruthy();
        expect(screen.getByRole('button', { name: /Show a new code/ })).toBeTruthy();
    });

    it('over the device limit the challenge takes over, keeping the one-time key', async () => {
        const next = codes();
        const limit = { code: 'DEVICE_LIMIT', pendingToken: 'p'.repeat(43), devices: [], limit: 4 };
        api.post.mockImplementation(async (url) => {
            if (url === '/api/auth/qr/request') return next();
            throw fail(409, limit);
        });
        const onChallenge = vi.fn();
        render(<QrSignIn onSession={vi.fn()} onChallenge={onChallenge} onBack={vi.fn()} makeKey={makeKey} />);
        await tick(0);
        await tick(2000);
        expect(onChallenge).toHaveBeenCalledWith(limit, { ephemeralPrivateKey: KEY.privateKey });
    });
});

describe('Settings → Devices → Sign in a phone', () => {
    it('shows a code, and once a phone claims it asks "Allow <phone> to sign in?"', async () => {
        api.post.mockImplementation(async (url, body) => {
            if (url === '/api/auth/qr/offer') return { data: { code: 'offer-1', qrDataUrl: 'data:image/png;base64,Q', expiresAt: new Date(Date.now() + 60000).toISOString() } };
            if (url === '/api/auth/qr/offer/status') return { data: { status: 'claimed', requester: { deviceName: 'Pixel 8 (Android 15)', location: 'Pune, IN' } } };
            if (url === '/api/auth/qr/decide') { expect(body).toEqual({ code: 'offer-1', approve: true }); return { data: { status: 'approved' } }; }
            throw new Error(url);
        });
        const onSignedIn = vi.fn();
        render(<SignInPhoneDialog open onClose={vi.fn()} onSignedIn={onSignedIn} />);
        await tick(0);
        expect(screen.getByAltText('QR code for signing in a phone')).toBeTruthy();
        await tick(2000);
        expect(screen.getByText(/Allow Pixel 8 \(Android 15\) near Pune, IN to sign in\?/)).toBeTruthy();
        fireEvent.click(screen.getByTestId('allow-phone'));
        await tick(0);
        expect(onSignedIn).toHaveBeenCalled();
    });
});
