// The full-screen viewer for photos, videos, audio and PDFs, and the sheet that opens or downloads
// any other file. Rendered once at the app root; anything calls openFile() (media.js) to use them.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Music, Share2, TriangleAlert, X } from 'lucide-react';
import { ActionSheet, useOverlay, usePresence } from '../../ui/Overlay.jsx';
import { IconButton, Button } from '../../ui/Button.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Spinner } from '../../ui/Feedback.jsx';
import { cx } from '../../ui/cx.js';
import { formatBytes, previewKind } from '../../lib/files.js';
import { finePointer } from '../../app/layout.js';
import { deviceNoun, isNative } from '../../native/index.js';
import { canShareFiles, downloadFile, openWithSystem, shareFile, useMediaUrl, useViewer } from './media.js';

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

function ImageView({ file, url, onError }) {
  const [zoom, setZoom] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className={cx('flex h-full w-full', zoom ? 'overflow-auto' : 'items-center justify-center overflow-hidden')}
      onClick={() => setZoom((z) => !z)}
      role="presentation"
    >
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

function MediaItem({ file }) {
  const { url, error, retry, retried } = useMediaUrl(file);
  const kind = previewKind(file);
  const onError = () => (retried ? null : retry());
  if (error || (!url && !file.url && !file.gcsPath && !file.localUrl)) return <Failed file={file} />;
  if (!url) return <Spinner className="text-text-2" />;
  if (kind === 'image') return <ImageView key={url} file={file} url={url} onError={onError} />;
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
  if (kind === 'pdf') return <PdfView file={file} url={url} />;
  return (
    <div className="flex flex-col items-center text-text-2">
      <Icon as={FileText} size={40} />
    </div>
  );
}

function Viewer({ media, onClose }) {
  const open = Boolean(media);
  useOverlay(open, onClose);
  const { mounted, closing } = usePresence(open, 160);
  const [index, setIndex] = useState(media?.index || 0);
  const last = useRef(media);
  if (media) last.current = media;
  const shown = media || last.current;
  useEffect(() => {
    if (media) setIndex(media.index || 0);
  }, [media]);
  const swipe = useRef(null);
  if (!mounted || !shown) return null;
  const items = shown.items;
  const file = items[Math.min(index, items.length - 1)];
  const many = items.length > 1;
  const go = (d) => setIndex((i) => (i + d + items.length) % items.length);

  return createPortal(
    <div
      data-theme="dark"
      role="dialog"
      aria-modal="true"
      aria-label={file.name || 'Preview'}
      className={cx('fixed inset-0 z-[60] flex flex-col bg-bg text-text', closing ? 'opacity-0 transition-opacity duration-150' : 'animate-fade-in')}
      onKeyDown={(e) => {
        if (many && e.key === 'ArrowRight') go(1);
        if (many && e.key === 'ArrowLeft') go(-1);
      }}
    >
      <header className="flex shrink-0 items-center gap-1 px-2 pt-safe">
        <div className="flex h-14 w-full items-center gap-1">
          <IconButton icon={X} label="Close" onClick={onClose} />
          <div className="min-w-0 flex-1 pl-1">
            <h2 className="truncate text-[15px] font-semibold">{file.name || 'File'}</h2>
            <p className="truncate text-xs text-text-2">
              {[formatBytes(file.size), many && `${index + 1} of ${items.length}`].filter(Boolean).join(' · ')}
            </p>
          </div>
          {canShareFiles() && <IconButton icon={Share2} label="Share" onClick={() => shareFile(file)} />}
          <IconButton
            icon={isNative ? ExternalLink : Download}
            label={isNative ? 'Open with…' : 'Download'}
            onClick={() => (isNative ? openWithSystem(file) : downloadFile(file))}
          />
        </div>
      </header>
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center pb-safe"
        onPointerDown={(e) => {
          swipe.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const s = swipe.current;
          swipe.current = null;
          if (!many || !s || e.pointerType === 'mouse') return;
          const dx = e.clientX - s.x;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.5) go(dx < 0 ? 1 : -1);
        }}
      >
        <MediaItem key={`${index}:${file.url || file.localUrl || file.name}`} file={file} />
        {many && finePointer() && (
          <>
            <IconButton icon={ChevronLeft} label="Previous" onClick={() => go(-1)} className="absolute left-3 bg-surface-2" />
            <IconButton icon={ChevronRight} label="Next" onClick={() => go(1)} className="absolute right-3 bg-surface-2" />
          </>
        )}
      </div>
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
