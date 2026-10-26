// @vitest-environment jsdom
// Motion: new messages fade in (not the history), counts bump, and reduced motion removes it all.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { defineMotionTests } from '@platform/motion/motion.cases.js';
import { motionClass } from '../utils/motion';
import BumpCount from '../components/motion/BumpCount';

vi.mock('../features/messaging/events/MessageEvent', () => ({ default: ({ event }) => <span>{event.payload?.text}</span> }));
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast: () => {} }) }));
vi.mock('../hooks/useUserPreferences', () => ({ useDateFormatter: () => ({ time: () => '10:00', dayKey: () => '2026-10-26', dayHeading: () => 'Today' }) }));
const { default: ConversationStream } = await import('../features/messaging/events/ConversationStream');

defineMotionTests({ describe, it, expect });

const setReduced = (reduce) => {
    window.matchMedia = (q) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} });
};
const ev = (id, s) => ({ id, type: 'message', createdAt: new Date(2026, 9, 26, 10, 0, s).toISOString(), sender: { _id: 'u1', username: 'ana' }, payload: { text: `text ${id}` } });
const stream = (events) => <ConversationStream events={events} conversationId="c1" conversationType="dm" currentUserId="me" />;
const row = (id) => document.getElementById(`msg-${id}`);

afterEach(() => {
    cleanup();
    delete window.matchMedia;
});

describe('web motion', () => {
    it('a new message fades in; the history does not', () => {
        setReduced(false);
        Element.prototype.scrollIntoView = () => {};
        Element.prototype.scrollTo = () => {};
        const { rerender } = render(stream([ev('a1', 1), ev('a2', 2)]));
        expect(row('a1').className).not.toContain('anim-msg-in');
        rerender(stream([ev('a1', 1), ev('a2', 2), ev('a3', 3)]));
        expect(row('a3').className).toContain('anim-msg-in');
        expect(row('a2').className).not.toContain('anim-msg-in');
    });

    it('reduced motion removes the animation classes', () => {
        setReduced(true);
        Element.prototype.scrollIntoView = () => {};
        Element.prototype.scrollTo = () => {};
        const { rerender, container } = render(stream([ev('a1', 1)]));
        rerender(stream([ev('a1', 1), ev('a2', 2)]));
        expect(row('a2').className).not.toContain('anim-msg-in');
        expect(container.querySelector('.anim-conv-in')).toBeNull();
        expect(motionClass('pop-in', true)).toBe('');
        expect(motionClass('pop-in', false)).toBe('anim-pop-in');
    });

    it('an unread count that goes up bumps, unless motion is reduced', () => {
        setReduced(false);
        const { rerender } = render(<BumpCount count={0} data-testid="n" />);
        rerender(<BumpCount count={1} data-testid="n" />);
        expect(screen.getByTestId('n').className).toContain('anim-bump');
        expect(screen.getByTestId('n').textContent).toBe('1');
        rerender(<BumpCount count={120} data-testid="n" />);
        expect(screen.getByTestId('n').textContent).toBe('99+');
        cleanup();
        setReduced(true);
        const again = render(<BumpCount count={1} data-testid="n" />);
        again.rerender(<BumpCount count={2} data-testid="n" />);
        expect(screen.getByTestId('n').className).not.toContain('anim-bump');
    });
});
