import { describe, expect, it } from 'vitest';
import { pokeAi, scrollReaction, useAiMood } from './aiMood.js';

describe('AI button mood', () => {
  it('a tap is happy, three quick taps stick its tongue out', () => {
    expect(pokeAi(1000)).toBe('happy');
    expect(useAiMood.getState().mood).toBe('happy');
    expect(pokeAi(1300)).toBe('happy');
    expect(pokeAi(1600)).toBe('tongue');
    expect(useAiMood.getState().mood).toBe('tongue');
    expect(pokeAi(5000)).toBe('happy'); // slow taps start over
  });

  it('looks the way a list scrolls, and is surprised by a fling', () => {
    expect(scrollReaction(20, 100)).toEqual({ mood: null, glance: 0.5 });
    expect(scrollReaction(-200, 100).glance).toBe(-1);
    expect(scrollReaction(900, 100).mood).toBe('surprised');
  });
});
