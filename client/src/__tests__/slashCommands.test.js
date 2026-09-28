import { describe, it, expect } from 'vitest';
import { parseSlashCommand, filterSlashCommands, availableSlashCommands } from '../components/chat/slash/slashCommands';

describe('slash commands', () => {
    it('parses a known command and its arguments', () => {
        expect(parseSlashCommand('/ai what did we decide?')).toEqual({ name: 'ai', args: 'what did we decide?' });
        expect(parseSlashCommand('  /CALL  ')).toEqual({ name: 'call', args: '' });
    });
    it('leaves unknown commands and normal text alone', () => {
        expect(parseSlashCommand('/nope')).toBeNull();
        expect(parseSlashCommand('hello /ai')).toBeNull();
        expect(parseSlashCommand('/usr/local/bin is a path')).toBeNull();
    });
    it('hides integration commands unless the flag is on', () => {
        expect(parseSlashCommand('/github')).toBeNull();
        expect(parseSlashCommand('/github', { integrations: true })).toEqual({ name: 'github', args: '' });
        expect(availableSlashCommands().some(c => c.command === '/jira')).toBe(false);
    });
    it('knows the integration and task commands', () => {
        const on = { integrations: true };
        expect(parseSlashCommand('/review acme/web#12', on)).toEqual({ name: 'review', args: 'acme/web#12' });
        expect(parseSlashCommand('/github issue acme/web Login broken', on)).toEqual({ name: 'github', args: 'issue acme/web Login broken' });
        expect(parseSlashCommand('/jira WEB Fix it', on)).toEqual({ name: 'jira', args: 'WEB Fix it' });
        expect(parseSlashCommand('/zoom', on)).toEqual({ name: 'zoom', args: '' });
        expect(parseSlashCommand('/review acme/web#12')).toBeNull();
        expect(parseSlashCommand('/zoom')).toBeNull();
        // /task is a core command, not behind the flag.
        expect(parseSlashCommand('/task Write the release notes')).toEqual({ name: 'task', args: 'Write the release notes' });
        expect(filterSlashCommands('/re', on).map(c => c.command)).toContain('/review');
        expect(availableSlashCommands(on).filter(c => c.flag === 'integrations').map(c => c.command).sort())
            .toEqual(['/github', '/jira', '/review', '/zoom']);
    });
    it('filters by prefix', () => {
        expect(filterSlashCommands('/vi').map(c => c.command)).toEqual(['/video']);
        expect(filterSlashCommands('/').length).toBe(availableSlashCommands().length);
    });
});
