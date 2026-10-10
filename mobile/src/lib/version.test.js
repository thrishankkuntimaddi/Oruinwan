import { compareVersions, parseVersion, versionCode } from './version.js';

describe('version helpers', () => {
  it('parses plain and v-prefixed versions', () => {
    expect(parseVersion('1.2.3')).toEqual([1, 2, 3]);
    expect(parseVersion('v10.0.1')).toEqual([10, 0, 1]);
    expect(parseVersion('1.2')).toBeNull();
    expect(parseVersion(undefined)).toBeNull();
  });

  it('compares numerically, not as strings', () => {
    expect(compareVersions('1.10.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('0.9.0', '1.0.0')).toBeLessThan(0);
  });

  it('matches the Android versionCode formula in android/app/build.gradle', () => {
    expect(versionCode('1.0.0')).toBe(10000);
    expect(versionCode('1.2.3')).toBe(10203);
    expect(versionCode('2.10.15')).toBe(21015);
  });
});
