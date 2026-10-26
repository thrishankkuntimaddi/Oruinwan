// Shared cases for platform/people/mentions.js, run by the web and phone test suites.
import { findMentions, mentionedPeople } from './mentions.js';

const NAMES = ['Pakanati Shiva Kumar Goud', 'Muzamil K', 'Thrishank Kuntimaddi', 'varshitha gajjala k', 'varshitha', 'Manogna'];

export function defineMentionTests({ describe, it, expect }) {
  describe('mentions with spaces', () => {
    it('reads the whole name after @, longest first', () => {
      const m = findMentions('@Pakanati Shiva Kumar Goud hi', NAMES);
      expect(m).toEqual([{ start: 0, end: 26, handle: 'Pakanati Shiva Kumar Goud', key: 'pakanati shiva kumar goud', known: true }]);
      expect(findMentions('ask @varshitha gajjala k and @varshitha', NAMES).map((x) => x.key)).toEqual(['varshitha gajjala k', 'varshitha']);
      expect(findMentions('@muzamil k, @thrishank kuntimaddi!', NAMES).map((x) => x.key)).toEqual(['muzamil k', 'thrishank kuntimaddi']);
    });
    it('needs a word boundary after the name', () => {
      expect(findMentions('@Muzamil Khan', NAMES).map((x) => [x.key, x.known])).toEqual([['muzamil', false]]);
    });
    it('accepts non-breaking spaces and any case', () => {
      expect(findMentions('@MUZAMIL K ok', NAMES)[0].key).toBe('muzamil k');
    });
    it('keeps one-word handles, skips emails and URLs', () => {
      expect(findMentions('hi @here and @gemini', NAMES).map((x) => [x.key, x.known])).toEqual([['here', false], ['gemini', false]]);
      expect(findMentions('mail me@x.io or http://a/@b', NAMES)).toEqual([]);
    });
    it('finds people by their usernames', () => {
      const people = NAMES.map((username, i) => ({ id: String(i), username }));
      expect(mentionedPeople('@Pakanati Shiva Kumar Goud and @Manogna and @Manogna', people).map((p) => p.id)).toEqual(['0', '5']);
    });
  });
}
