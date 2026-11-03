// The composer's sticker sheet: my stickers (by pack), GIPHY GIFs and GIPHY stickers, plus
// making a sticker from a photo. Same library and server as the web app
// (client/src/features/stickers/StickerPicker.jsx).
import { useEffect, useMemo, useRef, useState } from 'react';
import { BookmarkPlus, Plus, X } from 'lucide-react';
import { Sheet } from '../../ui/Overlay.jsx';
import { Button } from '../../ui/Button.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Spinner } from '../../ui/Feedback.jsx';
import { Field, SearchField, Segmented } from '../../ui/Controls.jsx';
import { SquareCropSheet } from '../../ui/SquareCropSheet.jsx';
import { cx } from '../../ui/cx.js';
import { toast } from '../../lib/bus.js';
import { readImageSize } from '../../lib/files.js';
import { useMediaUrl } from '../media/media.js';
import {
  CAPTION_MAX, STICKER_SIZE, canAddAsIs, canvasToStickerBlob, drawSticker, loadImage, stickerFile, stickerFileProblem,
} from '../../../../platform/media/stickerMaker.js';
import { fromGiphy, groupByPack, removeSticker, searchGiphy, uploadSticker, useStickers } from './stickers.js';

function LibraryTile({ sticker, onPick, onRemove, editing }) {
  const { url, retry, retried } = useMediaUrl(sticker.attachment);
  return (
    <div className="relative aspect-square">
      <button
        type="button"
        onClick={() => (editing ? onRemove(sticker) : onPick(sticker))}
        aria-label={editing ? `Remove sticker ${sticker.name || ''}` : `Send sticker ${sticker.name || ''}`}
        className="pressable grid h-full w-full place-items-center rounded-xl p-1 active:bg-surface-2"
      >
        {url ? (
          <img src={url} alt="" draggable={false} loading="lazy" onError={() => !retried && retry()} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="skeleton h-4/5 w-4/5 rounded-xl" aria-hidden />
        )}
      </button>
      {editing && (
        <span className="pointer-events-none absolute top-0 right-0 grid h-5 w-5 place-items-center rounded-full bg-danger text-white" aria-hidden>
          <Icon as={X} size={12} />
        </span>
      )}
    </div>
  );
}

function MyStickers({ onSend, onCreate }) {
  const { status, stickers, error } = useStickers();
  const packs = useMemo(() => groupByPack(stickers), [stickers]);
  const [editing, setEditing] = useState(false);
  const remove = async (s) => {
    try {
      await removeSticker(s.id);
    } catch (err) {
      toast(err?.message || "The sticker couldn't be removed.", 'danger');
    }
  };
  if (status === 'idle' || status === 'loading') {
    return (
      <div className="grid place-items-center py-10 text-text-2">
        <Spinner />
      </div>
    );
  }
  if (status === 'error') return <p className="px-4 py-6 text-center text-[13px] text-danger">{error}</p>;
  if (!stickers.length) {
    return (
      <div className="px-6 py-8 text-center">
        <p className="text-[15px] font-semibold">No stickers yet</p>
        <p className="mt-1.5 text-[13px] text-text-2">
          Make one from a photo, add a GIF, or save one someone sent you (press and hold it → Save as sticker).
        </p>
        <Button className="mt-4" size="sm" icon={Plus} onClick={onCreate}>
          Create sticker
        </Button>
      </div>
    );
  }
  return (
    <div className="px-3 pb-3">
      <div className="flex justify-end px-1">
        <button type="button" onClick={() => setEditing((e) => !e)} className="text-[13px] font-medium text-accent-ink">
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>
      {packs.map((p) => (
        <section key={p.name} aria-label={p.name} className="mt-1">
          <h4 className="px-1 pb-1 text-[11px] font-semibold tracking-wider text-text-3 uppercase">{p.name}</h4>
          <div className="grid grid-cols-4 gap-1">
            {p.items.map((s) => (
              <LibraryTile key={s.id} sticker={s} editing={editing} onPick={() => onSend(s.attachment)} onRemove={remove} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function GiphyTab({ kind, onSend }) {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const seq = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = (offset) => {
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    return searchGiphy(query, kind, offset)
      .then((data) => {
        if (mine !== seq.current) return;
        setResults((prev) => (offset ? [...prev, ...(data?.results || [])] : data?.results || []));
        setNext(data?.next ?? null);
      })
      .catch((err) => mine === seq.current && setError(err?.message || 'GIF search failed.'))
      .finally(() => mine === seq.current && setLoading(false));
  };

  useEffect(() => {
    setResults([]);
    load(0);
  }, [query, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = async (r, save) => {
    setBusyId(r.id);
    try {
      const data = await fromGiphy(r.id, kind, { save });
      if (save) toast('Added to your stickers');
      else onSend(data.attachment);
    } catch (err) {
      toast(err?.message || "That GIF couldn't be sent.", 'danger');
    } finally {
      setBusyId(null);
    }
  };

  const stickers = kind === 'stickers';
  return (
    <div className="px-3 pb-3">
      <SearchField value={q} onChange={setQ} placeholder={stickers ? 'Search GIPHY stickers' : 'Search GIFs'} className="mb-2" />
      {error && <p className="py-2 text-center text-[13px] text-danger">{error}</p>}
      {!loading && !error && !results.length && <p className="py-6 text-center text-[13px] text-text-2">Nothing found</p>}
      <div className={cx('grid gap-1', stickers ? 'grid-cols-4' : 'grid-cols-2')}>
        {results.map((r) => (
          <div key={r.id} className={cx('relative overflow-hidden rounded-xl', stickers ? 'aspect-square' : 'h-28 bg-surface-2')}>
            <button
              type="button"
              disabled={Boolean(busyId)}
              onClick={() => pick(r, false)}
              aria-label={`Send ${r.title || (stickers ? 'sticker' : 'GIF')}`}
              className={cx('block h-full w-full', busyId && busyId !== r.id && 'opacity-50')}
            >
              <img
                src={r.preview.url}
                alt=""
                loading="lazy"
                draggable={false}
                referrerPolicy="no-referrer"
                className={cx('h-full w-full', stickers ? 'object-contain' : 'object-cover')}
              />
              {busyId === r.id && (
                <span className="absolute inset-0 grid place-items-center bg-surface/60">
                  <Spinner />
                </span>
              )}
            </button>
            <button
              type="button"
              disabled={Boolean(busyId)}
              aria-label="Save to my stickers"
              onClick={() => pick(r, true)}
              className="absolute top-1 right-1 grid h-7 w-7 place-items-center rounded-full border border-line-soft bg-surface/90 text-text-2"
            >
              <Icon as={BookmarkPlus} size={14} />
            </button>
          </div>
        ))}
      </div>
      {loading && (
        <div className="grid place-items-center py-4 text-text-2">
          <Spinner />
        </div>
      )}
      {!loading && next != null && (
        <Button block variant="secondary" size="sm" className="mt-2" onClick={() => load(next)}>
          Load more
        </Button>
      )}
      <p className="mt-2 text-right text-[10px] tracking-wider text-text-3 uppercase">Powered by GIPHY</p>
    </div>
  );
}

const SHAPES = [
  { value: 'rounded', label: 'Rounded' },
  { value: 'circle', label: 'Circle' },
  { value: 'full', label: 'No frame' },
];

/**
 * Makes a sticker from a picture: photos are cropped to a square and styled (shape, outline,
 * caption); GIFs, WebP and PNG can be added as they are. onDone(sticker, { send }).
 */
export function StickerMakerSheet({ file, onCancel, onDone, canSend = true }) {
  const asIs = canAddAsIs(file);
  const gif = /gif$/i.test(file?.type || '');
  const [step, setStep] = useState(gif && asIs ? 'asis' : asIs ? 'choose' : 'crop');
  const [cropped, setCropped] = useState(null);
  const [shape, setShape] = useState('rounded');
  const [caption, setCaption] = useState('');
  const [pack, setPack] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(stickerFileProblem(file));
  const [preview, setPreview] = useState(null);
  const canvas = useRef(null);
  const { stickers } = useStickers();
  const packs = useMemo(() => groupByPack(stickers).map((p) => p.name), [stickers]);

  useEffect(() => {
    if (!file || (step !== 'asis' && step !== 'choose')) return undefined;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, step]);

  useEffect(() => {
    if (step === 'style' && cropped && canvas.current) drawSticker(canvas.current, cropped, { shape, caption });
  }, [step, cropped, shape, caption]);

  const finish = async (send) => {
    setBusy(true);
    setError(null);
    try {
      let sticker;
      if (step === 'style') {
        const blob = await canvasToStickerBlob(canvas.current);
        sticker = await uploadSticker(stickerFile(blob, file?.name), { pack: pack.trim(), width: STICKER_SIZE, height: STICKER_SIZE, made: true });
      } else {
        const size = await readImageSize(file);
        sticker = await uploadSticker(file, { pack: pack.trim(), ...(size || {}) });
      }
      onDone?.(sticker, { send });
    } catch (err) {
      setError(err?.message || "The sticker couldn't be added.");
      setBusy(false);
    }
  };

  if (step === 'crop') {
    return (
      <SquareCropSheet
        file={file}
        title="Make a sticker"
        onCancel={onCancel}
        onDone={async (blob) => {
          try {
            setCropped(await loadImage(blob));
          } catch (err) {
            setError(err.message);
          }
          setStep('style');
        }}
      />
    );
  }

  return (
    <Sheet open={Boolean(file)} onClose={busy ? () => {} : onCancel} title={step === 'style' ? 'Style your sticker' : 'Add sticker'}>
      <div className="px-4 pb-4" data-testid="sticker-maker">
        <div
          className="mx-auto grid h-48 w-48 place-items-center rounded-xl border border-line-soft"
          style={{
            backgroundColor: 'rgb(var(--c-surface-2))',
            backgroundImage:
              'linear-gradient(45deg, rgb(var(--c-surface-3)) 25%, transparent 25%, transparent 75%, rgb(var(--c-surface-3)) 75%), linear-gradient(45deg, rgb(var(--c-surface-3)) 25%, transparent 25%, transparent 75%, rgb(var(--c-surface-3)) 75%)',
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0, 8px 8px',
          }}
        >
          {step === 'style' ? (
            <canvas ref={canvas} aria-label="Sticker preview" className="h-48 w-48" />
          ) : (
            preview && <img src={preview} alt="" className="max-h-48 max-w-48 object-contain" />
          )}
        </div>
        {step === 'choose' && (
          <p className="mt-3 text-center text-[13px] text-text-2">
            Add it as it is (keeps animation and see-through parts), or{' '}
            <button type="button" className="font-medium text-accent-ink" onClick={() => setStep('crop')} disabled={busy}>
              crop and style it
            </button>
            .
          </p>
        )}
        {step === 'style' && (
          <>
            <p className="mt-4 mb-1.5 text-[13px] font-medium text-text-2">Shape</p>
            <Segmented options={SHAPES} value={shape} onChange={setShape} label="Shape" />
            <Field className="mt-3" label="Caption (optional)" value={caption} maxLength={CAPTION_MAX} placeholder="e.g. On it!" onChange={(e) => setCaption(e.target.value)} />
          </>
        )}
        <Field className="mt-3" label="Pack" value={pack} maxLength={40} placeholder="My stickers" list="m-sticker-packs" onChange={(e) => setPack(e.target.value)} />
        <datalist id="m-sticker-packs">
          {packs.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        {error && <p className="mt-2 text-center text-[13px] text-danger">{error}</p>}
        <div className="mt-4 flex gap-2">
          <Button block variant="secondary" disabled={busy || (step === 'style' && !cropped) || Boolean(stickerFileProblem(file))} onClick={() => finish(false)} data-testid="sticker-save">
            Add to stickers
          </Button>
          {canSend && (
            <Button block loading={busy} disabled={(step === 'style' && !cropped) || Boolean(stickerFileProblem(file))} onClick={() => finish(true)} data-testid="sticker-save-send">
              Add & send
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

/** onSend(attachment) sends a sticker or GIF right away. */
export function StickerSheet({ open, onClose, onSend }) {
  const { giphy } = useStickers();
  const [tab, setTab] = useState('mine');
  const [makerFile, setMakerFile] = useState(null);
  const input = useRef(null);
  const tabs = [
    { value: 'mine', label: 'My stickers' },
    giphy && { value: 'gifs', label: 'GIFs' },
    giphy && { value: 'stickers', label: 'GIPHY' },
  ].filter(Boolean);
  const send = (attachment) => {
    onSend?.(attachment);
    onClose?.();
  };
  const create = () => input.current?.click();

  return (
    <>
      <Sheet
        open={open && !makerFile}
        onClose={onClose}
        full
        title="Stickers"
      >
        <div data-testid="sticker-sheet">
          <div className="mx-4 mb-3 flex items-center gap-2">
            {tabs.length > 1 ? <Segmented options={tabs} value={tab} onChange={setTab} label="Sticker source" className="flex-1" size="sm" /> : <span className="flex-1" />}
            <Button size="sm" variant="secondary" icon={Plus} onClick={create} aria-label="Create sticker">
              Create
            </Button>
          </div>
          {tab === 'mine' ? <MyStickers onSend={send} onCreate={create} /> : <GiphyTab key={tab} kind={tab} onSend={send} />}
        </div>
      </Sheet>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        data-testid="sticker-file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) setMakerFile(f);
        }}
      />
      {makerFile && (
        <StickerMakerSheet
          file={makerFile}
          canSend={Boolean(onSend)}
          onCancel={() => setMakerFile(null)}
          onDone={(sticker, { send: andSend }) => {
            setMakerFile(null);
            setTab('mine');
            if (andSend) send(sticker.attachment);
            else toast('Added to your stickers');
          }}
        />
      )}
    </>
  );
}
