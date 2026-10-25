'use strict';

jest.mock('../../../identity', () => ({}));
const { _internal: { memberStanding } } = require('../workspace.controller');

test('how someone stands in the workspace, for the tag beside their name', () => {
  expect(memberStanding({ status: 'active', user: { isActive: true } })).toBe('active');
  expect(memberStanding({ user: {} })).toBe('active');
  expect(memberStanding({ status: 'suspended', user: {} })).toBe('suspended');
  expect(memberStanding({ status: 'removed', user: {} })).toBe('former');
  // A closed account wins over the workspace membership.
  expect(memberStanding({ status: 'active', user: { isActive: false } })).toBe('deactivated');
  expect(memberStanding({ status: 'removed', user: { accountStatus: 'deactivated' } })).toBe('deactivated');
});
