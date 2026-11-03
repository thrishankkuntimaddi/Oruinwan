import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import SquareCropDialog from '../../shared/components/media/SquareCropDialog';
import {
    CAPTION_MAX, canAddAsIs, canvasToStickerBlob, drawSticker, loadImage, stickerFile, stickerFileProblem, STICKER_SIZE,
} from '@platform/media/stickerMaker.js';
import { groupByPack, uploadSticker, useStickers } from './stickerStore';
import { readImageSize } from '../../utils/uploadFile';

const SHAPES = [
    { id: 'rounded', label: 'Rounded' },
    { id: 'circle', label: 'Circle' },
    { id: 'full', label: 'No frame' },
];

const overlay = { position: 'fixed', inset: 0, zIndex: 400, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font)' };
const card = { background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 2, width: 'min(380px, calc(100vw - 32px))', padding: 16 };
const label = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', margin: '12px 0 4px' };
const input = { width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 13, background: 'var(--bg-input, var(--bg-active))', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 2, fontFamily: 'var(--font)' };
// A checkerboard behind the preview, so the transparent parts show.
const checker = { backgroundColor: 'var(--bg-active)', backgroundImage: 'linear-gradient(45deg, var(--bg-hover) 25%, transparent 25%, transparent 75%, var(--bg-hover) 75%), linear-gradient(45deg, var(--bg-hover) 25%, transparent 25%, transparent 75%, var(--bg-hover) 75%)', backgroundSize: '16px 16px', backgroundPosition: '0 0, 8px 8px' };

/**
 * Turns a picture into a sticker in the person's library. Photos are cropped to a square,
 * then get a shape, a white outline and an optional caption. GIFs (and WebP/PNG, which may be
 * animated or transparent) can be added as they are.
 * onDone(sticker, { send }) — send is true for "Add & send".
 */
export default function StickerMakerDialog({ file, onCancel, onDone, canSend = false }) {
    const asIsAllowed = canAddAsIs(file);
    const isGif = /gif$/i.test(file?.type || '');
    const [step, setStep] = useState(isGif && asIsAllowed ? 'asis' : asIsAllowed ? 'choose' : 'crop');
    const [cropped, setCropped] = useState(null); // <img> of the square crop
    const [shape, setShape] = useState('rounded');
    const [caption, setCaption] = useState('');
    const { stickers } = useStickers();
    const packs = useMemo(() => groupByPack(stickers).map((p) => p.name), [stickers]);
    const [pack, setPack] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(stickerFileProblem(file));
    const canvasRef = useRef(null);
    const [asIsUrl, setAsIsUrl] = useState(null);

    useEffect(() => {
        if (step !== 'asis' && step !== 'choose') return undefined;
        const url = URL.createObjectURL(file);
        setAsIsUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [file, step]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape' && step !== 'crop') onCancel?.(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onCancel, step]);

    useEffect(() => {
        if (step === 'style' && cropped && canvasRef.current) drawSticker(canvasRef.current, cropped, { shape, caption });
    }, [step, cropped, shape, caption]);

    const finish = async (send) => {
        setBusy(true);
        setError(null);
        try {
            let sticker;
            if (step === 'asis' || step === 'choose') {
                const size = await readImageSize(file);
                sticker = await uploadSticker(file, { pack: pack.trim(), ...(size || {}) });
            } else {
                const blob = await canvasToStickerBlob(canvasRef.current);
                sticker = await uploadSticker(stickerFile(blob, file?.name), { pack: pack.trim(), width: STICKER_SIZE, height: STICKER_SIZE, made: true });
            }
            onDone?.(sticker, { send });
        } catch (err) {
            setError(err.message || 'The sticker could not be added');
            setBusy(false);
        }
    };

    if (step === 'crop') {
        return (
            <SquareCropDialog
                file={file}
                title="Make a sticker"
                onCancel={onCancel}
                onDone={async (blob) => {
                    try {
                        setCropped(await loadImage(blob));
                        setStep('style');
                    } catch (err) {
                        setError(err.message);
                        setStep('style');
                    }
                }}
            />
        );
    }

    const title = step === 'style' ? 'Style your sticker' : 'Add sticker';
    return (
        <div role="dialog" aria-modal="true" aria-label={title} data-testid="sticker-maker" style={overlay}
            onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel?.(); }}>
            <div className="anim-pop-in" style={card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h3>
                    <button type="button" aria-label="Close" onClick={onCancel} disabled={busy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
                </div>

                <div style={{ ...checker, width: 200, height: 200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 2 }}>
                    {step === 'style'
                        ? <canvas ref={canvasRef} aria-label="Sticker preview" style={{ width: 200, height: 200 }} />
                        : asIsUrl && <img src={asIsUrl} alt="" style={{ maxWidth: 200, maxHeight: 200, objectFit: 'contain' }} />}
                </div>

                {step === 'choose' && (
                    <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
                        Add it as it is (keeps animation and see-through parts), or{' '}
                        <button type="button" className="gl-link" onClick={() => setStep('crop')} disabled={busy}
                            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font)' }}>
                            crop and style it
                        </button>.
                    </p>
                )}

                {step === 'style' && (
                    <>
                        <span style={label}>Shape</span>
                        <div role="radiogroup" aria-label="Shape" style={{ display: 'flex', gap: 6 }}>
                            {SHAPES.map((s) => (
                                <button key={s.id} type="button" role="radio" aria-checked={shape === s.id} onClick={() => setShape(s.id)}
                                    className={`gl-btn gl-btn--sm ${shape === s.id ? 'gl-btn--primary' : 'gl-btn--ghost'}`} style={{ flex: 1 }}>
                                    {s.label}
                                </button>
                            ))}
                        </div>
                        <label style={label} htmlFor="sticker-caption">Caption (optional)</label>
                        <input id="sticker-caption" style={input} value={caption} maxLength={CAPTION_MAX}
                            placeholder="e.g. On it!" onChange={(e) => setCaption(e.target.value)} />
                    </>
                )}

                <label style={label} htmlFor="sticker-pack">Pack</label>
                <input id="sticker-pack" style={input} list="sticker-packs" value={pack} maxLength={40}
                    placeholder="My stickers" onChange={(e) => setPack(e.target.value)} />
                <datalist id="sticker-packs">{packs.map((p) => <option key={p} value={p} />)}</datalist>

                {error && <p role="alert" style={{ color: 'var(--state-danger)', fontSize: 12, margin: '8px 0 0' }}>{error}</p>}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                    <button type="button" className="gl-btn gl-btn--ghost gl-btn--sm" onClick={onCancel} disabled={busy}>Cancel</button>
                    <button type="button" className="gl-btn gl-btn--ghost gl-btn--sm" data-testid="sticker-save"
                        onClick={() => finish(false)} disabled={busy || (step === 'style' && !cropped) || !!stickerFileProblem(file)}>
                        {busy ? 'Adding…' : 'Add to stickers'}
                    </button>
                    {canSend && (
                        <button type="button" className="gl-btn gl-btn--primary gl-btn--sm" data-testid="sticker-save-send"
                            onClick={() => finish(true)} disabled={busy || (step === 'style' && !cropped) || !!stickerFileProblem(file)}>
                            Add & send
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
