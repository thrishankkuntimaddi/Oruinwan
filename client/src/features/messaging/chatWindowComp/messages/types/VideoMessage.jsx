import React, { useRef, useState } from "react";
import { Download, Maximize2, Play, Monitor, Loader2 } from "lucide-react";
import { toProxyUrl } from "../../../../../utils/gcsProxy";
import { useMediaUrl } from "../../../../../utils/mediaUrl";
import { formatBytes, downloadAttachment } from "../../../../../utils/uploadFile";
import { formatClock } from "../../../../../utils/mediaRecording";

// "#t=0.1" makes browsers (Safari included) paint a first frame as the poster.
const withPosterFrame = (url) => (url && !url.includes('#') ? `${url}#t=0.1` : url);

function enterFullscreen(el) {
    if (!el) return;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (el.webkitEnterFullscreen) el.webkitEnterFullscreen(); // iOS Safari
}

/** A round camera note: tap to play/pause with sound, button for full screen. */
function VideoNote({ src, duration, onError }) {
    const ref = useRef(null);
    const [playing, setPlaying] = useState(false);
    const [time, setTime] = useState(0);
    const [mediaDuration, setMediaDuration] = useState(0);
    const toggle = () => {
        const v = ref.current;
        if (!v) return;
        if (v.paused) { v.muted = false; v.play().catch(() => {}); } else v.pause();
    };
    const total = mediaDuration > 0 ? mediaDuration : duration;
    return (
        <div data-testid="video-note" style={{ marginTop: 6, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <button type="button" onClick={toggle} aria-label={playing ? 'Pause video note' : 'Play video note'}
                style={{
                    position: 'relative', width: 200, height: 200, borderRadius: '50%', overflow: 'hidden', padding: 0,
                    border: `3px solid ${playing ? 'var(--accent)' : 'var(--border-accent)'}`, background: '#000', cursor: 'pointer',
                }}>
                <video ref={ref} src={withPosterFrame(src)} preload="metadata" playsInline
                    onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setTime(0); }}
                    onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)} onError={onError}
                    onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) setMediaDuration(d); }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                {!playing && (
                    <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Play size={20} color="#fff" style={{ marginLeft: 3 }} />
                        </span>
                    </span>
                )}
                <span style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', fontSize: 11, color: '#fff', background: 'rgba(0,0,0,0.55)', padding: '1px 7px', borderRadius: 8, fontVariantNumeric: 'tabular-nums' }}>
                    {formatClock(playing || time ? time : total)}
                </span>
            </button>
            <button type="button" onClick={() => enterFullscreen(ref.current)} title="Full screen" aria-label="Full screen"
                style={{ background: 'none', border: '1px solid var(--border-default)', borderRadius: 2, padding: 5, color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
                <Maximize2 size={13} />
            </button>
        </div>
    );
}

export default function VideoMessage({ msg }) {
    const attachment = msg.attachment || {};
    const { name } = attachment;
    const sizeLabel = attachment.sizeFormatted || formatBytes(attachment.size);
    const hasFile = !!toProxyUrl(attachment);
    const { url: proxyUrl, refresh, attempt } = useMediaUrl(attachment);
    const [failed, setFailed] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const onError = () => (attempt < 2 ? refresh() : setFailed(true)); // expired signed link: re-sign

    if (!hasFile) return null;

    if (attachment.variant === 'video_note' && !failed) {
        return <VideoNote src={proxyUrl} duration={Number(attachment.duration) || 0} onError={onError} />;
    }

    const ratio = attachment.width && attachment.height ? `${attachment.width} / ${attachment.height}` : '16 / 9';
    const download = async (e) => {
        e.preventDefault();
        setDownloading(true);
        try { await downloadAttachment(attachment); } catch { /* ignore */ }
        setDownloading(false);
    };

    return (
        <div data-testid="video-attachment" style={{
            marginTop: '6px', width: 'min(360px, 100%)',
            borderRadius: '2px', overflow: 'hidden',
            border: '1px solid var(--border-default)',
        }}>
            {failed ? (
                <div style={{ aspectRatio: ratio, maxHeight: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#aaa', fontSize: 12, padding: 12, textAlign: 'center' }}>
                    This video can’t be played here. Download it to watch.
                </div>
            ) : (
                <video
                    src={withPosterFrame(proxyUrl) || undefined}
                    controls
                    playsInline
                    preload="metadata"
                    onError={onError}
                    style={{ width: '100%', maxHeight: '260px', aspectRatio: ratio, backgroundColor: '#000', display: 'block' }}
                >
                    Your browser does not support the video element.
                </video>
            )}
            <div style={{
                padding: '6px 10px',
                backgroundColor: 'var(--bg-active)',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontSize: '11px', color: 'var(--text-muted)',
            }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden', minWidth: 0 }}>
                    {attachment.variant === 'screen_recording' && <Monitor size={11} style={{ flexShrink: 0 }} />}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '8px' }}>
                    {attachment.duration > 0 && <span>{formatClock(attachment.duration)}</span>}
                    {sizeLabel && <span>{sizeLabel}</span>}
                    <button type="button" onClick={download} title="Download" aria-label={`Download ${name || 'video'}`}
                        style={{ color: 'var(--accent)', display: 'flex', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                        {downloading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={12} />}
                    </button>
                </div>
            </div>
        </div>
    );
}
