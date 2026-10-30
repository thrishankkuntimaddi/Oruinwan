// Free-plan limits on the phone: the upgrade sheet, Settings → Plan & usage, the AI counter and
// the call's time-limit banner and message — against a fake adapter.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { create } from 'zustand';

const PLAN = {
  plan: 'free',
  userPlan: 'free',
  workspacePlan: 'free',
  exempt: false,
  upgradeUrl: '/pricing',
  plans: [
    { id: 'free', name: 'Free', comingSoon: false },
    { id: 'pro', name: 'Pro', comingSoon: true },
    { id: 'enterprise', name: 'Enterprise', comingSoon: true },
  ],
  limits: { 'channels.perWorkspace': 10 },
  usage: {},
  items: [
    { key: 'workspaces.create', label: 'Workspaces you created', used: 1, max: 2, atLimit: false, scope: 'user' },
    { key: 'channels.perWorkspace', label: 'Channels (besides #general and #random)', used: 10, max: 10, atLimit: true, scope: 'workspace' },
    { key: 'ai.userDaily', label: 'Your AI requests today', used: 12, max: 50, atLimit: false, scope: 'user' },
  ],
  notes: { perTemplate: 2, byTemplate: { meeting: 1, projectspec: 2 } },
  huddles: { participants: 10, minutes: 30 },
  ai: { userUsed: 12, userMax: 50, userRemaining: 38, workspaceUsed: 40, workspaceMax: 300, workspaceRemaining: 260, resetsAt: '2026-10-22T00:00:00.000Z', exempt: false },
  blocked: { 'channels.perWorkspace': true },
};

const fake = {
  getPlan: vi.fn(async () => PLAN),
  getAiQuota: vi.fn(async () => ({ userUsed: 12, userMax: 50, userRemaining: 38, workspaceUsed: 40, workspaceMax: 300, workspaceRemaining: 260, resetsAt: null, exempt: false })),
  huddles: { emit: vi.fn(), request: vi.fn(async () => ({ huddles: [] })) },
};

const mockSession = create(() => ({ user: { id: 'me', name: 'Me' }, workspaceId: 'w1', mode: 'live', status: 'signed-in', server: 'https://chat.example' }));
vi.mock('../../data/session.js', () => ({ api: () => fake, useSession: mockSession, useWorkspace: () => ({ id: 'w1', name: 'Acme' }) }));
const openExternal = vi.fn();
vi.mock('../../native/index.js', async (importOriginal) => ({ ...(await importOriginal()), openExternal: (...a) => openExternal(...a) }));

const { clearQueries } = await import('../../data/query.js');
const { emit, on } = await import('../../lib/bus.js');
const { PlanLayer } = await import('./UpgradeSheet.jsx');
const { PlanScreen } = await import('./PlanScreen.jsx');
const { AiQuotaLine } = await import('./AiQuotaLine.jsx');
const { CallEndedNotice, CallTimeBanner } = await import('./CallLimitNotice.jsx');
const { closeUpgrade, mergeAiUsage } = await import('./plan.js');
const text = await import('./planText.js');
const huddle = await import('../huddles/huddle.js');
const { useHuddle } = huddle;

beforeEach(() => {
  clearQueries();
  vi.clearAllMocks();
  fake.getPlan.mockImplementation(async () => PLAN);
});
afterEach(() => {
  cleanup();
  act(() => closeUpgrade());
});

describe('upgrade sheet', () => {
  it('opens for any PLAN_LIMIT refusal, with the server message, and See plans opens pricing', async () => {
    render(<PlanLayer />);
    expect(screen.queryByTestId('upgrade-sheet')).toBeNull();
    act(() => emit('plan:limit', { code: 'PLAN_LIMIT', limit: 'workspaces.create', max: 2, used: 2, upgradeUrl: '/pricing', message: "You've reached the free plan limit: 2 workspaces you created." }));
    expect(await screen.findByText('Free plan limit reached')).toBeTruthy();
    expect(screen.getByText("You've reached the free plan limit: 2 workspaces you created.")).toBeTruthy();
    expect(screen.getByText('Pro and Enterprise are coming soon.')).toBeTruthy();
    expect(screen.getByText('2 of 2 used')).toBeTruthy();
    fireEvent.click(screen.getByText('See plans'));
    expect(openExternal).toHaveBeenCalledWith('https://chat.example/pricing');
  });

  it('opens for a full call (huddle:error PLAN_LIMIT) and leaves the call', async () => {
    render(<PlanLayer />);
    huddle.bindHuddles();
    act(() => useHuddle.setState({ call: { huddleId: 'h1', scope: { channelId: 'c1' } } }));
    act(() => emit('huddle', { event: 'huddle:error', payload: { huddleId: 'h1', code: 'PLAN_LIMIT', limit: 'huddles.participants', max: 10, used: 10 } }));
    expect(await screen.findByText(text.CALL_FULL)).toBeTruthy();
    expect(useHuddle.getState().call).toBeNull();
    expect(fake.huddles.emit).toHaveBeenCalledWith('huddle:leave', { huddleId: 'h1' });
    huddle.__resetHuddles();
  });

  it('tells an inviter that their invitee reached the limit', () => {
    const toasts = [];
    const off = on('toast', (t) => toasts.push(t));
    render(<PlanLayer />);
    act(() => emit('plan:limit_reached', { code: 'PLAN_LIMIT', workspaceName: 'Acme', username: 'sam', message: 'sam could not join Acme: they reached the free plan limit.' }));
    off();
    expect(toasts.map((t) => t.message)).toContain('sam could not join Acme: they reached the free plan limit.');
  });
});

describe('Plan & usage', () => {
  it('shows the plan, usage bars with the at-limit state, notes per template, calls and AI today', async () => {
    render(<PlanScreen />);
    expect((await screen.findByTestId('plan-card')).textContent).toContain('Your planFree');
    expect(screen.getByText('Pro and Enterprise are coming soon.')).toBeTruthy();
    expect(screen.getByTestId('plan-item-workspaces.create').textContent).toContain('1 of 2');
    const channels = screen.getByTestId('plan-item-channels.perWorkspace');
    expect(channels.textContent).toContain('10 of 10');
    expect(channels.textContent).toContain('Limit reached');
    // AI requests have their own section, not a duplicate row.
    expect(screen.queryByTestId('plan-item-ai.userDaily')).toBeNull();
    expect(screen.getByTestId('plan-item-ai.user').textContent).toContain('12 of 50');
    expect(screen.getByText('Meeting notes')).toBeTruthy();
    expect(screen.getByText('Up to 10')).toBeTruthy();
    expect(screen.getByText('30 minutes')).toBeTruthy();
    expect(screen.getAllByRole('progressbar').length).toBeGreaterThan(2);
    fireEvent.click(screen.getByText('See plans'));
    expect(openExternal).toHaveBeenCalledWith('https://chat.example/pricing');
  });

  it('says a company plan has no free-plan limits', async () => {
    fake.getPlan.mockImplementation(async () => ({ ...PLAN, plan: 'company', exempt: true, blocked: {} }));
    render(<PlanScreen />);
    expect(await screen.findByText('Your company plan has no free-plan limits.')).toBeTruthy();
    expect(screen.getAllByText('Company').length).toBeGreaterThan(0);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

describe('AI counter', () => {
  it('shows what is left today and follows plan:ai_usage', async () => {
    render(
      <>
        <PlanLayer />
        <AiQuotaLine ws="w1" />
      </>,
    );
    expect((await screen.findByTestId('ai-quota')).textContent).toBe('38 of 50 AI requests left today');
    act(() => emit('plan:ai_usage', { workspaceId: 'w1', userUsed: 13, userMax: 50, workspaceUsed: 41, workspaceMax: 300, resetsAt: null }));
    await waitFor(() => expect(screen.getByTestId('ai-quota').textContent).toBe('37 of 50 AI requests left today'));
  });

  it('is hidden on a company plan', async () => {
    fake.getAiQuota.mockResolvedValueOnce({ userUsed: 0, userMax: null, exempt: true });
    render(<AiQuotaLine ws="w1" />);
    await waitFor(() => expect(fake.getAiQuota).toHaveBeenCalled());
    expect(screen.queryByTestId('ai-quota')).toBeNull();
  });

  it('words the counter', () => {
    expect(text.aiCounterText({ userUsed: 38, userMax: 50, userRemaining: 12 })).toBe('12 of 50 AI requests left today');
    expect(text.aiCounterText({ userUsed: 50, userMax: 50, userRemaining: 0, resetsAt: null })).toBe('No AI requests left today');
    expect(text.aiCounterText({ exempt: true, userMax: 50 })).toBeNull();
    expect(text.aiCounterText(null)).toBeNull();
    expect(mergeAiUsage({ exempt: false, userMax: 50, userUsed: 1 }, { userUsed: 2 })).toMatchObject({ userUsed: 2, userMax: 50, userRemaining: 48 });
  });
});

describe('limit helpers', () => {
  it('finds the task limit a new task would hit', () => {
    const plan = { exempt: false, blocked: { 'tasks.selfCreated': true } };
    expect(text.taskLimitKey(plan, ['me'], 'me')).toBe('tasks.selfCreated');
    expect(text.taskLimitKey(plan, ['sam'], 'me')).toBeNull();
    expect(text.taskLimitKey({ ...plan, blocked: { 'tasks.perWorkspace': true } }, ['sam'], 'me')).toBe('tasks.perWorkspace');
    expect(text.taskLimitKey({ exempt: true, blocked: { 'tasks.perWorkspace': true } }, ['me'], 'me')).toBeNull();
  });

  it('counts notes per template under the server key and its short alias', () => {
    expect(text.templateKey({ id: 'blank', type: 'note' })).toBeNull();
    expect(text.templateKey({ id: 'spec', type: 'projectspec' })).toBe('projectspec');
    expect(text.templateUsage({ notes: { perTemplate: 2, byTemplate: { projectspec: 1, spec: 1 } } }, 'projectspec')).toEqual({ used: 2, max: 2, atLimit: true });
    expect(text.templateUsage({ notes: { perTemplate: 2, byTemplate: {} } }, 'meeting')).toEqual({ used: 0, max: 2, atLimit: false });
  });

  it('builds the pricing link from the server', () => {
    expect(text.pricingUrl('https://chat.example/', '/pricing')).toBe('https://chat.example/pricing');
    expect(text.pricingUrl('https://chat.example', 'https://other.example/plans')).toBe('https://other.example/plans');
  });
});

describe('free-plan call length', () => {
  beforeEach(() => {
    huddle.bindHuddles();
    act(() => useHuddle.setState({ call: { huddleId: 'h1', scope: { channelId: 'c1' }, meetingId: 'm1' } }));
  });
  afterEach(() => act(() => huddle.__resetHuddles()));

  it('words the warnings', () => {
    expect(text.timeWarningText({ minutesLeft: 5, maxMinutes: 30 })).toBe('5 minutes left — free plan calls end at 30 minutes');
    expect(text.timeWarningText({ minutesLeft: 1, maxMinutes: 30 })).toBe('1 minute left');
    expect(text.timeWarningText(null)).toBeNull();
  });

  it('keeps the call time limit from the roster and shows the 5- and 1-minute banners', () => {
    render(<CallTimeBanner />);
    act(() => emit('huddle', { event: 'huddle:roster', payload: { huddleId: 'h1', participants: [], timeLimit: { maxMinutes: 30, startedAt: 'a', endsAt: 'b' } } }));
    expect(useHuddle.getState().timeLimit).toEqual({ maxMinutes: 30, startedAt: 'a', endsAt: 'b' });
    expect(screen.queryByTestId('call-time-warning')).toBeNull();
    act(() => emit('huddle', { event: 'huddle:time_warning', payload: { huddleId: 'h1', minutesLeft: 5, maxMinutes: 30, endsAt: 'b', plan: 'free' } }));
    expect(screen.getByTestId('call-time-warning').textContent).toContain('5 minutes left — free plan calls end at 30 minutes');
    act(() => emit('huddle', { event: 'huddle:time_warning', payload: { huddleId: 'h1', minutesLeft: 1, maxMinutes: 30 } }));
    expect(screen.getByTestId('call-time-warning').textContent).toContain('1 minute left');
    // Another call's warning is not mine.
    act(() => emit('huddle', { event: 'huddle:time_warning', payload: { huddleId: 'other', minutesLeft: 5 } }));
    expect(screen.getByTestId('call-time-warning').textContent).toContain('1 minute left');
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(screen.queryByTestId('call-time-warning')).toBeNull();
  });

  it('explains a call ended at the 30-minute limit', async () => {
    render(<CallEndedNotice />);
    act(() => emit('huddle', { event: 'huddle:ended', payload: { huddleId: 'h1', channelId: 'c1', reason: 'time_limit' } }));
    expect(useHuddle.getState().call).toBeNull();
    expect(await screen.findByText(text.TIME_LIMIT_ENDED)).toBeTruthy();
    expect(screen.getByText('Open notes')).toBeTruthy();
  });

  it('says nothing extra when a call ends normally', () => {
    act(() => emit('huddle', { event: 'huddle:ended', payload: { huddleId: 'h1', channelId: 'c1' } }));
    expect(useHuddle.getState().endedNotice).toBeNull();
  });
});
