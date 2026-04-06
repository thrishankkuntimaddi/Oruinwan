/**
 * ImageMessage.jsx — Phase 7.1 Attachments
 * Renders an inline image with a click-to-expand lightbox.
 */
import React, { useState } from "react";
import { X, ExternalLink } from "lucide-react";
import { toProxyUrl } from "../../../../../utils/gcsProxy";

export default function ImageMessage({ msg }) {
    const attachment = msg.attachment || {};
    const { name, sizeFormatted } = attachment;
    const proxyUrl = toProxyUrl(attachment);
    const [lightbox, setLightbox] = useState(false);

    if (!proxyUrl) return null;

    return (
        <>
            {/* Thumbnail */}
            <div
                style={{
                    marginTop: '6px', display: 'inline-block', maxWidth: '280px',
                    borderRadius: '2px', overflow: 'hidden',
                    border: '1px solid var(--border-default)',
                    cursor: 'zoom-in',
                    transition: 'border-color 100ms ease',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                onClick={() => setLightbox(true)}
            >
                <img
                    src={proxyUrl}
                    alt={name || "Image"}
                    style={{ maxWidth: '100%', maxHeight: '220px', objectFit: 'cover', display: 'block' }}
                    loading="lazy"
                />
                {sizeFormatted && (
                    <div style={{
                        padding: '4px 10px', display: 'flex', justifyContent: 'space-between',
                        backgroundColor: 'var(--bg-active)', borderTop: '1px solid var(--border-subtle)',
                        fontSize: '10px', color: 'var(--text-muted)',
                    }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>{name}</span>
                        <span style={{ flexShrink: 0, marginLeft: '8px' }}>{sizeFormatted}</span>
                    </div>
                )}
            </div>

            {/* Lightbox */}
            {lightbox && (
                <div
                    style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
                    onClick={() => setLightbox(false)}
                >
                    <div
                        style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <img
                            src={proxyUrl}
                            alt={name}
                            style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '2px' }}
                        />
                        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>{name}</span>
                            <a href={proxyUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.55)', display: 'flex' }} title="Open in new tab">
                                <ExternalLink size={14} />
                            </a>
                        </div>
                        <button
                            onClick={() => setLightbox(false)}
                            style={{ position: 'absolute', top: '-12px', right: '-12px', width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.12)', border: 'none', outline: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', transition: '100ms ease' }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.22)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'}
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
