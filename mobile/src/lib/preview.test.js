import { describe, expect, it } from 'vitest';
import { clipPreview, isGenericPreview } from './preview.js';

describe('clipPreview', () => {
  it('keeps short text and folds whitespace', () => {
    expect(clipPreview('hi,\n  how can I help you')).toBe('hi, how can I help you');
  });
  it('cuts long text at a word with an ellipsis', () => {
    const out = clipPreview('hi, hi, hi, how can I help you today with the report we talked about yesterday afternoon', 40);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(41);
    expect(out.startsWith('hi, hi, hi, how can I help')).toBe(true);
  });
});

describe('isGenericPreview', () => {
  it('spots the server stand-ins', () => {
    expect(isGenericPreview('New message')).toBe(true);
    expect(isGenericPreview('')).toBe(true);
    expect(isGenericPreview('🔒 Encrypted message')).toBe(true);
    expect(isGenericPreview('Can we meet at 3?')).toBe(false);
  });
});
