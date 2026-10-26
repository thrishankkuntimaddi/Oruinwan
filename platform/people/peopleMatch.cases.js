// Test cases for the shared people matcher. The web app's and the phone app's test suites both
// run them (client/src/__tests__/recipients.test.jsx, mobile/src/lib/peopleSearch.test.js).

import { searchPeople, personMatchRank, wordStartMatch } from './peopleMatch.js';

export const PEOPLE = [
  { id: 's', name: 'Shiva Kumar', email: 'shiva@x.io' },
  { id: 'm', name: 'Manideep K', username: 'mani' },
  { id: 'a', name: 'Ana Martin', email: 'ana@x.io' },
  { id: 't', name: 'Thrishank', email: 'tk@x.io' },
  { id: 'n', username: 'nikil.r', email: 'nikil@x.io' },
];

export function definePeopleMatchTests({ describe, it, expect }) {
  const ids = (q) => searchPeople(PEOPLE, q).map((u) => u.id);

  describe('people matching (shared by web and phone)', () => {
    it('short queries match word starts only ("ma" never finds Shiva Kumar)', () => {
      expect(ids('ma')).toEqual(['m', 'a']);
    });
    it('ranks name start before a later word', () => {
      expect(personMatchRank(PEOPLE[1], 'ma')).toBe(0);
      expect(personMatchRank(PEOPLE[2], 'ma')).toBe(1);
    });
    it('finds by username and email start', () => {
      expect(ids('@mani')).toEqual(['m']);
      expect(ids('tk')).toEqual(['t']);
      expect(ids('shiva@x')).toEqual(['s']);
    });
    it('matches several word starts', () => {
      expect(ids('sh ku')).toEqual(['s']);
    });
    it('three or more letters match inside a name, username or email', () => {
      expect(ids('deep')).toEqual(['m']);
      expect(ids('x.io')).toEqual(['a', 'n', 's', 't']);
    });
    it('ignores case, accents and surrounding spaces', () => {
      expect(ids('  MANI ')).toEqual(['m']);
      expect(searchPeople([{ id: 'e', name: 'Élodie' }], 'elo').map((u) => u.id)).toEqual(['e']);
    });
    it('people without a name are matched by username', () => {
      expect(ids('nik')).toEqual(['n']);
    });
    it('an empty query keeps everyone, by name', () => {
      expect(ids('')).toEqual(['a', 'm', 'n', 's', 't']);
    });
    it('word-start text match for channel names', () => {
      expect(wordStartMatch('design-review', 'rev')).toBe(true);
      expect(wordStartMatch('general', 'er')).toBe(false);
    });
  });
}
