// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock('../services/api', () => ({ default: apiMock }));

import { runIntegrationCommand, parseIssueArgs } from '../features/integrations/slashActions';
import { clearConnectionCache } from '../features/integrations/integrationsApi';
import { relayIfBridged, clearBridgeCache, BridgeNotice } from '../features/integrations/bridgeRelay';
import { CloudPicker, itemMarkdown } from '../features/integrations/CloudPicker';
import { BridgedMessage } from '../features/integrations/IntegrationCard';

const ctx = (over = {}) => ({ workspaceId: 'ws1', conversationId: 'c1', conversationType: 'channel', send: vi.fn(), notify: vi.fn(), ...over });

beforeEach(() => { vi.clearAllMocks(); clearConnectionCache(); clearBridgeCache(); });

describe('connector slash commands', () => {
    it('parses issue arguments', () => {
        expect(parseIssueArgs('gitlab', 'issue acme/web Fix login')).toEqual({ target: 'acme/web', title: 'Fix login' });
        expect(parseIssueArgs('linear', 'eng Crash on start')).toEqual({ target: 'ENG', title: 'Crash on start' });
        expect(parseIssueArgs('bitbucket', 'issue nope')).toHaveProperty('error');
    });

    it('/gitlab creates the issue through the connector action and posts the link', async () => {
        apiMock.get.mockResolvedValue({ data: { connected: true, config: {} } });
        apiMock.post.mockResolvedValue({ data: { issue: { number: 4, repo: 'acme/web', url: 'https://gitlab.com/acme/web/-/issues/4', title: 'Fix login' } } });
        const c = ctx();
        await runIntegrationCommand('gitlab', 'issue acme/web Fix login', c);
        expect(apiMock.post).toHaveBeenCalledWith('/api/v2/integrations/gitlab/actions/issue', { workspaceId: 'ws1', project: 'acme/web', title: 'Fix login' });
        expect(c.send.mock.calls[0][0]).toContain('[acme/web#4](https://gitlab.com/acme/web/-/issues/4)');
    });

    it('/gmeet shares a pasted Meet link, refuses others, and never invents one', async () => {
        const c = ctx();
        await runIntegrationCommand('gmeet', 'https://meet.google.com/abc-defg-hij', c);
        expect(c.send.mock.calls[0][0]).toContain('(https://meet.google.com/abc-defg-hij)');
        await expect(runIntegrationCommand('gmeet', 'https://evil.example/abc', ctx())).rejects.toThrow(/not a Google Meet link/);
        apiMock.get.mockResolvedValue({ data: { connected: false, config: {} } });
        const d = ctx();
        await expect(runIntegrationCommand('gmeet', 'Standup', d)).rejects.toThrow(/Paste one instead/);
        expect(d.send).not.toHaveBeenCalled();
    });

    it('/gmeet creates a real link when Google Meet is connected', async () => {
        apiMock.get.mockResolvedValue({ data: { connected: true, config: {} } });
        apiMock.post.mockResolvedValue({ data: { meeting: { joinUrl: 'https://meet.google.com/xyz-abcd-efg', title: 'Standup' } } });
        const c = ctx();
        await runIntegrationCommand('gmeet', 'Standup', c);
        expect(apiMock.post).toHaveBeenCalledWith('/api/v2/integrations/google_meet/actions/meeting', { workspaceId: 'ws1', title: 'Standup' });
        expect(c.send.mock.calls[0][0]).toContain('https://meet.google.com/xyz-abcd-efg');
    });
});

describe('outgoing bridge (client relay)', () => {
    it('relays only in channels with an outgoing bridge', async () => {
        apiMock.get.mockResolvedValue({ data: { channels: [{ channelId: 'c1', outgoing: true, providers: [{ type: 'slack', label: 'Slack', direction: 'both' }] }, { channelId: 'c2', outgoing: false, providers: [] }] } });
        apiMock.post.mockResolvedValue({ data: { relayed: [{ type: 'slack' }] } });
        await relayIfBridged({ workspaceId: 'ws1', channelId: 'c2', messageId: 'm1', text: 'hi' });
        expect(apiMock.post).not.toHaveBeenCalled();
        await relayIfBridged({ workspaceId: 'ws1', channelId: 'c1', messageId: 'm2', text: 'hi' });
        expect(apiMock.post).toHaveBeenCalledWith('/api/v2/integrations/bridge/relay', { workspaceId: 'ws1', channelId: 'c1', messageId: 'm2', text: 'hi' });
        expect(apiMock.get).toHaveBeenCalledTimes(1); // cached
    });

    it('never throws and relays nothing when the bridge list cannot load', async () => {
        apiMock.get.mockRejectedValue(new Error('404'));
        await expect(relayIfBridged({ workspaceId: 'ws1', channelId: 'c1', messageId: 'm', text: 'x' })).resolves.toBeNull();
        expect(apiMock.post).not.toHaveBeenCalled();
    });

    it('warns in a bridged channel that copies are not end-to-end encrypted', async () => {
        apiMock.get.mockResolvedValue({ data: { channels: [{ channelId: 'c1', outgoing: true, providers: [{ type: 'teams', label: 'Microsoft Teams', direction: 'out' }] }] } });
        render(<BridgeNotice workspaceId="ws1" channelId="c1" />);
        expect(await screen.findByTestId('bridge-notice')).toHaveTextContent(/copied to Microsoft Teams.*not end-to-end encrypted/);
    });
});

describe('cloud picker', () => {
    it('searches and imports pages into Knowledge', async () => {
        apiMock.get.mockResolvedValue({ data: { items: [{ id: 'p1', title: 'Roadmap', url: 'https://notion.so/p1', kind: 'page' }] } });
        apiMock.post.mockResolvedValue({ data: { page: { id: 'k1', title: 'Roadmap' } } });
        render(<CloudPicker type="notion" workspaceId="ws1" initialQuery="road" onDone={vi.fn()} onClose={vi.fn()} />);
        expect(await screen.findByText('Roadmap')).toBeInTheDocument();
        expect(apiMock.get).toHaveBeenCalledWith('/api/v2/integrations/notion/actions/search', { params: { workspaceId: 'ws1', q: 'road' } });
        fireEvent.click(screen.getByRole('button', { name: /Import to Knowledge/ }));
        await waitFor(() => expect(apiMock.post).toHaveBeenCalledWith('/api/v2/integrations/notion/import', { workspaceId: 'ws1', id: 'p1' }));
        expect(await screen.findByRole('status')).toHaveTextContent(/imported into Knowledge/);
    });

    it('attaches in task mode', async () => {
        apiMock.get.mockResolvedValue({ data: { items: [{ id: 'f1', title: 'Plan.pdf', url: 'https://drive/f1', kind: 'file' }] } });
        apiMock.post.mockResolvedValue({ data: { item: {}, task: { id: 't1' } } });
        const onDone = vi.fn();
        render(<CloudPicker type="google_drive" workspaceId="ws1" mode="task" taskId="t1" onDone={onDone} onClose={vi.fn()} />);
        fireEvent.click(await screen.findByRole('button', { name: /^Attach$/ }));
        await waitFor(() => expect(onDone).toHaveBeenCalled());
        expect(apiMock.post).toHaveBeenCalledWith('/api/v2/integrations/google_drive/attach', { workspaceId: 'ws1', itemId: 'f1', taskId: 't1' });
    });

    it('formats a shared link', () => {
        expect(itemMarkdown('google_drive', { title: 'Q[3] plan', url: 'https://d/1', kind: 'file' })).toBe('📎 [Q\\[3\\] plan](https://d/1) · Google Drive');
    });
});

describe('bridged messages', () => {
    it('shows the remote author and says it is not end-to-end encrypted', () => {
        render(<BridgedMessage integration={{ provider: 'slack', kind: 'message', author: 'Bea', extra: { notE2EE: true } }} summary="hello from Slack" />);
        expect(screen.getByText('Bea')).toBeInTheDocument();
        expect(screen.getByText('hello from Slack')).toBeInTheDocument();
        expect(screen.getByText(/Via Slack · not end-to-end encrypted/)).toBeInTheDocument();
    });
});
