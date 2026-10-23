import { describe, test, expect } from 'vitest';
import { mapGroupDm, mapGroupDetails, mapPersonDm, groupTitle } from '../../data/live/adapter.js';
import { togglePicked, MAX_GROUP_MEMBERS } from './groupScreens.jsx';

const session = {
  id: 'g1',
  isGroup: true,
  name: null,
  displayName: 'ben and chen',
  createdBy: 'u1',
  members: [
    { _id: 'u1', username: 'asha' },
    { _id: 'u2', username: 'ben' },
    { _id: 'u3', username: 'chen' },
  ],
  memberCount: 3,
  unreadCount: 2,
  lastMessageAt: '2026-10-22T10:00:00.000Z',
};

describe('group DMs on the phone', () => {
  test('a group row carries its people and a title in `user` for older screens', () => {
    const dm = mapGroupDm(session, 'u1');
    expect(dm).toMatchObject({ id: 'g1', isGroup: true, name: 'ben and chen', memberCount: 3, unread: 2, userId: null });
    expect(dm.user.name).toBe('ben and chen');
    // Every member is used if the phone ever has to create the key itself.
    expect(dm.participantIds).toEqual(['u1', 'u2', 'u3']);
  });

  test('a 1:1 row keeps the other person', () => {
    const dm = mapPersonDm({ id: 'd1', otherUser: { _id: 'u2', username: 'ben' }, unreadCount: 0 }, 'u1');
    expect(dm).toMatchObject({ id: 'd1', isGroup: false, userId: 'u2' });
    expect(dm.participantIds).toEqual(['u1', 'u2']);
  });

  test('titles follow the server rule', () => {
    const people = ['u1', 'u2', 'u3', 'u4', 'u5'].map((id, i) => ({ id, name: ['asha', 'ben', 'chen', 'divya', 'eli'][i] }));
    expect(groupTitle('Crew', people, 'u1')).toBe('Crew');
    expect(groupTitle(null, people.slice(0, 3), 'u1')).toBe('ben and chen');
    expect(groupTitle(null, people, 'u1')).toBe('ben, chen and 2 others');
  });

  test('details from GET /v2/dm/:id', () => {
    const g = mapGroupDetails({ id: 'g1', isGroup: true, name: 'Crew', createdBy: 'u1', participants: session.members }, 'u1');
    expect(g).toMatchObject({ id: 'g1', isGroup: true, name: 'Crew', groupName: 'Crew', createdBy: 'u1' });
    expect(g.members.map((m) => m.id)).toEqual(['u1', 'u2', 'u3']);
  });

  test('picking people stops at the group limit', () => {
    let list = [];
    for (let i = 0; i < MAX_GROUP_MEMBERS + 3; i++) list = togglePicked(list, `p${i}`);
    expect(list).toHaveLength(MAX_GROUP_MEMBERS - 1);
    expect(togglePicked(['a', 'b'], 'a')).toEqual(['b']);
  });
});
