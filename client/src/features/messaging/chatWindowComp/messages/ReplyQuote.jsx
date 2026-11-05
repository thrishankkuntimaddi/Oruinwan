import React from 'react';
import { MessageSquare } from 'lucide-react';
import { useMediaUrl } from '../../../../utils/mediaUrl';

/** What a quoted picture or video is called ("Photo", "Sticker"…), or null for documents. */
export function quoteMediaLabel(a) {
    if (!a) return null;
    const type = String(a.mimeType || a.type || '');
    if (a.variant === 'sticker') return 'Sticker';
    if (a.variant === 'gif' || /gif$/i.test(type)) return 'GIF';
    if (/^image\//i.test(type) || a.type === 'image') return 'Photo';
    if (/^video\//i.test(type) || a.type === 'video') return 'Video';
    if (/^audio\//i.test(type) || a.type === 'voice' || a.type === 'audio') return 'Voice message';
    return null;
}

function Thumb({ attachment }) {
    const { url } = useMediaUrl(attachment);
    const type = String(attachment.mimeType || attachment.type || '');
    const video = /^video\//i.test(type) || attachment.type === 'video';
    const image = /^image\//i.test(type) || attachment.type === 'image';
    if (!video && !image) return null;
    return (
        <span data-testid="reply-quote-thumb" style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 6, overflow: 'hidden', background: 'var(--bg-hover)' }}>
            {url && image && <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: attachment.variant === 'sticker' ? 'contain' : 'cover', display: 'block' }} />}
            {url && video && <video src={`${url}#t=0.1`} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
        </span>
    );
}

/**
 * The message a reply quotes: who wrote it and a line of it. A quoted photo, video or sticker shows
 * a small preview and "Photo" instead of its file name (26380.webp).
 */
export default function ReplyQuote({ repliedTo }) {
    if (!repliedTo) return null;
    const a = repliedTo.attachment || null;
    const label = quoteMediaLabel(a);
    const raw = repliedTo.payload?.text || '';
    const caption = a && raw.trim() === String(a.name || '').trim() ? '' : raw;
    const text = label ? [label, caption].filter(Boolean).join(' · ') : raw || (a?.name || '🔒 Encrypted message');
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', padding: '0 4px' }} data-testid="reply-quote">
            <div style={{ width: '2px', backgroundColor: 'var(--accent)', borderRadius: '1px', flexShrink: 0, alignSelf: 'stretch', opacity: 0.6 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                    <MessageSquare size={10} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>{repliedTo.senderName}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.5 }}>
                    {text}
                </div>
            </div>
            {a && <Thumb attachment={a} />}
        </div>
    );
}
