import { openPlan, openTarget } from '../pages/OpenInApp';

describe('/open links from email buttons', () => {
  it('lead to the same page without /open', () => {
    expect(openTarget('/open/settings/security')).toBe('/settings/security');
    expect(openTarget('/open/workspace/w1/tasks/t1', '?x=1', '#c')).toBe('/workspace/w1/tasks/t1?x=1#c');
    expect(openTarget('/open')).toBe('/');
    expect(openTarget('/open/')).toBe('/');
  });

  it('never lead off the site or into another /open link', () => {
    expect(openTarget('/open//evil.example.com')).toBe('/');
    expect(openTarget('/open/open/x')).toBe('/');
  });

  it('try the desktop app only in a computer browser that handles app links', () => {
    const chromeMac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
    const firefox = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0';
    const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36';
    const desktopApp = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Oruinwan/3.1.1 Chrome/138 Electron/37.0 Safari/537.36';
    expect(openPlan(chromeMac)).toBe('try-desktop');
    expect(openPlan(firefox)).toBe('browser');
    expect(openPlan(android)).toBe('browser');
    expect(openPlan(desktopApp)).toBe('stay');
  });
});
