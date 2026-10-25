import { callWorkspaceId } from '../features/huddles/call/AddPeopleDialog';

describe('Add people to a call', () => {
  it('finds the call’s workspace without needing the workspace pages around it', () => {
    expect(callWorkspaceId({ id: 'w1' }, '/anything')).toBe('w1');
    expect(callWorkspaceId(null, '/workspace/64b0000000000000000000a1/dm/d1')).toBe('64b0000000000000000000a1');
    expect(callWorkspaceId(undefined, '/messages')).toBeNull();
  });
});
