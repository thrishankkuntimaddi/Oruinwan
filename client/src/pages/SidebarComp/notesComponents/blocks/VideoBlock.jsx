import React from 'react';
import { Trash2, Download, Video, RefreshCw } from 'lucide-react';
import logger from '../../../../utils/logger';
import { useBlockMediaUrl, uploadBlockFile, downloadBlockFile, mediaStyles, isStoredFile } from './mediaUtils';
import { MediaToolbar, UploadProgress, UploadButton } from './MediaChrome';

/** YouTube / Vimeo embed URL for a pasted link, or null. */
function embedUrlOf(content) {
    if (!content || isStoredFile(content)) return null;
    let u;
    try { u = new URL(content); } catch { return null; }
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtube.com' && u.searchParams.get('v')) return `https://www.youtube.com/embed/${encodeURIComponent(u.searchParams.get('v'))}`;
    if (host === 'youtube.com' && u.pathname.startsWith('/embed/')) return `https://www.youtube.com${u.pathname}`;
    if (host === 'youtu.be') return `https://www.youtube.com/embed/${encodeURIComponent(u.pathname.slice(1))}`;
    if (host === 'vimeo.com') {
        const vid = u.pathname.split('/').filter(Boolean).pop();
        if (/^\d+$/.test(vid || '')) return `https://player.vimeo.com/video/${vid}`;
    }
    return null;
}

const VideoBlock = ({
    block,
    onBlockChange,
    onRemoveBlock,
    workspaceId,
    noteId,
    uploadProgress = {},
    setUploadProgress,
    showToast,
    readOnly = false,
}) => {
    const embed = embedUrlOf(block.content);
    const { url, error, onMediaError } = useBlockMediaUrl(embed ? null : block.content);

    const handleFile = async (file) => {
        if (!file.type.startsWith('video/')) { showToast('Please choose a video file', 'error'); return; }
        try {
            const res = await uploadBlockFile(file, { workspaceId, noteId, blockId: block.id, setUploadProgress });
            onBlockChange(block.id, res.url, { ...block.meta, name: res.name, size: res.size, mimeType: res.mimeType });
            showToast('Video uploaded', 'success');
        } catch (err) {
            logger.error('Video upload error:', err);
            showToast(err.message || 'Failed to upload video', 'error');
        }
    };

    const handleDownload = async () => {
        try { await downloadBlockFile(block); } catch (err) {
            logger.error('Video download error:', err);
            showToast('Failed to download video', 'error');
        }
    };

    if (readOnly && !block.content) return null;

    return (
        <div className="group relative mb-4">
            <div style={mediaStyles.frame}>
                {block.content ? (
                    <div style={{ background: '#000' }}>
                        {embed ? (
                            <iframe
                                style={{ width: '100%', aspectRatio: '16 / 9', border: 0, display: 'block' }}
                                src={embed}
                                title="Embedded video"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                sandbox="allow-scripts allow-same-origin allow-presentation"
                                allowFullScreen
                            />
                        ) : error ? (
                            <p style={mediaStyles.error}>This video could not be loaded.</p>
                        ) : url ? (
                            <video style={{ width: '100%', maxHeight: '384px', display: 'block' }} controls playsInline src={url} onError={onMediaError} />
                        ) : (
                            <div style={{ width: '100%', aspectRatio: '16 / 9', background: 'var(--bg-hover)' }} />
                        )}
                    </div>
                ) : (
                    <div style={mediaStyles.empty}>
                        <Video size={32} style={{ color: 'var(--text-muted)' }} />
                        <p style={mediaStyles.emptyLabel}>Add a video</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '360px' }}>
                            <UploadButton id={`video-upload-${block.id}`} accept="video/*" label="Upload video file" onFile={handleFile} />
                            <input
                                type="text"
                                placeholder="Or paste a YouTube, Vimeo or video URL and press Enter"
                                style={mediaStyles.input}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.target.value.trim()) {
                                        onBlockChange(block.id, e.target.value.trim(), { ...block.meta });
                                        e.target.value = '';
                                    }
                                }}
                            />
                        </div>
                    </div>
                )}
                <MediaToolbar actions={readOnly ? [
                    block.content && !embed && { Icon: Download, title: 'Download video', onClick: handleDownload },
                ] : [
                    block.content && !embed && { Icon: Download, title: 'Download video', onClick: handleDownload },
                    block.content && { Icon: RefreshCw, title: 'Replace video', onClick: () => onBlockChange(block.id, '', {}) },
                    { Icon: Trash2, title: 'Delete video', onClick: () => onRemoveBlock(block.id), danger: true },
                ]} />
                <UploadProgress value={uploadProgress[block.id]} />
            </div>
        </div>
    );
};

export default VideoBlock;
