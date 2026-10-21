// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock('@services/api', () => ({ default: apiMock }));
vi.mock('../services/api', () => ({ default: apiMock }));
vi.mock('../components/workspace/settings/ComplianceExportCard', () => ({ default: () => null }));
vi.mock('../components/workspace/settings/RetentionPolicyCard', () => ({ default: () => null }));
vi.mock('../components/workspace-os/WorkspaceExportImport', () => ({ default: () => null }));

import { planSkipsText, skippedChannelsText, skippedMembersText } from '../features/plan/planSkips';
import { timeWarningText, timeLimitEndedMessage, TIME_LIMIT_ENDED_MESSAGE } from '../features/plan/HuddleTimeLimitBanner';
import { adoptDeviceId } from '../utils/deviceId';
import { FREE_LIMITS, PLANS } from '../pages/pricing/plans';
import { FAQ } from '../pages/landing/data';
import DataTab from '../components/workspace/settings/DataTab';

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

describe('what bulk creates skipped', () => {
    it('words the skipped channels and people', () => {
        const data = { skippedChannels: ['a', 'b'], channelLimit: 10, skippedMembers: [{ userId: 'u1', name: 'Sam', reason: 'workspaces.join' }] };
        expect(skippedChannelsText(data)).toBe('2 channels skipped: free plan allows 10');
        expect(skippedMembersText(data)).toMatch(/^1 person not added .*: Sam$/);
        expect(planSkipsText(data)).toContain('. 1 person not added');
        expect(planSkipsText({ skippedChannels: [], skippedMembers: [] })).toBeNull();
    });

    it('the clone panel shows what the free plan left out', async () => {
        apiMock.post.mockResolvedValue({ data: { workspace: { id: 'w2', name: 'Acme (copy)' }, skippedChannels: ['x', 'y', 'z'], channelLimit: 10, skippedMembers: [{ userId: 'u9', name: 'Ana', reason: 'members.perWorkspace' }] } });
        render(<MemoryRouter><DataTab workspaceId="w1" workspaceName="Acme" /></MemoryRouter>);
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', { name: 'Clone workspace' }));
        const note = await screen.findByTestId('clone-skipped');
        expect(note).toHaveTextContent('3 channels skipped: free plan allows 10');
        expect(note).toHaveTextContent('Ana');
        expect(apiMock.post).toHaveBeenCalledWith('/api/workspace-os/w1/clone', { name: 'Acme (copy)', includeMembers: true });
    });
});

describe('call minutes come from the server', () => {
    it('uses the warning, then the roster, and only then 30', () => {
        expect(timeWarningText({ minutesLeft: 5, maxMinutes: 45 })).toBe('5 minutes left — free plan calls end at 45 minutes');
        expect(timeWarningText({ minutesLeft: 5 }, 20)).toBe('5 minutes left — free plan calls end at 20 minutes');
        expect(timeWarningText({ minutesLeft: 1 })).toBe('1 minute left — free plan calls end at 30 minutes');
        expect(timeLimitEndedMessage(20)).toMatch(/free plan's 20-minute limit/);
        expect(TIME_LIMIT_ENDED_MESSAGE).toMatch(/30-minute/);
    });
});

describe('device id from the server', () => {
    it('is kept only when this browser has none', () => {
        expect(adoptDeviceId('srv-1234-5678')).toBe(true);
        expect(localStorage.getItem('deviceId')).toBe('srv-1234-5678');
        expect(adoptDeviceId('srv-other-9999')).toBe(false);
        expect(localStorage.getItem('deviceId')).toBe('srv-1234-5678');
        expect(adoptDeviceId('bad id!')).toBe(false);
    });
});

describe('plan copy', () => {
    it('mentions the workspace AI limit and no longer sells "more devices"', () => {
        expect(FREE_LIMITS.find((l) => l.id === 'ai').value).toContain('300 per workspace per day');
        expect(PLANS.find((p) => p.id === 'pro').features.join(' ')).not.toMatch(/devices/);
        expect(FAQ.map((f) => f.a).join(' ')).toContain('300 AI requests per workspace per day');
    });
});

describe('reactivating an account', () => {
    it('goes through the same device-limit step as signing in', async () => {
        const { default: ReactivationFlow } = await import('../pages/ReactivationFlow');
        const { ToastProvider } = await import('../contexts/ToastContext');
        apiMock.post.mockRejectedValue({ response: { status: 409, data: {
            code: 'DEVICE_LIMIT', limit: 4, pendingToken: 'p'.repeat(43), reactivated: true,
            devices: [{ id: 'd1', name: 'Chrome on macOS', platform: 'web', lastActiveAt: new Date().toISOString() }],
        } } });
        render(<MemoryRouter initialEntries={['/reactivate?email=a%40example.com']}><ToastProvider><ReactivationFlow /></ToastProvider></MemoryRouter>);
        fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '123456' } });
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Passw0rd!' } });
        fireEvent.click(screen.getByRole('button', { name: /Reactivate account/ }));
        expect(await screen.findByText('Too many devices')).toBeInTheDocument();
        expect(apiMock.post).toHaveBeenCalledWith('/api/auth/reactivate/verify-otp', { email: 'a@example.com', otpCode: '123456', password: 'Passw0rd!' });
    });
});

describe('integration cards', () => {
    it('show why no task was made', async () => {
        const { default: IntegrationCard } = await import('../features/integrations/IntegrationCard');
        render(<MemoryRouter><IntegrationCard integration={{ provider: 'github', kind: 'issue', repo: 'a/b', number: 3, title: 'Bug', extra: { planNote: 'No task created: limit' } }} summary="Bug" /></MemoryRouter>);
        await waitFor(() => expect(screen.getByTestId('integration-plan-note')).toHaveTextContent('No task created: limit'));
    });
});
