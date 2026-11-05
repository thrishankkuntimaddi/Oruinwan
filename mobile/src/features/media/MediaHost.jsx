// The full-screen viewer for photos, videos, audio and PDFs (swipe sideways between files; others
// show a card to open them), and the sheet that opens or downloads any other file. Rendered once at the app root; anything calls openFile() (media.js) to use them.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Download, ExternalLink, FileText, MessageSquare, Music, Share2, TriangleAlert, X } from 'lucide-react';
import { ActionSheet, useOverlay, usePresence } from '../../ui/Overlay.jsx';
import { IconButton, Button } from '../../ui/Button.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Spinner } from '../../ui/Feedback.jsx';
import { cx } from '../../ui/cx.js';
import { formatBytes, previewKind } from '../../lib/files.js';
import { finePointer } from '../../app/layout.js';
import { deviceNoun, isNative } from '../../native/index.js';
import { canShareFiles, downloadFile, fileMeta, openWithSystem, pdfInApp, shareFile, useMediaUrl, useViewer } from './media.js';
import { clock, dayLabel } from '../../lib/time.js';

function Failed({ file }) {
  return (
    <div className="flex max-w-xs flex-col items-center px-6 text-center">
      <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-line bg-surface text-text-2">
        <Icon as={TriangleAlert} size="lg" />
      </span>
      <p className="text-[15px] font-medium">This file couldn't be loaded.</p>
      <p className="mt-1 text-sm text-text-2">It may have been deleted, or you may be offline.</p>
      <Button variant="secondary" size="sm" className="mt-5" icon={ExternalLink} onClick={() => openWithSystem(file)}>
        {isNative ? 'Open with…' : 'Open in a new tab'}
      </Button>
    </div>
  );
}

/** A photo; `zoom` (double tap in the viewer) shows it at twice the size to pan around. */
function ImageView({ file, url, onError, zoom = false }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={cx('flex h-full w-full', zoom ? 'overflow-auto' : 'items-center justify-center overflow-hidden')} role="presentation">
      {!loaded && (
        <span className="absolute inset-0 grid place-items-center text-text-2">
          <Spinner />
        </span>
      )}
      <img
        src={url}
        alt={file.name || 'Photo'}
        onLoad={() => setLoaded(true)}
        onError={onError}
        draggable={false}
        className={cx('select-none', zoom ? 'max-w-none' : 'max-h-full max-w-full object-contain', !loaded && 'opacity-0')}
        style={zoom ? { width: '200%' } : undefined}
      />
    </div>
  );
}

function PdfView({ file, url }) {
  // The file is served with a sandboxing policy that stops browsers drawing it in a frame,
  // so the PDF is loaded here and shown from a local copy.
  const [state, setState] = useState({ src: null, error: false });
  useEffect(() => {
    let href = null;
    let cancelled = false;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        href = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        setState({ src: href, error: false });
      })
      .catch(() => !cancelled && setState({ src: null, error: true }));
    return () => {
      cancelled = true;
      if (href) URL.revokeObjectURL(href);
    };
  }, [url]);
  if (state.error) return <Failed file={file} />;
  if (!state.src) return <Spinner className="text-text-2" />;
  return <iframe title={file.name || 'PDF'} src={state.src} className="h-full w-full border-0 bg-surface" />;
}

function MediaItem({ file, zoom }) {
  const { url, error, retry, retried } = useMediaUrl(file);
  const kind = previewKind(file);
  const onError = () => (retried ? null : retry());
  if (!VIEWABLE.has(kind) || (kind === 'pdf' && !pdfInApp)) return <FileCard file={file} />;
  if (error || (!url && !file.url && !file.gcsPath && !file.localUrl)) return <Failed file={file} />;
  if (!url) return <Spinner className="text-text-2" />;
  if (kind === 'image') return <ImageView key={url} file={file} url={url} onError={onError} zoom={zoom} />;
  if (kind === 'video') {
    return <video key={url} src={url} controls autoPlay playsInline onError={onError} className="max-h-full max-w-full" />;
  }
  if (kind === 'audio') {
    return (
      <div className="flex w-full max-w-sm flex-col items-center px-6 text-center">
        <span className="mb-5 grid h-24 w-24 place-items-center rounded-3xl border border-accent/30 bg-accent/10 text-accent-ink">
          <Icon as={Music} size={40} />
        </span>
        <p className="mb-5 max-w-full truncate text-[15px] font-medium">{file.name}</p>
        <audio key={url} src={url} controls autoPlay onError={onError} className="w-full" />
      </div>
    );
  }
  if (kind === 'pdf' && pdfInApp) return <PdfView file={file} url={url} />;
  return <FileCard file={file} />;
}

const VIEWABLE = new Set(['image', 'video', 'audio', 'pdf']);

/** Anything the viewer can't draw (documents, archives, PDFs on phones): a card to open it. */
function FileCard({ file }) {
  return (
    <div className="flex max-w-xs flex-col items-center px-6 text-center">
      <span className="mb-4 grid h-20 w-20 place-items-center rounded-3xl border border-accent/30 bg-accent/10 text-accent-ink">
        <Icon as={FileText} size={36} />
      </span>
      <p className="max-w-full truncate text-[15px] font-medium">{file.name || 'File'}</p>
      {file.size ? <p className="mt-1 text-sm text-text-2">{formatBytes(file.size)}</p> : null}
      <Button variant="secondary" size="sm" className="mt-5" icon={isNative ? ExternalLink : Download} onClick={() => (isNative ? openWithSystem(file) : downloadFile(file))}>
        {isNative ? 'Open with…' : 'Download'}
      </Button>
    </div>
  );
}

function ViewerAction({ icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex min-w-16 flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[11px] font-medium text-white active:bg-white/10">
      <Icon as={icon} size={20} />
      {label}
    </button>
  );
}

// Taps on these are theirs (video controls, buttons, a PDF), not "show / hide the bars".
const OWN_TAPS = 'button, a, video, audio, iframe, input, select, textarea';

function Viewer({ media, onClose }) {
  const open = Boolean(media);
  useOverlay(open, onClose);
  const { mounted, closing } = usePresence(open, 160);
  const [index, setIndex] = useState(media?.index || 0);
  const [chrome, setChrome] = useState(true); // header and toolbar shown
  const [zoom, setZoom] = useState(false);
  const [drag, setDrag] = useState({ x: 0, y: 0 }); // the photo follows the finger
  const last = useRef(media);
  if (media) last.current = media;
  const shown = media || last.current;
  useEffect(() => {
    if (media) {
      setIndex(media.index || 0);
      setChrome(true);
    }
  }, [media]);
  useEffect(() => setZoom(false), [index]);
  const touch = useRef(null);
  const tapTimer = useRef(null);
  const lastTap = useRef(0);
  const dir = useRef(0);
  useEffect(() => () => clearTimeout(tapTimer.current), []);
  if (!mounted || !shown) return null;
  const items = shown.items;
  const file = items[Math.min(index, items.length - 1)];
  const many = items.length > 1;
  const meta = fileMeta.get(file) || null;
  const go = (d) => {
    dir.current = d;
    setIndex((i) => (i + d + items.length) % items.length);
  };

  // One tap: hide or show the bars. Two quick taps on a photo: zoom in or out.
  const tap = (target) => {
    if (target.closest?.(OWN_TAPS)) return;
    const now = Date.now();
    if (now - lastTap.current < 280 && previewKind(file) === 'image') {
      clearTimeout(tapTimer.current);
      lastTap.current = 0;
      setZoom((z) => !z);
      return;
    }
    lastTap.current = now;
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => setChrome((c) => !c), 280);
  };

  // Touch events, not pointer events: Android cancels the pointer as soon as a sideways drag
  // starts. Sideways moves to the next / previous file, down closes; a zoomed photo pans instead.
  const onTouchStart = (e) => {
    const t = e.touches[0];
    touch.current = e.touches.length === 1 && !zoom && !e.target.closest?.('.overflow-auto, video, iframe') ? { x: t.clientX, y: t.clientY, at: Date.now(), axis: null } : null;
    if (e.touches.length === 1 && !touch.current) touch.current = { x: t.clientX, y: t.clientY, at: Date.now(), axis: 'none' };
  };
  const onTouchMove = (e) => {
    const s = touch.current;
    const t = e.touches[0];
    if (!s || !t || s.axis === 'none') return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (!s.axis && Math.hypot(dx, dy) > 10) s.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : dy > 0 ? 'y' : 'none';
    if (s.axis === 'x' && many) setDrag({ x: dx, y: 0 });
    if (s.axis === 'y') setDrag({ x: 0, y: Math.max(0, dy) });
  };
  const onTouchEnd = (e) => {
    const s = touch.current;
    touch.current = null;
    const t = e.changedTouches[0];
    setDrag({ x: 0, y: 0 });
    if (!s || !t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    const fast = Date.now() - s.at < 250;
    if (!s.axis || (s.axis === 'none' && Math.hypot(dx, dy) < 10)) return tap(e.target);
    if (s.axis === 'x' && many && (Math.abs(dx) > window.innerWidth * 0.22 || (fast && Math.abs(dx) > 40))) return go(dx < 0 ? 1 : -1);
    if (s.axis === 'y' && (dy > 140 || (fast && dy > 60))) return onClose();
    return undefined;
  };

  const pull = Math.min(1, drag.y / 300);
  const barClass = cx('transition-opacity duration-200', chrome ? 'opacity-100' : 'pointer-events-none opacity-0');

  return createPortal(
    <div
      data-theme="dark"
      role="dialog"
      aria-modal="true"
      aria-label={file.name || 'Preview'}
      className={cx('fixed inset-0 z-[60] flex flex-col text-text', closing ? 'opacity-0 transition-opacity duration-150' : 'animate-fade-in')}
      style={{ background: `rgb(var(--c-bg) / ${1 - pull * 0.7})` }}
      onKeyDown={(e) => {
        if (many && e.key === 'ArrowRight') go(1);
        if (many && e.key === 'ArrowLeft') go(-1);
      }}
    >
      <header className={cx('absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/70 to-transparent px-2 pt-safe', barClass)}>
        <div className="flex h-14 w-full items-center gap-1">
          <IconButton icon={X} label="Close" onClick={onClose} />
          <div className="min-w-0 flex-1 pl-1">
            <h2 className="truncate text-[15px] font-semibold">{file.name || 'File'}</h2>
            <p className="truncate text-xs text-text-2">
              {[formatBytes(file.size), many && `${index + 1} of ${items.length}`].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      </header>
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
        data-testid="media-stage"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={(e) => finePointer() && tap(e.target)}
      >
        <div
          key={`${index}:${file.url || file.localUrl || file.name}`}
          className="flex h-full w-full items-center justify-center"
          style={{
            transform: drag.x || drag.y ? `translate(${drag.x}px, ${drag.y}px) scale(${1 - pull * 0.15})` : undefined,
            transition: drag.x || drag.y ? 'none' : 'transform 180ms ease-out',
            animation: dir.current ? `media-in-${dir.current > 0 ? 'next' : 'prev'} 200ms var(--ease-out-soft) both` : undefined,
          }}
        >
          <MediaItem file={file} zoom={zoom} />
        </div>
        {/* Arrows at the screen edges, for a mouse or keyboard; on a phone, swipe. */}
        {many && (
          <>
            <div className={cx('absolute inset-y-0 left-1 flex items-center', finePointer() ? barClass : 'sr-only')}>
              <IconButton icon={ChevronLeft} label="Previous" onClick={() => go(-1)} className="bg-black/50 backdrop-blur" />
            </div>
            <div className={cx('absolute inset-y-0 right-1 flex items-center', finePointer() ? barClass : 'sr-only')}>
              <IconButton icon={ChevronRight} label="Next" onClick={() => go(1)} className="bg-black/50 backdrop-blur" />
            </div>
          </>
        )}
      </div>
      {/* What you can do with it: share, save, go back to its message; who sent it and when. */}
      <footer className={cx('absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/75 to-transparent px-2 pt-6 pb-safe', barClass)} data-testid="media-actions">
        {many && items.length <= 12 && (
          <div className="mb-2 flex justify-center gap-1.5" aria-hidden>
            {items.map((it, i) => (
              <span key={i} className={cx('h-1.5 rounded-full transition-all', i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/40')} />
            ))}
          </div>
        )}
        {meta && (
          <p className="truncate px-2 pb-1 text-center text-[12px] text-white/75">
            {[meta.authorName, meta.at && `${dayLabel(meta.at)} ${clock(meta.at)}`].filter(Boolean).join(' · ')}
          </p>
        )}
        <div className="mx-auto flex max-w-md justify-around pb-1">
          {canShareFiles() && <ViewerAction icon={Share2} label="Share" onClick={() => shareFile(file)} />}
          <ViewerAction icon={isNative ? ExternalLink : Download} label={isNative ? 'Open / save' : 'Save'} onClick={() => (isNative ? openWithSystem(file) : downloadFile(file))} />
          {meta?.messageId && (
            <ViewerAction
              icon={MessageSquare}
              label="Show in chat"
              onClick={() => {
                onClose();
                // The conversation is right behind the viewer: scroll to the message and flash it.
                setTimeout(() => {
                  const el = document.querySelector(`[data-mid="${String(meta.messageId).replace(/"/g, '')}"]`);
                  el?.scrollIntoView?.({ block: 'center' });
                  el?.animate?.([{ backgroundColor: 'rgb(var(--c-accent) / 0.25)' }, { backgroundColor: 'transparent' }], { duration: 1400 });
                }, 220);
              }}
            />
          )}
        </div>
      </footer>
    </div>,
    document.body,
  );
}

function FileActions({ file, onClose }) {
  const last = useRef(file);
  if (file) last.current = file;
  const f = file || last.current;
  const actions = !f
    ? []
    : isNative
      ? [{ icon: ExternalLink, label: 'Open with…', hint: `Opens in your ${deviceNoun}'s viewer, where you can save or share it`, onSelect: () => openWithSystem(f) }]
      : [
          { icon: Download, label: 'Download', hint: formatBytes(f.size) || null, onSelect: () => downloadFile(f) },
          { icon: ExternalLink, label: 'Open in a new tab', onSelect: () => openWithSystem(f) },
          canShareFiles() && { icon: Share2, label: 'Share…', onSelect: () => shareFile(f) },
        ];
  return <ActionSheet open={Boolean(file)} onClose={onClose} title={f?.name || 'File'} actions={actions} />;
}

export function MediaHost() {
  const media = useViewer((s) => s.media);
  const actions = useViewer((s) => s.actions);
  const closeMedia = useViewer((s) => s.closeMedia);
  const closeActions = useViewer((s) => s.closeActions);
  return (
    <>
      <Viewer media={media} onClose={closeMedia} />
      <FileActions file={actions} onClose={closeActions} />
    </>
  );
}
