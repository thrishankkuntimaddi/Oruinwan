import { describe, expect, it } from 'vitest';
import { aiMentionAt, assistantMentionAt, mentionsAI } from './aiMention.js';

describe('@ai mentions', () => {
  it('spots a mention of the assistant', () => {
    expect(mentionsAI('@ai summarise this')).toBe(true);
    expect(mentionsAI('hey @Oruinwan what is due?')).toBe(true);
    expect(mentionsAI('email me@ai.com')).toBe(false);
    expect(mentionsAI('@aisha hello')).toBe(false);
  });

  it('suggests @ai while the word is being typed', () => {
    expect(aiMentionAt('hey @')).toEqual({ start: 4, end: 5 });
    expect(aiMentionAt('@a')).toEqual({ start: 0, end: 2 });
    expect(aiMentionAt('@oru')).toEqual({ start: 0, end: 4 });
    expect(aiMentionAt('@ai')).toBeNull();
    expect(aiMentionAt('@priya')).toBeNull();
    expect(aiMentionAt('email@a')).toBeNull();
  });
});

describe('connected assistants', () => {
  const list = [{ id: 'default', name: 'Oruinwan AI', mention: 'ai' }, { id: 'anthropic', name: 'Claude', mention: 'claude' }, { id: 'xai', name: 'Grok', mention: 'grok' }];
  it('are mentionable', () => {
    expect(mentionsAI('@claude review this')).toBe(true);
    expect(mentionsAI('@grok?')).toBe(true);
  });
  it('are suggested while typing', () => {
    expect(assistantMentionAt('@', 1, list).matches.map((a) => a.id)).toEqual(['default', 'anthropic', 'xai']);
    expect(assistantMentionAt('ask @cl', 7, list).matches.map((a) => a.id)).toEqual(['anthropic']);
    expect(assistantMentionAt('@claude', 7, list)).toBeNull();
  });
});
