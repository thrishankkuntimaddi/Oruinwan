import { describe, expect, it } from 'vitest';
import { layoutFor, listColumnWidth, syncLayout, useLayout } from './layout.js';
import { shortcutFor } from './shortcuts.js';

describe('layoutFor', () => {
  it('keeps phones in portrait and landscape on the phone layout', () => {
    expect(layoutFor(390, 844)).toBe('phone');
    expect(layoutFor(844, 390)).toBe('phone');
    expect(layoutFor(932, 430)).toBe('phone');
  });
  it('splits tablets in portrait and iPad split-screen halves', () => {
    expect(layoutFor(768, 1024)).toBe('split');
    expect(layoutFor(820, 1180)).toBe('split');
    expect(layoutFor(800, 1280)).toBe('split'); // Android 10" portrait
    expect(layoutFor(981, 820)).toBe('split'); // iPad 2/3 of a landscape screen
  });
  it('uses the sidebar on tablets in landscape', () => {
    expect(layoutFor(1180, 820)).toBe('wide');
    expect(layoutFor(1366, 1024)).toBe('wide');
    expect(layoutFor(1280, 800)).toBe('wide');
  });
  it('narrow multitasking windows fall back to the phone layout', () => {
    expect(layoutFor(320, 1024)).toBe('phone'); // Slide Over
    expect(layoutFor(507, 1024)).toBe('phone');
    expect(layoutFor(694, 1024)).toBe('phone');
  });
  it('handles unknown sizes', () => {
    expect(layoutFor(0, 0)).toBe('phone');
    expect(layoutFor(1200, 0)).toBe('wide');
  });
});

describe('listColumnWidth', () => {
  it('is fluid within bounds', () => {
    expect(listColumnWidth(768, 'split')).toBe(307);
    expect(listColumnWidth(1000, 'split')).toBe(380);
    expect(listColumnWidth(1024, 'wide')).toBe(320);
    expect(listColumnWidth(1366, 'wide')).toBe(410);
    expect(listColumnWidth(2560, 'wide')).toBe(420);
    expect(listColumnWidth(390, 'phone')).toBe(390);
  });
});

describe('syncLayout', () => {
  it('follows rotation', () => {
    syncLayout({ w: 820, h: 1180 });
    expect(useLayout.getState()).toMatchObject({ kind: 'split', split: true, wide: false });
    syncLayout({ w: 1180, h: 820 });
    expect(useLayout.getState()).toMatchObject({ kind: 'wide', split: true, wide: true });
    syncLayout({ w: 844, h: 390 });
    expect(useLayout.getState()).toMatchObject({ kind: 'phone', split: false, wide: false });
  });
});

describe('shortcutFor', () => {
  const tabs = ['home', 'chats', 'tasks', 'notes', 'activity'];
  const key = (k, extra = {}) => ({ key: k, metaKey: true, ...extra });
  it('maps modifier shortcuts', () => {
    expect(shortcutFor(key('k'), tabs)).toEqual({ kind: 'search' });
    expect(shortcutFor(key('2'), tabs)).toEqual({ kind: 'tab', tab: 'chats' });
    expect(shortcutFor(key('5'), tabs)).toEqual({ kind: 'tab', tab: 'activity' });
    expect(shortcutFor(key('j'), tabs)).toEqual({ kind: 'ai' });
    expect(shortcutFor(key('9'), tabs)).toBeNull();
    expect(shortcutFor(key('['), tabs)).toEqual({ kind: 'back' });
    expect(shortcutFor(key(','), tabs)).toEqual({ kind: 'settings' });
    expect(shortcutFor(key('N', { shiftKey: true }), tabs)).toEqual({ kind: 'notifications' });
    expect(shortcutFor({ key: 'k', ctrlKey: true }, tabs)).toEqual({ kind: 'search' });
  });
  it('ignores plain keys and alt combos', () => {
    expect(shortcutFor({ key: 'k' }, tabs)).toBeNull();
    expect(shortcutFor(key('k', { altKey: true }), tabs)).toBeNull();
  });
});
