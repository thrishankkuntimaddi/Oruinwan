// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('@services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), defaults: { baseURL: 'https://api.test' } } }));
const showToast = vi.fn();
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast }) }));
vi.mock('../contexts/WorkspaceContext', () => ({ useWorkspace: () => ({ activeWorkspace: { _id: 'w1', name: 'Acme' } }) }));
vi.mock('../components/apps/useIsWorkspaceAdmin', () => ({ default: () => true }));

import api from '@services/api';
import OpenApiReference, { resolveRef, typeLabel, groupOperations } from '../pages/developer/OpenApiReference';
import MyAppsTab, { toPayload } from '../pages/developer/MyAppsTab';
import MarketplacePanel from '../components/apps/MarketplacePanel';
import TemplateMarketplacePage from '../pages/workspace/TemplateMarketplacePage';
import MarketplaceReview from '../pages/admin/platform/views/MarketplaceReview';

const SPEC = {
  openapi: '3.0.3',
  info: { title: 'Oruinwan Public API', version: '1.0.0', description: 'REST API.' },
  servers: [{ url: '/api/public/v1' }],
  tags: [{ name: 'Tasks' }],
  paths: {
    '/tasks': {
      get: { tags: ['Tasks'], summary: 'List tasks', 'x-scope': 'tasks:read', parameters: [{ name: 'status', in: 'query', schema: { type: 'string', enum: ['todo', 'done'] } }],
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { tasks: { type: 'array', items: { $ref: '#/components/schemas/Task' } } } } } } } } },
      post: { tags: ['Tasks'], summary: 'Create a task', 'x-scope': 'tasks:write',
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/TaskInput' } } } },
        responses: { 201: { description: 'Created' }, 403: { description: 'Missing scope' } } },
    },
  },
  components: {
    securitySchemes: { ApiKey: { type: 'apiKey', in: 'header', name: 'X-Api-Key', description: 'Workspace key.' } },
    schemas: {
      Task: { type: 'object', properties: { title: { type: 'string' }, dueDate: { type: 'string', format: 'date-time', nullable: true } } },
      TaskInput: { type: 'object', required: ['title'], properties: { title: { type: 'string', maxLength: 500 } } },
    },
  },
};

beforeEach(() => { vi.clearAllMocks(); });

describe('OpenAPI reference', () => {
  it('resolves refs, labels types and groups operations by tag', () => {
    expect(resolveRef(SPEC, { $ref: '#/components/schemas/Task' }).properties.title.type).toBe('string');
    expect(typeLabel(SPEC, { type: 'array', items: { $ref: '#/components/schemas/Task' } })).toBe('array of Task');
    expect(typeLabel(SPEC, { type: 'string', format: 'date-time', nullable: true })).toBe('string (date-time) | null');
    const groups = groupOperations(SPEC);
    expect(groups).toHaveLength(1);
    expect(groups[0].ops.map((o) => `${o.method} ${o.path}`)).toEqual(['get /tasks', 'post /tasks']);
  });

  it('renders the spec from /api/public/v1/openapi.json with expandable operations', async () => {
    api.get.mockResolvedValue({ data: SPEC });
    render(<OpenApiReference />);
    expect(await screen.findByTestId('openapi-reference')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/api/public/v1/openapi.json');
    expect(screen.getByText('https://api.test/api/public/v1')).toBeTruthy();
    const ops = screen.getAllByTestId('openapi-operation');
    expect(ops).toHaveLength(2);
    fireEvent.click(within(ops[1]).getByRole('button', { expanded: false }));
    expect(within(ops[1]).getByText('Request body (JSON)')).toBeTruthy();
    expect(within(ops[1]).getByText(/required · max 500 chars/)).toBeTruthy();
    expect(within(ops[1]).getByText(/curl -X POST "https:\/\/api.test\/api\/public\/v1\/tasks"/)).toBeTruthy();
  });
});

describe('My apps', () => {
  const app = { _id: 'a1', name: 'Retro', description: 'Runs retros in a channel.', category: 'productivity', version: '1.0.0', status: 'draft', scopes: ['tasks:read'], installCount: 0, signingSecret: 'whsec_abcdef0123456789' };

  it('maps the form to the API payload', () => {
    expect(toPayload({ name: ' X ', description: ' d ', category: 'developer', iconUrl: '', homepageUrl: '', webhookUrl: 'https://h', redirectUrl: '', version: '', scopes: ['a'], botEnabled: true, botName: '' }))
      .toEqual({ name: 'X', description: 'd', category: 'developer', iconUrl: null, homepageUrl: null, webhookUrl: 'https://h', redirectUrl: null, version: '1.0.0', scopes: ['a'], botUser: { enabled: true, name: null } });
  });

  it('lists apps with status and submits a draft for review', async () => {
    api.get.mockResolvedValue({ data: { apps: [app] } });
    api.post.mockResolvedValue({ data: { message: 'Submitted for review', app: { ...app, status: 'submitted' } } });
    render(<MyAppsTab />);
    const row = await screen.findByTestId('my-app-row');
    expect(within(row).getByText('Draft')).toBeTruthy();
    expect(within(row).getByText(/whsec_abcd/)).toBeTruthy();
    fireEvent.click(within(row).getByRole('button', { name: /Submit for review/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/developer/my-apps/a1/submit'));
    expect(await screen.findByText('In review')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Withdraw/ })).toBeTruthy();
  });
});

describe('Marketplace panel', () => {
  const listing = { _id: 'p1', name: 'Standup', description: 'Daily standups.', developer: 'Dev Co', version: '1.0.0', scopes: ['tasks:read'], botUser: { enabled: true }, installed: false, avgRating: 4.5, reviewCount: 2 };

  it('shows the app token once after installing', async () => {
    api.get.mockResolvedValue({ data: { apps: [listing], totalPages: 1 } });
    api.post.mockResolvedValue({ data: { appToken: 'chx_tok', botToken: 'bot_tok', scopes: ['tasks:read'], webhookDelivered: false } });
    render(<MarketplacePanel workspaceId="w1" canManage />);
    const card = await screen.findByTestId('marketplace-app-card');
    expect(within(card).getByText('1 scope')).toBeTruthy();
    expect(within(card).getByText('Bot user')).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: /Install/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/marketplace/install', { appId: 'p1', workspaceId: 'w1' }));
    expect(await screen.findByText('chx_tok')).toBeTruthy();
    expect(screen.getByText('bot_tok')).toBeTruthy();
  });

  it('reviews need the app installed in this workspace and send workspaceId', async () => {
    api.get.mockImplementation((url) => (url.startsWith('/api/marketplace/reviews')
      ? Promise.resolve({ data: { reviews: [{ _id: 'r1', rating: 5, comment: 'Great', userId: { username: 'sam' } }], total: 1, avgRating: 5 } })
      : Promise.resolve({ data: { apps: [listing, { ...listing, _id: 'p2', name: 'Installed one', installed: true }], totalPages: 1 } })));
    render(<MarketplacePanel workspaceId="w1" canManage />);
    const cards = await screen.findAllByTestId('marketplace-app-card');
    fireEvent.click(within(cards[0]).getByRole('button', { name: /Reviews of Standup/ }));
    expect(await screen.findByText('Install this app in your workspace to review it.')).toBeTruthy();
    expect(await screen.findByText('Great')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' }).at(-1));

    fireEvent.click(within(cards[1]).getByRole('button', { name: /Reviews of Installed one/ }));
    fireEvent.click(await screen.findByRole('button', { name: '4 stars' }));
    api.post.mockResolvedValue({ data: {} });
    fireEvent.click(screen.getByRole('button', { name: 'Save review' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/marketplace/review', { appId: 'p2', rating: 4, comment: '', workspaceId: 'w1' }));
  });
});

describe('Community templates', () => {
  const tpl = { _id: 't1', name: 'Product squad', description: 'For product teams.', category: 'product', channels: [{ name: 'general', isDefault: true }, { name: 'roadmap' }], importCount: 3, ratingAvg: 4, ratingCount: 2, publisher: { username: 'alice' } };

  function renderPage() {
    return render(
      <MemoryRouter initialEntries={['/workspace/w1/templates']}>
        <Routes><Route path="/workspace/:workspaceId/templates" element={<TemplateMarketplacePage />} /></Routes>
      </MemoryRouter>,
    );
  }

  it('shows community templates with channel preview, imports and ratings, and rates one', async () => {
    api.get.mockImplementation((url) => Promise.resolve({ data: url.includes('/community') ? { templates: [tpl], totalPages: 1 } : { templates: [], totalPages: 1 } }));
    renderPage();
    fireEvent.click(await screen.findByRole('tab', { name: 'Community' }));
    const card = await screen.findByTestId('template-card');
    expect(api.get).toHaveBeenCalledWith('/api/workspace-templates/community', expect.objectContaining({ params: expect.objectContaining({ sort: 'popular' }) }));
    expect(within(card).getByText('roadmap')).toBeTruthy();
    expect(within(card).getByText('3 imports')).toBeTruthy();
    expect(within(card).getByText('4.0 (2)')).toBeTruthy();
    expect(within(card).getByText('Shared by alice')).toBeTruthy();

    api.post.mockResolvedValue({ data: { ratingAvg: 4.3, ratingCount: 3 } });
    fireEvent.click(within(card).getByRole('button', { name: /Rate Product squad/ }));
    fireEvent.click(await screen.findByRole('button', { name: '5 stars' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save rating' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/workspace-templates/community/t1/rate', { rating: 5 }));
    expect(await screen.findByText('4.3 (3)')).toBeTruthy();
  });

  it('publishes this workspace for review', async () => {
    api.get.mockResolvedValue({ data: { templates: [], totalPages: 1 } });
    api.post.mockResolvedValue({ data: { message: 'Submitted to the community gallery.' } });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Share this workspace/ }));
    fireEvent.change(screen.getByLabelText(/Description/), { target: { value: 'Channels for a product team.' } });
    fireEvent.click(screen.getByRole('button', { name: /Submit for review/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/workspace-templates/community/publish',
      { workspaceId: 'w1', name: 'Acme', description: 'Channels for a product team.', category: 'general' }));
  });
});

describe('Platform marketplace review', () => {
  it('approves a submitted app', async () => {
    api.get.mockResolvedValue({ data: { apps: [{ _id: 'a1', name: 'Retro', description: 'd', status: 'submitted', scopes: ['tasks:read'], version: '1.0.0', category: 'productivity', ownerId: { username: 'dev' } }], counts: { submitted: 1 } } });
    api.post.mockResolvedValue({ data: {} });
    render(<MarketplaceReview />);
    const row = await screen.findByTestId('review-app-row');
    expect(api.get).toHaveBeenCalledWith('/api/developer/admin/apps', { params: { status: 'submitted' } });
    fireEvent.click(within(row).getByRole('button', { name: /Approve/ }));
    await screen.findByText(/listed in the marketplace for every workspace/);
    fireEvent.click(screen.getAllByRole('button', { name: 'Approve' }).at(-1));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/developer/admin/apps/a1/review', { decision: 'approve', note: '' }));
  });
});
