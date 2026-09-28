import React, { useEffect, useState } from "react";
import { FileText, Film, Archive, Sheet, File, Download, Eye, EyeOff, FileCode, Music, Image as ImageIcon, Presentation, ExternalLink, Loader2 } from "lucide-react";
import { toProxyUrl } from "../../../../../utils/gcsProxy";
import { useMediaUrl, getMediaUrl } from "../../../../../utils/mediaUrl";
import { formatBytes, downloadAttachment } from "../../../../../utils/uploadFile";
import CodeBlock from "../../../../../shared/components/messages/CodeBlock";

const PDF = { Icon: FileText, bg: 'rgba(224,82,82,0.10)', color: '#e05252' };
const DOC = { Icon: FileText, bg: 'rgba(184,149,106,0.12)', color: 'var(--accent)' };
const SHEET = { Icon: Sheet, bg: 'rgba(90,186,138,0.10)', color: '#5aba8a' };
const SLIDES = { Icon: Presentation, bg: 'rgba(230,140,60,0.12)', color: '#e68c3c' };
const ARCHIVE = { Icon: Archive, bg: 'rgba(201,168,124,0.12)', color: 'var(--accent-hover)' };
const VIDEO = { Icon: Film, bg: 'rgba(138,110,184,0.12)', color: '#8a6eb8' };
const AUDIO = { Icon: Music, bg: 'rgba(198,60,60,0.10)', color: 'var(--state-danger)' };
const IMAGE = { Icon: ImageIcon, bg: 'rgba(156,127,212,0.12)', color: '#9c7fd4' };
const CODE = { Icon: FileCode, bg: 'rgba(99,179,237,0.12)', color: '#63b3ed' };

// Extension -> syntax-highlighter language for text previews ('' = plain text).
const TEXT_LANG = {
    txt: '', log: '', md: 'markdown', csv: '', tsv: '', ini: '', cfg: '', conf: '', env: '',
    js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
    py: 'python', json: 'json', sh: 'bash', bash: 'bash', zsh: 'bash', css: 'css', scss: 'css', sql: 'sql',
    java: 'java', go: 'go', rb: 'ruby', rs: 'rust', c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', cs: 'csharp',
    php: 'php', kt: 'kotlin', swift: 'swift', yml: 'yaml', yaml: 'yaml', toml: '', xml: 'xml', html: 'html', svg: 'xml',
};
const TEXT_PREVIEW_MAX = 512 * 1024;

const extOf = (name = '') => (String(name).includes('.') ? String(name).split('.').pop().toLowerCase() : '');

function getFileInfo(name = '', mime = '') {
    const ext = extOf(name);
    const m = String(mime).toLowerCase();
    if (ext === 'pdf' || m === 'application/pdf') return PDF;
    if (['doc', 'docx', 'odt', 'rtf', 'pages'].includes(ext)) return DOC;
    if (['xls', 'xlsx', 'ods', 'csv', 'tsv', 'numbers'].includes(ext)) return SHEET;
    if (['ppt', 'pptx', 'odp', 'key'].includes(ext)) return SLIDES;
    if (['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2'].includes(ext)) return ARCHIVE;
    if (m.startsWith('video/') || ['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)) return VIDEO;
    if (m.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'ogg', 'flac'].includes(ext)) return AUDIO;
    if (m.startsWith('image/') || ['heic', 'heif', 'tif', 'tiff', 'svg', 'psd'].includes(ext)) return IMAGE;
    if (ext in TEXT_LANG && ext !== 'txt' && ext !== 'log') return CODE;
    return { Icon: File, bg: 'var(--bg-hover)', color: 'var(--text-secondary)' };
}

const iconBtn = {
    flexShrink: 0, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', padding: 4, borderRadius: 2,
};

export default function FileMessage({ msg, unavailableNote = null }) {
    const attachment = msg.attachment || {};
    const { name } = attachment;
    const sizeLabel = attachment.sizeFormatted || formatBytes(attachment.size);
    const hasFile = !!toProxyUrl(attachment);
    const { url: proxyUrl } = useMediaUrl(attachment);
    const [downloading, setDownloading] = useState(false);
    const [downloadError, setDownloadError] = useState(null);

    const ext = extOf(name);
    const mime = String(attachment.mimeType || '').toLowerCase();
    const isPdf = mime === 'application/pdf' || ext === 'pdf';
    const textLang = ext in TEXT_LANG ? TEXT_LANG[ext] : (mime.startsWith('text/') ? '' : null);
    const isText = textLang !== null && (attachment.size == null || attachment.size <= TEXT_PREVIEW_MAX);
    const canPreview = isPdf || isText;

    // Previews load the file into memory: a PDF goes into a blob: frame (the server's
    // strict headers keep the browser's viewer out of a direct frame), text is decoded
    // as UTF-8 and shown highlighted. Nothing from the file runs.
    const [preview, setPreview] = useState(null); // null | 'loading' | { url } | { text } | { error }
    useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview]);
    const togglePreview = async (e) => {
        e?.preventDefault();
        e?.stopPropagation();
        if (preview) { setPreview(null); return; }
        setPreview('loading');
        try {
            const url = await getMediaUrl(attachment, { fresh: true });
            const res = await fetch(url);
            if (!res.ok) throw new Error(String(res.status));
            const blob = await res.blob();
            if (isPdf) setPreview({ url: URL.createObjectURL(new Blob([blob], { type: 'application/pdf' })) });
            else setPreview({ text: new TextDecoder('utf-8').decode(await blob.arrayBuffer()) });
        } catch {
            setPreview({ error: true });
        }
    };

    const download = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDownloading(true);
        setDownloadError(null);
        try { await downloadAttachment(attachment); } catch { setDownloadError('Download failed — try again'); }
        setDownloading(false);
    };

    if (!hasFile) return null;

    const { Icon, bg, color } = getFileInfo(name, mime);

    return (
        <div data-testid="file-attachment" style={{ maxWidth: '100%' }}>
            <div
                role={canPreview ? 'button' : undefined}
                tabIndex={canPreview ? 0 : undefined}
                onClick={canPreview ? togglePreview : undefined}
                onKeyDown={canPreview ? (e) => { if (e.key === 'Enter' || e.key === ' ') togglePreview(e); } : undefined}
                title={canPreview ? (preview ? 'Hide preview' : 'Show preview') : name}
                style={{
                    marginTop: '6px', display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 10px 8px 12px',
                    backgroundColor: 'var(--bg-active)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '2px',
                    width: 'min(320px, 100%)',
                    cursor: canPreview ? 'pointer' : 'default',
                    transition: 'border-color 100ms ease, background-color 100ms ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.backgroundColor = 'var(--bg-active)'; }}
            >
                <div style={{ flexShrink: 0, width: '36px', height: '36px', borderRadius: '2px', backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={18} style={{ color }} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>
                        {name || "Attachment"}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {[ext ? ext.toUpperCase() : null, sizeLabel, unavailableNote].filter(Boolean).join(' · ')}
                    </div>
                </div>

                {canPreview && (
                    <button type="button" onClick={togglePreview} title={preview ? 'Hide preview' : (isPdf ? 'Preview PDF' : 'Preview file')}
                        aria-label={preview ? 'Hide preview' : 'Preview'} data-testid="file-preview-toggle" style={iconBtn}>
                        {preview ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                )}
                {isPdf && preview?.url && (
                    <a href={preview.url} target="_blank" rel="noopener noreferrer" title="Open in a new tab" aria-label="Open in a new tab"
                        onClick={(e) => e.stopPropagation()} style={iconBtn}>
                        <ExternalLink size={15} />
                    </a>
                )}
                <button type="button" onClick={download} disabled={!proxyUrl || downloading} title="Download" aria-label={`Download ${name || 'file'}`}
                    data-testid="file-download" style={iconBtn}>
                    {downloading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={15} />}
                </button>
            </div>
            {downloadError && <div style={{ fontSize: 11, color: 'var(--state-danger)', marginTop: 4 }}>{downloadError}</div>}
            {preview === 'loading' && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Loading preview…</div>}
            {preview?.error && <div style={{ fontSize: 11, color: 'var(--state-danger)', marginTop: 4 }}>Couldn’t load the preview.</div>}
            {preview?.url && (
                <iframe data-testid="pdf-preview" title={name || 'PDF preview'} src={preview.url}
                    style={{ display: 'block', marginTop: 6, width: 'min(640px, 100%)', height: 480, border: '1px solid var(--border-default)', borderRadius: 2, background: '#fff' }} />
            )}
            {typeof preview?.text === 'string' && (
                <div data-testid="text-preview" style={{ width: 'min(640px, 100%)' }}>
                    <CodeBlock language={textLang} code={preview.text} filename={name} runnable={false} />
                </div>
            )}
        </div>
    );
}
