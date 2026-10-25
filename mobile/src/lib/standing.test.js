import { activePeople, standingLabel } from './standing.js';

describe('people who are no longer active', () => {
  it('are tagged by how they left', () => {
    expect(standingLabel({ standing: 'former' })).toBe('Former member');
    expect(standingLabel({ standing: 'deactivated' })).toBe('Deactivated');
    expect(standingLabel({ standing: 'suspended' })).toBe('Suspended');
    expect(standingLabel({ standing: 'active' })).toBeNull();
    expect(standingLabel({})).toBeNull();
  });

  it('stay out of pickers', () => {
    const list = [{ id: 'a', standing: 'active' }, { id: 'b', standing: 'former' }, { id: 'c' }, { id: 'd', standing: 'suspended' }];
    expect(activePeople(list).map((u) => u.id)).toEqual(['a', 'c']);
  });
});
