// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';

const mockApi = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock('@services/api', () => ({ default: mockApi }));
vi.mock('../services/api', () => ({ default: mockApi }));

const setUser = vi.fn();
let mockUser = {};
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser, setUser }) }));

import FirstRunTour from '../components/tour/FirstRunTour';
import { TOUR_STEPS, moveStep, placeCard, shouldAutoStart, startTour, tourDone, tourStore, visibleSteps } from '../components/tour/tourState';

beforeEach(() => {
    vi.clearAllMocks();
    tourStore.reset();
    mockApi.put.mockResolvedValue({ data: {} });
    mockUser = { _id: 'u1', username: 'Sam', preferences: { tour: { done: false } } };
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
    document.body.innerHTML = '';
});

describe('tour state', () => {
    it('starts once per account, inside a workspace, when nothing blocks it', () => {
        expect(shouldAutoStart({ user: mockUser, workspaceId: 'ws1' })).toBe(true);
        expect(shouldAutoStart({ user: { preferences: {} }, workspaceId: 'ws1' })).toBe(true); // never saw it
        expect(shouldAutoStart({ user: { preferences: { tour: { done: true } } }, workspaceId: 'ws1' })).toBe(false);
        expect(shouldAutoStart({ user: mockUser, workspaceId: null })).toBe(false);
        expect(shouldAutoStart({ user: null, workspaceId: 'ws1' })).toBe(false);
        expect(shouldAutoStart({ user: mockUser, workspaceId: 'ws1', blocked: true })).toBe(false);
        expect(shouldAutoStart({ user: mockUser, workspaceId: 'ws1', closedThisSession: true })).toBe(false);
        expect(tourDone({ preferences: { tour: { done: true } } })).toBe(true);
    });

    it('moves between steps and finishes past the last', () => {
        expect(moveStep(0, 3, 'next')).toBe(1);
        expect(moveStep(2, 3, 'next')).toBe(null);
        expect(moveStep(0, 3, 'back')).toBe(0);
        expect(moveStep(2, 3, 'back')).toBe(1);
    });

    it('leaves out Huddles only when the rail is on screen without it', () => {
        expect(visibleSteps(TOUR_STEPS, () => false)).toHaveLength(TOUR_STEPS.length);
        // Phone-sized web layout: only the search bar is on screen; Huddles stays as a centred card.
        expect(visibleSteps(TOUR_STEPS, (t) => t === 'search')).toHaveLength(TOUR_STEPS.length);
        expect(visibleSteps(TOUR_STEPS, () => true)).toHaveLength(TOUR_STEPS.length);
        const allButHuddles = (t) => t !== 'huddles';
        expect(visibleSteps(TOUR_STEPS, allButHuddles).map((s) => s.target)).not.toContain('huddles');
        expect(TOUR_STEPS.length).toBeGreaterThanOrEqual(5);
        expect(TOUR_STEPS.length).toBeLessThanOrEqual(7);
        expect(TOUR_STEPS[TOUR_STEPS.length - 1].title).toMatch(/all set/);
    });

    it('places the card beside the element, and centred without one', () => {
        const vp = { width: 1440, height: 900 };
        const card = { width: 320, height: 180 };
        expect(placeCard({ top: 10, left: 4, width: 44, height: 44 }, card, vp).placement).toBe('right');
        expect(placeCard({ top: 10, left: 1300, width: 120, height: 30 }, card, vp).placement).toBe('bottom');
        expect(placeCard({ top: 820, left: 1300, width: 120, height: 30 }, card, vp).placement).toBe('top');
        const c = placeCard(null, card, { width: 390, height: 844 });
        expect(c.placement).toBe('center');
        expect(c.left).toBeGreaterThanOrEqual(12);
        // Never off screen on a phone.
        const p = placeCard({ top: 4, left: 100, width: 200, height: 40 }, card, { width: 390, height: 844 });
        expect(p.left + card.width).toBeLessThanOrEqual(390 - 12 + 0.001);
    });
});

describe('<FirstRunTour>', () => {
    it('Next, Back and Esc (skip) — skipping saves the tour as seen', () => {
        render(<FirstRunTour workspaceId="ws1" />);
        act(() => startTour());
        const dialog = screen.getByRole('dialog');
        expect(dialog.getAttribute('aria-modal')).toBe('true');
        expect(dialog.textContent).toContain(`Step 1 of ${TOUR_STEPS.length}`);
        expect(document.activeElement.textContent).toBe('Next');

        fireEvent.keyDown(window, { key: 'ArrowRight' });
        expect(screen.getByRole('dialog').textContent).toContain('Step 2 of');
        fireEvent.keyDown(document.body, { key: 'Enter' });
        expect(screen.getByRole('dialog').textContent).toContain('Step 3 of');
        fireEvent.click(screen.getByText('Back'));
        expect(screen.getByRole('dialog').textContent).toContain('Step 2 of');

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(mockApi.put).toHaveBeenCalledWith('/api/auth/me', { preferences: { tour: { done: true } } });
        expect(setUser).toHaveBeenCalled();
        expect(tourStore.get().closedThisSession).toBe(true);
    });

    it('finishing on the last step saves it too', () => {
        render(<FirstRunTour workspaceId="ws1" />);
        act(() => startTour());
        for (let i = 1; i < TOUR_STEPS.length; i += 1) fireEvent.click(screen.getByText('Next'));
        expect(screen.getByRole('dialog').textContent).toMatch(/all set/);
        fireEvent.click(screen.getByText('Done'));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(mockApi.put).toHaveBeenCalledTimes(1);
    });

    it('opens by itself for a new account, but waits for blocking dialogs', () => {
        vi.useFakeTimers();
        const blocker = document.createElement('div');
        blocker.setAttribute('aria-modal', 'true');
        document.body.appendChild(blocker);
        render(<FirstRunTour workspaceId="ws1" />);
        act(() => { vi.advanceTimersByTime(3000); });
        expect(screen.queryByRole('dialog')).toBeNull();

        blocker.remove();
        act(() => { vi.advanceTimersByTime(1500); });
        expect(screen.getByRole('dialog').textContent).toContain('Step 1 of');
    });

    it('does not open by itself once seen', () => {
        vi.useFakeTimers();
        mockUser = { _id: 'u1', preferences: { tour: { done: true } } };
        render(<FirstRunTour workspaceId="ws1" />);
        act(() => { vi.advanceTimersByTime(3000); });
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
