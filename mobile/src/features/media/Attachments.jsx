// Attachments inside a message: photos and videos inline, audio with a player, and other files
// as a card that opens or downloads them. Uploads in progress show their progress and Cancel.
import { createContext, useContext, useState } from 'react';
import { File, FileAudio, FileImage, FileSpreadsheet, FileText, FileVideo, Play, X } from 'lucide-react';
import { Icon } from '../../ui/Icon.jsx';
import { Spinner } from '../../ui/Feedback.jsx';
import { cx } from '../../ui/cx.js';
import { extOf, fileIconKind, fitBox, formatBytes, formatDuration, previewKind } from '../../lib/files.js';
import { openFile, useMediaUrl } from './media.js';

/** The conversation's photos and videos (MessageList provides it), so the viewer swipes through all of them. */
export const ConversationMedia = createContext(null);

export const FILE_ICONS = { image: FileImage, video: FileVideo, audio: FileAudio, pdf: FileText, sheet: FileSpreadsheet, doc: File };

function Progress({ upload, onCancel, inline = false }) {
  if (!upload || upload.failed) return null;
  return (
    <span
      className={cx(
        'flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-text-2',
        inline ? 'border-t border-line-soft px-3' : 'absolute inset-x-0 bottom-0 bg-surface/90',
      )}
    >
      <span
        className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
        aria-valuenow={upload.progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Uploading"
      >
        <span className="block h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${upload.progress || 0}%` }} />
      </span>
      {upload.sending ? 'Sending…' : `${upload.progress || 0}%`}
      {onCancel && !upload.sending && (
        <button
          type="button"
          aria-label="Cancel upload"
          onClick={(e) => (e.stopPropagation(), onCancel())}
          className="grid h-6 w-6 place-items-center rounded-full text-text"
        >
          <Icon as={X} size={14} />
        </button>
      )}
    </span>
  );
}

function Photo({ file, siblings, upload, onCancel }) {
  const { url, retry, retried, error } = useMediaUrl(file);
  const [loaded, setLoaded] = useState(false);
  const box = fitBox(file.width, file.height);
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-line-soft bg-surface-2"
      style={{ width: box.width, height: box.height, maxWidth: '100%' }}
    >
      <button type="button" onClick={() => !upload && openFile(file, siblings)} aria-label={`Photo: ${file.name}`} className="block h-full w-full">
        {url && !error && (
          <img
            src={url}
            alt=""
            draggable={false}
            onLoad={() => setLoaded(true)}
            onError={() => !retried && retry()}
            className={cx('h-full w-full object-cover transition-opacity', loaded ? 'opacity-100' : 'opacity-0')}
          />
        )}
        {!loaded && <span className="skeleton absolute inset-0" aria-hidden />}
      </button>
      <Progress upload={upload} onCancel={onCancel} />
    </div>
  );
}

function Video({ file, siblings, upload, onCancel }) {
  const box = fitBox(file.width, file.height, 260, 220);
  // A frame from the video as its thumbnail (the browser loads just enough to draw it).
  const { url } = useMediaUrl(file.localUrl || upload ? null : file);
  const [frame, setFrame] = useState(false);
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-line-soft bg-surface-2"
      style={{ width: box.width, height: box.height, maxWidth: '100%' }}
    >
      <button
        type="button"
        onClick={() => !upload && openFile(file, siblings)}
        aria-label={`Video: ${file.name}`}
        className="grid h-full w-full place-items-center"
      >
        {file.localUrl && <video src={file.localUrl} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />}
        {!file.localUrl && url && (
          <video
            src={`${url}#t=0.5`}
            muted
            playsInline
            preload="metadata"
            onLoadedData={() => setFrame(true)}
            className={cx('pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity', frame ? 'opacity-100' : 'opacity-0')}
            aria-hidden
          />
        )}
        <span className="relative grid h-12 w-12 place-items-center rounded-full bg-gold text-on-accent" style={{ boxShadow: 'var(--shadow-pop)' }}>
          <Icon as={Play} size={20} className="translate-x-px" />
        </span>
        <span className="absolute top-2 left-2 max-w-[80%] truncate rounded-md bg-surface/85 px-1.5 py-0.5 text-[11px] text-text-2">
          {[file.variant === 'screen_recording' && 'Screen recording', file.duration ? formatDuration(file.duration) : !file.variant && file.name].filter(Boolean).join(' · ')}
        </span>
      </button>
      <Progress upload={upload} onCancel={onCancel} />
    </div>
  );
}

function Audio({ file, upload, onCancel }) {
  const { url, retry, retried } = useMediaUrl(upload ? null : file);
  return (
    <div className="relative w-full max-w-[300px] overflow-hidden rounded-xl border border-line-soft bg-surface">
      <div className="px-3 py-2.5">
        <p className={cx('flex items-center gap-2 text-[13px]', !upload && 'mb-1.5')}>
          <Icon as={FileAudio} size={15} className="shrink-0 text-accent-ink" />
          <span className="min-w-0 flex-1 truncate font-medium">{file.type === 'voice' && !extOf(file.name) ? 'Voice message' : file.name}</span>
          {file.duration ? <span className="shrink-0 text-xs text-text-3">{formatDuration(file.duration)}</span> : null}
        </p>
        {upload ? null : url ? (
          <audio src={url} controls preload="metadata" onError={() => !retried && retry()} className="h-9 w-full" />
        ) : (
          <span className="flex h-9 items-center text-text-2">
            <Spinner />
          </span>
        )}
      </div>
      <Progress upload={upload} onCancel={onCancel} inline />
    </div>
  );
}

function FileCard({ file, upload, onCancel }) {
  const kind = fileIconKind(file);
  const label = (extOf(file.name) || (previewKind(file) === 'pdf' ? 'pdf' : 'file')).toUpperCase();
  return (
    <div className="relative w-full max-w-[300px] overflow-hidden rounded-xl border border-line-soft bg-surface">
      <button
        type="button"
        onClick={() => !upload && openFile(file)}
        aria-label={`File: ${file.name}`}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-surface-2"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent-ink">
          <Icon as={FILE_ICONS[kind] || File} size="sm" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium">{file.name}</span>
          <span className="block truncate text-[12px] text-text-2">{[formatBytes(file.size), label].filter(Boolean).join(' · ')}</span>
        </span>
      </button>
      <Progress upload={upload} onCancel={onCancel} inline />
    </div>
  );
}

/** Every attachment of one message. `upload`: { progress, sending } while it uploads. */
export function Attachments({ files, upload, onCancel, className }) {
  const gallery = useContext(ConversationMedia);
  if (!files?.length) return null;
  const own = files.filter((f) => ['image', 'video'].includes(previewKind(f)));
  const media = gallery && own.length && own.every((f) => gallery.includes(f)) ? gallery : own;
  return (
    <div className={cx('mt-1 flex flex-col items-start gap-1.5', className)}>
      {files.map((f, i) => {
        const kind = previewKind(f);
        const props = { file: f, siblings: media, upload, onCancel };
        if (kind === 'image') return <Photo key={i} {...props} />;
        if (kind === 'video') return <Video key={i} {...props} />;
        if (kind === 'audio') return <Audio key={i} {...props} />;
        return <FileCard key={i} {...props} />;
      })}
    </div>
  );
}
