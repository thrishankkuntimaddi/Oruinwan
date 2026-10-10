// Appearance is a per-device choice (never synced): theme, message text size, motion.
import { create } from 'zustand';
import { prefs } from '../native/storage.js';
import { applySystemBars } from '../native/index.js';

const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

function resolve(pref) {
  if (pref === 'light' || pref === 'dark') return pref;
  return media?.matches === false ? 'light' : 'dark';
}

function apply({ theme, textSize, reduceMotion }) {
  const resolved = resolve(theme);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.textSize = textSize;
  root.dataset.reduceMotion = reduceMotion ? 'true' : 'false';
  applySystemBars(resolved);
  return resolved;
}

export const TEXT_SIZES = [
  { value: 'small', label: 'Small', px: 14 },
  { value: 'default', label: 'Default', px: 15 },
  { value: 'large', label: 'Large', px: 17 },
  { value: 'larger', label: 'Larger', px: 19 },
];

export const useAppearance = create((set, get) => ({
  // Stored raw (not JSON) because index.html reads it before React loads.
  theme: prefs.raw('theme') || 'system',
  textSize: prefs.get('textSize', 'default'),
  reduceMotion: prefs.get('reduceMotion', false),
  resolved: 'dark',
  setTheme(theme) {
    prefs.setRaw('theme', theme);
    set({ theme, resolved: apply({ ...get(), theme }) });
  },
  setTextSize(textSize) {
    prefs.set('textSize', textSize);
    set({ textSize });
    apply(get());
  },
  setReduceMotion(reduceMotion) {
    prefs.set('reduceMotion', reduceMotion);
    set({ reduceMotion });
    apply(get());
  },
  init() {
    set({ resolved: apply(get()) });
    media?.addEventListener?.('change', () => {
      if (get().theme === 'system') set({ resolved: apply(get()) });
    });
  },
}));
