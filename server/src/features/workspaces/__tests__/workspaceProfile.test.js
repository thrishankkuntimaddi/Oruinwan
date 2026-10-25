'use strict';

const { publicProfile, profileTextPatch } = require('../workspaceProfile');

test('the apps see the profile without storage paths', () => {
  expect(publicProfile({ profile: { logoUrl: '/l', logoPath: 'workspace-profiles/x', tagline: 'Hi' } })).toEqual({
    logoUrl: '/l', coverUrl: null, tagline: 'Hi', website: '', location: '',
  });
  expect(publicProfile({})).toEqual({ logoUrl: null, coverUrl: null, tagline: '', website: '', location: '' });
});

test('tagline, website and location are checked and tidied', () => {
  expect(profileTextPatch(undefined)).toEqual({ patch: null });
  expect(profileTextPatch({ tagline: '  We build things ', website: 'poelys.com', location: 'Hyderabad' })).toEqual({
    patch: { tagline: 'We build things', website: 'https://poelys.com/', location: 'Hyderabad' },
  });
  expect(profileTextPatch({ website: '' })).toEqual({ patch: { website: '' } });
  expect(profileTextPatch({ tagline: 'x'.repeat(121) }).error).toMatch(/at most 120/);
  expect(profileTextPatch({ website: 'javascript:alert(1)' }).error).toMatch(/web address/);
  expect(profileTextPatch({ website: 'not a site' }).error).toMatch(/web address/);
  expect(profileTextPatch({ location: 5 }).error).toMatch(/must be text/);
  expect(profileTextPatch('nope').error).toMatch(/object/);
});
