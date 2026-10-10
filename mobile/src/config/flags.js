// Feature flags. Defaults ship inside the app; Firebase Remote Config can override
// them per release or roll a feature out to a percentage of installs without a rebuild.
import { create } from 'zustand';
import { prefs } from '../native/storage.js';

export const DEFAULT_FLAGS = {
  ai: true,
  notes: true,
  knowledge: true,
  files: true,
  integrations: true,
  threads: true,
  huddles: false,
  // Shown in Settings → About when true; lets a build expose experimental screens.
  labs: false,
};

export const FLAG_LABELS = {
  ai: 'Oruinwan AI',
  notes: 'Notes',
  knowledge: 'Knowledge base',
  files: 'Files',
  integrations: 'Integrations',
  threads: 'Threads',
  huddles: 'Huddles',
  labs: 'Labs',
};

function sanitize(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const key of Object.keys(DEFAULT_FLAGS)) {
    if (typeof input[key] === 'boolean') out[key] = input[key];
  }
  return out;
}

export const useFlags = create((set) => ({
  // Last remote values are cached so the next cold start uses them immediately.
  flags: { ...DEFAULT_FLAGS, ...sanitize(prefs.get('flags.remote')) },
  source: prefs.get('flags.remote') ? 'cached' : 'built-in',
  applyRemote(remote) {
    const clean = sanitize(remote);
    prefs.set('flags.remote', clean);
    set({ flags: { ...DEFAULT_FLAGS, ...clean }, source: 'remote' });
  },
}));

export const useFlag = (name) => useFlags((s) => s.flags[name] ?? false);
