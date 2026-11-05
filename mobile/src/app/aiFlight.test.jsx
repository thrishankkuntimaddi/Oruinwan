// The AI button flying between the floating button and a screen's AI button.
import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { _clearSpot, fly, leaveSpot, takeSpot, useAiLanding } from './aiFlight.js';

const rect = (left, top, size) => ({ left, top, width: size, height: size, right: left + size, bottom: top + size });
const at = (el, r) => {
  el.getBoundingClientRect = () => r;
  return el;
};

afterEach(() => {
  cleanup();
  _clearSpot();
  vi.useRealTimers();
});

describe('AI button flight', () => {
  it('a spot is used once and only while fresh', () => {
    leaveSpot(at(document.createElement('button'), rect(300, 700, 44)));
    expect(takeSpot().rect.left).toBe(300);
    expect(takeSpot()).toBeNull();
    leaveSpot(at(document.createElement('button'), rect(0, 0, 0)));
    expect(takeSpot()).toBeNull();
  });

  it('a ghost flies to the target and lands', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    const to = at(document.createElement('button'), rect(320, 20, 36));
    document.body.appendChild(to);
    const onLand = vi.fn();
    fly({ rect: rect(300, 700, 44), look: document.createElement('button') }, to, onLand);
    expect(document.querySelector('[data-testid="ai-flight"]')).toBeTruthy();
    vi.advanceTimersByTime(700);
    expect(onLand).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-testid="ai-flight"]')).toBeNull();
  });

  it("a screen's AI button waits invisible while it lands, and leaves its spot when it goes", async () => {
    leaveSpot(at(document.createElement('button'), rect(300, 700, 44)));
    function Island() {
      const [ref, style] = useAiLanding();
      return <button ref={(el) => { ref.current = el && at(el, rect(320, 20, 36)); }} style={style} data-testid="island">AI</button>;
    }
    const { getByTestId, unmount } = render(<Island />);
    expect(getByTestId('island').style.visibility).toBe('hidden');
    await act(async () => {});
    expect(document.querySelector('[data-testid="ai-flight"]')).toBeTruthy();
    unmount();
    expect(takeSpot()?.rect.left).toBe(320);
  });
});

describe('flight paths', () => {
  it('never takes the same path twice in a row, and every path starts and ends on the line', async () => {
    const { PATHS, pickPath } = await import('./aiFlight.js');
    let prev = pickPath();
    for (let i = 0; i < 30; i++) {
      const next = pickPath();
      expect(next).not.toBe(prev);
      prev = next;
    }
    for (const [name, path] of Object.entries(PATHS)) {
      for (const t of [0, 1]) {
        const o = path(t, 600);
        expect(Math.abs(o.x), `${name} x at ${t}`).toBeLessThan(0.5);
        expect(Math.abs(o.y), `${name} y at ${t}`).toBeLessThan(0.5);
      }
    }
  });
});
