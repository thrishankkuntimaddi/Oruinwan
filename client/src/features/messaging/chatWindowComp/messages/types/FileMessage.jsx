import React, { useEffect, useState } from "react";
import { FileText, Film, Archive, Sheet, File, Download, Eye, EyeOff } from "lucide-react";
import { toProxyUrl } from "../../../../../utils/gcsProxy";
import { useMediaUrl } from "../../../../../utils/mediaUrl";

const ICON_MAP = {
    pdf:  { Icon: FileText, bg: 'rgba(224,82,82,0.10)',  color: '#e05252' },
    doc:  { Icon: FileText, bg: 'rgba(184,149,106,0.12)', color: 'var(--accent)' },
    docx: { Icon: FileText, bg: 'rgba(184,149,106,0.12)', color: 'var(--accent)' },
    xls:  { Icon: Sheet,    bg: 'rgba(90,186,138,0.10)',  color: '#5aba8a' },
    xlsx: { Icon: Sheet,    bg: 'rgba(90,186,138,0.10)',  color: '#5aba8a' },
    csv:  { Icon: Sheet,    bg: 'rgba(90,186,138,0.10)',  color: '#5aba8a' },
    zip:  { Icon: Archive,  bg: 'rgba(201,168,124,0.12)', color: 'var(--accent-hover)' },
    rar:  { Icon: Archive,  bg: 'rgba(201,168,124,0.12)', color: 'var(--accent-hover)' },
    mp4:  { Icon: Film,     bg: 'rgba(138,110,184,0.12)', color: '#8a6eb8' },
    mov:  { Icon: Film,     bg: 'rgba(138,110,184,0.12)', color: '#8a6eb8' },
};

function getFileInfo(name = '') {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    return ICON_MAP[ext] || { Icon: File, bg: 'var(--bg-hover)', color: 'var(--text-secondary)' };
}

export default function FileMessage({ msg }) {
    const attachment = msg.attachment || {};
    const { name, sizeFormatted } = attachment;
    const hasFile = !!toProxyUrl(attachment);
    const { url: proxyUrl } = useMediaUrl(attachment);

    // PDFs preview inline. The file is loaded into a blob: the server's strict
    // headers (CSP sandbox) would stop the browser's PDF viewer in a frame.
    const isPdf = (attachment.mimeType || '').toLowerCase() === 'application/pdf' || /\.pdf$/i.test(name || '');
    const [preview, setPreview] = useState(null); // null | 'loading' | { url } | { error }
    useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview]);
    const togglePreview = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (preview) { setPreview(null); return; }
        if (!proxyUrl) return;
        setPreview('loading');
        try {
            const res = await fetch(proxyUrl);
            if (!res.ok) throw new Error(String(res.status));
            const blob = await res.blob();
            setPreview({ url: URL.createObjectURL(new Blob([blob], { type: 'application/pdf' })) });
        } catch {
            setPreview({ error: true });
        }
    };

    if (!hasFile) return null;

    const { Icon, bg, color } = getFileInfo(name);

    return (
        <div>
        <a
            href={proxyUrl || undefined}
            target="_blank"
            rel="noopener noreferrer"
            style={{
                marginTop: '6px', display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 12px',
                backgroundColor: 'var(--bg-active)',
                border: '1px solid var(--border-default)',
                borderRadius: '2px',
                maxWidth: '280px',
                textDecoration: 'none',
                transition: 'border-color 100ms ease, background-color 100ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.backgroundColor = 'var(--bg-active)'; }}
        >
            {}
            <div style={{ flexShrink: 0, width: '36px', height: '36px', borderRadius: '2px', backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} style={{ color }} />
            </div>

            {}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name || "Attachment"}
                </div>
                {sizeFormatted && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {sizeFormatted}
                    </div>
                )}
            </div>

            {isPdf && (
                <button type="button" onClick={togglePreview} title={preview ? 'Hide preview' : 'Preview PDF'}
                    style={{ flexShrink: 0, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
                    {preview ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
            )}
            {}
            <div style={{ flexShrink: 0, color: 'var(--text-muted)' }}>
                <Download size={15} />
            </div>
        </a>
        {preview === 'loading' && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Loading preview…</div>}
        {preview?.error && <div style={{ fontSize: 11, color: 'var(--state-danger)', marginTop: 4 }}>Could not load the preview.</div>}
        {preview?.url && (
            <iframe data-testid="pdf-preview" title={name || 'PDF preview'} src={preview.url}
                style={{ display: 'block', marginTop: 6, width: 'min(560px, 100%)', height: 420, border: '1px solid var(--border-default)', borderRadius: 2 }} />
        )}
        </div>
    );
}
