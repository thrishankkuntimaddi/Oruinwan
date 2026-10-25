import { describe, expect, it } from 'vitest';
import { searchPeople, personMatchRank, wordStartMatch } from './peopleSearch.js';

const people = [
  { id: 's', name: 'Shiva Kumar', email: 'shiva@x.io' },
  { id: 'm', name: 'Manideep K', username: 'mani' },
  { id: 'a', name: 'Ana Martin', email: 'ana@x.io' },
  { id: 't', name: 'Thrishank', email: 'tk@x.io' },
];

describe('people search', () => {
  it('matches word starts only ("ma" never finds Shiva Kumar)', () => {
    expect(searchPeople(people, 'ma').map((u) => u.id)).toEqual(['m', 'a']);
  });
  it('ranks name start before a later word', () => {
    expect(personMatchRank(people[1], 'ma')).toBe(0);
    expect(personMatchRank(people[2], 'ma')).toBe(1);
  });
  it('finds by username and email start', () => {
    expect(searchPeople(people, '@mani').map((u) => u.id)).toEqual(['m']);
    expect(searchPeople(people, 'tk').map((u) => u.id)).toEqual(['t']);
  });
  it('matches several word starts', () => {
    expect(searchPeople(people, 'sh ku').map((u) => u.id)).toEqual(['s']);
  });
  it('an empty query keeps everyone, by name', () => {
    expect(searchPeople(people, '').map((u) => u.id)).toEqual(['a', 'm', 's', 't']);
  });
  it('word-start text match for channel names', () => {
    expect(wordStartMatch('design-review', 'rev')).toBe(true);
    expect(wordStartMatch('general', 'er')).toBe(false);
  });
});
