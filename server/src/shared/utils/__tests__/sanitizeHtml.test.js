'use strict';

const { sanitizeHtml, isSafeUrl } = require('../sanitizeHtml');

describe('sanitizeHtml', () => {
    test('keeps basic formatting', () => {
        expect(sanitizeHtml('<b>bold</b> <i>it</i><br><a href="https://x.test">l</a>'))
            .toBe('<b>bold</b> <i>it</i><br><a href="https://x.test">l</a>');
    });

    test('removes script/style/iframe/svg with content', () => {
        const out = sanitizeHtml('a<script>alert(1)</script>b<iframe src="x"></iframe>c<style>*{}</style><svg onload=alert(1)><circle/></svg>d');
        expect(out).toBe('abcd');
    });

    test('nested script tricks do not survive', () => {
        const out = sanitizeHtml('<scr<script>x</script>ipt>alert(1)</script>');
        expect(out.toLowerCase()).not.toContain('<script');
    });

    test('strips event handlers and unknown attributes', () => {
        const out = sanitizeHtml('<img src="https://i.test/a.png" onerror="alert(1)" data-x="1"><div onclick="x()" class="c">t</div>');
        expect(out).toBe('<img src="https://i.test/a.png"><div class="c">t</div>');
    });

    test('drops javascript: and obfuscated schemes', () => {
        expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>');
        expect(sanitizeHtml('<a href="jav&#x61;script:alert(1)">x</a>')).toBe('<a>x</a>');
        expect(sanitizeHtml('<a href=" java\tscript:alert(1)">x</a>')).toBe('<a>x</a>');
        expect(sanitizeHtml('<img src="data:text/html;base64,xx">')).toBe('<img>');
        expect(sanitizeHtml('<img src="data:image/png;base64,AAA">')).toBe('<img src="data:image/png;base64,AAA">');
    });

    test('unsafe style dropped, safe style kept', () => {
        expect(sanitizeHtml('<span style="color: red">x</span>')).toBe('<span style="color: red">x</span>');
        expect(sanitizeHtml('<span style="background:url(javascript:alert(1))">x</span>')).toBe('<span>x</span>');
    });

    test('target=_blank forces rel', () => {
        expect(sanitizeHtml('<a href="/x" target="_blank" rel="opener">x</a>'))
            .toBe('<a href="/x" target="_blank" rel="noopener noreferrer">x</a>');
    });

    test('unknown tags removed, stray brackets escaped, comments removed', () => {
        expect(sanitizeHtml('<foo>t</foo> a < b <!-- c --> <object data=x>y</object>')).toBe('t a &lt; b  ');
    });

    test('quote-breaking attribute values cannot inject attributes', () => {
        const out = sanitizeHtml('<a title=\'x" onmouseover="alert(1)\'>y</a>');
        expect(out).not.toMatch(/\sonmouseover="/);
        expect(out).toContain('title="x&quot; onmouseover=&quot;alert(1)"');
    });

    test('isSafeUrl', () => {
        expect(isSafeUrl('/api/v2/uploads/file?path=a')).toBe(true);
        expect(isSafeUrl('mailto:a@b.c')).toBe(true);
        expect(isSafeUrl('vbscript:x')).toBe(false);
    });
});
