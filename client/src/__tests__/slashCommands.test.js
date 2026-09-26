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
    it('filters by prefix', () => {
        expect(filterSlashCommands('/vi').map(c => c.command)).toEqual(['/video']);
        expect(filterSlashCommands('/').length).toBe(availableSlashCommands().length);
    });
});
