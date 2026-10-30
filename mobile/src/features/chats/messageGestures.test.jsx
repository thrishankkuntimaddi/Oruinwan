import { renderHook, act } from '@testing-library/react';
import { useRowGestures } from './messageGestures.js';

vi.mock('../../native/index.js', () => ({ tap: vi.fn() }));

// A touch tap at (10, 10) on a plain part of the message row.
function tapOn(handlers) {
  const row = document.createElement('div');
  const ev = { pointerType: 'touch', button: 0, clientX: 10, clientY: 10, pointerId: 1, currentTarget: row, target: row };
  handlers.onPointerDown(ev);
  handlers.onPointerUp(ev);
}

describe('message taps', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = () => {
    const onTap = vi.fn();
    const onDoubleTap = vi.fn();
    const { result } = renderHook(() => useRowGestures({ onTap, onDoubleTap, onLongPress: vi.fn() }));
    return { onTap, onDoubleTap, handlers: () => result.current.handlers };
  };

  it('a tap in a sheet opened from the row (a portal) never opens the thread', () => {
    const { onTap, onDoubleTap, handlers } = setup();
    const row = document.createElement('div');
    const sheetButton = document.createElement('button'); // elsewhere in the page
    const ev = { pointerType: 'touch', button: 0, clientX: 10, clientY: 10, pointerId: 1, currentTarget: row, target: sheetButton };
    handlers().onPointerDown(ev);
    handlers().onPointerUp(ev);
    act(() => vi.advanceTimersByTime(800));
    expect(onTap).not.toHaveBeenCalled();
    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  it('a single tap opens the thread', () => {
    const { onTap, handlers } = setup();
    tapOn(handlers());
    act(() => vi.advanceTimersByTime(400));
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('a double tap reacts and never opens the thread, even a slowish one', () => {
    const { onTap, onDoubleTap, handlers } = setup();
    tapOn(handlers());
    act(() => vi.advanceTimersByTime(320));
    tapOn(handlers());
    act(() => vi.advanceTimersByTime(800));
    expect(onDoubleTap).toHaveBeenCalledTimes(1);
    expect(onTap).not.toHaveBeenCalled();
  });

  it('a tap right after reacting (tap, tap, tap) doesn’t open the thread', () => {
    const { onTap, onDoubleTap, handlers } = setup();
    tapOn(handlers());
    act(() => vi.advanceTimersByTime(100));
    tapOn(handlers());
    act(() => vi.advanceTimersByTime(150));
    tapOn(handlers());
    act(() => vi.advanceTimersByTime(800));
    expect(onDoubleTap).toHaveBeenCalledTimes(1);
    expect(onTap).not.toHaveBeenCalled();
  });
});
