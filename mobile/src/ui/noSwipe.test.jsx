import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { Sheet, inNoSwipe } from './Overlay.jsx';

describe('no-swipe areas', () => {
  it('finds a marked ancestor', () => {
    const outer = document.createElement('div');
    outer.setAttribute('data-no-swipe', '');
    const inner = document.createElement('canvas');
    outer.appendChild(inner);
    expect(inNoSwipe(inner)).toBe(true);
    expect(inNoSwipe(document.createElement('div'))).toBe(false);
    expect(inNoSwipe(null)).toBe(false);
  });

  it('drawing down on a canvas inside a sheet does not close it', () => {
    const onClose = vi.fn();
    const { getByTestId } = render(
      <Sheet open onClose={onClose} title="Meeting">
        <canvas data-testid="board" data-no-swipe />
      </Sheet>,
    );
    const board = getByTestId('board');
    fireEvent.pointerDown(board, { clientY: 100, pointerId: 1, button: 0 });
    fireEvent.pointerMove(board, { clientY: 400, pointerId: 1 });
    fireEvent.pointerUp(board, { clientY: 400, pointerId: 1 });
    expect(onClose).not.toHaveBeenCalled();
  });
});
