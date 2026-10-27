import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';

vi.mock('../config/flags.js', () => ({ useFlag: () => true }));
const { AiFab } = await import('./AiFab.jsx');
const { useNav } = await import('./nav.js');

describe('AI button hop', () => {
  it('hops (legs out) when the page changes, not on first show', () => {
    render(<AiFab tab="home" />);
    const body = () => screen.getByRole('button', { name: 'Oruinwan AI' }).querySelector('.ai-fab-body');
    expect(body().classList.contains('is-hopping')).toBe(false);
    expect(body().querySelectorAll('.ai-fab-legs i')).toHaveLength(2);
    act(() => useNav.setState({ tab: 'chats' }));
    expect(body().classList.contains('is-hopping')).toBe(true);
    // Each change replays it (a fresh element each time).
    const first = body();
    act(() => useNav.setState({ tab: 'tasks' }));
    expect(body()).not.toBe(first);
    expect(body().classList.contains('is-hopping')).toBe(true);
  });
});
