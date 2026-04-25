import React from "react";
import { FileText, Film, Archive, Sheet, File, Download } from "lucide-react";
import { toProxyUrl } from "../../../../../utils/gcsProxy";

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
    const proxyUrl = toProxyUrl(attachment);

    if (!proxyUrl) return null;

    const { Icon, bg, color } = getFileInfo(name);

    return (
        <a
            href={proxyUrl}
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

            {}
            <div style={{ flexShrink: 0, color: 'var(--text-muted)' }}>
                <Download size={15} />
            </div>
        </a>
    );
}
