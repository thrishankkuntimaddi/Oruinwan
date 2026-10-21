import { afterEach, describe, expect, it, vi } from 'vitest';

const native = { isNative: false, plugin: true };
const listeners = {};
const plugin = {
  available: vi.fn(async () => ({ available: true })),
  checkPermissions: vi.fn(async () => ({ speechRecognition: 'granted' })),
  requestPermissions: vi.fn(async () => ({ speechRecognition: 'granted' })),
  start: vi.fn(async () => {}),
  stop: vi.fn(async () => {}),
  isListening: vi.fn(async () => ({ listening: true })),
  addListener: vi.fn(async (name, fn) => {
    listeners[name] = fn;
    return { remove: async () => {} };
  }),
};
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => native.isNative, isPluginAvailable: () => native.plugin },
}));
vi.mock('@capacitor-community/speech-recognition', () => ({ SpeechRecognition: plugin }));

const { startCaptions, speechEngine, UNAVAILABLE } = await import('./speech.js');

afterEach(() => {
  native.isNative = false;
  delete window.SpeechRecognition;
  delete window.webkitSpeechRecognition;
  vi.useRealTimers();
});

describe('speech for live captions', () => {
  it('reports captions as unavailable without a recognizer', async () => {
    expect(await speechEngine()).toBeNull();
    await expect(startCaptions({})).rejects.toThrow(UNAVAILABLE);
  });

  it('uses the Web Speech API: final results become lines, interim ones the line in progress', async () => {
    const recs = [];
    window.webkitSpeechRecognition = class {
      constructor() {
        recs.push(this);
      }
      start() {
        this.started = (this.started || 0) + 1;
      }
      stop() {
        this.stopped = true;
      }
    };
    const onPartial = vi.fn();
    const onFinal = vi.fn();
    const stop = await startCaptions({ onPartial, onFinal, lang: 'en-GB' });
    const rec = recs[0];
    expect(rec).toMatchObject({ continuous: true, interimResults: true, lang: 'en-GB', started: 1 });
    const result = (text, isFinal) => Object.assign([{ transcript: text }], { isFinal });
    rec.onresult({ resultIndex: 0, results: [result('ship it', false)] });
    expect(onPartial).toHaveBeenLastCalledWith('ship it');
    rec.onresult({ resultIndex: 0, results: [result('ship it Friday', true)] });
    expect(onFinal).toHaveBeenCalledWith(expect.objectContaining({ text: 'ship it Friday' }));
    await stop();
    expect(rec.stopped).toBe(true);
  });

  it('uses the native recognizer on Android and keeps listening after each utterance', async () => {
    vi.useFakeTimers();
    native.isNative = true;
    const onFinal = vi.fn();
    const onPartial = vi.fn();
    const stop = await startCaptions({ onPartial, onFinal });
    expect(plugin.start).toHaveBeenCalledWith(expect.objectContaining({ partialResults: true, popup: false }));
    listeners.partialResults({ matches: ['hello team'] });
    expect(onPartial).toHaveBeenLastCalledWith('hello team');
    listeners.listeningState({ status: 'stopped' });
    listeners.partialResults({ matches: ['hello team, quick update'] }); // the final words arrive after "stopped"
    await vi.advanceTimersByTimeAsync(SILENCE + 100);
    expect(onFinal).toHaveBeenCalledTimes(1);
    expect(onFinal.mock.calls[0][0].text).toBe('hello team, quick update');
    expect(plugin.start.mock.calls.length).toBeGreaterThanOrEqual(2);
    await stop();
    expect(plugin.stop).toHaveBeenCalled();
  });

  it('asks for permission and explains a refusal', async () => {
    native.isNative = true;
    plugin.checkPermissions.mockResolvedValueOnce({ speechRecognition: 'prompt' });
    plugin.requestPermissions.mockResolvedValueOnce({ speechRecognition: 'denied' });
    await expect(startCaptions({})).rejects.toThrow(/Allow speech recognition/);
  });
});

const SILENCE = 1600;
