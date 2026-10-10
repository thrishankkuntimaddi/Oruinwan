import { htmlToText, sanitizeHtml } from './sanitize.js';

describe('sanitizeHtml', () => {
  it('drops scripts, handlers and unsafe links', () => {
    const out = sanitizeHtml('<p onclick="x()">Hi<script>alert(1)</script></p><a href="javascript:alert(1)">x</a><iframe src="//evil"></iframe>');
    expect(out).toBe('<p>Hi</p><a target="_blank" rel="noreferrer noopener">x</a>');
  });

  it('keeps checklists and safe links', () => {
    const out = sanitizeHtml('<ul data-type="checklist" class="x"><li data-checked="true">Done</li></ul><a href="https://a.b">a</a>');
    expect(out).toContain('<ul data-type="checklist"><li data-checked="true">Done</li></ul>');
    expect(out).toContain('href="https://a.b"');
  });

  it('unwraps unknown tags but keeps their text', () => {
    expect(sanitizeHtml('<section><mark>kept</mark></section>')).toBe('kept');
  });
});

describe('htmlToText', () => {
  it('separates block elements with spaces', () => {
    expect(htmlToText('<h2>Before</h2><ul><li>One</li><li>Two</li></ul>')).toBe('Before One Two');
  });
});
