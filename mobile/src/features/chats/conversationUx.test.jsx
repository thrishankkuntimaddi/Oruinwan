// Conversation gestures and helpers: swipe to reply, tap for the thread, double tap to react,
// several reactions per person, read ticks, the date jump calendar and Send later choices.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../native/index.js', async (orig) => ({ ...(await orig()), tap: vi.fn() }));

const { toggleReaction } = await import('./useConversation.js');
const { receiptFor, doubleTapEmoji } = await import('./screens.jsx');
const { monthGrid, messageDays } = await import('./DayJumpSheet.jsx');
const { scheduleChoices } = await import('./ScheduleSheet.jsx');
const { MessageItem } = await import('./messages.jsx');

beforeEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('reactions', () => {
  it('a person can give several emojis; tapping one again takes back only that one', () => {
    let m = { id: 'm', reactions: { '👍': ['ben'] } };
    m = toggleReaction(m, '🎉', 'me');
    m = toggleReaction(m, '👍', 'me');
    expect(m.reactions).toEqual({ '👍': ['ben', 'me'], '🎉': ['me'] });
    m = toggleReaction(m, '🎉', 'me');
    expect(m.reactions).toEqual({ '👍': ['ben', 'me'] });
  });

  it('double tap adds the most used reaction, or 👍, and never takes one back', () => {
    expect(doubleTapEmoji({ reactions: {} }, 'me')).toBe('👍');
    expect(doubleTapEmoji({ reactions: { '🎉': ['a', 'b'], '👍': ['c'] } }, 'me')).toBe('🎉');
    expect(doubleTapEmoji({ reactions: { '🎉': ['me'] } }, 'me')).toBeNull();
  });
});

describe('read ticks', () => {
  it('sending, sent, then read once everyone else read it', () => {
    expect(receiptFor({ authorId: 'me', pending: true }, 'me', ['ben'])).toBe('sending');
    expect(receiptFor({ authorId: 'me', readBy: [] }, 'me', ['ben'])).toBe('sent');
    expect(receiptFor({ authorId: 'me', readBy: ['ben'] }, 'me', ['ben'])).toBe('read');
    expect(receiptFor({ authorId: 'me', readBy: ['ben'] }, 'me', ['ben', 'cleo'])).toBe('sent');
    expect(receiptFor({ authorId: 'ben', readBy: [] }, 'me', ['ben'])).toBeNull();
  });
});

describe('jump to a date', () => {
  it('lays a month out Monday first and marks days with messages', () => {
    const weeks = monthGrid(2026, 9); // October 2026 starts on a Thursday
    expect(weeks[0].slice(0, 3)).toEqual([null, null, null]);
    expect(weeks[0][3].getDate()).toBe(1);
    const days = messageDays([
      { id: 'a', at: new Date(2026, 9, 3, 9).toISOString() },
      { id: 'b', at: new Date(2026, 9, 3, 18).toISOString() },
      { id: 's', at: new Date(2026, 9, 4).toISOString(), state: 'system' },
    ]);
    expect([...days.values()]).toEqual(['a']);
  });
});

describe('send later', () => {
  it('offers an hour from now, this evening while it is still ahead, tomorrow morning and next Monday', () => {
    const morning = scheduleChoices(new Date(2026, 9, 21, 10, 0)); // a Wednesday
    expect(morning.map((c) => c.id)).toEqual(['hour', 'evening', 'tomorrow', 'monday']);
    expect(morning.find((c) => c.id === 'monday').when.getDay()).toBe(1);
    const late = scheduleChoices(new Date(2026, 9, 21, 21, 0));
    expect(late.map((c) => c.id)).not.toContain('evening');
  });
});

describe('message gestures', () => {
  const m = { id: 'm1', authorId: 'ben', text: 'Hello', state: 'ok', at: new Date().toISOString(), reactions: {} };
  const renderRow = (props) =>
    render(<MessageItem m={m} directory={{ ben: { id: 'ben', name: 'Ben' } }} me="me" onReact={vi.fn()} onLongPress={vi.fn()} onOpenThread={vi.fn()} onRetry={vi.fn()} {...props} />);

  it('swiping right far enough replies to the message', () => {
    const onSwipeReply = vi.fn();
    renderRow({ onSwipeReply });
    const row = document.querySelector('[data-mid="m1"]');
    fireEvent.pointerDown(row, { clientX: 20, clientY: 100, pointerId: 1, pointerType: 'touch' });
    fireEvent.pointerMove(row, { clientX: 60, clientY: 102, pointerId: 1, pointerType: 'touch' });
    fireEvent.pointerMove(row, { clientX: 140, clientY: 103, pointerId: 1, pointerType: 'touch' });
    fireEvent.pointerUp(row, { clientX: 140, clientY: 103, pointerId: 1, pointerType: 'touch' });
    expect(onSwipeReply).toHaveBeenCalledWith(m);
  });

  it('a tap opens the thread view; a double tap reacts instead', () => {
    vi.useFakeTimers();
    const onTapMessage = vi.fn();
    const onDoubleTap = vi.fn();
    renderRow({ onTapMessage, onDoubleTap });
    const body = screen.getByText('Hello');
    const tapAt = (x) => {
      fireEvent.pointerDown(body, { clientX: x, clientY: 50, pointerId: 2, pointerType: 'touch' });
      fireEvent.pointerUp(body, { clientX: x, clientY: 50, pointerId: 2, pointerType: 'touch' });
    };
    tapAt(50);
    vi.advanceTimersByTime(400);
    expect(onTapMessage).toHaveBeenCalledTimes(1);
    tapAt(50);
    tapAt(51);
    vi.advanceTimersByTime(400);
    expect(onDoubleTap).toHaveBeenCalledTimes(1);
    expect(onTapMessage).toHaveBeenCalledTimes(1);
  });

  it('tapping a reaction shows who reacted, with an All filter, and + opens the emoji picker', () => {
    vi.useFakeTimers();
    render(
      <MessageItem
        m={{ ...m, reactions: { '👍': ['ben', 'me'], '🎉': ['ben'] } }}
        directory={{ ben: { id: 'ben', name: 'Ben' }, me: { id: 'me', name: 'Ada' } }}
        me="me"
        onReact={vi.fn()}
        onLongPress={vi.fn()}
        onOpenThread={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    fireEvent.click(screen.getAllByTestId('reaction-chip')[0]);
    act(() => vi.advanceTimersByTime(400));
    expect(screen.getByRole('tab', { name: /All/ })).toBeTruthy();
    expect(screen.getByTestId('reaction-people').textContent).toContain('Ben');
    expect(screen.getByTestId('reaction-add')).toBeTruthy();
  });

  it('shows the quoted message above a reply', () => {
    renderRow({ m: { ...m, quoted: { id: 'q', authorId: 'me', text: 'Original *text*', state: 'ok' } } });
    expect(screen.getByTestId('quote-block').textContent).toContain('You');
    expect(screen.getByTestId('quote-block').textContent).toContain('Original text');
  });
});
