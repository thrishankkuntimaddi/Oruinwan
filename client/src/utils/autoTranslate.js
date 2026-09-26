import { useEffect, useState } from 'react';

// Per-user, per-browser preference: translate incoming messages into this language
// automatically ('' = off). Stored locally; translation itself runs on demand.
const KEY = 'chttrix.autoTranslateLang';
const EVENT = 'chttrix:auto-translate-changed';

export function getAutoTranslateLang() {
    try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
}

export function setAutoTranslateLang(code) {
    try {
        if (code) localStorage.setItem(KEY, code); else localStorage.removeItem(KEY);
    } catch { /* storage blocked */ }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: code || '' }));
}

export function useAutoTranslateLang() {
    const [lang, setLang] = useState(getAutoTranslateLang);
    useEffect(() => {
        const on = (e) => setLang(e.detail || '');
        window.addEventListener(EVENT, on);
        return () => window.removeEventListener(EVENT, on);
    }, []);
    return lang;
}

/** True when a translation's source language is already the target (nothing to show). */
export function isSameLanguage(detected, target) {
    if (!detected || !target) return false;
    const norm = (s) => String(s).toLowerCase().split(/[-_]/)[0];
    return norm(detected) === norm(target);
}
