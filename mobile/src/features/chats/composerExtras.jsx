// Composer helpers: @mention / #channel suggestions, AI smart reply chips and voice messages.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Hash, Megaphone, Mic, SendHorizontal, Trash2, X, Zap } from 'lucide-react';
import { api, useSession } from '../../data/session.js';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { cx } from '../../ui/cx.js';
import { toast } from '../../lib/bus.js';
import { tap } from '../../native/index.js';
import { formatDuration } from '../../lib/files.js';

/** People, channels and @channel/@here for the mention being typed. */
export function MentionSuggestions({ items, onPick }) {
  if (!items?.length) return null;
  return (
    <div role="listbox" aria-label="Mention suggestions" className="max-h-60 overflow-y-auto border-b border-line-soft">
      {items.map((s) => (
        <button
          key={`${s.kind}-${s.id}`}
          type="button"
          role="option"
          aria-selected={false}
          aria-disabled={s.disabled || undefined}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => (s.disabled ? toast(s.hint) : onPick(s))}
          className={cx('flex w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-2', s.disabled && 'opacity-55')}
          data-testid="mention-suggestion"
        >
          {s.kind === 'person' ? (
            <Avatar name={s.label} src={s.item?.avatarUrl} size="sm" presence={s.item?.presence} />
          ) : (
            <span className="grid h-8 w-8 place-items-center rounded-full border border-line bg-surface-2 text-text-2">
              <Icon as={s.kind === 'channel' ? Hash : Megaphone} size={15} />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium">{s.label}</span>
            {s.hint && <span className="block truncate text-[12px] text-text-2">{s.hint}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * Reply suggestions under the composer when the last message is from someone else. `recent`
 * is the decrypted end of the conversation ([{ id, sender, text, isMe }]); it goes to the AI
 * because the server can't read the messages.
 */
export function SmartReplies({ recent, onPick, enabled = true }) {
  const ws = useSession((s) => s.workspaceId);
  const [state, setState] = useState({ key: null, list: [], loading: false });
  const [dismissed, setDismissed] = useState(null);
  const last = recent[recent.length - 1];
  const key = last ? `${last.id}:${String(last.text).slice(0, 40)}` : null;
  const want = enabled && Boolean(ws) && last && !last.isMe && Boolean(last.text?.trim());
  const recentRef = useRef(recent);
  recentRef.current = recent;

  useEffect(() => {
    if (!want || !api().smartReplies) return undefined;
    let alive = true;
    setState({ key, list: [], loading: true });
    const t = setTimeout(() => {
      api()
        .smartReplies(ws, recentRef.current.slice(-8))
        .then((list) => alive && setState({ key, list, loading: false }))
        .catch(() => alive && setState({ key, list: [], loading: false }));
    }, 700);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [want, key, ws]);

  if (!want || dismissed === key || state.key !== key || (!state.loading && !state.list.length)) return null;
  return (
    <div className="no-scrollbar flex items-center gap-2 overflow-x-auto px-3 pt-2" data-testid="smart-replies">
      <Icon as={Zap} size={13} className="shrink-0 text-accent-ink" aria-label="Suggested replies" />
      {state.loading
        ? [80, 104, 72].map((w) => <span key={w} className="skeleton h-8 shrink-0 rounded-full" style={{ width: w }} />)
        : state.list.map((s) => (
            <button
              key={s}
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => {
                setDismissed(key);
                onPick(s);
              }}
              className="pressable h-8 max-w-[240px] shrink-0 truncate rounded-full border border-line bg-surface px-3.5 text-[13px] font-medium text-text-2"
            >
              {s}
            </button>
          ))}
      {!state.loading && (
        <button type="button" aria-label="Hide suggestions" onClick={() => setDismissed(key)} className="grid h-8 w-8 shrink-0 place-items-center text-text-3">
          <Icon as={X} size={14} />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- voice messages

const MIME_CHOICES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg;codecs=opus'];
const MAX_SECONDS = 5 * 60;

export const canRecordVoice = () =>
  typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

function pickMime() {
  if (typeof MediaRecorder.isTypeSupported !== 'function') return '';
  return MIME_CHOICES.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

const EXT = { 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/ogg': 'ogg' };

/**
 * Records a voice message with the WebView's MediaRecorder (the microphone permission is in
 * AndroidManifest.xml and Info.plist). `onDone(file)` gets an audio File with `durationSeconds`.
 */
export function useVoiceRecorder(onDone) {
  const [state, setState] = useState({ recording: false, seconds: 0 });
  const rec = useRef(null);

  const cleanup = () => {
    const r = rec.current;
    if (!r) return;
    clearInterval(r.timer);
    r.stream.getTracks().forEach((t) => t.stop());
    rec.current = null;
    setState({ recording: false, seconds: 0 });
  };

  const stop = useCallback((send) => {
    const r = rec.current;
    if (!r) return;
    r.send = send;
    if (r.recorder.state !== 'inactive') r.recorder.stop();
    else cleanup();
  }, []);

  const start = useCallback(async () => {
    if (rec.current) return;
    if (!canRecordVoice()) {
      toast("Voice messages can't be recorded on this device.", 'danger');
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (err) {
      toast(err?.name === 'NotAllowedError' ? 'Allow microphone access in your settings to record voice messages.' : 'The microphone is not available.', 'danger');
      return;
    }
    const mimeType = pickMime();
    let recorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      toast("Voice messages can't be recorded on this device.", 'danger');
      return;
    }
    const chunks = [];
    const startedAt = Date.now();
    const r = { recorder, stream, chunks, startedAt, send: false, timer: null };
    rec.current = r;
    recorder.ondataavailable = (e) => e.data?.size && chunks.push(e.data);
    recorder.onstop = () => {
      const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      const send = r.send;
      cleanup();
      if (!send || !chunks.length) return;
      const type = (recorder.mimeType || mimeType || 'audio/webm').split(';')[0];
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const file = new File(chunks, `voice-message-${stamp}.${EXT[type] || 'webm'}`, { type });
      file.durationSeconds = seconds;
      onDone(file);
    };
    recorder.start(250);
    tap('medium');
    setState({ recording: true, seconds: 0 });
    r.timer = setInterval(() => {
      const s = Math.round((Date.now() - startedAt) / 1000);
      setState({ recording: true, seconds: s });
      if (s >= MAX_SECONDS) stop(true);
    }, 500);
  }, [onDone, stop]);

  // Leaving the conversation discards a recording in progress.
  useEffect(() => () => rec.current && stop(false), [stop]);

  return { ...state, start, send: () => stop(true), cancel: () => stop(false) };
}

/** The bar shown instead of the text box while recording. */
export function RecordingBar({ seconds, onCancel, onSend }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5" role="status" aria-live="polite">
      <button type="button" aria-label="Discard recording" onClick={onCancel} className="pressable grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2 text-danger">
        <Icon as={Trash2} size={18} />
      </button>
      <div className="flex min-h-10 flex-1 items-center gap-2.5 rounded-[20px] border border-line bg-input px-4">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" aria-hidden />
        <span className="text-[15px] tabular-nums">{formatDuration(seconds)}</span>
        <span className="truncate text-[13px] text-text-2">Recording a voice message…</span>
      </div>
      <button type="button" aria-label="Send voice message" onClick={onSend} className="pressable grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold text-on-accent">
        <Icon as={SendHorizontal} size={19} />
      </button>
    </div>
  );
}

export function MicButton({ onClick }) {
  return (
    <button type="button" aria-label="Record a voice message" onClick={onClick} className="pressable grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2 text-text-2">
      <Icon as={Mic} size={19} />
    </button>
  );
}
