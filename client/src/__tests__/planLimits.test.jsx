// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import {
    isPlanLimitBody, isPlanLimitError, handlePlanLimitError, handlePlanLimitResponse, onPlanLimit, emitPlanLimit,
    isDuplicateOfPlanLimit, planBlock, blockedButtonProps, guardAction, aiUsageText, aiRemaining, normalizeAIUsage,
    __resetPlanBusForTests,
} from '../features/plan/planLimit';
import UpgradeDialog from '../features/plan/UpgradeDialog';
import AIUsageLine from '../features/plan/AIUsageLine';
import { PlanUsageView, UsageBar } from '../features/plan/PlanUsageSection';
import { applyAIUsage } from '../features/plan/usePlan';
import { timeWarningText, timeLeftLabel } from '../features/plan/HuddleTimeLimitBanner';
import { templateToNote, TEMPLATES } from '../pages/SidebarComp/notesComponents/ui/NoteTemplateModal';
import { getCreatePolicy } from '../pages/workspaceSelectComponents/createPolicy';

const REFUSAL = {
    code: 'PLAN_LIMIT', limit: 'workspaces.create', max: 2, used: 2, plan: 'free', upgradeUrl: '/pricing',
    message: "You've reached the free plan limit: 2 workspaces you created. Pro and Enterprise are coming soon.",
};

const PLAN = {
    plan: 'free', userPlan: 'free', workspacePlan: 'free', exempt: false, upgradeUrl: '/pricing',
    plans: [{ id: 'free', name: 'Free', comingSoon: false }, { id: 'pro', name: 'Pro', comingSoon: true }],
    limits: { 'workspaces.create': 2, 'channels.perWorkspace': 10, 'members.perWorkspace': 11, 'tasks.perWorkspace': 300, 'ai.userDaily': 50 },
    items: [
        { key: 'workspaces.create', label: 'Workspaces you created', used: 2, max: 2, atLimit: true, scope: 'user' },
        { key: 'workspaces.join', label: 'Workspaces you joined', used: 0, max: 2, atLimit: false, scope: 'user' },
        { key: 'channels.perWorkspace', label: 'Channels (besides #general and #random)', used: 3, max: 10, atLimit: false, scope: 'workspace' },
        { key: 'ai.userDaily', label: 'Your AI requests today', used: 12, max: 50, atLimit: false, scope: 'user' },
        { key: 'ai.workspaceDaily', label: 'Workspace AI requests today', used: 40, max: 300, atLimit: false, scope: 'workspace' },
    ],
    notes: { perTemplate: 2, byTemplate: { meeting: 1, projectspec: 2 } },
    huddles: { participants: 10, minutes: 30 },
    ai: { userUsed: 12, userMax: 50, userRemaining: 38, workspaceUsed: 40, workspaceMax: 300, workspaceRemaining: 260, resetsAt: '2026-10-22T00:00:00.000Z' },
    blocked: { 'workspaces.create': true, 'channels.perWorkspace': false },
};

beforeEach(() => { __resetPlanBusForTests(); });

describe('PLAN_LIMIT detection and the event bus', () => {
    it('recognises the 403 PLAN_LIMIT body and ignores other errors', () => {
        expect(isPlanLimitBody(REFUSAL)).toBe(true);
        expect(isPlanLimitBody({ code: 'FORBIDDEN' })).toBe(false);
        expect(isPlanLimitError({ response: { status: 403, data: REFUSAL } })).toBe(true);
        expect(isPlanLimitError({ response: { status: 500, data: REFUSAL } })).toBe(false);
        expect(isPlanLimitError({ response: { status: 403, data: { message: 'Forbidden' } } })).toBe(false);
        expect(isPlanLimitError(null)).toBe(false);
    });

    it('announces a refusal once per error with the server message', () => {
        const seen = vi.fn();
        onPlanLimit(seen);
        const err = { response: { status: 403, data: REFUSAL } };
        expect(handlePlanLimitError(err)).toBe(true);
        expect(handlePlanLimitError(err)).toBe(true);
        expect(seen).toHaveBeenCalledTimes(1);
        expect(seen.mock.calls[0][0]).toMatchObject({ code: 'PLAN_LIMIT', limit: 'workspaces.create', message: REFUSAL.message });
        expect(handlePlanLimitError({ response: { status: 403, data: {} } })).toBe(false);
        expect(handlePlanLimitResponse(403, REFUSAL)).toBe(true);
        expect(handlePlanLimitResponse(400, REFUSAL)).toBe(false);
        expect(seen).toHaveBeenCalledTimes(2);
    });

    it('the axios layer opens the dialog for any 403 PLAN_LIMIT response', async () => {
        const { default: api } = await vi.importActual('../services/api');
        const seen = vi.fn();
        onPlanLimit(seen);
        const adapter = (config) => Promise.reject(Object.assign(new Error('403'), { config, response: { status: 403, data: REFUSAL, headers: {}, config } }));
        await expect(api.post('/api/workspaces', {}, { adapter })).rejects.toBeTruthy();
        expect(seen).toHaveBeenCalledTimes(1);
        expect(seen.mock.calls[0][0].message).toBe(REFUSAL.message);
    });

    it('marks a duplicate error toast right after a refusal', () => {
        expect(isDuplicateOfPlanLimit(REFUSAL.message)).toBe(false);
        emitPlanLimit(REFUSAL);
        expect(isDuplicateOfPlanLimit(REFUSAL.message)).toBe(true);
        expect(isDuplicateOfPlanLimit('Server error')).toBe(true);
        expect(isDuplicateOfPlanLimit('Name is required')).toBe(false);
        expect(isDuplicateOfPlanLimit(REFUSAL.message, Date.now() + 10000)).toBe(false);
    });

    it('turns blocked flags into button props and guarded actions', () => {
        const block = planBlock(PLAN, 'workspaces.create');
        expect(block.blocked).toBe(true);
        expect(block.reason).toMatch(/2 workspaces/);
        expect(blockedButtonProps(block)).toMatchObject({ 'aria-disabled': 'true', 'data-plan-blocked': 'true' });
        expect(planBlock(PLAN, 'channels.perWorkspace').blocked).toBe(false);
        expect(planBlock({ ...PLAN, exempt: true }, 'workspaces.create').blocked).toBe(false);
        expect(blockedButtonProps(planBlock(null, 'x'))).toEqual({});

        const seen = vi.fn();
        onPlanLimit(seen);
        const action = vi.fn();
        guardAction(block, action)();
        expect(action).not.toHaveBeenCalled();
        expect(seen).toHaveBeenCalledTimes(1);
        guardAction(planBlock(PLAN, 'channels.perWorkspace'), action)();
        expect(action).toHaveBeenCalledTimes(1);
    });
});

describe('Upgrade dialog', () => {
    it('shows the title, the server message, the coming-soon line and both buttons', () => {
        const onSeePlans = vi.fn();
        const onClose = vi.fn();
        render(<UpgradeDialog open message="You've reached the free plan limit: 10 channels." onSeePlans={onSeePlans} onClose={onClose} />);
        expect(screen.getByRole('dialog', { name: 'Free plan limit reached' })).toBeInTheDocument();
        expect(screen.getByText("You've reached the free plan limit: 10 channels.")).toBeInTheDocument();
        expect(screen.getByText('Pro and Enterprise are coming soon.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /See plans/ }));
        expect(onSeePlans).toHaveBeenCalled();
        fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]);
        expect(onClose).toHaveBeenCalled();
    });

    it('renders nothing while closed', () => {
        render(<UpgradeDialog open={false} message="x" onSeePlans={() => {}} onClose={() => {}} />);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('PlanLimitProvider opens on a refusal and "See plans" goes to /pricing', async () => {
        vi.resetModules();
        vi.doMock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
        vi.doMock('../contexts/SocketContext', () => ({ useOptionalSocket: () => null }));
        const { default: PlanLimitProvider } = await import('../features/plan/PlanLimitProvider');
        const bus = await import('../features/plan/planLimit');
        render(
            <MemoryRouter initialEntries={['/workspace/1/home']}>
                <Routes>
                    <Route path="/pricing" element={<p>Pricing page</p>} />
                    <Route path="*" element={<PlanLimitProvider />} />
                </Routes>
            </MemoryRouter>,
        );
        expect(screen.queryByRole('dialog')).toBeNull();
        act(() => { bus.emitPlanLimit({ ...REFUSAL, limit: 'huddles.participants', message: 'This call is full: 10 people on the free plan.' }); });
        expect(await screen.findByText('This call is full: 10 people on the free plan.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /See plans/ }));
        expect(await screen.findByText('Pricing page')).toBeInTheDocument();
        vi.doUnmock('../contexts/ToastContext');
        vi.doUnmock('../contexts/SocketContext');
    });
});

describe('Plan & usage section', () => {
    it('shows the plan name, coming soon, and a progress bar per item and template', () => {
        render(<PlanUsageView plan={PLAN} workspaceName="Acme" onSeePlans={() => {}} />);
        expect(screen.getByTestId('plan-name')).toHaveTextContent('Free');
        expect(screen.getByText('Pro and Enterprise are coming soon.')).toBeInTheDocument();
        const bars = screen.getAllByRole('progressbar');
        // 5 items + 7 note templates
        expect(bars).toHaveLength(12);
        const created = screen.getByRole('progressbar', { name: 'Workspaces you created' });
        expect(created).toHaveAttribute('aria-valuetext', '2 of 2');
        expect(created.closest('[data-testid="plan-usage-row"]')).toHaveAttribute('data-at-limit', 'true');
        expect(screen.getByRole('progressbar', { name: 'Project spec' }).closest('[data-testid="plan-usage-row"]')).toHaveAttribute('data-at-limit', 'true');
        expect(screen.getByRole('progressbar', { name: 'Meeting notes' })).toHaveAttribute('aria-valuetext', '1 of 2');
        expect(screen.getByText('10')).toBeInTheDocument();
        expect(screen.getByText('30 minutes')).toBeInTheDocument();
        expect(screen.getByText(/Workspace · Acme/)).toBeInTheDocument();
    });

    it('company accounts have no limits', () => {
        render(<PlanUsageView plan={{ ...PLAN, exempt: true, plan: 'company' }} onSeePlans={() => {}} />);
        expect(screen.getByText('Your company plan has no free-plan limits.')).toBeInTheDocument();
        expect(screen.queryByRole('progressbar')).toBeNull();
    });

    it('a usage bar without a max says there is no limit', () => {
        render(<UsageBar label="Tasks" used={4} max={null} />);
        expect(screen.getByText('4 · no limit')).toBeInTheDocument();
        expect(screen.queryByRole('progressbar')).toBeNull();
    });
});

describe('AI counter', () => {
    it('says how many requests are left today', () => {
        const ai = normalizeAIUsage(PLAN.ai);
        expect(aiUsageText(ai)).toBe('38 of 50 AI requests left today');
        expect(aiRemaining(ai)).toBe(38);
        expect(aiUsageText(normalizeAIUsage({ userUsed: 50, userMax: 50, workspaceUsed: 60, workspaceMax: 300 }))).toBe("You've used all 50 AI requests for today");
        expect(aiUsageText(normalizeAIUsage({ userUsed: 1, userMax: 50, workspaceUsed: 295, workspaceMax: 300 }))).toBe('5 of 300 workspace AI requests left today');
        expect(aiUsageText(normalizeAIUsage({ ...PLAN.ai, exempt: true }))).toBe('');
        expect(aiUsageText(null)).toBe('');
    });

    it('renders the muted line and hides it for company plans', () => {
        const { rerender } = render(<AIUsageLine usage={normalizeAIUsage({ userUsed: 38, userMax: 50, workspaceUsed: 0, workspaceMax: 300 })} />);
        expect(screen.getByTestId('ai-usage-line')).toHaveTextContent('12 of 50 AI requests left today');
        rerender(<AIUsageLine usage={normalizeAIUsage({ userUsed: 38, userMax: 50, exempt: true })} />);
        expect(screen.queryByTestId('ai-usage-line')).toBeNull();
    });

    it('applies plan:ai_usage to a loaded plan', () => {
        const next = applyAIUsage(PLAN, { workspaceId: 'w1', userUsed: 50, userMax: 50, workspaceUsed: 41, workspaceMax: 300 });
        expect(next.ai.userRemaining).toBe(0);
        expect(next.blocked['ai.userDaily']).toBe(true);
        expect(next.items.find((i) => i.key === 'ai.userDaily')).toMatchObject({ used: 50, atLimit: true });
    });
});

describe('Huddle time limit copy', () => {
    it('words the warnings', () => {
        expect(timeWarningText({ minutesLeft: 5, maxMinutes: 30 })).toBe('5 minutes left — free plan calls end at 30 minutes');
        expect(timeWarningText({ minutesLeft: 1, maxMinutes: 30 })).toBe('1 minute left — free plan calls end at 30 minutes');
        expect(timeLeftLabel('2026-10-21T10:05:00Z', new Date('2026-10-21T10:00:28Z').getTime())).toBe('4:32');
        expect(timeLeftLabel(null)).toBeNull();
    });
});

describe('Workspace create policy', () => {
    it('follows GET /api/plan and falls back to 2 created workspaces', () => {
        const personal = { userType: 'personal' };
        expect(getCreatePolicy(personal, [], PLAN)).toMatchObject({ isLimitReached: true, canCreate: false });
        expect(getCreatePolicy(personal, [], PLAN).limitMessage).toMatch(/free plan limit: 2 workspaces you created/);
        expect(getCreatePolicy(personal, [], { ...PLAN, exempt: true }).isLimitReached).toBe(false);
        expect(getCreatePolicy(personal, [{ isOwner: true }, { isOwner: true }]).isLimitReached).toBe(true);
        expect(getCreatePolicy(personal, [{ isOwner: true }]).isLimitReached).toBe(false);
    });
});

describe('Notes from templates send templateId', () => {
    it('templateToNote adds the template id (blank adds none)', () => {
        const meeting = TEMPLATES.find((t) => t.id === 'meeting');
        const [title, type, extra] = templateToNote(meeting);
        expect(title).toBe(meeting.title);
        expect(type).toBeTruthy();
        expect(extra.templateId).toBe('meeting');
        const blank = TEMPLATES.find((t) => t.id === 'blank');
        expect(templateToNote(blank)[2].templateId).toBeUndefined();
    });

    it('addNote posts templateId to the notes API', async () => {
        vi.resetModules();
        const post = vi.fn().mockResolvedValue({ data: { note: { _id: 'n1', title: 'Meeting', content: '', type: 'meeting', workspace: 'w1' } } });
        vi.doMock('@services/api', () => ({ default: { get: vi.fn().mockResolvedValue({ data: { notes: [] } }), post, put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
        const toast = { showToast: vi.fn() };
        const sock = { socket: null };
        const auth = { user: { _id: 'u1' } };
        vi.doMock('../contexts/ToastContext', () => ({ useToast: () => toast }));
        vi.doMock('../contexts/SocketContext', () => ({ useSocket: () => sock, useOptionalSocket: () => null }));
        vi.doMock('../contexts/AuthContext', () => ({ useAuth: () => auth }));
        const { NotesProvider, useNotes } = await import('../contexts/NotesContext');
        const modal = await import('../pages/SidebarComp/notesComponents/ui/NoteTemplateModal');

        let ctx = null;
        const Grab = () => { ctx = useNotes(); return null; };
        render(
            <MemoryRouter initialEntries={['/workspace/w1/notes']}>
                <Routes>
                    <Route path="/workspace/:workspaceId/*" element={<NotesProvider><Grab /></NotesProvider>} />
                </Routes>
            </MemoryRouter>,
        );
        await waitFor(() => expect(ctx).toBeTruthy());
        const meeting = modal.TEMPLATES.find((t) => t.id === 'meeting');
        await act(async () => { await ctx.addNote(...modal.templateToNote(meeting)); });
        expect(post).toHaveBeenCalledWith('/api/v2/notes', expect.objectContaining({ templateId: 'meeting', workspaceId: 'w1' }));

        post.mockClear();
        const blank = modal.TEMPLATES.find((t) => t.id === 'blank');
        await act(async () => { await ctx.addNote(...modal.templateToNote(blank)); });
        expect(post.mock.calls[0][1]).not.toHaveProperty('templateId');

        vi.doUnmock('@services/api');
        vi.doUnmock('../contexts/ToastContext');
        vi.doUnmock('../contexts/SocketContext');
        vi.doUnmock('../contexts/AuthContext');
    }, 30000);
});
