import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button, IconButton, Notice } from '../settingsUi';
import './account.css';

/**
 * Library of generated avatars (DiceBear, the same service avatarUtils uses
 * for default avatars). Picking one renders it to a PNG in the browser and
 * uploads it like any other photo, so the server never stores an SVG.
 */

const STYLES = {
    Illustrated: 'lorelei-neutral',
    Notion: 'notionists-neutral',
    Minimal: 'micah',
    Geometric: 'identicon',
    Abstract: 'rings',
    Shapes: 'shapes',
    Classic: 'miniavs',
};

const SEEDS = {
    Illustrated: ['Alexandra', 'Jordan', 'Morgan', 'Cameron', 'Avery', 'Quinn', 'Riley', 'Reese', 'Sage', 'Emery', 'Parker', 'Hayden', 'Finley', 'River', 'Kendall'],
    Notion: ['Atlas', 'Cleo', 'Darwin', 'Elliot', 'Fable', 'Glen', 'Haven', 'Inigo', 'Jules', 'Knox', 'Lael', 'Maren', 'Noel', 'Orion', 'Piper'],
    Minimal: ['Adam', 'Benjamin', 'Charles', 'Daniel', 'Edward', 'Francis', 'George', 'Hannah', 'Isabelle', 'Julian', 'Katrina', 'Leonard', 'Margaret', 'Nathan', 'Olivia'],
    Geometric: ['Alpha01', 'Beta02', 'Gamma03', 'Delta04', 'Epsilon05', 'Zeta06', 'Eta07', 'Theta08', 'Iota09', 'Kappa10', 'Lambda11', 'Mu12', 'Nu13', 'Xi14', 'Omicron15'],
    Abstract: ['Cobalt', 'Crimson', 'Dune', 'Eclipse', 'Flux', 'Granite', 'Horizon', 'Indigo', 'Jasper', 'Lunar', 'Marble', 'Nordic', 'Onyx', 'Prism'],
    Shapes: ['Apex', 'Bolt', 'Core', 'Drive', 'Edge', 'Forge', 'Grid', 'Hub', 'Ion', 'Jolt', 'Key', 'Link', 'Matrix', 'Node'],
    Classic: Array.from({ length: 16 }, (_, i) => `Prof${i + 1}`),
};

const LIBRARY = Object.entries(SEEDS).flatMap(([cat, seeds]) => seeds.map((seed) => ({ cat, seed, key: `${cat}|${seed}` })));
const CATEGORIES = ['All', ...Object.keys(STYLES)];

export const avatarSvgUrl = ({ cat, seed }) =>
    `https://api.dicebear.com/7.x/${STYLES[cat] || 'identicon'}/svg?seed=${encodeURIComponent(seed)}&size=128&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf,f8f8f8`;

/** Fetch the avatar SVG and draw it into a 400×400 PNG blob. */
export async function renderAvatarPng(avatar, size = 400) {
    const res = await fetch(avatarSvgUrl(avatar));
    if (!res.ok) throw new Error('Could not load that avatar. Check your connection and try again.');
    const svg = await res.text();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    try {
        const img = await new Promise((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = () => reject(new Error('Could not draw that avatar'));
            el.src = url;
        });
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        canvas.getContext('2d').drawImage(img, 0, 0, size, size);
        return await new Promise((resolve, reject) => {
            canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not draw that avatar'))), 'image/png');
        });
    } finally {
        URL.revokeObjectURL(url);
    }
}

/** One avatar. DiceBear can rate-limit a burst of requests, so a failed image retries twice. */
function AvatarTile({ avatar, selected, onToggle, onPick }) {
    const [attempt, setAttempt] = useState(0);
    const [failed, setFailed] = useState(false);
    const [waiting, setWaiting] = useState(false);
    const timer = useRef(null);
    useEffect(() => () => clearTimeout(timer.current), []);

    const onError = () => {
        if (attempt >= 2) { setFailed(true); return; }
        setWaiting(true);
        timer.current = setTimeout(() => { setWaiting(false); setAttempt((n) => n + 1); }, 800 * (attempt + 1));
    };
    const src = avatarSvgUrl(avatar) + (attempt ? `&r=${attempt}` : '');

    return (
        <button
            type="button"
            className="stg-acc-tile"
            aria-pressed={selected}
            aria-label={`${avatar.cat} avatar ${avatar.seed}`}
            title={failed ? 'Could not load this avatar' : `${avatar.cat} · ${avatar.seed}`}
            onClick={onToggle}
            onDoubleClick={onPick}
            disabled={failed}
        >
            {!failed && !waiting && <img key={attempt} src={src} alt="" loading="lazy" width={56} height={56} onError={onError} />}
        </button>
    );
}

export default function AvatarPicker({ open, busy, error, onSelect, onClose }) {
    const [category, setCategory] = useState('All');
    const [selected, setSelected] = useState(null);
    const dialogRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
        document.addEventListener('keydown', onKey);
        const t = setTimeout(() => dialogRef.current?.querySelector('.stg-acc-chip')?.focus(), 0);
        return () => { document.removeEventListener('keydown', onKey); clearTimeout(t); };
    }, [open, busy, onClose]);

    useEffect(() => { if (open) setSelected(null); }, [open]);

    const shown = useMemo(() => (category === 'All' ? LIBRARY : LIBRARY.filter((a) => a.cat === category)), [category]);
    const picked = LIBRARY.find((a) => a.key === selected) || null;

    if (!open) return null;
    return createPortal(
        <div className="stg">
            <div className="stg-dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
                <div className="stg-dialog stg-acc-picker" data-size="lg" role="dialog" aria-modal="true" aria-labelledby="stg-acc-picker-title" ref={dialogRef}>
                    <div className="stg-acc-picker-head">
                        <div>
                            <h3 id="stg-acc-picker-title">Choose an avatar</h3>
                            <p>{LIBRARY.length} avatars in {CATEGORIES.length - 1} styles</p>
                        </div>
                        <IconButton label="Close" onClick={onClose} disabled={busy}><X size={15} /></IconButton>
                    </div>

                    <div className="stg-acc-chips" role="toolbar" aria-label="Avatar style">
                        {CATEGORIES.map((c) => (
                            <button key={c} type="button" className="stg-acc-chip" aria-pressed={category === c} onClick={() => setCategory(c)}>
                                {c}
                            </button>
                        ))}
                    </div>

                    <div className="stg-acc-grid">
                        {shown.map((a) => (
                            <AvatarTile
                                key={a.key}
                                avatar={a}
                                selected={selected === a.key}
                                onToggle={() => setSelected(selected === a.key ? null : a.key)}
                                onPick={() => !busy && onSelect(a)}
                            />
                        ))}
                    </div>

                    {error && <div className="stg-acc-pad-bottom"><Notice tone="danger">{error}</Notice></div>}

                    <div className="stg-acc-picker-foot">
                        <span className="stg-acc-grow">{picked ? `${picked.cat} · ${picked.seed}` : 'Select an avatar'}</span>
                        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
                        <Button variant="primary" onClick={() => picked && onSelect(picked)} disabled={!picked} loading={busy}>
                            {busy ? 'Applying…' : 'Use avatar'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}
