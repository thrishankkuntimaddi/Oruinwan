// Appearance is a per-device choice (never synced): design (Glass | Unslop), theme, message text
// size, motion. The design sets <html data-look>; styles/unslop.css is scoped to data-look='unslop'.
import { create } from 'zustand';
import { prefs } from '../native/storage.js';
import { applySystemBars } from '../native/index.js';

const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

function resolve(pref) {
  if (pref === 'light' || pref === 'dark') return pref;
  return media?.matches ? 'dark' : 'light';
}

export const LOOKS = ['glass', 'unslop'];
const normalizeLook = (l) => (LOOKS.includes(l) ? l : 'glass');

function apply({ theme, textSize, reduceMotion, look, glassColour }) {
  const resolved = resolve(theme);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.look = normalizeLook(look);
  // Glass only: Off drops the colour field behind the glass (styles/glass-plain.css).
  root.dataset.glassColour = glassColour === 'off' ? 'off' : 'on';
  root.dataset.textSize = textSize;
  root.dataset.reduceMotion = reduceMotion ? 'true' : 'false';
  applySystemBars(resolved, normalizeLook(look) === 'glass' && glassColour === 'off' ? 'plain' : normalizeLook(look));
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
  // Light unless the person picked Dark or System.
  theme: prefs.raw('theme') || 'light',
  textSize: prefs.get('textSize', 'default'),
  reduceMotion: prefs.get('reduceMotion', false),
  // Raw (not JSON) because theme-boot.js reads it before React loads.
  look: normalizeLook(prefs.raw('look')),
  glassColour: prefs.raw('glassColour') === 'off' ? 'off' : 'on',
  resolved: 'light',
  setTheme(theme) {
    prefs.setRaw('theme', theme);
    set({ theme, resolved: apply({ ...get(), theme }) });
  },
  setTextSize(textSize) {
    prefs.set('textSize', textSize);
    set({ textSize });
    apply(get());
  },
  setLook(look) {
    const l = normalizeLook(look);
    prefs.setRaw('look', l);
    set({ look: l });
    apply(get());
  },
  setGlassColour(glassColour) {
    const c = glassColour === 'off' ? 'off' : 'on';
    prefs.setRaw('glassColour', c);
    set({ glassColour: c });
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
