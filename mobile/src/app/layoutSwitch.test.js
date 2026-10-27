import { describe, expect, it, vi } from 'vitest';

vi.mock('../native/index.js', () => ({ isNative: false }));
const { shouldUseComputerLayout } = await import('./layoutSwitch.js');

describe('phone layout in a computer browser', () => {
  it('goes back to the computer layout only when a desktop window is wide', () => {
    const desktop = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130';
    expect(shouldUseComputerLayout({ width: 1400, userAgent: desktop, native: false, pathname: '/m/' })).toBe(true);
    expect(shouldUseComputerLayout({ width: 700, userAgent: desktop, native: false, pathname: '/m/' })).toBe(false);
    expect(shouldUseComputerLayout({ width: 1400, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)', native: false, pathname: '/m/' })).toBe(false);
    expect(shouldUseComputerLayout({ width: 1400, userAgent: desktop, native: true, pathname: '/m/' })).toBe(false);
  });
});
