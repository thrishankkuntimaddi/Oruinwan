// "Turn me into a cat": pick a photo and a look, Oruinwan AI (Google Gemini) makes a fun
// picture, then it opens in the sticker maker to cut out and style. Limited per day by plan.
import { useEffect, useRef, useState } from 'react';
import { Flag, ImagePlus, RefreshCw, Sparkles, Wand2 } from 'lucide-react';
import { openExternal } from '../../native/index.js';
import { Sheet } from '../../ui/Overlay.jsx';
import { Button } from '../../ui/Button.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Spinner } from '../../ui/Feedback.jsx';
import { Field } from '../../ui/Controls.jsx';
import { cx } from '../../ui/cx.js';
import { AI_LOOKS, makeAiPicture } from './stickers.js';

function useObjectUrl(file) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!file) return setUrl(null);
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}

/** onUse(file) hands the AI picture to the sticker maker. */
export function AiPictureSheet({ open, onClose, onUse }) {
  const [photo, setPhoto] = useState(null);
  const [look, setLook] = useState('cat');
  const [own, setOwn] = useState('');
  const [result, setResult] = useState(null); // { file, used, max }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const input = useRef(null);
  const photoUrl = useObjectUrl(photo);
  const resultUrl = useObjectUrl(result?.file);

  useEffect(() => {
    if (open) return;
    setPhoto(null);
    setResult(null);
    setError(null);
    setBusy(false);
  }, [open]);

  const make = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await makeAiPicture(photo, { style: look, prompt: look === 'custom' ? own : undefined }));
    } catch (err) {
      setError(err?.message || "The AI couldn't make that picture.");
    } finally {
      setBusy(false);
    }
  };
  const canMake = photo && !busy && (look !== 'custom' || own.trim().length > 2);

  return (
    <Sheet open={open} onClose={busy ? () => {} : onClose} title="AI fun picture" full>
      <div className="px-4 pb-4" data-testid="ai-picture-sheet">
        <button
          type="button"
          onClick={() => !busy && input.current?.click()}
          className="relative mx-auto grid aspect-square w-full max-w-[280px] place-items-center overflow-hidden rounded-xl border border-dashed border-line bg-surface-2"
          aria-label={photo ? 'Pick another photo' : 'Pick a photo'}
        >
          {resultUrl || photoUrl ? (
            <img src={resultUrl || photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-2 text-text-2">
              <Icon as={ImagePlus} size={28} />
              <span className="text-[14px] font-medium">Pick a photo</span>
              <span className="text-[12px]">A face or a pet works best</span>
            </span>
          )}
          {busy && (
            <span className="absolute inset-0 grid place-items-center bg-black/45 text-white">
              <span className="flex flex-col items-center gap-2">
                <Spinner />
                <span className="text-[13px] font-medium">Making your picture… (up to a minute)</span>
              </span>
            </span>
          )}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) {
              setPhoto(f);
              setResult(null);
              setError(null);
            }
          }}
        />

        <p className="mt-4 mb-1.5 text-[13px] font-medium text-text-2">Turn into</p>
        <div className="grid grid-cols-5 gap-2" data-testid="ai-looks">
          {[...AI_LOOKS, { id: 'custom', label: 'Describe', emoji: '✏️' }].map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={look === l.id}
              onClick={() => setLook(l.id)}
              disabled={busy}
              className={cx('flex flex-col items-center gap-0.5 rounded-xl border py-2 text-[11px] font-medium', look === l.id ? 'border-accent bg-accent/12 text-accent-ink' : 'border-line text-text-2')}
            >
              <span className="text-[22px] leading-none" aria-hidden>
                {l.emoji}
              </span>
              {l.label}
            </button>
          ))}
        </div>
        {look === 'custom' && <Field className="mt-3" label="Describe the look" value={own} maxLength={200} placeholder="e.g. a superhero penguin" onChange={(e) => setOwn(e.target.value)} />}

        {error && <p className="mt-3 text-center text-[13px] text-danger">{error}</p>}
        {result && (
          <button
            type="button"
            className="mx-auto mt-2 flex items-center gap-1 text-[12px] text-text-3"
            onClick={() =>
              openExternal(
                `mailto:admin@poelys.com?subject=${encodeURIComponent('Report an AI picture')}&body=${encodeURIComponent(`The AI picture made from the "${look}" look was offensive or wrong.\n\nWhat was wrong:\n`)}`,
              )
            }
          >
            <Icon as={Flag} size={12} /> Report this picture
          </button>
        )}
        {result?.max != null && <p className="mt-3 text-center text-[12px] text-text-3">{Math.max(0, result.max - result.used)} AI pictures left today</p>}

        <div className="mt-4 flex gap-2">
          {result ? (
            <>
              <Button block variant="secondary" icon={RefreshCw} disabled={!canMake} onClick={make}>
                Try again
              </Button>
              <Button block icon={Wand2} onClick={() => onUse(result.file)} data-testid="ai-picture-use">
                Make sticker
              </Button>
            </>
          ) : (
            <Button block icon={Sparkles} disabled={!canMake} loading={busy} onClick={make} data-testid="ai-picture-make">
              Make it
            </Button>
          )}
        </div>
        <p className="mt-3 text-center text-[11px] text-text-3">
          Made by Oruinwan AI with Google Gemini. Your photo is sent to make the picture and isn't kept. Only use photos of people who agree.
        </p>
      </div>
    </Sheet>
  );
}
