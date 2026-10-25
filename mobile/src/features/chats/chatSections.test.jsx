import { chatSections } from './ChatsScreen.jsx';

describe('the Chats list', () => {
  it('leaves out 1:1 DMs nobody has written in, but keeps groups and anything unread', () => {
    const dms = [
      { id: 'talked', lastAt: '2026-10-25T10:00:00Z', noMessages: false, unread: 0 },
      { id: 'empty', lastAt: '2026-10-25T11:00:00Z', noMessages: true, unread: 0 },
      { id: 'group', isGroup: true, noMessages: true, unread: 0 },
      { id: 'agent', agentId: 'default', noMessages: false },
    ];
    const { people, agentDms } = chatSections([], dms);
    expect(people.map((d) => d.id).sort()).toEqual(['group', 'talked']);
    expect(agentDms.map((d) => d.id)).toEqual(['agent']);
  });
});
