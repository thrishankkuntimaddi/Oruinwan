import React, { useEffect, useId, useRef, useState } from "react";
import { toProxyUrl } from "../../../../../utils/gcsProxy";
import { useMediaUrl } from "../../../../../utils/mediaUrl";
import { formatBytes } from "../../../../../utils/uploadFile";
import MediaLightbox, { registerLightboxImage } from "./MediaLightbox";
import FileMessage from "./FileMessage";

const MAX_W = 320;
const MAX_H = 280;

/** Display box for an image of w×h that fits MAX_W×MAX_H, keeping its aspect ratio. */
function fitBox(w, h) {
    if (!w || !h) return null;
    const scale = Math.min(1, MAX_W / w, MAX_H / h);
    return { width: Math.max(40, Math.round(w * scale)), height: Math.max(40, Math.round(h * scale)) };
}

export default function ImageMessage({ msg }) {
    const attachment = msg.attachment || {};
    const { name } = attachment;
    const sizeLabel = attachment.sizeFormatted || formatBytes(attachment.size);
    const hasFile = !!toProxyUrl(attachment);
    const { url: proxyUrl, error: signError, refresh, attempt } = useMediaUrl(attachment);
    const [lightbox, setLightbox] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [broken, setBroken] = useState(false);
    const [natural, setNatural] = useState(null);
    const boxRef = useRef(null);
    const id = useId();

    useEffect(() => {
        if (!hasFile || broken || !boxRef.current) return undefined;
        return registerLightboxImage(id, attachment, boxRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, hasFile, broken, attachment.url]);

    if (!hasFile) return null;
    // A failed load is retried once with a freshly signed link (they expire); after that,
    // formats the browser can't draw (or a file that is gone) show as a file card.
    if (broken || signError) return <FileMessage msg={msg} unavailableNote={broken ? 'Preview unavailable' : null} />;

    const box = fitBox(attachment.width || natural?.w, attachment.height || natural?.h) || { width: 240, height: 180 };

    return (
        <>
            <button
                type="button"
                ref={boxRef}
                data-testid="image-attachment"
                onClick={() => setLightbox(true)}
                title={name ? `Open ${name}` : 'Open image'}
                style={{
                    marginTop: '6px', display: 'block', padding: 0, textAlign: 'left',
                    width: box.width, maxWidth: '100%',
                    borderRadius: '2px', overflow: 'hidden',
                    border: '1px solid var(--border-default)', background: 'var(--bg-active)',
                    cursor: 'zoom-in', transition: 'border-color 100ms ease',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
            >
                <div style={{ width: '100%', aspectRatio: `${box.width} / ${box.height}`, position: 'relative', background: loaded ? 'transparent' : 'var(--bg-hover)' }}>
                    {proxyUrl && (
                        <img
                            src={proxyUrl}
                            alt={name || "Image"}
                            loading="lazy"
                            decoding="async"
                            onLoad={(e) => { setLoaded(true); if (!attachment.width) setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight }); }}
                            onError={() => (attempt < 1 ? refresh() : setBroken(true))}
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: loaded ? 1 : 0, transition: 'opacity 150ms ease' }}
                        />
                    )}
                </div>
                {(name || sizeLabel) && (
                    <div style={{
                        padding: '4px 10px', display: 'flex', justifyContent: 'space-between',
                        backgroundColor: 'var(--bg-active)', borderTop: '1px solid var(--border-subtle)',
                        fontSize: '10px', color: 'var(--text-muted)',
                    }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{name}</span>
                        {sizeLabel && <span style={{ flexShrink: 0, marginLeft: '8px' }}>{sizeLabel}</span>}
                    </div>
                )}
            </button>

            {lightbox && <MediaLightbox startId={id} onClose={() => setLightbox(false)} />}
        </>
    );
}
