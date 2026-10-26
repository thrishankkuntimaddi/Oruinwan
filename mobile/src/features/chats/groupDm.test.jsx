import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { mapGroupDm, mapGroupDetails, mapPersonDm, groupTitle } from '../../data/live/adapter.js';
import { togglePicked, MAX_GROUP_MEMBERS, HistoryChoice, HISTORY_OPTIONS, addedMessage } from './groupScreens.jsx';

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

describe('adding people to a group: what they can see', () => {
  test('two choices, "from now on" first', () => {
    expect(HISTORY_OPTIONS.map((o) => o.value)).toEqual(['from_now', 'earlier']);
  });

  test('the picker shows both and reports the choice', () => {
    const onChange = vi.fn();
    render(<HistoryChoice value="from_now" onChange={onChange} />);
    const [now, earlier] = screen.getAllByRole('radio');
    expect(now.getAttribute('aria-checked')).toBe('true');
    expect(earlier.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(screen.getByText('Include earlier messages'));
    expect(onChange).toHaveBeenCalledWith('earlier');
  });

  test('the toast says what they can see', () => {
    expect(addedMessage(1, 'from_now')).toBe('Added to the group. They see messages from now on.');
    expect(addedMessage(2, 'earlier', false)).toBe('2 people added to the group with the earlier messages.');
    expect(addedMessage(1, 'earlier', true)).toMatch(/Some older messages couldn't be shared/);
  });
});
