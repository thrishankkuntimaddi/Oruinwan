import { describe, expect, test } from 'vitest';
import { SETTINGS_INDEX, searchSettings } from './searchIndex.js';

describe('settings search', () => {
  test('finds screens by title and by keyword', () => {
    expect(searchSettings('notif')[0].title).toBe('Notifications');
    expect(searchSettings('2fa').map((i) => i.title)).toContain('Two-factor authentication');
    expect(searchSettings('dark').map((i) => i.title)).toEqual(['Appearance']);
    expect(searchSettings('bug')[0].route).toBe('settings.support.new');
  });

  test('every word must match; empty queries find nothing', () => {
    expect(searchSettings('email digest')[0].title).toBe('Email digest');
    expect(searchSettings('zzzz')).toEqual([]);
    expect(searchSettings('   ')).toEqual([]);
  });

  test('every entry opens something', () => {
    for (const item of SETTINGS_INDEX) expect(Boolean(item.route || item.action)).toBe(true);
  });
});
