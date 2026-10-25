import { describe, expect, it } from 'vitest';
import { highlightSegments } from './composerHighlight.js';

const join = (segs) => segs.map((s) => s.text).join('');
const kinds = (segs) => segs.filter((s) => s.kind).map((s) => `${s.kind}:${s.text}`);

describe('composer live formatting', () => {
  it('draws every character exactly once (the caret stays aligned)', () => {
    const t = 'Hi **bold _both_** and ~~gone~~ `code` @ana #general\n> quoted\n- item\n```\nblock\n```';
    expect(join(highlightSegments(t))).toBe(t);
  });

  it('styles bold, italic, strike and code and fades the markers', () => {
    expect(kinds(highlightSegments('a **b** _c_ ~~d~~ `e`'))).toEqual([
      'mark:**', 'bold:b', 'mark:**', 'mark:_', 'italic:c', 'mark:_', 'mark:~~', 'strike:d', 'mark:~~', 'mark:`', 'code:e', 'mark:`',
    ]);
  });

  it('nests italic inside bold', () => {
    expect(kinds(highlightSegments('**a _b_**'))).toContain('bold italic:b');
  });

  it('does not treat snake_case or a lone asterisk as formatting', () => {
    expect(kinds(highlightSegments('my_var_name and 2 * 3'))).toEqual([]);
  });

  it('marks mentions, channels, quotes and list markers', () => {
    expect(kinds(highlightSegments('@ana in #design'))).toEqual(['mention:@ana', 'mention:#design']);
    expect(kinds(highlightSegments('> hello'))).toEqual(['mark:> ', 'quote:hello']);
    expect(kinds(highlightSegments('- one'))).toEqual(['mark:- ']);
  });
});
