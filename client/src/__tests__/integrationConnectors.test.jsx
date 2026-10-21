// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const WS = 'a'.repeat(24);
const CH = 'c'.repeat(24);
const showToast = vi.fn();

vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast }) }));
vi.mock('@services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import api from '@services/api';
import ConnectorCatalog from '../features/integrations/setup/ConnectorCatalog';
import IncomingWebhooks from '../features/integrations/setup/IncomingWebhooks';

const BASE = '/api/v2/integrations';

const CATALOG = [
    {
        type: 'gitlab', label: 'GitLab', category: 'developer', description: 'Merge requests and issues.',
        setup: ['Create a token.'],
        form: [
            { key: 'baseUrl', label: 'GitLab address', kind: 'url', placeholder: 'https://gitlab.com' },
            { key: 'token', label: 'Access token', kind: 'secret', required: true, placeholder: 'glpat-…', secret: true },
        ],
        toggles: [], routes: null, defaultChannel: false, bridge: null,
        webhook: { how: 'Header X-Gitlab-Token', tokenInUrl: false, generatedSecret: true }, actions: {}, canAttach: false,
    },
    {
        type: 'slack', label: 'Slack', category: 'communication', description: 'Bridge Slack channels.',
        setup: ['Create a Slack app.'],
        form: [{ key: 'botToken', label: 'Bot token', kind: 'secret', secret: true }],
        toggles: [], routes: null, defaultChannel: false,
        bridge: { remoteLabel: 'Slack channel ID', remotePlaceholder: 'C0123ABCD or *', remoteRequired: true },
        webhook: { how: 'Slack Events API', tokenInUrl: false, generatedSecret: false }, actions: {}, canAttach: false,
    },
    {
        type: 'zapier', label: 'Zapier', category: 'automation', description: 'Let Zapier post messages.',
        setup: ['Save to get the URL.'], form: [], toggles: [],
        routes: { label: 'Channel name', placeholder: 'deploys', hint: '', events: null, wildcard: false },
        defaultChannel: true, bridge: null, webhook: { how: 'Token in the URL', tokenInUrl: true, generatedSecret: true }, actions: {}, canAttach: false,
    },
];

const CONFIGS = {
    gitlab: { type: 'gitlab', label: 'GitLab', connected: false, status: 'disconnected', config: { baseUrl: 'https://gitlab.com', hasToken: false, token: '' }, webhookUrl: null },
    slack: {
        type: 'slack', label: 'Slack', connected: true, status: 'connected', webhookUrl: 'https://api.example.com/api/v2/integrations/webhook/slack?workspaceId=x',
        config: { hasBotToken: false, botToken: '', account: { name: 'oruinwan-bot' }, bridges: [{ remote: 'C0123ABCD', channelId: CH, direction: 'in' }] },
    },
    zapier: { type: 'zapier', label: 'Zapier', connected: false, status: 'disconnected', config: { routes: [], defaultChannelId: null }, webhookUrl: null },
};

function mockGet({ hooks = [] } = {}) {
    api.get.mockImplementation((url) => {
        if (url === `${BASE}/catalog`) return Promise.resolve({ data: { connectors: CATALOG } });
        const m = url.match(/\/integrations\/([a-z_]+)\/config$/);
        if (m) return Promise.resolve({ data: CONFIGS[m[1]] });
        if (url === '/api/channels/my') return Promise.resolve({ data: { channels: [{ _id: CH, name: 'general' }] } });
        if (url === `${BASE}/incoming-webhooks`) return Promise.resolve({ data: { webhooks: hooks } });
        return Promise.reject(Object.assign(new Error('nope'), { response: { status: 404, data: {} } }));
    });
}

beforeEach(() => {
    api.get.mockReset(); api.post.mockReset(); api.put.mockReset(); api.patch.mockReset(); api.delete.mockReset();
    showToast.mockReset();
});

describe('Settings → Integrations connectors', () => {
    it('renders the catalog grouped by category, with the connected account', async () => {
        mockGet();
        render(<ConnectorCatalog workspaceId={WS} isAdmin />);
        expect(await screen.findByRole('heading', { name: 'Developer' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Communication' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Automation' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Files' })).not.toBeInTheDocument();
        const slack = screen.getByTestId('connector-slack');
        expect(await within(slack).findByText('as oruinwan-bot')).toBeInTheDocument();
        expect(within(slack).getByRole('button', { name: 'Manage Slack' })).toBeInTheDocument();
        expect(within(screen.getByTestId('connector-gitlab')).getByRole('button', { name: 'Connect GitLab' })).toBeInTheDocument();
    });

    it('members only see the status', async () => {
        mockGet();
        render(<ConnectorCatalog workspaceId={WS} isAdmin={false} />);
        const slack = await screen.findByTestId('connector-slack');
        expect(await within(slack).findByText('Connected')).toBeInTheDocument();
        expect(within(slack).queryByRole('button')).not.toBeInTheDocument();
    });

    it('saves the form values with PUT and shows the server’s error inline', async () => {
        mockGet();
        api.put.mockRejectedValue(Object.assign(new Error('Request failed'), { response: { status: 400, data: { message: 'GitLab: could not verify — 401 Unauthorized', code: 'GITLAB_BAD_TOKEN' } } }));
        render(<ConnectorCatalog workspaceId={WS} isAdmin />);
        const gitlab = await screen.findByTestId('connector-gitlab');
        fireEvent.click(await within(gitlab).findByRole('button', { name: 'Connect GitLab' }));
        fireEvent.change(within(gitlab).getByLabelText('Access token'), { target: { value: 'glpat-secret' } });
        fireEvent.click(within(gitlab).getByRole('button', { name: 'Save and connect' }));
        await waitFor(() => expect(api.put).toHaveBeenCalledWith(`${BASE}/gitlab/config`, { workspaceId: WS, baseUrl: 'https://gitlab.com', token: 'glpat-secret' }));
        expect(await within(gitlab).findByText('GitLab: could not verify — 401 Unauthorized')).toBeInTheDocument();
    });

    it('requires required fields before saving', async () => {
        mockGet();
        render(<ConnectorCatalog workspaceId={WS} isAdmin />);
        const gitlab = await screen.findByTestId('connector-gitlab');
        fireEvent.click(await within(gitlab).findByRole('button', { name: 'Connect GitLab' }));
        fireEvent.click(within(gitlab).getByRole('button', { name: 'Save and connect' }));
        expect(await within(gitlab).findByText('Fill in: Access token.')).toBeInTheDocument();
        expect(api.put).not.toHaveBeenCalled();
    });

    it('asks before copying a bridged channel out and sends acknowledgeOutgoing', async () => {
        mockGet();
        api.put.mockResolvedValue({ data: { ...CONFIGS.slack, config: { ...CONFIGS.slack.config, bridges: [{ remote: 'C0123ABCD', channelId: CH, direction: 'out' }] } } });
        render(<ConnectorCatalog workspaceId={WS} isAdmin />);
        const slack = await screen.findByTestId('connector-slack');
        fireEvent.click(await within(slack).findByRole('button', { name: 'Manage Slack' }));
        const bridges = await within(slack).findByTestId('bridges-slack');
        await waitFor(() => expect(within(bridges).getByLabelText('Oruinwan channel')).toHaveValue(CH));
        fireEvent.change(within(bridges).getByLabelText('Direction'), { target: { value: 'out' } });

        const dialog = await screen.findByRole('dialog');
        expect(dialog).toHaveTextContent('Messages posted in #general will be copied to Slack');
        expect(dialog).toHaveTextContent('leave Oruinwan’s end-to-end encryption and are stored by Slack');
        expect(within(bridges).getByLabelText('Direction')).toHaveValue('in'); // not changed until confirmed
        fireEvent.click(within(dialog).getByRole('button', { name: 'Copy to Slack' }));

        expect(within(bridges).getByLabelText('Direction')).toHaveValue('out');
        expect(within(bridges).getByText(/Those copies leave Oruinwan’s end-to-end encryption/)).toBeInTheDocument();
        fireEvent.click(within(bridges).getByRole('button', { name: 'Save bridges' }));
        await waitFor(() => expect(api.put).toHaveBeenCalledWith(`${BASE}/slack/config`, {
            workspaceId: WS,
            bridges: [{ remote: 'C0123ABCD', channelId: CH, direction: 'out', acknowledgeOutgoing: true }],
        }));
    });

    it('cancelling the warning keeps the bridge incoming only', async () => {
        mockGet();
        render(<ConnectorCatalog workspaceId={WS} isAdmin />);
        const slack = await screen.findByTestId('connector-slack');
        fireEvent.click(await within(slack).findByRole('button', { name: 'Manage Slack' }));
        const bridges = await within(slack).findByTestId('bridges-slack');
        fireEvent.change(within(bridges).getByLabelText('Direction'), { target: { value: 'both' } });
        fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));
        expect(within(bridges).getByLabelText('Direction')).toHaveValue('in');
        expect(within(bridges).queryByRole('button', { name: 'Save bridges' })).not.toBeInTheDocument();
    });
});

describe('Settings → Integrations → Incoming webhooks', () => {
    it('creates a webhook and shows its URL with a curl example', async () => {
        mockGet();
        const url = `https://api.example.com${BASE}/hooks/h1/tok123`;
        api.post.mockResolvedValue({ data: { webhook: { id: 'h1', name: 'Deploy bot', channelId: CH, isActive: true, lastUsedAt: null, useCount: 0, url } } });
        render(<IncomingWebhooks workspaceId={WS} />);
        expect(await screen.findByText('No incoming webhooks yet.')).toBeInTheDocument();
        expect(screen.getByText(/not end-to-end encrypted/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Add incoming webhook' }));
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Deploy bot' } });
        await waitFor(() => expect(screen.getByRole('option', { name: '#general' })).toBeInTheDocument());
        fireEvent.change(screen.getByLabelText('Channel'), { target: { value: CH } });
        fireEvent.click(screen.getByRole('button', { name: 'Create webhook' }));

        await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${BASE}/incoming-webhooks`, { workspaceId: WS, name: 'Deploy bot', channelId: CH }));
        const curl = await screen.findByTestId('incoming-webhook-curl');
        expect(curl).toHaveTextContent(`curl -X POST -H 'Content-Type: application/json' -d '{"text":"Hello"}' ${url}`);
        const item = screen.getByTestId('incoming-webhook');
        expect(item).toHaveTextContent('Deploy bot');
        expect(item).toHaveTextContent('#general');
        expect(item).toHaveTextContent('Never used');
    });
});
