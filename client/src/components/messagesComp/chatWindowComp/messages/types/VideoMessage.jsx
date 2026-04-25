import React from "react";
import { ExternalLink } from "lucide-react";
import { toProxyUrl } from "../../../../../utils/gcsProxy";

export default function VideoMessage({ msg }) {
    const attachment = msg.attachment || {};
    const { name, sizeFormatted } = attachment;
    const proxyUrl = toProxyUrl(attachment);

    if (!proxyUrl) return null;

    return (
        <div style={{
            marginTop: '6px', maxWidth: '320px',
            borderRadius: '2px', overflow: 'hidden',
            border: '1px solid var(--border-default)',
        }}>
            <video
                src={proxyUrl}
                controls
                preload="metadata"
                style={{ width: '100%', maxHeight: '200px', backgroundColor: '#000', display: 'block' }}
            >
                Your browser does not support the video element.
            </video>
            <div style={{
                padding: '6px 10px',
                backgroundColor: 'var(--bg-active)',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontSize: '11px', color: 'var(--text-muted)',
            }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>{name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '8px' }}>
                    {sizeFormatted && <span>{sizeFormatted}</span>}
                    <a
                        href={proxyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--accent)', display: 'flex' }}
                        title="Open in new tab"
                    >
                        <ExternalLink size={12} />
                    </a>
                </div>
            </div>
        </div>
    );
}
