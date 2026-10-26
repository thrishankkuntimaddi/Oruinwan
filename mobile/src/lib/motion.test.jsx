// Motion: new messages fade in (not the history), counts bump, and reduced motion removes it all.
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, render, screen, act } from '@testing-library/react';
import { create } from 'zustand';
import { defineMotionTests } from '../../../platform/motion/motion.cases.js';
import { motion } from './motion.js';

vi.mock('../data/session.js', () => ({
  api: () => ({}),
  useSession: create(() => ({ user: { id: 'me' }, workspaceId: 'w1' })),
  useWorkspace: () => ({ id: 'w1', role: 'member' }),
}));
const { MessageList } = await import('../features/chats/messages.jsx');
const { TabBadge } = await import('../app/TabBar.jsx');

defineMotionTests({ describe, it, expect });

const setReduced = (reduce) => {
  window.matchMedia = (q) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} });
};
const msg = (id, s, text = id) => ({ id, convId: 'c1', authorId: 'u1', author: { name: 'Ana' }, text, state: 'ok', at: new Date(Date.UTC(2026, 9, 26, 10, 0, s)).toISOString(), reactions: {}, replyCount: 0 });
const list = (items) => <MessageList items={items} directory={{}} me="me" onReact={() => {}} onLongPress={() => {}} onOpenThread={() => {}} onRetry={() => {}} />;
const row = (id) => document.querySelector(`[data-mid="${id}"]`);

afterEach(() => {
  cleanup();
  delete window.matchMedia;
});

describe('phone motion', () => {
  it('a new message fades in; the history does not', () => {
    setReduced(false);
    const { rerender } = render(list([msg('m1', 1), msg('m2', 2)]));
    expect(row('m1').className).not.toContain('animate-msg-in');
    rerender(list([msg('m1', 1), msg('m2', 2), msg('m3', 3)]));
    expect(row('m3').className).toContain('animate-msg-in');
    expect(row('m2').className).not.toContain('animate-msg-in');
  });

  it('reduced motion removes the animation classes', () => {
    setReduced(true);
    const { rerender } = render(list([msg('m1', 1)]));
    rerender(list([msg('m1', 1), msg('m2', 2)]));
    expect(row('m2').className).not.toContain('animate-msg-in');
    expect(motion('animate-pop-in', true)).toBe('');
    expect(motion('animate-pop-in', false)).toBe('animate-pop-in');
  });

  it('a count that goes up bumps, unless motion is reduced', () => {
    setReduced(false);
    const { rerender } = render(<TabBadge count={1} />);
    expect(screen.getByTestId('tab-badge').className).not.toContain('animate-bump');
    rerender(<TabBadge count={2} />);
    expect(screen.getByTestId('tab-badge').className).toContain('animate-bump');
    cleanup();
    setReduced(true);
    const again = render(<TabBadge count={1} />);
    act(() => again.rerender(<TabBadge count={5} />));
    expect(screen.getByTestId('tab-badge').className).not.toContain('animate-bump');
  });
});
