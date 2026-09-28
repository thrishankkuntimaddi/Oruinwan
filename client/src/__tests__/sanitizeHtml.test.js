// @vitest-environment jsdom
import { sanitizeHtml, htmlToText, isSafeUrl } from '../utils/sanitizeHtml';

describe('sanitizeHtml', () => {
    it('removes event handlers and scripts', () => {
        const out = sanitizeHtml('<p onclick="x()">hi<img src=x onerror="alert(1)"><script>alert(2)</script></p>');
        expect(out).not.toMatch(/onclick|onerror|script|alert/i);
        expect(out).toContain('<p>hi<img src="x"></p>');
    });

    it('drops dangerous URLs, including obfuscated ones', () => {
        expect(sanitizeHtml('<a href="javascript:alert(1)">a</a>')).toBe('<a>a</a>');
        expect(sanitizeHtml('<a href=" jav&#x09;ascript:alert(1)">a</a>')).toBe('<a>a</a>');
        expect(sanitizeHtml('<img src="data:text/html,<b>x</b>">')).toBe('<img>');
        expect(sanitizeHtml('<img src="data:image/png;base64,AAAA">')).toContain('data:image/png');
    });

    it('keeps formatting and unwraps unknown tags', () => {
        expect(sanitizeHtml('<b>bold</b> <em>it</em> <custom>x</custom>')).toBe('<b>bold</b> <em>it</em> x');
        expect(sanitizeHtml('<iframe src="https://evil"></iframe><svg><script>1</script></svg>ok')).toBe('ok');
        expect(sanitizeHtml('<a href="https://x.test" target="_blank">l</a>')).toBe('<a href="https://x.test" target="_blank" rel="noopener noreferrer">l</a>');
    });

    it('rejects unsafe inline styles', () => {
        expect(sanitizeHtml('<span style="background:url(javascript:1)">x</span>')).toBe('<span>x</span>');
        expect(sanitizeHtml('<span style="color: red">x</span>')).toBe('<span style="color: red">x</span>');
    });

    it('extracts plain text and validates URLs', () => {
        expect(htmlToText('<p>Hello</p><p>world&amp;co</p>').replace(/\s+/g, ' ').trim()).toBe('Hello world&co');
        expect(isSafeUrl('/api/v2/uploads/file?path=a')).toBe(true);
        expect(isSafeUrl('vbscript:x')).toBe(false);
    });
});
