// The people in a call, laid out by callLayout.js: a paged grid, the speaker or a pinned person
// (or a shared screen) large with a filmstrip, or a 1:1 call with my own camera in a corner.
// Video is attached only for tiles on screen (the current page, the part of the filmstrip in
// view); voices play from huddle.js's own audio elements, so everyone stays audible on any page.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Hand, MicOff, Pin, PinOff } from 'lucide-react';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { cx } from '../../ui/cx.js';
import {
  cornerPosition,
  gridLayout,
  nearestCorner,
  selfViewSize,
  stageLayout,
  stripVisibleRange,
} from './callLayout.js';
import { localMedia, remoteMedia, useHuddle } from './huddle.js';

export const streamOf = (p) => (p.isLocal ? localMedia() : remoteMedia(p.userId));

/** A live, unmuted video track in the stream, if any. */
export function liveVideo(stream) {
  return stream?.getVideoTracks?.().find((t) => t.readyState === 'live' && !t.muted) || null;
}

/** The stage's size in CSS pixels, following rotation, the keyboard and the controls showing or hiding. */
export function useElementSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => {
      const r = el.getBoundingClientRect();
      const next = { width: Math.round(r.width), height: Math.round(r.height) };
      setSize((prev) => (prev.width === next.width && prev.height === next.height ? prev : next));
    };
    read();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(read);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, [ref]);
  return size;
}

export function VideoEl({ stream, fit = 'cover', mirror = false, zoom = 1 }) {
  const ref = useRef(null);
  const tick = useHuddle((s) => s.mediaTick);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream || null;
    el.play?.()?.catch?.(() => {});
  }, [stream, tick]);
  // Let go of the stream when the tile scrolls away, so its decoder can rest.
  useEffect(
    () => () => {
      if (ref.current) ref.current.srcObject = null;
    },
    [],
  );
  return (
    <video
      ref={ref}
      muted
      autoPlay
      playsInline
      data-testid="huddle-video"
      className={cx('h-full w-full bg-black', fit === 'contain' ? 'object-contain' : 'object-cover', mirror && '-scale-x-100')}
      style={zoom > 1 ? { width: `${zoom * 100}%`, height: `${zoom * 100}%`, maxWidth: 'none' } : undefined}
    />
  );
}

/** Tap, or press and hold, without the hold also counting as a tap. */
function usePress({ onTap, onLongPress }) {
  const timer = useRef(null);
  const start = useRef(null);
  const held = useRef(false);
  const clear = () => {
    clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);
  return {
    onPointerDown: (e) => {
      held.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      if (!onLongPress) return;
      clear();
      timer.current = setTimeout(() => {
        held.current = true;
        onLongPress();
      }, 500);
    },
    onPointerMove: (e) => {
      const s = start.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onContextMenu: (e) => onLongPress && e.preventDefault(),
    onClick: () => {
      if (held.current) {
        held.current = false;
        return;
      }
      onTap?.();
    },
  };
}

/**
 * One person: their video when the camera is on and the tile is on screen, else their initials;
 * their name ("You" for me), muted and raised hand, and a gold ring while they talk.
 */
export function Tile({ p, speaking = false, visible = true, mirror = false, compact = false, large = false, fit, onTap, onLongPress, label, style, className, testId = 'huddle-tile', as = 'button' }) {
  useHuddle((s) => s.mediaTick); // re-render when a track arrives or ends
  const stream = streamOf(p);
  const hasVideo = Boolean(p.videoEnabled && liveVideo(stream));
  const press = usePress({ onTap, onLongPress });
  const name = p.isLocal ? 'You' : p.username || 'Someone';
  const Root = as;
  return (
    <Root
      {...(as === 'button' ? { type: 'button', ...press } : {})}
      aria-label={label || `${name}${p.audioEnabled === false ? ', muted' : ''}${p.handRaised ? ', hand raised' : ''}${speaking ? ', speaking' : ''}`}
      data-testid={testId}
      data-user={p.userId}
      data-video={hasVideo && visible ? 'on' : 'off'}
      style={style}
      className={cx(
        'relative grid min-h-0 place-items-center overflow-hidden rounded-2xl border select-none',
        hasVideo && visible ? 'bg-black' : 'bg-surface-2',
        speaking ? 'border-accent shadow-[0_0_0_2px_rgb(var(--c-accent))]' : 'border-line',
        className,
      )}
    >
      {hasVideo && visible ? (
        <VideoEl stream={stream} fit={fit || (large ? 'contain' : 'cover')} mirror={mirror} />
      ) : (
        <span className={cx('rounded-full transition-shadow', speaking && 'shadow-[0_0_0_4px_rgb(var(--c-accent)/0.5)]')}>
          <Avatar name={p.username || 'You'} size={compact ? 'md' : large ? 'xl' : 'lg'} />
        </span>
      )}
      {p.handRaised && (
        <span className={cx('absolute top-1.5 left-1.5 grid place-items-center rounded-full bg-warning text-white', compact ? 'h-6 w-6' : 'h-8 w-8')} aria-hidden>
          <Icon as={Hand} size={compact ? 13 : 16} />
        </span>
      )}
      <span
        className={cx(
          'glass absolute flex max-w-[calc(100%-12px)] items-center gap-1 rounded-full border font-medium',
          compact ? 'bottom-1 left-1 px-1.5 py-0.5 text-[11px]' : 'bottom-2 left-2 px-2 py-0.5 text-xs',
        )}
      >
        {p.audioEnabled === false && <Icon as={MicOff} size={12} className="shrink-0 text-danger" />}
        <span className="truncate">{name}</span>
      </span>
    </Root>
  );
}

const rectStyle = (r) => ({ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h });

/** Page dots and "Page x of y" under the grid. A dot shows where the person talking is. */
export function PageDots({ page, pages, onPage, speakerPage = -1 }) {
  if (pages <= 1) return null;
  return (
    <div className="flex h-6 items-center justify-center gap-2" role="group" aria-label={`Page ${page + 1} of ${pages}`} data-testid="huddle-pages">
      {Array.from({ length: pages }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPage(i)}
          aria-label={`Page ${i + 1} of ${pages}`}
          aria-current={i === page ? 'page' : undefined}
          className="grid h-6 w-5 place-items-center"
        >
          <span
            className={cx(
              'block rounded-full transition-all',
              i === page ? 'h-2 w-4 bg-accent' : 'h-2 w-2 bg-line-strong',
              i !== page && i === speakerPage && 'ring-2 ring-accent/60',
            )}
          />
        </button>
      ))}
      <span className="ml-1 text-[11px] text-text-2 tabular-nums">
        {page + 1} / {pages}
      </span>
    </div>
  );
}

/** Everyone in equal tiles, one page at a time; swipe sideways (or tap a dot) for the next page. */
export function GridView({ size, people, page, onPage, speaking, mirrorId, onPin }) {
  const g = gridLayout({ ...size, count: people.length, page });
  const swipe = useRef(null);
  const swiped = useRef(false);
  const onPointerDown = (e) => {
    swipe.current = { x: e.clientX, y: e.clientY };
    swiped.current = false;
  };
  const onPointerUp = (e) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    swiped.current = true;
    const next = g.page + (dx < 0 ? 1 : -1);
    if (next >= 0 && next < g.pageCount) onPage(next);
  };
  return (
    <div
      className="absolute inset-0"
      style={{ touchAction: g.pageCount > 1 ? 'pan-y' : undefined }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (swipe.current = null)}
      onClickCapture={(e) => {
        if (swiped.current) {
          swiped.current = false;
          e.stopPropagation();
        }
      }}
      data-testid="huddle-grid"
      data-page={g.page}
      data-cols={g.cols}
      data-rows={g.rows}
    >
      {people.slice(g.start, g.end).map((p, i) => (
        <Tile
          key={p.userId}
          p={p}
          speaking={Boolean(speaking[p.userId])}
          mirror={p.userId === mirrorId}
          style={{ ...rectStyle(g.rects[i]), transition: 'left 200ms, top 200ms, width 200ms, height 200ms' }}
          onTap={() => onPin(p.userId)}
          onLongPress={() => onPin(p.userId)}
        />
      ))}
    </div>
  );
}

/** One person large: double-tap a video (a shared screen reads best) to zoom in, drag to look around. */
function Focus({ p, speaking, mirror, pinned, onUnpin, onTap, rect }) {
  const [zoom, setZoom] = useState(1);
  useHuddle((s) => s.mediaTick);
  const stream = streamOf(p);
  const video = p.videoEnabled && liveVideo(stream);
  return (
    <div style={rectStyle(rect)} className="overflow-hidden rounded-2xl" data-testid="huddle-focus" data-user={p.userId}>
      {video ? (
        <div className="h-full w-full overflow-auto overscroll-contain bg-black" onDoubleClick={() => setZoom((z) => (z > 1 ? 1 : 2))} onClick={onTap}>
          <VideoEl stream={stream} fit="contain" mirror={mirror} zoom={zoom} />
        </div>
      ) : (
        <Tile p={p} large speaking={speaking} className="h-full w-full" onTap={onTap} />
      )}
      {pinned && (
        <button
          type="button"
          onClick={onUnpin}
          aria-label="Back to everyone"
          data-testid="huddle-unpin"
          className="glass absolute top-2 right-2 flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium"
        >
          <Icon as={PinOff} size={14} />
          Unpin
        </button>
      )}
      {video && (
        <span className="glass absolute bottom-2 left-2 flex max-w-[85%] items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
          {pinned && <Icon as={Pin} size={12} className="shrink-0 text-accent-ink" />}
          {p.audioEnabled === false && <Icon as={MicOff} size={12} className="shrink-0 text-danger" />}
          <span className="truncate">
            {p.isLocal ? 'You' : p.username}
            {p.sharing ? ' · sharing' : ''} · double-tap to {zoom > 1 ? 'zoom out' : 'zoom in'}
          </span>
        </span>
      )}
    </div>
  );
}

/** The filmstrip: scrolls, and attaches video only to the tiles in view. */
function Filmstrip({ layout, people, speaking, mirrorId, onPin }) {
  const { strip, item, direction } = layout;
  const ref = useRef(null);
  const [offset, setOffset] = useState(0);
  const frame = useRef(0);
  const row = direction === 'row';
  const onScroll = () => {
    if (frame.current) return;
    const raf = window.requestAnimationFrame || ((fn) => setTimeout(fn, 16));
    frame.current = raf(() => {
      frame.current = 0;
      const el = ref.current;
      if (el) setOffset(row ? el.scrollLeft : el.scrollTop);
    });
  };
  const [from, to] = stripVisibleRange({ offset, viewport: row ? strip.w : strip.h, itemSize: row ? item.w : item.h, count: people.length });
  return (
    <div
      ref={ref}
      onScroll={onScroll}
      data-testid="huddle-filmstrip"
      className={cx('flex gap-2 overscroll-contain', row ? 'flex-row overflow-x-auto' : 'flex-col overflow-y-auto')}
      style={rectStyle(strip)}
    >
      {people.map((p, i) => (
        <Tile
          key={p.userId}
          p={p}
          compact
          visible={i >= from && i < to}
          speaking={Boolean(speaking[p.userId])}
          mirror={p.userId === mirrorId}
          className="shrink-0"
          style={{ width: item.w, height: item.h }}
          onTap={() => onPin(p.userId)}
          onLongPress={() => onPin(p.userId)}
        />
      ))}
    </div>
  );
}

/** Someone large (pinned, sharing, or talking) with everyone else in the filmstrip. */
export function StageView({ size, focus, others, speaking, mirrorId, pinned, onPin, onUnpin, onStageTap }) {
  const layout = stageLayout({ ...size, stripCount: others.length });
  return (
    <div className="absolute inset-0" data-testid="huddle-stage">
      <Focus
        p={focus}
        rect={layout.stage}
        speaking={Boolean(speaking[focus.userId])}
        mirror={focus.userId === mirrorId}
        pinned={pinned}
        onUnpin={onUnpin}
        onTap={onStageTap}
      />
      {layout.strip && <Filmstrip layout={layout} people={others} speaking={speaking} mirrorId={mirrorId} onPin={onPin} />}
    </div>
  );
}

// Which corner my window was left in, for the rest of the call.
let lastCorner = 'br';
export const resetSelfCorner = () => {
  lastCorner = 'br';
};

/** A 1:1 call: the other person full size, me in a small window that snaps to the nearest corner. Tap it to swap. */
export function DuoView({ size, me, other, speaking, mirrorId, onStageTap }) {
  const [swapped, setSwapped] = useState(false);
  const [corner, setCorner] = useState(lastCorner);
  const [drag, setDrag] = useState(null); // { x, y } while dragging
  const start = useRef(null);
  const big = swapped ? me : other;
  const small = swapped ? other : me;
  const box = selfViewSize(size);
  const area = size.width > 0 ? size : undefined;
  const home = cornerPosition(corner, box, area);
  const pos = drag || home;
  const full = { x: 0, y: 0, w: size.width || '100%', h: size.height || '100%' };

  const onDown = (e) => {
    start.current = { x: e.clientX, y: e.clientY, left: pos.x, top: pos.y, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.moved && Math.hypot(dx, dy) < 6) return;
    s.moved = true;
    const w = size.width || box.w;
    const h = size.height || box.h;
    setDrag({ x: Math.min(Math.max(0, s.left + dx), w - box.w), y: Math.min(Math.max(0, s.top + dy), h - box.h) });
  };
  const onUp = () => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    if (!s.moved) {
      setSwapped((v) => !v);
      return;
    }
    setDrag((d) => {
      if (d) {
        const next = nearestCorner(d, box, area);
        lastCorner = next;
        setCorner(next);
      }
      return null;
    });
  };

  return (
    <div className="absolute inset-0" data-testid="huddle-duo">
      <Tile
        p={big}
        large
        fit="cover"
        speaking={Boolean(speaking[big.userId])}
        mirror={big.userId === mirrorId}
        style={rectStyle(full)}
        onTap={onStageTap}
      />
      <div
        role="button"
        tabIndex={0}
        aria-label={swapped ? `Show ${other.username || 'them'} large` : 'Your camera. Drag to move, tap to swap'}
        data-testid="huddle-selfview"
        data-corner={corner}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => {
          start.current = null;
          setDrag(null);
        }}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSwapped((v) => !v)}
        className="absolute z-10 touch-none overflow-hidden rounded-2xl shadow-[var(--shadow-sheet)]"
        style={{ left: pos.x, top: pos.y, width: box.w, height: box.h, transition: drag ? 'none' : 'left 220ms ease-out, top 220ms ease-out' }}
      >
        <Tile p={small} compact speaking={Boolean(speaking[small.userId])} mirror={small.userId === mirrorId} as="div" className="h-full w-full" />
      </div>
    </div>
  );
}

/** Just me: my own tile, full size. */
export function SoloView({ size, me, mirrorId }) {
  const full = { x: 0, y: 0, w: size.width || '100%', h: size.height || '100%' };
  return (
    <div className="absolute inset-0" data-testid="huddle-solo">
      <Tile p={me} large fit="cover" mirror={me.userId === mirrorId} style={rectStyle(full)} />
    </div>
  );
}
