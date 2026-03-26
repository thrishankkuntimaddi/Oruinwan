// client/src/components/messagesComp/TranslateToggle.jsx
// Phase-8: Inline translate toggle for a message bubble
import React, { useState, useCallback } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || '';

const SUPPORTED_LANGS = [
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'hi', label: 'Hindi' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ar', label: 'Arabic' },
];

/**
 * TranslateToggle — appended below a message bubble.
 *
 * Props:
 *  messageId   — used as cache key (optional)
 *  text        — plaintext of the message to translate
 *  onTranslated(text) — optional callback when translation is ready (parent can store it)
 */
export default function TranslateToggle({ messageId, text, onTranslated }) {
  const [state, setState] = useState('idle'); // idle | choosing | loading | done | error
  const [translated, setTranslated] = useState(null);
  const [detectedLang, setDetectedLang] = useState(null);

  const handleTranslate = useCallback(async (langCode) => {
    setState('loading');
    try {
      const res = await axios.post(
        `${API}/api/v2/messages/ai/translate`,
        { text, targetLang: langCode, messageId },
        { withCredentials: true }
      );
      setTranslated(res.data?.translated || text);
      setDetectedLang(res.data?.detectedLang || null);
      setState('done');
      onTranslated?.(res.data?.translated);
    } catch {
      setState('error');
    }
  }, [messageId, text, onTranslated]);

  if (!text) return null;

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', marginTop: 4 }}>
      {state === 'idle' && (
        <button
          onClick={() => setState('choosing')}
          style={linkBtn}
        >
          🌐 Translate
        </button>
      )}

      {state === 'choosing' && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center',
          marginTop: 4,
        }}>
          {SUPPORTED_LANGS.map(l => (
            <button key={l.code} onClick={() => handleTranslate(l.code)} style={chipBtn}>
              {l.label}
            </button>
          ))}
          <button onClick={() => setState('idle')} style={{ ...chipBtn, color: '#6b7280', borderColor: '#3a3d42' }}>
            ✕
          </button>
        </div>
      )}

      {state === 'loading' && (
        <span style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>Translating…</span>
      )}

      {state === 'done' && translated && (
        <div style={{ marginTop: 6 }}>
          <p style={{
            margin: 0, padding: '8px 10px', borderRadius: 6,
            background: '#1e2124', border: '1px solid #3a3d42',
            color: '#d1d5db', fontSize: 13, lineHeight: 1.5,
          }}>
            {translated}
          </p>
          {detectedLang && (
            <span style={{ fontSize: 10, color: '#6b7280' }}>
              Detected: {detectedLang.toUpperCase()}
            </span>
          )}
          <button onClick={() => { setState('idle'); setTranslated(null); }} style={{ ...linkBtn, marginLeft: 8 }}>
            Show original
          </button>
        </div>
      )}

      {state === 'error' && (
        <span style={{ fontSize: 11, color: '#ed4245' }}>
          Translation unavailable. <button onClick={() => setState('idle')} style={linkBtn}>Retry</button>
        </span>
      )}
    </div>
  );
}

const linkBtn = {
  background: 'none', border: 'none', color: '#5865f2',
  cursor: 'pointer', fontSize: 11, padding: '2px 0', fontFamily: 'inherit',
  textDecoration: 'underline',
};

const chipBtn = {
  background: 'none', border: '1px solid #5865f2', borderRadius: 12,
  color: '#5865f2', padding: '2px 8px', fontSize: 11, cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'background 0.15s',
};
