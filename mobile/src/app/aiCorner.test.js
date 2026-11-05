import { describe, expect, it } from 'vitest';
import { nearestCorner, onLeft, onTop, setAiCorner, useAiCorner } from './aiCorner.js';

describe('AI button corner', () => {
  it('snaps to the nearest corner', () => {
    expect(nearestCorner(20, 30, 400, 800)).toBe('top-left');
    expect(nearestCorner(390, 30, 400, 800)).toBe('top-right');
    expect(nearestCorner(20, 790, 400, 800)).toBe('bottom-left');
    expect(nearestCorner(390, 790, 400, 800)).toBe('bottom-right');
  });

  it('remembers a valid corner only', () => {
    setAiCorner('top-left');
    expect(useAiCorner.getState().corner).toBe('top-left');
    setAiCorner('middle');
    expect(useAiCorner.getState().corner).toBe('top-left');
    expect(onLeft('top-left') && onTop('top-left')).toBe(true);
    setAiCorner('bottom-right');
  });
});

describe('moving the AI button is a setting', () => {
  it('stays bottom right until switched on, and goes back when switched off', async () => {
    const { effectiveCorner, setAiMovable, setAiCorner, useAiCorner } = await import('./aiCorner.js');
    setAiMovable(false);
    setAiCorner('top-left');
    expect(effectiveCorner(useAiCorner.getState())).toBe('bottom-right');
    setAiMovable(true);
    expect(effectiveCorner(useAiCorner.getState())).toBe('top-left');
    setAiMovable(false);
    expect(useAiCorner.getState().corner).toBe('bottom-right');
    expect(effectiveCorner(useAiCorner.getState())).toBe('bottom-right');
  });
});
