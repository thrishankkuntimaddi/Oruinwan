import { screenForPage, unwrapOpenLink } from './openLink.js';

describe('email buttons that open the app', () => {
  it('unwraps https://<web>/open/<page> to the plain link', () => {
    expect(unwrapOpenLink('https://oruinwan.poelys.com/open/join-workspace?token=abc')).toEqual({
      url: 'https://oruinwan.poelys.com/join-workspace?token=abc',
      page: '/join-workspace?token=abc',
    });
    expect(unwrapOpenLink('https://oruinwan.poelys.com/open/')).toEqual({ url: 'https://oruinwan.poelys.com/', page: '/' });
  });

  it('unwraps oruinwan://open/<page> to oruinwan://<page>', () => {
    expect(unwrapOpenLink('oruinwan://open/workspace/w1/tasks/t1')).toEqual({ url: 'oruinwan://workspace/w1/tasks/t1', page: '/workspace/w1/tasks/t1' });
  });

  it('leaves other links alone', () => {
    expect(unwrapOpenLink('https://oruinwan.poelys.com/join-workspace?token=a')).toBeNull();
    expect(unwrapOpenLink('https://oruinwan.poelys.com/opener')).toBeNull();
    expect(unwrapOpenLink('oruinwan://sso?code=1')).toBeNull();
    expect(unwrapOpenLink('nonsense')).toBeNull();
  });

  it('knows the screens for app pages', () => {
    expect(screenForPage('/notifications')).toEqual(['activity']);
    expect(screenForPage('/settings/security')).toEqual(['settings.security']);
    expect(screenForPage('/workspace/w1/tasks')).toEqual(['tasks']);
    expect(screenForPage('/')).toBeNull();
  });
});
