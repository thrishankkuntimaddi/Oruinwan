import { render } from '@testing-library/react';
import { Markdown, parseBlocks, plainPreview } from './Markdown.jsx';

describe('Markdown', () => {
  it('splits blocks', () => {
    const blocks = parseBlocks('# Title\n\n- a\n- b\n\n```\ncode\n```\nText');
    expect(blocks.map((b) => b.type)).toEqual(['h1', 'ul', 'code', 'p']);
  });

  // Regression: nested bold used to share a global regex and loop forever.
  it('renders bold next to other inline marks without hanging', () => {
    const { container } = render(<Markdown text={'You have **5 open tasks** and **two** `items` at https://example.com'} />);
    expect(container.querySelectorAll('strong')).toHaveLength(2);
    expect(container.querySelector('code').textContent).toBe('items');
    expect(container.querySelector('a').getAttribute('href')).toBe('https://example.com');
  });

  it('never turns message text into markup', () => {
    const { container } = render(<Markdown text={'<img src=x onerror=alert(1)> [x](javascript:alert(1))'} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
  });

  it('builds plain previews', () => {
    expect(plainPreview('**Hi** see [docs](https://x.y)\n```\nx\n```')).toBe('Hi see docs [code]');
  });
});
