// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { defineMentionTests } from '@platform/people/mentions.cases.js';
import { linkMentions } from '../utils/linkMentions';
import { peopleFromHandles } from '../utils/aiMentions';

defineMentionTests({ describe, it, expect });

describe('web mentions with spaces', () => {
    it('links the whole name', () => {
        expect(linkMentions('hey @Pakanati Shiva Kumar Goud ok', ['Pakanati Shiva Kumar Goud']))
            .toBe('hey [@Pakanati Shiva Kumar Goud](mention:Pakanati%20Shiva%20Kumar%20Goud) ok');
    });
    it('finds the person for the group offer', () => {
        const members = [{ _id: 'a', username: 'Pakanati Shiva Kumar Goud' }, { _id: 'b', username: 'Pakanati' }];
        expect(peopleFromHandles('@Pakanati Shiva Kumar Goud hi', members).map((p) => p.id)).toEqual(['a']);
    });
});

describe('typing a name with spaces', () => {
    it('keeps suggesting while the text starts a username', async () => {
        const { mentionStart } = await import('../hooks/useMentionAutocomplete');
        const members = [{ username: 'varshitha gajjala k' }];
        expect(mentionStart('hi @varshitha gaj', 17, members)).toBe(3);
        expect(mentionStart('hi @varshitha said hi', 21, members)).toBe(-1);
        expect(mentionStart('mail me@x', 9, members)).toBe(-1);
    });
});
