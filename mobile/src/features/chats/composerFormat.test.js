import { describe, expect, it } from 'vitest';
import { applyFormat, insertAt, insertLink, normalizeUrl } from './composerFormat.js';

// Selection helper: "a [b] c" → text "a b c", start 2, end 3.
const sel = (marked) => {
  const start = marked.indexOf('[');
  const end = marked.indexOf(']') - 1;
  return [marked.replace('[', '').replace(']', ''), start, end];
};

describe('inline formats', () => {
  it.each([
    ['bold', '**'],
    ['italic', '_'],
    ['strike', '~~'],
    ['code', '`'],
  ])('%s wraps the selection', (kind, mark) => {
    const r = applyFormat(...sel('say [hello] now'), kind);
    expect(r.text).toBe(`say ${mark}hello${mark} now`);
    expect(r.text.slice(r.start, r.end)).toBe('hello');
  });

  it('inserts empty markers with the caret between them when nothing is selected', () => {
    const r = applyFormat('hi ', 3, 3, 'bold');
    expect(r.text).toBe('hi ****');
    expect(r.start).toBe(5);
    expect(r.end).toBe(5);
  });

  it('keeps spaces around a selection outside the markers', () => {
    expect(applyFormat(...sel('a[ word ]b'), 'italic').text).toBe('a _word_ b');
  });

  it('unwraps when the selection is already wrapped', () => {
    const r = applyFormat('x **bold** y', 4, 8, 'bold');
    expect(r.text).toBe('x bold y');
    expect(r.text.slice(r.start, r.end)).toBe('bold');
  });

  it('clamps out-of-range selections', () => {
    expect(applyFormat('abc', 99, 120, 'code').text).toBe('abc``');
  });
});

describe('code block', () => {
  it('fences an empty block with the caret inside', () => {
    const r = applyFormat('', 0, 0, 'codeblock');
    expect(r.text).toBe('```\n\n```');
    expect(r.start).toBe(4);
  });

  it('puts a selection on its own fenced lines', () => {
    const r = applyFormat(...sel('see [a = 1] ok'), 'codeblock');
    expect(r.text).toBe('see \n```\na = 1\n```\n ok');
    expect(r.text.slice(r.start, r.end)).toBe('a = 1');
  });
});

describe('line formats', () => {
  it('bullets every selected line', () => {
    const r = applyFormat('one\ntwo\nthree', 0, 7, 'ul');
    expect(r.text).toBe('- one\n- two\nthree');
  });

  it('numbers selected lines', () => {
    expect(applyFormat('a\nb\nc', 0, 5, 'ol').text).toBe('1. a\n2. b\n3. c');
  });

  it('quotes the current line when nothing is selected, caret at its end', () => {
    const r = applyFormat('first\nsecond', 8, 8, 'quote');
    expect(r.text).toBe('first\n> second');
    expect(r.start).toBe(r.text.length);
  });

  it('starts a list on an empty line', () => {
    const r = applyFormat('intro\n', 6, 6, 'ul');
    expect(r.text).toBe('intro\n- ');
    expect(r.start).toBe(8);
  });

  it('toggles a format off when every line has it', () => {
    expect(applyFormat('- a\n- b', 0, 7, 'ul').text).toBe('a\nb');
    expect(applyFormat('> a\n> b', 0, 7, 'quote').text).toBe('a\nb');
  });

  it('switches one list kind to another', () => {
    expect(applyFormat('- a\n- b', 0, 7, 'ol').text).toBe('1. a\n2. b');
  });
});

describe('links', () => {
  it('uses the selection as the label', () => {
    const r = insertLink(...sel('read [the docs] please'), 'docs.example.com');
    expect(r.text).toBe('read [the docs](https://docs.example.com) please');
    expect(r.start).toBe(r.end);
  });

  it('uses the address as the label without a selection', () => {
    expect(insertLink('', 0, 0, 'https://x.io/a').text).toBe('[x.io/a](https://x.io/a)');
  });

  it('ignores an empty address', () => {
    expect(insertLink('abc', 1, 2, '  ').text).toBe('abc');
  });

  it('normalizes addresses', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com');
    expect(normalizeUrl('http://a.b')).toBe('http://a.b');
    expect(normalizeUrl('me@x.io')).toBe('mailto:me@x.io');
  });
});

describe('insertAt', () => {
  it('replaces the selection and puts the caret after the insert', () => {
    const r = insertAt('hi there', 3, 8, '👋');
    expect(r.text).toBe('hi 👋');
    expect(r.start).toBe(3 + '👋'.length);
  });
});
