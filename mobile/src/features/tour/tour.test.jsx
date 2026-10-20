import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';

// The session, with the live adapter recorded instead of talking to a server.
const live = vi.hoisted(() => ({ markTourDone: null }));
const mockSession = vi.hoisted(() => ({ store: null }));
vi.mock('../../data/session.js', () => {
  mockSession.store = create((set, get) => ({
    user: null,
    workspaceId: 'w1',
    setUser: (patch) => set({ user: { ...get().user, ...patch } }),
  }));
  return { api: () => live, useSession: mockSession.store };
});
vi.mock('../../native/index.js', () => ({ tap: vi.fn(), hideKeyboard: vi.fn() }));

const { PhoneTour } = await import('./PhoneTour.jsx');
const { TOUR_STEPS, moveStep, placeCard, shouldAutoStart, startTour, useTour } = await import('./tourState.js');
const { useNav } = await import('../../app/nav.js');

beforeEach(() => {
  live.markTourDone = vi.fn(async () => {});
  useTour.setState({ open: false, closedThisSession: false });
  mockSession.store.setState({ user: { id: 'u1', name: 'Ada', tourDone: false }, workspaceId: 'w1' });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('tour state', () => {
  it('opens by itself only for an account the server says hasn’t seen it', () => {
    const user = { id: 'u1', tourDone: false };
    expect(shouldAutoStart({ user, workspaceId: 'w1' })).toBe(true);
    expect(shouldAutoStart({ user: { tourDone: true }, workspaceId: 'w1' })).toBe(false);
    // Unknown (offline, cached user without preferences): never repeat by mistake.
    expect(shouldAutoStart({ user: { id: 'u1' }, workspaceId: 'w1' })).toBe(false);
    expect(shouldAutoStart({ user, workspaceId: null })).toBe(false);
    expect(shouldAutoStart({ user, workspaceId: 'w1', blocked: true })).toBe(false);
    expect(shouldAutoStart({ user, workspaceId: 'w1', closedThisSession: true })).toBe(false);
  });

  it('steps and placement', () => {
    expect(moveStep(0, 6, 'next')).toBe(1);
    expect(moveStep(5, 6, 'next')).toBe(null);
    expect(moveStep(0, 6, 'back')).toBe(0);
    const vp = { width: 390, height: 844 };
    // A tab bar item: the card goes above it.
    expect(placeCard({ top: 780, left: 80, width: 60, height: 56 }, { width: 360, height: 190 }, vp)).toMatchObject({ placement: 'top', width: 358, left: 16 });
    // The header: below it.
    expect(placeCard({ top: 10, left: 10, width: 200, height: 50 }, { width: 360, height: 190 }, vp).placement).toBe('bottom');
    expect(placeCard(null, { width: 360, height: 190 }, vp).placement).toBe('center');
    expect(TOUR_STEPS.at(-1).title).toMatch(/all set/);
  });
});

describe('<PhoneTour>', () => {
  it('Next, Back, and Skip saves the tour as seen', () => {
    render(<PhoneTour />);
    act(() => startTour());
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain(`Step 1 of ${TOUR_STEPS.length}`);
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByRole('dialog').textContent).toContain('Step 2 of');
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByRole('dialog').textContent).toContain('Step 1 of');
    fireEvent.click(screen.getByText('Skip'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(live.markTourDone).toHaveBeenCalledTimes(1);
    expect(mockSession.store.getState().user.tourDone).toBe(true);
  });

  it('Done on the last step, and the back button (overlay stack) skips', () => {
    render(<PhoneTour />);
    act(() => startTour());
    for (let i = 1; i < TOUR_STEPS.length; i += 1) fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Done'));
    expect(live.markTourDone).toHaveBeenCalledTimes(1);

    act(() => startTour());
    expect(screen.getByRole('dialog')).toBeTruthy();
    act(() => useNav.getState().back());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens by itself after a sheet in front closes', () => {
    vi.useFakeTimers();
    const sheet = document.createElement('div');
    sheet.setAttribute('aria-modal', 'true');
    document.body.appendChild(sheet);
    render(<PhoneTour />);
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryByRole('dialog')).toBeNull();
    sheet.remove();
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.getByRole('dialog').textContent).toContain('Step 1 of');
  });
});
