'use strict';

/**
 * What a call can share, as picker choices: every screen, then up to 8 windows (never
 * Oruinwan's own windows). `sources` come from desktopCapturer.getSources().
 * @returns {{ source: object, label: string }[]}
 */
function shareOptions(sources = []) {
  const screens = sources.filter((s) => String(s.id).startsWith('screen:'));
  const windows = sources.filter((s) => String(s.id).startsWith('window:') && s.name && !/^Oruinwan( call)?$/.test(s.name));
  return [
    ...screens.map((s, i) => ({ source: s, label: screens.length > 1 ? `Screen ${i + 1}` : 'Entire screen' })),
    ...windows.slice(0, 8).map((s) => ({ source: s, label: s.name.length > 48 ? `${s.name.slice(0, 47)}…` : s.name })),
  ];
}

module.exports = { shareOptions };
