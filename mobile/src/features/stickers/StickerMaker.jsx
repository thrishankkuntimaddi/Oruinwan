// Making a sticker from a picture: crop it to a square (pinch to zoom, drag to move), then either
// keep the whole photo in a shape, or cut out the person or thing you tap (on the phone, nothing
// uploaded) and put it on nothing, a colour or a picture. White outline and caption optional.
// GIFs, WebP and PNG can also be added as they are. Saved to a pack you pick or create.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Eraser, ImagePlus, Plus, Scissors, Sparkles, Undo2, Wand2 } from 'lucide-react';
import { Sheet } from '../../ui/Overlay.jsx';
import { Button } from '../../ui/Button.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Spinner } from '../../ui/Feedback.jsx';
import { Field, Segmented, Toggle } from '../../ui/Controls.jsx';
import { SquareCropSheet } from '../../ui/SquareCropSheet.jsx';
import { cx } from '../../ui/cx.js';
import { readImageSize } from '../../lib/files.js';
import {
  BACKGROUND_COLORS, CAPTION_MAX, STICKER_SIZE, canAddAsIs, canvasToStickerBlob, drawSticker, loadImage, stickerFile, stickerFileProblem,
} from '../../../../platform/media/stickerMaker.js';
import { CUTOUT_DOWNLOAD_MB, keptBox, keptShare, maskCanvas } from '../../../../platform/media/cutout.js';
import { groupByPack, uploadSticker, useStickers } from './stickers.js';
import { getCutter } from './cutoutEngine.js';

const DEFAULT_PACK = 'My stickers';
const SHAPES = [
  { value: 'rounded', label: 'Rounded' },
  { value: 'circle', label: 'Circle' },
  { value: 'full', label: 'Square' },
];
const MODES = [
  { value: 'photo', label: 'Whole photo' },
  { value: 'cutout', label: 'Cut out' },
];

const CHECKER = {
  backgroundColor: 'rgb(var(--c-surface-2))',
  backgroundImage:
    'linear-gradient(45deg, rgb(var(--c-surface-3)) 25%, transparent 25%, transparent 75%, rgb(var(--c-surface-3)) 75%), linear-gradient(45deg, rgb(var(--c-surface-3)) 25%, transparent 25%, transparent 75%, rgb(var(--c-surface-3)) 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 8px 8px',
};

/** Pick one of my packs or start a new one (a dropdown can't take a new name on Android). */
export function PackPicker({ value, onChange }) {
  const { stickers } = useStickers();
  const packs = useMemo(() => {
    const names = groupByPack(stickers).map((p) => p.name);
    return names.includes(DEFAULT_PACK) ? names : [DEFAULT_PACK, ...names];
  }, [stickers]);
  const current = value || DEFAULT_PACK;
  const [adding, setAdding] = useState(!packs.includes(current));
  return (
    <div className="mt-3" data-testid="pack-picker">
      <p className="mb-1.5 text-[13px] font-medium text-text-2">Pack</p>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {packs.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setAdding(false);
              onChange(p);
            }}
            aria-pressed={!adding && p === current}
            className={cx('h-8 shrink-0 rounded-full border px-3.5 text-[13px] font-medium', !adding && p === current ? 'border-accent bg-accent/15 text-accent-ink' : 'border-line bg-surface text-text-2')}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            onChange('');
          }}
          aria-pressed={adding}
          className={cx('inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-dashed px-3.5 text-[13px] font-medium', adding ? 'border-accent text-accent-ink' : 'border-line text-text-2')}
        >
          <Icon as={Plus} size={13} /> New pack
        </button>
      </div>
      {adding && <Field className="mt-2" label="New pack name" value={value} maxLength={40} placeholder="e.g. Office memes" autoFocus onChange={(e) => onChange(e.target.value)} />}
    </div>
  );
}

/** The cropped photo with what the cut-out keeps highlighted; tap to keep (or remove) parts. */
function CutoutCanvas({ image, mask, taps, onTap, busy }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !image) return;
    const S = 512;
    c.width = S;
    c.height = S;
    const ctx = c.getContext('2d');
    ctx.drawImage(image, 0, 0, S, S);
    if (mask) {
      // Dim what is left out; the kept part stays bright.
      const kept = document.createElement('canvas');
      kept.width = S;
      kept.height = S;
      const k = kept.getContext('2d');
      k.drawImage(image, 0, 0, S, S);
      k.globalCompositeOperation = 'destination-in';
      k.drawImage(maskCanvas(mask, S), 0, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.fillRect(0, 0, S, S);
      ctx.drawImage(kept, 0, 0);
    }
    for (const t of taps) {
      ctx.beginPath();
      ctx.arc(t.x * S, t.y * S, 9, 0, Math.PI * 2);
      ctx.fillStyle = t.mode === 'remove' ? '#ef4444' : '#22c55e';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }
  }, [image, mask, taps]);
  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      <canvas
        ref={ref}
        data-no-swipe
        data-testid="cutout-canvas"
        aria-label="Tap what to keep"
        className="block aspect-square w-full rounded-xl border border-line-soft"
        style={{ touchAction: 'none' }}
        onPointerUp={(e) => {
          if (busy) return;
          const r = e.currentTarget.getBoundingClientRect();
          onTap({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
        }}
      />
      {busy && (
        <span className="absolute inset-0 grid place-items-center rounded-xl bg-black/35 text-white">
          <Spinner />
        </span>
      )}
    </div>
  );
}

/**
 * Makes a sticker from a picture: photos are cropped to a square and styled; GIFs, WebP and PNG
 * can be added as they are. onDone(sticker, { send }).
 */
export function StickerMakerSheet({ file, onCancel, onDone, canSend = true }) {
  const asIs = canAddAsIs(file);
  const gif = /gif$/i.test(file?.type || '');
  const [step, setStep] = useState(gif && asIs ? 'asis' : asIs ? 'choose' : 'crop');
  const [cropped, setCropped] = useState(null);
  const [mode, setMode] = useState('photo');
  const [shape, setShape] = useState('rounded');
  const [outline, setOutline] = useState(true);
  const [caption, setCaption] = useState('');
  const [pack, setPack] = useState(DEFAULT_PACK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(stickerFileProblem(file));
  const [preview, setPreview] = useState(null);
  // Cut-out
  const [engine, setEngine] = useState('off'); // off | loading | ready | error
  const [stage, setStage] = useState(null);
  const [taps, setTaps] = useState([]);
  const [brush, setBrush] = useState('add');
  const [mask, setMask] = useState(null);
  const [cutting, setCutting] = useState(false);
  const [editingCut, setEditingCut] = useState(true);
  const [background, setBackground] = useState({ kind: 'none', color: BACKGROUND_COLORS[0], image: null });
  const cutter = useRef(null);
  const canvas = useRef(null);
  const bgInput = useRef(null);

  useEffect(() => {
    if (!file || (step !== 'asis' && step !== 'choose')) return undefined;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, step]);

  const cutoutReady = mode === 'cutout' && mask && keptShare(mask) > 0.002;
  const showSticker = step === 'style' && (mode === 'photo' || (cutoutReady && !editingCut));

  useEffect(() => {
    if (!showSticker || !cropped || !canvas.current) return;
    if (mode === 'cutout') {
      const N = cropped.naturalWidth || cropped.width;
      const b = keptBox(mask);
      const k = N / mask.width;
      drawSticker(canvas.current, cropped, {
        caption,
        outline,
        maskImage: maskCanvas(mask, N),
        box: b && { x: b.x * k, y: b.y * k, w: b.w * k, h: b.h * k },
        background,
      });
    } else drawSticker(canvas.current, cropped, { shape, caption, outline });
  }, [showSticker, cropped, mode, shape, caption, outline, mask, background]);

  // Cut-out: load the engine the first time, then give it this photo once.
  const startCutout = async () => {
    setMode('cutout');
    setEditingCut(true);
    if (cutter.current) return;
    setEngine('loading');
    try {
      const c = await getCutter(setStage);
      c.setImage(cropped);
      cutter.current = c;
      setEngine('ready');
    } catch (err) {
      setEngine('error');
      setError(err?.message || "The cut-out tool couldn't start.");
    }
  };
  const recut = (next) => {
    setTaps(next);
    if (!next.length) {
      setMask(null);
      return;
    }
    setCutting(true);
    // Let the spinner paint before the (blocking) model runs.
    setTimeout(() => {
      try {
        setMask(cutter.current.cut(next));
        setError(null);
      } catch (err) {
        setError(err?.message || 'The cut-out failed. Try tapping again.');
      } finally {
        setCutting(false);
      }
    }, 30);
  };

  const finish = async (send) => {
    setBusy(true);
    setError(null);
    try {
      let sticker;
      if (step === 'style') {
        const blob = await canvasToStickerBlob(canvas.current);
        sticker = await uploadSticker(stickerFile(blob, file?.name), { pack: pack.trim() || DEFAULT_PACK, width: STICKER_SIZE, height: STICKER_SIZE, made: true });
      } else {
        const size = await readImageSize(file);
        sticker = await uploadSticker(file, { pack: pack.trim() || DEFAULT_PACK, ...(size || {}) });
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

  const ready = step !== 'style' || (cropped && (mode === 'photo' || (cutoutReady && !editingCut)));

  return (
    <Sheet open={Boolean(file)} onClose={busy ? () => {} : onCancel} title={step === 'style' ? 'Style your sticker' : 'Add sticker'} full={step === 'style'}>
      <div className="px-4 pb-4" data-testid="sticker-maker">
        {step === 'style' && (
          <Segmented options={MODES} value={mode} onChange={(v) => (v === 'cutout' ? startCutout() : setMode('photo'))} label="Sticker type" className="mb-3" />
        )}

        {step === 'style' && mode === 'cutout' && editingCut ? (
          engine === 'loading' ? (
            <div className="grid aspect-square w-full max-w-[300px] mx-auto place-items-center rounded-xl border border-line-soft px-6 text-center" data-testid="cutout-loading">
              <div>
                <Spinner />
                <p className="mt-3 text-[14px] font-medium">{stage === 'model' ? 'Getting the cut-out tool ready…' : 'Downloading the cut-out tool…'}</p>
                <p className="mt-1 text-[12px] text-text-2">One-time download, about {CUTOUT_DOWNLOAD_MB} MB. It works on your phone: the photo isn't uploaded.</p>
              </div>
            </div>
          ) : engine === 'ready' ? (
            <>
              <CutoutCanvas image={cropped} mask={mask} taps={taps} busy={cutting} onTap={(p) => recut([...taps, { ...p, mode: brush }])} />
              <p className="mt-2 text-center text-[13px] text-text-2">
                {taps.length ? (brush === 'add' ? 'Tap more to add parts.' : 'Tap parts to take away.') : 'Tap the person or thing to keep.'}
              </p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <Button size="sm" variant={brush === 'add' ? 'primary' : 'secondary'} icon={Wand2} onClick={() => setBrush('add')}>
                  Keep
                </Button>
                <Button size="sm" variant={brush === 'remove' ? 'primary' : 'secondary'} icon={Eraser} onClick={() => setBrush('remove')} disabled={!taps.length}>
                  Remove
                </Button>
                <Button size="sm" variant="ghost" icon={Undo2} disabled={!taps.length || cutting} onClick={() => recut(taps.slice(0, -1))}>
                  Undo
                </Button>
              </div>
              <Button block className="mt-3" icon={Scissors} disabled={!cutoutReady || cutting} onClick={() => setEditingCut(false)} data-testid="cutout-done">
                Use this cut-out
              </Button>
            </>
          ) : (
            <div className="grid aspect-square w-full max-w-[300px] mx-auto place-items-center rounded-xl border border-line-soft px-6 text-center">
              <div>
                <p className="text-[14px] font-medium">The cut-out tool couldn't start.</p>
                <Button size="sm" className="mt-3" onClick={startCutout}>
                  Try again
                </Button>
              </div>
            </div>
          )
        ) : (
          <div className="mx-auto grid aspect-square w-full max-w-[260px] place-items-center rounded-xl border border-line-soft" style={CHECKER}>
            {step === 'style' ? (
              <canvas ref={canvas} aria-label="Sticker preview" className="aspect-square w-full" />
            ) : (
              preview && <img src={preview} alt="" className="max-h-full max-w-full object-contain" />
            )}
          </div>
        )}

        {step === 'choose' && (
          <p className="mt-3 text-center text-[13px] text-text-2">
            Add it as it is (keeps animation and see-through parts), or{' '}
            <button type="button" className="font-medium text-accent-ink" onClick={() => setStep('crop')} disabled={busy}>
              crop and style it
            </button>
            .
          </p>
        )}

        {showSticker && (
          <>
            {mode === 'cutout' ? (
              <>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-[13px] font-medium text-text-2">Background</p>
                  <button type="button" className="inline-flex items-center gap-1 text-[13px] font-medium text-accent-ink" onClick={() => setEditingCut(true)}>
                    <Icon as={Scissors} size={13} /> Edit cut-out
                  </button>
                </div>
                <div className="no-scrollbar -mx-4 mt-1.5 flex items-center gap-2 overflow-x-auto px-4" data-testid="sticker-backgrounds">
                  <button
                    type="button"
                    aria-label="No background"
                    aria-pressed={background.kind === 'none'}
                    onClick={() => setBackground((b) => ({ ...b, kind: 'none' }))}
                    className={cx('h-9 w-9 shrink-0 rounded-full border-2', background.kind === 'none' ? 'border-accent' : 'border-line')}
                    style={CHECKER}
                  />
                  {BACKGROUND_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Background ${c}`}
                      aria-pressed={background.kind === 'color' && background.color === c}
                      onClick={() => setBackground((b) => ({ ...b, kind: 'color', color: c }))}
                      className={cx('h-9 w-9 shrink-0 rounded-full border-2', background.kind === 'color' && background.color === c ? 'border-accent' : 'border-line')}
                      style={{ background: c }}
                    />
                  ))}
                  <button
                    type="button"
                    aria-label="Picture background"
                    aria-pressed={background.kind === 'image'}
                    onClick={() => bgInput.current?.click()}
                    className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 bg-surface text-text-2', background.kind === 'image' ? 'border-accent' : 'border-line')}
                  >
                    <Icon as={ImagePlus} size={16} />
                  </button>
                  <input
                    ref={bgInput}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (!f) return;
                      try {
                        const image = await loadImage(f);
                        setBackground((b) => ({ ...b, kind: 'image', image }));
                      } catch (err) {
                        setError(err.message);
                      }
                    }}
                  />
                </div>
              </>
            ) : (
              <>
                <p className="mt-3 mb-1.5 text-[13px] font-medium text-text-2">Shape</p>
                <Segmented options={SHAPES} value={shape} onChange={setShape} label="Shape" />
              </>
            )}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[14px]">White outline</span>
              <Toggle checked={outline} onChange={setOutline} label="White outline" />
            </div>
            <Field className="mt-3" label="Caption (optional)" value={caption} maxLength={CAPTION_MAX} placeholder="e.g. On it!" onChange={(e) => setCaption(e.target.value)} />
          </>
        )}

        {(step !== 'style' || showSticker) && <PackPicker value={pack} onChange={setPack} />}
        {mode === 'photo' && step === 'style' && (
          <p className="mt-3 flex items-center gap-1.5 text-[12px] text-text-3">
            <Icon as={Sparkles} size={12} /> Try <b className="font-semibold">Cut out</b> to keep only the person or thing, without the background.
          </p>
        )}
        {error && <p className="mt-2 text-center text-[13px] text-danger">{error}</p>}
        {(step !== 'style' || showSticker) && (
          <div className="mt-4 flex gap-2">
            <Button block variant="secondary" disabled={busy || !ready || Boolean(stickerFileProblem(file))} onClick={() => finish(false)} data-testid="sticker-save">
              Add to stickers
            </Button>
            {canSend && (
              <Button block loading={busy} disabled={!ready || Boolean(stickerFileProblem(file))} onClick={() => finish(true)} data-testid="sticker-save-send">
                Add & send
              </Button>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
