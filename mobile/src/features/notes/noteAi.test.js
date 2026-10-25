import { describe, expect, it } from 'vitest';
import { markdownToNoteHtml, summaryBlock } from './noteAi.js';

describe('AI text written into a note', () => {
  it('turns bullets, bold and checklists into the editor’s HTML', () => {
    expect(markdownToNoteHtml('- **Launch** on Friday\n- Ship _docs_')).toBe('<ul><li><strong>Launch</strong> on Friday</li><li>Ship <em>docs</em></li></ul>');
    expect(markdownToNoteHtml('- [ ] Email Ana\n- [x] Book room')).toBe('<ul data-type="checklist"><li data-checked="false">Email Ana</li><li data-checked="true">Book room</li></ul>');
  });

  it('escapes anything that looks like markup', () => {
    expect(markdownToNoteHtml('<img src=x onerror=alert(1)>')).toBe('<p>&lt;img src=x onerror=alert(1)&gt;</p>');
  });

  it('puts a dated heading on top of a summary', () => {
    expect(summaryBlock('Short.', new Date(2026, 9, 25))).toMatch(/^<h2>✨ Summary · .*25.*<\/h2><p>Short\.<\/p><hr>$/);
  });
});
