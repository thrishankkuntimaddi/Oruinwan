import { mobileLayout } from '../hooks/useIsMobile';

describe('mobile layout breakpoint', () => {
  test('phones switch at the breakpoint', () => {
    expect(mobileLayout(430, 768, false)).toBe(true);
    expect(mobileLayout(740, 768, false)).toBe(true); // phone in landscape
    expect(mobileLayout(844, 768, false)).toBe(false);
  });

  test('tablets keep the desktop layout down to 600px', () => {
    expect(mobileLayout(744, 768, true)).toBe(false); // iPad mini, portrait
    expect(mobileLayout(820, 768, true)).toBe(false); // iPad Air, portrait
    expect(mobileLayout(560, 768, true)).toBe(true); // narrow Split View
  });
});
