// The call on the phone, like a WhatsApp call: a full screen with everyone's video (or avatar),
// mute, camera, flip, hand, the meeting panel and leave; minimise it to a small floating window
// and keep using the app while the call goes on. Android's back button minimises.
// The people are laid out by CallStage.jsx / callLayout.js: a paged grid, the speaker or a pinned
// person (or a shared screen) large with a filmstrip, or a 1:1 call with my camera in a corner.
// The controls fade while there's video and come back with a tap.
import { bindPip, usePip } from '../../native/callSession.js';
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import {
  UserPlus,
  ChevronDown,
  ClipboardList,
  Ear,
  Ellipsis,
  Hand,
  LayoutGrid,
  Maximize2,
  Mic,
  MicOff,
  PhoneOff,
  ScreenShare,
  ScreenShareOff,
  SquareUserRound,
  SwitchCamera,
  Video,
  VideoOff,
  Volume2,
} from 'lucide-react';
import { useWide } from '../../app/layout.js';
import { AddPeopleSheet } from './AddPeopleSheet.jsx';
import { hasCallSession, keepScreenOn } from '../../native/callSession.js';
import { useOverlay } from '../../ui/Overlay.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { cx } from '../../ui/cx.js';
import { CallMenu, useActiveRecorder } from './CallExtras.jsx';
import { useCallExtras } from './callExtras.js';
import { clampPage, orderForGrid, pageCapacity, pageCount, pageOf, pickSpeaker, resolveView } from './callLayout.js';
import { DuoView, GridView, PageDots, SoloView, StageView, VideoEl, liveVideo, resetSelfCorner, streamOf, useElementSize } from './CallStage.jsx';
import {
  callClockStart,
  leave,
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

/** The person talking, held while they talk so the big tile doesn't flicker between voices. */
function useActiveSpeaker(participants, speaking) {
  const last = useRef(null);
  return useMemo(() => {
    last.current = pickSpeaker(participants, speaking, last.current);
    return last.current;
  }, [participants, speaking]);
}

// Controls hide after this long while there's video to watch; a tap brings them back.
const AUTO_HIDE_MS = 5000;

function HeaderButton({ icon, label, onClick, active = false, muted = false, testId, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      data-testid={testId}
      className={cx('pressable grid h-10 w-10 shrink-0 place-items-center rounded-full active:bg-surface-2', active ? 'text-accent-ink' : muted ? 'text-text-3' : 'text-text')}
      {...rest}
    >
      <Icon as={icon} size={20} />
    </button>
  );
}

function FullCall({ title, pip = false }) {
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
  const [mode, setMode] = useState(null); // null: automatic; 'grid' | 'speaker': the person's choice
  const [pinned, setPinned] = useState(null);
  const [page, setPage] = useState(0);
  const [shareDismissed, setShareDismissed] = useState(null);
  const [shown, setShown] = useState(true);
  const [poke, setPoke] = useState(0);
  const [menu, setMenu] = useState(false);
  const [panel, setPanel] = useState(false);
  const [adding, setAdding] = useState(false);
  const [pullDown, setPullDown] = useState(0);
  const swipe = useRef(null);
  const stageRef = useRef(null);
  const size = useElementSize(stageRef);
  const speaking = useSpeaking(participants, true);
  useOverlay(true, () => setCallView('mini'));

  // Keep the screen awake while there is video to watch.
  const anyVideo = participants.some((p) => p.videoEnabled);
  useEffect(() => {
    keepScreenOn(anyVideo);
    return () => keepScreenOn(false);
  }, [anyVideo]);

  // My own tile knows when it shows my screen; others' tiles do when the server says so.
  const people = useMemo(() => participants.map((p) => (p.isLocal ? { ...p, sharing } : p)), [participants, sharing]);
  const me = people.find((p) => p.isLocal) || people[0];
  const sharer = people.find((p) => p.sharing && !p.isLocal) || people.find((p) => p.sharing);
  const sharingId = sharer && sharer.userId !== shareDismissed ? sharer.userId : null;
  const pinnedId = pinned && people.some((p) => p.userId === pinned) ? pinned : null;
  useEffect(() => {
    if (pinned && !pinnedId) setPinned(null); // they left
  }, [pinned, pinnedId]);
  useEffect(() => {
    if (!sharer) setShareDismissed(null);
  }, [sharer]);

  const view = resolveView({ count: people.length, mode, pinnedId, sharingId });
  const speakerId = useActiveSpeaker(people, speaking);
  const capacity = pageCapacity(size);
  const ordered = useMemo(() => orderForGrid(people, { capacity }), [people, capacity]);
  const pages = view.kind === 'grid' ? pageCount(ordered.length, size) : 1;
  const currentPage = clampPage(page, ordered.length, size);
  const speakerPage = view.kind === 'grid' && speaking[speakerId] ? pageOf(ordered.findIndex((p) => p.userId === speakerId), size) : -1;
  const mirrorLocal = cameraOn && facing === 'user' && !sharing;
  const mirrorId = mirrorLocal && me ? me.userId : null;
  const canShare = screenShareSupported();

  // Controls fade away while there's video so they never sit on faces for long; any tap brings them back.
  const canHide = anyVideo && !menu && !panel;
  const controlsShown = !pip && (shown || !canHide);
  useEffect(() => {
    if (!canHide || !shown) return undefined;
    const t = setTimeout(() => setShown(false), AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [canHide, shown, poke]);
  const keepControls = () => setPoke((n) => n + 1);
  const onStageTap = () => {
    if (canHide) setShown(false);
  };

  const pin = (id) => setPinned((cur) => (cur === id ? null : id));
  const unpin = () => {
    if (pinnedId) setPinned(null);
    else if (sharingId) setShareDismissed(sharingId);
  };
  const gridLike = view.kind === 'grid';
  const switchLayout = () => {
    setPinned(null);
    if (sharingId) setShareDismissed(sharingId);
    setMode(gridLike ? 'speaker' : 'grid');
  };
  const focus =
    view.kind === 'stage' ? people.find((p) => p.userId === view.focusId) : view.kind === 'speaker' ? people.find((p) => p.userId === speakerId) : null;
  const other = people.find((p) => !p.isLocal);
  // More people than a phone page holds: keep room for the page dots under the grid.
  const dots = pages > 1 || (view.kind === 'grid' && people.length > 6);
  const right = panel && wide ? 440 : 0;

  let body;
  if (view.kind === 'solo' && me) body = <SoloView size={size} me={me} mirrorId={mirrorId} />;
  else if (view.kind === 'duo' && me && other) body = <DuoView size={size} me={me} other={other} speaking={speaking} mirrorId={mirrorId} onStageTap={onStageTap} />;
  else if (focus)
    body = (
      <StageView
        size={size}
        focus={focus}
        others={ordered.filter((p) => p.userId !== focus.userId)}
        speaking={speaking}
        mirrorId={mirrorId}
        pinned={view.kind === 'stage'}
        onPin={pin}
        onUnpin={unpin}
        onStageTap={onStageTap}
      />
    );
  else body = <GridView size={size} people={ordered} page={currentPage} onPage={setPage} speaking={speaking} mirrorId={mirrorId} onPin={pin} />;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Call: ${title}`}
      data-testid="huddle-call-screen"
      data-view={view.kind}
      data-controls={controlsShown ? 'shown' : 'hidden'}
      className="fixed inset-0 z-[45] overflow-hidden bg-bg"
      style={pullDown ? { transform: `translateY(${pullDown}px)`, borderRadius: 24, transition: 'none' } : { transition: 'transform 200ms ease-out' }}
      onTouchStart={(e) => {
        // Swipe the call down to keep using the app (it shrinks to the floating window).
        const t = e.touches[0];
        swipe.current = t.clientY < window.innerHeight * 0.4 ? { y: t.clientY, x: t.clientX } : null;
      }}
      onTouchMove={(e) => {
        if (!swipe.current) return;
        const t = e.touches[0];
        const dy = t.clientY - swipe.current.y;
        if (Math.abs(t.clientX - swipe.current.x) > Math.abs(dy)) return;
        setPullDown(Math.max(0, dy));
      }}
      onTouchEnd={() => {
        if (pullDown > 120) setCallView('mini');
        setPullDown(0);
        swipe.current = null;
      }}
      onPointerDown={() => controlsShown && keepControls()}
      onClickCapture={(e) => {
        if (controlsShown) return;
        // While the controls are hidden, the first tap only brings them back.
        e.stopPropagation();
        e.preventDefault();
        setShown(true);
      }}
    >
      <div
        ref={stageRef}
        className="absolute"
        data-testid="huddle-stage-area"
        style={{
          top: `calc(env(safe-area-inset-top) + ${controlsShown ? 60 : 8}px)`,
          bottom: `calc(env(safe-area-inset-bottom) + ${(controlsShown ? 84 : 8) + (dots ? 28 : 0)}px)`,
          left: 'calc(env(safe-area-inset-left) + 12px)',
          right: `calc(env(safe-area-inset-right) + ${12 + right}px)`,
          transition: 'top 200ms ease-out, bottom 200ms ease-out',
        }}
      >
        {body}
      </div>

      {dots && (
        <div
          className="absolute left-0 flex justify-center"
          style={{ bottom: `calc(env(safe-area-inset-bottom) + ${controlsShown ? 84 : 8}px)`, right, transition: 'bottom 200ms ease-out' }}
        >
          <PageDots page={currentPage} pages={pages} onPage={setPage} speakerPage={speakerPage} />
        </div>
      )}

      <div
        className={cx('absolute top-0 left-0 flex items-center gap-1 px-3 pb-2 transition duration-200', !controlsShown && 'pointer-events-none -translate-y-3 opacity-0')}
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)', right }}
        aria-hidden={!controlsShown || undefined}
        data-testid="huddle-topbar"
      >
        <HeaderButton icon={ChevronDown} label="Minimise the call" onClick={() => setCallView('mini')} testId="huddle-minimise" />
        <span className="min-w-0 flex-1 pl-1">
          <span className="block truncate text-[16px] font-semibold">{title}</span>
          <span className="flex items-center gap-1.5 text-xs text-text-2 tabular-nums">
            {recorder && (
              <span className="inline-flex items-center gap-1 font-semibold text-danger" data-testid="huddle-rec">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" aria-hidden />
                REC
              </span>
            )}
            <span className="truncate">
              {connecting ? 'Connecting…' : !callClockStart(call) ? 'Calling…' : `${participants.length} in call · ${clockSince(callClockStart(call) || now, now)}`}
            </span>
          </span>
        </span>
        <HeaderButton icon={UserPlus} label="Add people to the call" onClick={() => setAdding(true)} testId="huddle-add-people" />
        {people.length >= 2 && (
          <HeaderButton
            icon={gridLike ? SquareUserRound : LayoutGrid}
            label={gridLike ? 'Switch to speaker view' : 'Switch to grid view'}
            onClick={switchLayout}
            testId="huddle-layout"
          />
        )}
        {hasCallSession() && <HeaderButton icon={speakerOn ? Volume2 : Ear} label={speakerOn ? 'Use the earpiece' : 'Use the speaker'} onClick={toggleSpeaker} />}
        <HeaderButton
          icon={sharing ? ScreenShareOff : ScreenShare}
          label={sharing ? 'Stop sharing your screen' : canShare ? 'Share your screen' : 'Screen sharing from the phone isn’t available yet'}
          aria-disabled={!canShare && !sharing}
          active={sharing}
          muted={!canShare && !sharing}
          onClick={() => (sharing ? stopScreenShare() : startScreenShare())}
        />
      </div>

      <div
        className={cx(
          'absolute bottom-0 left-0 flex items-center justify-center gap-2.5 px-3 pt-2 transition duration-200 md:gap-4',
          !controlsShown && 'pointer-events-none translate-y-3 opacity-0',
        )}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)', right }}
        aria-hidden={!controlsShown || undefined}
        data-testid="huddle-controls"
      >
        <Control icon={muted ? MicOff : Mic} label={muted ? 'Unmute' : 'Mute'} on={muted} onClick={toggleMute} testId="huddle-bar-mute" />
        <Control icon={cameraOn ? Video : VideoOff} label={cameraOn ? 'Turn the camera off' : 'Turn the camera on'} on={cameraOn} onClick={toggleCamera} testId="huddle-camera" />
        {cameraOn && <Control icon={SwitchCamera} label="Switch camera" onClick={switchCamera} testId="huddle-flip" />}
        <Control icon={Hand} label={handRaised ? 'Lower your hand' : 'Raise your hand'} on={handRaised} onClick={toggleHand} testId="huddle-hand" />
        <Control icon={ClipboardList} label="Meeting: agenda, notes, transcript, summary" on={panel} onClick={() => setPanel(true)} testId="huddle-bar-meeting" />
        <Control icon={Ellipsis} label="Call options: captions, recording, transcript, ask AI" on={captions} onClick={() => setMenu(true)} testId="huddle-bar-more" />
        <Control icon={PhoneOff} label="Leave the call" danger onClick={leave} testId="huddle-bar-leave" />
      </div>
      <CallMenu open={menu} onClose={() => setMenu(false)} />
      <AddPeopleSheet open={adding} onClose={() => setAdding(false)} />
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
  // Show the active speaker (held while they talk), else someone with video, else the first other person.
  const speaking = useSpeaking(participants, true);
  const starId = useActiveSpeaker(participants, speaking);
  const star = participants.find((p) => p.userId === starId) || participants[0];
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
        {starVideo ? (
          <VideoEl stream={streamOf(star)} />
        ) : (
          <span className={cx('rounded-full transition-shadow', star && speaking[star.userId] && 'shadow-[0_0_0_3px_rgb(var(--c-accent)/0.6)]')}>
            <Avatar name={star?.username || title} size="lg" />
          </span>
        )}
        {star && (
          <span
            className="glass absolute bottom-1 left-1 flex max-w-[calc(100%-8px)] items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-medium"
            data-testid="huddle-bar-speaker"
          >
            {speaking[star.userId] && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />}
            {star.audioEnabled === false && <Icon as={MicOff} size={11} className="shrink-0 text-danger" />}
            <span className="truncate">{star.isLocal ? 'You' : star.username || 'Someone'}</span>
          </span>
        )}
        <span className="absolute top-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/40 text-white">
          <Icon as={Maximize2} size={12} />
        </span>
      </div>
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold">{title}</span>
          <span className="block text-[11px] text-text-2 tabular-nums">{connecting ? 'Connecting…' : !callClockStart(call) ? 'Calling…' : clockSince(callClockStart(call), now)}</span>
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
  // In Android's floating window (you left the app during the call): the call alone, full size.
  const pip = usePip((s) => s.on);
  useEffect(() => {
    if (call) bindPip();
  }, [call]);
  useEffect(() => {
    if (!call) {
      miniPos = null;
      resetSelfCorner();
    }
  }, [call]);
  if (!call) return null;
  if (pip) return <FullCall title={title} pip />;
  return view === 'mini' ? <MiniCall title={title} /> : <FullCall title={title} />;
}
