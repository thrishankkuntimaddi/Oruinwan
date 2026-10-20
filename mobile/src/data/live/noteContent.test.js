import { describe, expect, it } from 'vitest';
import { noteContentToHtml } from './adapter';

describe('noteContentToHtml', () => {
  it('turns web note blocks into HTML', () => {
    const blocks = JSON.stringify([
      { id: 'a', type: 'heading', meta: { level: 1 }, content: 'Goal' },
      { id: 'b', type: 'text', meta: {}, content: 'Launch <b>soon</b>' },
      { id: 'c', type: 'checklist', meta: {}, content: JSON.stringify([{ text: 'Book', done: true }, { text: 'Send <x>', done: false }]) },
      { id: 'd', type: 'divider', meta: {}, content: '' },
    ]);
    expect(noteContentToHtml(blocks)).toBe('<h1>Goal</h1><p>Launch <b>soon</b></p><ul><li>☑ Book</li><li>☐ Send &lt;x&gt;</li></ul><hr>');
  });

  it('passes HTML and plain text through', () => {
    expect(noteContentToHtml('<p>Hi</p>')).toBe('<p>Hi</p>');
    expect(noteContentToHtml('')).toBe('');
    expect(noteContentToHtml(undefined)).toBe('');
  });
});
