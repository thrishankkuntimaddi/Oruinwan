/**
 * LinkPreviewMessage.jsx — Phase 7.5
 * Renders an Open Graph / link preview card below message text.
 */
import React, { useState } from 'react';
import { ExternalLink, Globe } from 'lucide-react';

export default function LinkPreviewMessage({ preview }) {
    const [imgError, setImgError] = useState(false);

    if (!preview?.url) return null;
    const { url, title, description, image, site } = preview;

    let siteLabel = site || '';
    try {
        if (!siteLabel) siteLabel = new URL(url).hostname.replace(/^www\./, '');
    } catch { /* ignore */ }

    const hasImage = image && !imgError;

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginTop: '6px', display: 'block', maxWidth: '320px', textDecoration: 'none' }}
            onClick={e => e.stopPropagation()}
        >
            <div
                style={{
                    borderRadius: '2px',
                    border: '1px solid var(--border-accent)',
                    backgroundColor: 'var(--bg-active)',
                    overflow: 'hidden',
                    transition: 'border-color 120ms ease',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
            >
                {/* Left accent bar */}
                <div style={{ display: 'flex' }}>
                    <div style={{ width: '3px', backgroundColor: 'var(--accent)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Image */}
                        {hasImage && (
                            <div style={{ width: '100%', height: '120px', backgroundColor: 'var(--bg-hover)', overflow: 'hidden' }}>
                                <img
                                    src={image}
                                    alt={title || 'Link preview'}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={() => setImgError(true)}
                                />
                            </div>
                        )}

                        {/* Text body */}
                        <div style={{ padding: '8px 10px' }}>
                            {/* Site */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                                <Globe size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {siteLabel}
                                </span>
                            </div>

                            {/* Title */}
                            {title && (
                                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 3px', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {title}
                                </p>
                            )}

                            {/* Description */}
                            {description && (
                                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 6px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {description}
                                </p>
                            )}

                            {/* URL */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <ExternalLink size={10} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                                <span style={{ fontSize: '10px', color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </a>
    );
}
