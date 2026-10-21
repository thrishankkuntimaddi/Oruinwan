// Message translation, as on the web: the phone sends the decrypted text (the server can't read
// messages) and shows the result under the original. "Translate automatically" is a per-person,
// per-device setting, like the web's (client/src/utils/autoTranslate.js).
import { create } from 'zustand';
import { api, useSession } from '../../data/session.js';
import { prefs } from '../../native/storage.js';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ar', label: 'Arabic' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'pt', label: 'Portuguese' },
];

export const languageName = (code) => LANGUAGES.find((l) => l.code === code)?.label || code;

/** True when a translation's source language is already the target (nothing to show). */
export function isSameLanguage(detected, target) {
  if (!detected || !target) return false;
  const norm = (s) => String(s).toLowerCase().split(/[-_]/)[0];
  return norm(detected) === norm(target);
}

const AUTO_KEY = 'chats.autoTranslate';

export const useTranslations = create((set, get) => ({
  autoLang: prefs.get(AUTO_KEY, '') || '',
  lastLang: prefs.get('chats.translateLang', 'en') || 'en',
  // messageId → { status: 'loading' | 'done' | 'error', lang, text, detected, error, auto }
  byId: {},

  setAutoLang(code) {
    prefs.set(AUTO_KEY, code || null);
    set({ autoLang: code || '' });
  },

  async translate(id, text, lang, { auto = false } = {}) {
    if (!id || !text || !lang) return;
    const cur = get().byId[id];
    if (cur && cur.lang === lang && cur.status !== 'error') return;
    if (!auto) {
      prefs.set('chats.translateLang', lang);
      set({ lastLang: lang });
    }
    const put = (v) => set((s) => ({ byId: { ...s.byId, [id]: { lang, auto, ...v } } }));
    put({ status: 'loading' });
    try {
      const r = await api().translate(useSession.getState().workspaceId, text, lang);
      put({ status: 'done', text: r.text, detected: r.detectedLang });
    } catch (err) {
      put({ status: 'error', error: err.status === 503 ? 'Translation is unavailable right now.' : err.message || 'Could not translate.' });
    }
  },

  clear(id) {
    set((s) => {
      const byId = { ...s.byId };
      delete byId[id];
      return { byId };
    });
  },
}));

export const useTranslation = (id) => useTranslations((s) => s.byId[id] || null);
