// The call on the phone, like a WhatsApp call: a full screen with everyone's video (or avatar),
// mute, camera, flip, hand, the meeting panel and leave; minimise it to a small floating window
// and keep using the app while the call goes on. Android's back button minimises.
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ClipboardList,
  Ear,
  Ellipsis,
  Hand,
  Maximize2,
  Mic,
  MicOff,
  PhoneOff,
  PinOff,
  ScreenShare,
  ScreenShareOff,
  SwitchCamera,
  Video,
  VideoOff,
  Volume2,
} from 'lucide-react';
import { useWide } from '../../app/layout.js';
import { hasCallSession, keepScreenOn } from '../../native/callSession.js';
import { useOverlay } from '../../ui/Overlay.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { cx } from '../../ui/cx.js';
import { CallMenu, useActiveRecorder } from './CallExtras.jsx';
import { useCallExtras } from './callExtras.js';
import { gridColumns, orderTiles } from './callLogic.js';
import {
  leave,
  localMedia,
  remoteMedia,
  screenShareSupported,
  setCallView,
  startScreenShare,
  stopScreenShare,
  switchCamera,
  toggleCamera,
  toggleHand,
  toggleMute,
  toggleSpeaker,
  useHuddle,
} from './huddle.js';

// The call's meeting page, loaded when first opened (it brings the meeting tabs with it).
const MeetingCallPanel = lazy(() => import('./MeetingCallPanel.jsx'));

function clockSince(start, now) {
  const s = Math.max(0, Math.floor((now - start) / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0');
  return `${h ? `${h}:` : ''}${mm}:${String(s % 60).padStart(2, '0')}`;
}

function useClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const streamOf = (p) => (p.isLocal ? localMedia() : remoteMedia(p.userId));

/** A live, unmuted video track in the stream, if any. */
function liveVideo(stream) {
  return stream?.getVideoTracks?.().find((t) => t.readyState === 'live' && !t.muted) || null;
}

/** Who is talking right now, from each voice's loudness (only while the call screen is open). */
function useSpeaking(participants, enabled) {
  const [speaking, setSpeaking] = useState({});
  const tick = useHuddle((s) => s.mediaTick);
  const key = participants.map((p) => `${p.userId}:${p.audioEnabled !== false}`).join('|');
  useEffect(() => {
    const Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!enabled || !Ctx) return undefined;
    let ctx;
    try {
      ctx = new Ctx();
    } catch {
      return undefined;
    }
    const meters = [];
    for (const p of participants) {
      const tracks = streamOf(p)?.getAudioTracks?.() || [];
      if (!tracks.length || p.audioEnabled === false) continue;
      try {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        ctx.createMediaStreamSource(new MediaStream(tracks)).connect(analyser);
        meters.push({ id: p.userId, analyser, buf: new Uint8Array(analyser.fftSize) });
      } catch {
        /* a stream that ended meanwhile */
      }
    }
    const timer = setInterval(() => {
      const next = {};
      for (const m of meters) {
        m.analyser.getByteTimeDomainData(m.buf);
        let sum = 0;
        for (const v of m.buf) sum += ((v - 128) / 128) ** 2;
        if (Math.sqrt(sum / m.buf.length) > 0.045) next[m.id] = true;
      }
      setSpeaking((prev) => (Object.keys(prev).join() === Object.keys(next).join() ? prev : next));
    }, 300);
    return () => {
      clearInterval(timer);
      ctx.close?.().catch(() => {});
      setSpeaking({});
    };
  }, [enabled, key, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  return speaking;
}

function VideoEl({ stream, fit = 'cover', mirror = false, zoom = 1 }) {
  const ref = useRef(null);
  const tick = useHuddle((s) => s.mediaTick);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream || null;
    el.play?.().catch(() => {});
  }, [stream, tick]);
  return (
    <video
      ref={ref}
      muted
      autoPlay
      playsInline
      className={cx('h-full w-full bg-black', fit === 'contain' ? 'object-contain' : 'object-cover', mirror && '-scale-x-100')}
      style={zoom > 1 ? { width: `${zoom * 100}%`, height: `${zoom * 100}%`, maxWidth: 'none' } : undefined}
    />
  );
}

function Tile({ p, speaking, onTap, large = false, mirror = false }) {
  useHuddle((s) => s.mediaTick); // re-render when a track arrives or ends
  const stream = streamOf(p);
  const showVideo = Boolean(p.videoEnabled && liveVideo(stream));
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={`${p.isLocal ? 'You' : p.username}${p.audioEnabled === false ? ', muted' : ''}${p.handRaised ? ', hand raised' : ''}`}
      data-testid="huddle-tile"
      className={cx(
        'relative grid h-full min-h-0 w-full place-items-center overflow-hidden rounded-2xl border bg-surface-2 transition-shadow',
        speaking ? 'border-success shadow-[0_0_0_2px_rgb(var(--c-success))]' : 'border-line',
      )}
    >
      {showVideo ? (
        <VideoEl stream={stream} fit={large ? 'contain' : 'cover'} mirror={mirror} />
      ) : (
        <span className={cx('rounded-full transition-shadow', speaking && 'shadow-[0_0_0_4px_rgb(var(--c-success)/0.55)]')}>
          <Avatar name={p.username || 'You'} size={large ? 'xl' : 'lg'} />
        </span>
      )}
      <span className="glass absolute bottom-2 left-2 flex max-w-[85%] items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium">
        {p.audioEnabled === false && <Icon as={MicOff} size={12} className="shrink-0 text-danger" />}
        {p.handRaised && <Icon as={Hand} size={12} className="shrink-0 text-warning" />}
        <span className="truncate">{p.isLocal ? 'You' : p.username || 'Someone'}</span>
      </span>
    </button>
  );
}

/** One person large (a shared screen reads best here): double-tap zooms in, drag to look around. */
function Focus({ p, onClose, mirror }) {
  const [zoom, setZoom] = useState(1);
  useHuddle((s) => s.mediaTick);
  const stream = streamOf(p);
  const video = p.videoEnabled && liveVideo(stream);
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-line bg-black">
      {video ? (
        <div className="h-full w-full overflow-auto overscroll-contain" onDoubleClick={() => setZoom((z) => (z > 1 ? 1 : 2))}>
          <VideoEl stream={stream} fit="contain" mirror={mirror} zoom={zoom} />
        </div>
      ) : (
        <Tile p={p} large onTap={onClose} />
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label="Back to everyone"
        className="glass absolute top-2 right-2 grid h-9 w-9 place-items-center rounded-full border"
      >
        <Icon as={PinOff} size={16} />
      </button>
      {video && (
        <span className="glass absolute bottom-2 left-2 rounded-full border px-2 py-0.5 text-xs">
          {p.isLocal ? 'You' : p.username} · double-tap to {zoom > 1 ? 'zoom out' : 'zoom in'}
        </span>
      )}
    </div>
  );
}

function Control({ icon, label, onClick, on = false, danger = false, disabled = false, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={on}
      title={label}
      data-testid={testId}
      className={cx(
        'pressable grid h-12 w-12 shrink-0 place-items-center rounded-full border disabled:opacity-40 md:h-14 md:w-14',
        danger ? 'border-transparent bg-danger text-white' : on ? 'border-accent/40 bg-accent/15 text-accent-ink' : 'border-line bg-surface-2 text-text',
      )}
    >
      <Icon as={icon} size={20} />
    </button>
  );
}

function FullCall({ title }) {
  const call = useHuddle((s) => s.call);
  const connecting = useHuddle((s) => s.connecting);
  const participants = useHuddle((s) => s.participants);
  const muted = useHuddle((s) => s.muted);
  const cameraOn = useHuddle((s) => s.cameraOn);
  const facing = useHuddle((s) => s.facing);
  const sharing = useHuddle((s) => s.sharing);
  const handRaised = useHuddle((s) => s.handRaised);
  const speakerOn = useHuddle((s) => s.speakerOn);
  const captions = useCallExtras((s) => s.showCaptions);
  const recorder = useActiveRecorder();
  const wide = useWide();
  const now = useClock();
  const [pinned, setPinned] = useState(null);
  const [menu, setMenu] = useState(false);
  const [panel, setPanel] = useState(false);
  const speaking = useSpeaking(participants, true);
  useOverlay(true, () => setCallView('mini'));

  // Keep the screen awake while there is video to watch.
  const anyVideo = participants.some((p) => p.videoEnabled);
  useEffect(() => {
    keepScreenOn(anyVideo);
    return () => keepScreenOn(false);
  }, [anyVideo]);

  const tiles = useMemo(() => orderTiles(participants, { pinned, speaking }), [participants, pinned, speaking]);
  const focused = pinned && participants.find((p) => p.userId === pinned);
  useEffect(() => {
    if (pinned && !focused) setPinned(null);
  }, [pinned, focused]);
  const mirrorLocal = cameraOn && facing === 'user' && !sharing;
  const cols = gridColumns(tiles.length, wide);
  const canShare = screenShareSupported();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Call: ${title}`}
      data-testid="huddle-call-screen"
      className="fixed inset-0 z-[45] flex flex-col bg-bg"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingRight: panel && wide ? 440 : undefined }}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setCallView('mini')}
          aria-label="Minimise the call"
          data-testid="huddle-minimise"
          className="pressable grid h-10 w-10 place-items-center rounded-full text-text active:bg-surface-2"
        >
          <Icon as={ChevronDown} size={22} />
        </button>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold">{title}</span>
          <span className="flex items-center gap-1.5 text-xs text-text-2 tabular-nums">
            {recorder && (
              <span className="inline-flex items-center gap-1 font-semibold text-danger" data-testid="huddle-rec">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" aria-hidden />
                REC
              </span>
            )}
            <span className="truncate">
              {connecting ? 'Connecting…' : `${participants.length} in call · ${clockSince(call?.startedAt || now, now)}`}
            </span>
          </span>
        </span>
        {hasCallSession() && (
          <button
            type="button"
            onClick={toggleSpeaker}
            aria-label={speakerOn ? 'Use the earpiece' : 'Use the speaker'}
            className="pressable grid h-10 w-10 place-items-center rounded-full text-text active:bg-surface-2"
          >
            <Icon as={speakerOn ? Volume2 : Ear} size={20} />
          </button>
        )}
        <button
          type="button"
          onClick={() => (sharing ? stopScreenShare() : startScreenShare())}
          aria-label={sharing ? 'Stop sharing your screen' : canShare ? 'Share your screen' : 'Screen sharing from the phone isn’t available yet'}
          aria-disabled={!canShare && !sharing}
          className={cx('pressable grid h-10 w-10 place-items-center rounded-full active:bg-surface-2', sharing ? 'text-accent-ink' : canShare ? 'text-text' : 'text-text-3')}
        >
          <Icon as={sharing ? ScreenShareOff : ScreenShare} size={20} />
        </button>
      </div>

      <div className="min-h-0 flex-1 px-3 pb-2">
        {focused ? (
          <div className="flex h-full flex-col gap-2">
            <div className="min-h-0 flex-1">
              <Focus p={focused} mirror={focused.isLocal && mirrorLocal} onClose={() => setPinned(null)} />
            </div>
            {tiles.length > 1 && (
              <div className="flex h-24 shrink-0 gap-2 overflow-x-auto">
                {tiles
                  .filter((p) => p.userId !== focused.userId)
                  .map((p) => (
                    <div key={p.userId} className="h-full w-28 shrink-0">
                      <Tile p={p} speaking={speaking[p.userId]} mirror={p.isLocal && mirrorLocal} onTap={() => setPinned(p.userId)} />
                    </div>
                  ))}
              </div>
            )}
          </div>
        ) : (
          <div
            className="grid h-full gap-2"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: `minmax(0, 1fr)` }}
          >
            {tiles.map((p) => (
              <Tile key={p.userId} p={p} speaking={speaking[p.userId]} mirror={p.isLocal && mirrorLocal} onTap={() => setPinned(p.userId)} />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-2.5 px-3 pt-2 pb-3 md:gap-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
        <Control icon={muted ? MicOff : Mic} label={muted ? 'Unmute' : 'Mute'} on={muted} onClick={toggleMute} testId="huddle-bar-mute" />
        <Control icon={cameraOn ? Video : VideoOff} label={cameraOn ? 'Turn the camera off' : 'Turn the camera on'} on={cameraOn} onClick={toggleCamera} testId="huddle-camera" />
        {cameraOn && <Control icon={SwitchCamera} label="Switch camera" onClick={switchCamera} testId="huddle-flip" />}
        <Control icon={Hand} label={handRaised ? 'Lower your hand' : 'Raise your hand'} on={handRaised} onClick={toggleHand} testId="huddle-hand" />
        <Control icon={ClipboardList} label="Meeting: agenda, notes, transcript, summary" on={panel} onClick={() => setPanel(true)} testId="huddle-bar-meeting" />
        <Control icon={Ellipsis} label="Call options: captions, recording, transcript, ask AI" on={captions} onClick={() => setMenu(true)} testId="huddle-bar-more" />
        <Control icon={PhoneOff} label="Leave the call" danger onClick={leave} testId="huddle-bar-leave" />
      </div>
      <CallMenu open={menu} onClose={() => setMenu(false)} />
      {panel && (
        <Suspense fallback={null}>
          <MeetingCallPanel open onClose={() => setPanel(false)} />
        </Suspense>
      )}
    </div>
  );
}

// Where the floating window was left, for the rest of this call.
let miniPos = null;

/** The minimised call: a small window you can drag to any corner; tap it to go back to the call. */
function MiniCall({ title }) {
  const call = useHuddle((s) => s.call);
  const participants = useHuddle((s) => s.participants);
  const muted = useHuddle((s) => s.muted);
  const connecting = useHuddle((s) => s.connecting);
  useHuddle((s) => s.mediaTick);
  const now = useClock();
  const [pos, setPos] = useState(miniPos);
  const drag = useRef(null);
  const box = useRef(null);
  // Show whoever has video (someone else first), else the first other person.
  const others = participants.filter((p) => !p.isLocal);
  const star = others.find((p) => p.videoEnabled && liveVideo(remoteMedia(p.userId))) || others[0] || participants[0];
  const starVideo = star && star.videoEnabled ? liveVideo(streamOf(star)) : null;

  const onDown = (e) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    drag.current = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    d.moved = true;
    const w = box.current?.offsetWidth || 160;
    const h = box.current?.offsetHeight || 120;
    setPos({
      left: Math.min(Math.max(8, d.left + dx), window.innerWidth - w - 8),
      top: Math.min(Math.max(8, d.top + dy), window.innerHeight - h - 8),
    });
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      setCallView('full');
      return;
    }
    // Snap to the nearer side, like a phone's picture-in-picture.
    setPos((p) => {
      if (!p) return p;
      const w = box.current?.offsetWidth || 160;
      const next = { ...p, left: p.left + w / 2 < window.innerWidth / 2 ? 8 : window.innerWidth - w - 8 };
      miniPos = next;
      return next;
    });
  };

  if (!call) return null;
  return (
    <div
      ref={box}
      role="region"
      aria-label={`You are in a call: ${title}`}
      data-testid="huddle-bar"
      className="glass-strong fixed z-[45] w-40 touch-none overflow-hidden rounded-2xl border select-none"
      style={{
        ...(pos ? { left: pos.left, top: pos.top } : { right: 12, bottom: 'calc(env(safe-area-inset-bottom) + 84px)' }),
        boxShadow: 'var(--glass-edge), var(--shadow-sheet)',
        borderLeft: '3px solid rgb(var(--c-success))',
      }}
    >
      <div
        className="relative grid h-24 cursor-pointer place-items-center bg-surface-2"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => (drag.current = null)}
        data-testid="huddle-expand"
        aria-label="Back to the call"
      >
        {starVideo ? <VideoEl stream={streamOf(star)} /> : <Avatar name={star?.username || title} size="lg" />}
        <span className="absolute top-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/40 text-white">
          <Icon as={Maximize2} size={12} />
        </span>
      </div>
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold">{title}</span>
          <span className="block text-[11px] text-text-2 tabular-nums">{connecting ? 'Connecting…' : clockSince(call.startedAt, now)}</span>
        </span>
        <button
          type="button"
          onClick={toggleMute}
          aria-pressed={muted}
          aria-label={muted ? 'Unmute' : 'Mute'}
          data-testid="huddle-bar-mute"
          className={cx('pressable grid h-8 w-8 place-items-center rounded-full border', muted ? 'border-danger/40 bg-danger/12 text-danger' : 'border-line bg-surface text-text')}
        >
          <Icon as={muted ? MicOff : Mic} size={15} />
        </button>
        <button type="button" onClick={leave} aria-label="Leave the call" data-testid="huddle-bar-leave" className="pressable grid h-8 w-8 place-items-center rounded-full bg-danger text-white">
          <Icon as={PhoneOff} size={15} />
        </button>
      </div>
    </div>
  );
}

/** The call, full screen or minimised. title: "# design" or "Call with Sam". */
export function CallView({ title }) {
  const call = useHuddle((s) => s.call);
  const view = useHuddle((s) => s.view);
  useEffect(() => {
    if (!call) miniPos = null;
  }, [call]);
  if (!call) return null;
  return view === 'mini' ? <MiniCall title={title} /> : <FullCall title={title} />;
}
