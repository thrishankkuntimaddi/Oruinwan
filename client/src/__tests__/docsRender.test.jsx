import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import DocsBlocks from '../pages/docs/DocsBlocks';
import { ALL_PAGES, headingsOf } from '../content/docs';

describe('docs pages render', () => {
    it('renders every page with its headings, and no raw markup left over', () => {
        for (const { page, path } of ALL_PAGES) {
            const html = renderToString(<MemoryRouter><DocsBlocks page={page} /></MemoryRouter>);
            expect(html.length, path).toBeGreaterThan(200);
            headingsOf(page).forEach((h) => expect(html, `${path}#${h.id}`).toContain(`id="${h.id}"`));
            // Inline markup is converted: no leftover **bold** or [[keys]] in the output.
            // (Code is shown literally, so it is left out of this check.)
            const prose = html.replace(/<code[\s\S]*?<\/code>/g, '').replace(/<pre[\s\S]*?<\/pre>/g, '');
            expect(prose, path).not.toMatch(/\*\*[^*<]+\*\*/);
            expect(prose, path).not.toMatch(/\[\[[^\]]+\]\]/);
        }
    });
});
