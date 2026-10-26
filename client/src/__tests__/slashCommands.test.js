import { describe, it, expect } from 'vitest';
import { defineCommandTests, fakeCtx } from '@platform/commands/commands.cases.js';
import { menuCommands, webOnlyCommandFor, webOnlyCommands, runsWithoutArgs, findCommand } from '../components/chat/slash/slashCommands';

// The same cases as the phone app (mobile/src/lib/slash.test.js).
defineCommandTests({ describe, it, expect });

describe('web-only commands', () => {
    it('hides integration commands unless the flag is on', () => {
        expect(webOnlyCommandFor('/github issue x')).toBeNull();
        expect(webOnlyCommandFor('/github issue acme/web Login broken', { integrations: true })).toMatchObject({ command: { name: 'github' }, args: 'issue acme/web Login broken' });
        expect(webOnlyCommands({ integrations: true }).map((c) => c.name).sort())
            .toEqual(['bitbucket', 'confluence', 'drive', 'dropbox', 'github', 'gitlab', 'gmeet', 'jira', 'linear', 'meet', 'notion', 'onedrive', 'review', 'zoom']);
        expect(webOnlyCommands({}).map((c) => c.name)).toEqual(['meet']);
    });
    it('are not offered in threads', () => {
        expect(webOnlyCommands({ integrations: true }, 'thread')).toEqual([]);
    });
    it('the menu lists shared commands first, then web ones', () => {
        const { ctx } = fakeCtx();
        const names = menuCommands('/', ctx, { integrations: true }).map((c) => c.name);
        expect(names.indexOf('task')).toBeLessThan(names.indexOf('github'));
        expect(menuCommands('/re', ctx, { integrations: true }).map((c) => c.name)).toEqual(['remind', 'review']);
    });
    it('knows which commands run straight from the menu', () => {
        expect(runsWithoutArgs(findCommand('huddle'))).toBe(true);
        expect(runsWithoutArgs(findCommand('shrug'))).toBe(true);
        expect(runsWithoutArgs(findCommand('task'))).toBe(false);
    });
});
