// On-device speech-to-text for live captions in calls.
//
//  - Android: the system recognizer through @capacitor-community/speech-recognition (Android
//    System WebView has no Web Speech API). It listens one utterance at a time, so this keeps
//    restarting it while captions are on.
//  - iPhone/iPad and the desktop/web app: the Web Speech API when the WebView or browser has it
//    (the community plugin ships only a CocoaPods spec, so the Swift Package Manager build of the
//    iOS app can't include it; when it can, the native path is used there too).
//  - Otherwise captions are reported as unavailable, with a reason.
//
// startCaptions() hands back final lines ({ text, startedAt, endedAt }) and the line in progress.
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition as NativeSpeech } from '@capacitor-community/speech-recognition';

const nativePlugin = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('SpeechRecognition');
const WebSpeech = () => (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) || null;

/** How long a pause ends a caption line when the recognizer itself keeps going. */
export const SILENCE_MS = 1600;

export const UNAVAILABLE = 'Live captions aren’t available on this device: it has no speech recognition the app can use.';

/** 'native' | 'web' | null, without asking for permission. */
export async function speechEngine() {
  if (nativePlugin()) {
    try {
      const { available } = await NativeSpeech.available();
      if (available) return 'native';
    } catch {
      /* fall through to the Web Speech API */
    }
  }
  return WebSpeech() ? 'web' : null;
}

const language = () => (typeof navigator !== 'undefined' && navigator.language) || 'en-US';

/**
 * Turns on continuous recognition. Resolves with stop() once listening, or rejects with a
 * readable Error (no recognizer, permission refused).
 * Callbacks: onPartial(text), onFinal({ text, startedAt, endedAt }), onError(Error) for a failure
 * that ends captions while they run.
 */
export async function startCaptions({ onPartial, onFinal, onError, lang = language() } = {}) {
  const engine = await speechEngine();
  if (engine === 'native') return startNative({ onPartial, onFinal, onError, lang });
  if (engine === 'web') return startWeb({ onPartial, onFinal, onError, lang });
  throw new Error(UNAVAILABLE);
}

async function startNative({ onPartial, onFinal, onError, lang }) {
  let status = await NativeSpeech.checkPermissions().catch(() => null);
  if (status?.speechRecognition !== 'granted') status = await NativeSpeech.requestPermissions().catch(() => null);
  if (status?.speechRecognition !== 'granted') throw new Error('Allow speech recognition (and the microphone) in Settings to turn on live captions.');

  let active = true;
  let current = '';
  let startedAt = null;
  let silence = null;
  let restarting = false;
  let failures = 0;
  const handles = [];
  const opts = { language: lang, maxResults: 1, partialResults: true, popup: false };

  const begin = () => {
    if (!active) return;
    NativeSpeech.start(opts).then(
      () => {
        failures = 0;
      },
      () => {
        // "No match" / "busy" end a listening round: try again, backing off; give up after many in a row.
        failures += 1;
        if (!active) return;
        if (failures > 12) {
          active = false;
          onError?.(new Error('Live captions stopped: speech recognition keeps failing on this device.'));
          return;
        }
        setTimeout(begin, Math.min(4000, 300 * failures));
      },
    );
  };

  // A pause in a recognition that keeps running (iOS): end the line and start a fresh round.
  const restart = async () => {
    if (restarting || !active) return;
    restarting = true;
    try {
      await NativeSpeech.stop().catch(() => {});
    } finally {
      restarting = false;
    }
    begin();
  };

  const finish = () => {
    clearTimeout(silence);
    silence = null;
    if (current.trim()) onFinal?.({ text: current.trim(), startedAt: startedAt || new Date().toISOString(), endedAt: new Date().toISOString() });
    current = '';
    startedAt = null;
    onPartial?.('');
  };

  handles.push(
    await NativeSpeech.addListener('partialResults', ({ matches }) => {
      const text = String(matches?.[0] || '');
      if (!active || !text || text === current) return;
      if (!startedAt) startedAt = new Date().toISOString();
      current = text;
      onPartial?.(text);
      clearTimeout(silence);
      // iOS keeps one recognition running and grows the same text: a pause ends the line.
      silence = setTimeout(() => {
        finish();
        restart();
      }, SILENCE_MS);
    }),
  );
  handles.push(
    await NativeSpeech.addListener('listeningState', ({ status: state }) => {
      if (state !== 'stopped' || !active) return;
      // Android ends each utterance by itself and sends the final words just after "stopped":
      // wait for them, keep the line, then listen again.
      clearTimeout(silence);
      silence = setTimeout(() => {
        finish();
        begin();
      }, 700);
    }),
  );
  begin();

  // A round that heard nothing ends without any event (Android "no match"): notice and listen again.
  const watchdog = setInterval(async () => {
    if (!active || restarting || silence) return;
    const res = await NativeSpeech.isListening().catch(() => null);
    if (active && res && !res.listening && !silence) begin();
  }, 2500);

  return async function stop() {
    if (!active) return;
    active = false;
    clearInterval(watchdog);
    finish();
    await NativeSpeech.stop().catch(() => {});
    for (const h of handles) await h?.remove?.().catch?.(() => {});
  };
}

function startWeb({ onPartial, onFinal, onError, lang }) {
  const Rec = WebSpeech();
  let active = true;
  let startedAt = null;
  const rec = new Rec();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = lang;

  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i += 1) {
      const r = e.results[i];
      const text = String(r[0]?.transcript || '').trim();
      if (!text) continue;
      if (!startedAt) startedAt = new Date().toISOString();
      if (r.isFinal) {
        onFinal?.({ text, startedAt, endedAt: new Date().toISOString() });
        startedAt = null;
      } else {
        interim += `${interim ? ' ' : ''}${text}`;
      }
    }
    onPartial?.(interim);
  };
  rec.onerror = (e) => {
    if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
      active = false;
      onError?.(new Error('Allow the microphone and speech recognition to turn on live captions.'));
    }
  };
  // Browsers end continuous recognition after a while or a long pause: start again.
  rec.onend = () => {
    if (active) setTimeout(() => active && safeStart(), 200);
  };
  const safeStart = () => {
    try {
      rec.start();
    } catch {
      /* already started */
    }
  };
  safeStart();

  return Promise.resolve(async function stop() {
    active = false;
    onPartial?.('');
    try {
      rec.stop();
    } catch {
      /* not running */
    }
  });
}
