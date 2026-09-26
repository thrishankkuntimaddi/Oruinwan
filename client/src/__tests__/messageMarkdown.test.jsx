// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { username: 'bob' } }) }));

import MessageMarkdown from '../shared/components/messages/MessageMarkdown';
import { linkMentions, mentionFromHref } from '../utils/linkMentions';

describe('linkMentions', () => {
    it('links mentions but not emails, paths or code', () => {
        expect(linkMentions('hi @alice and @here')).toBe('hi [@alice](mention:alice) and [@here](mention:here)');
        expect(linkMentions('mail me@x.io')).toBe('mail me@x.io');
        expect(linkMentions('use `@decorator` here')).toBe('use `@decorator` here');
        expect(linkMentions('```\n@Component\n```')).toBe('```\n@Component\n```');
        expect(mentionFromHref('mention:al%20ice')).toBe('al ice');
        expect(mentionFromHref('https://x')).toBeNull();
    });
});

describe('MessageMarkdown', () => {
    it('renders mentions as chips, strikethrough as strikethrough', () => {
        const { container } = render(<MessageMarkdown text={'ping @alice and @bob, ~~old plan~~'} />);
        expect(container.querySelector('[data-mention="alice"]').textContent).toBe('@alice');
        expect(container.querySelector('[data-mention="bob"]').className).toMatch(/ring-1/); // self
        expect(container.querySelector('del').textContent).toBe('old plan');
        expect(container.textContent).not.toContain('~~');
    });

    it('renders GFM tables and fenced code with a language', () => {
        const { container } = render(<MessageMarkdown text={'| a | b |\n|---|---|\n| 1 | 2 |\n\n```js\nconsole.log(1)\n```'} />);
        expect(container.querySelectorAll('td')).toHaveLength(2);
        expect(screen.getByTestId('code-block').textContent).toContain('console.log(1)');
        expect(screen.getByTitle('Run in sandbox')).toBeTruthy();
    });

    it('does not offer Run for non-JavaScript code, and keeps inline code inline', () => {
        const { container } = render(<MessageMarkdown text={'```python\nprint(1)\n```\nand `x = 1`'} />);
        expect(screen.queryByTitle('Run in sandbox')).toBeNull();
        expect(container.querySelector('p code').textContent).toBe('x = 1');
    });

    it('drops javascript: links', () => {
        const { container } = render(<MessageMarkdown text={'[click](javascript:alert(1))'} />);
        expect(container.querySelector('a')?.getAttribute('href') || '').not.toMatch(/javascript/i);
    });
});
