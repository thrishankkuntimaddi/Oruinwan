import React from 'react';
import { Trash2, Download, RefreshCw, Image as ImageIcon } from 'lucide-react';
import logger from '../../../../utils/logger';
import { useBlockMediaUrl, uploadBlockFile, downloadBlockFile, mediaStyles } from './mediaUtils';
import { MediaToolbar, UploadProgress, UploadButton } from './MediaChrome';

const ImageBlock = ({
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
    const { url, error, onMediaError } = useBlockMediaUrl(block.content, { allowDataImage: true });

    const handleFile = async (file) => {
        if (!file.type.startsWith('image/')) { showToast('Please choose an image file', 'error'); return; }
        try {
            const res = await uploadBlockFile(file, { workspaceId, noteId, blockId: block.id, setUploadProgress });
            onBlockChange(block.id, res.url, { ...block.meta, name: res.name, size: res.size, mimeType: res.mimeType });
            showToast('Image uploaded', 'success');
        } catch (err) {
            logger.error('Image upload error:', err);
            showToast(err.message || 'Failed to upload image', 'error');
        }
    };

    const handleDownload = async () => {
        try { await downloadBlockFile(block); } catch (err) {
            logger.error('Image download error:', err);
            showToast('Failed to download image', 'error');
        }
    };

    if (readOnly && !block.content) return null;

    return (
        <div className="group relative mb-4">
            <div style={mediaStyles.frame}>
                {block.content ? (
                    <div style={{ minHeight: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-active)' }}>
                        {error ? (
                            <p style={mediaStyles.error}>This image could not be loaded.</p>
                        ) : url ? (
                            <img src={url} onError={onMediaError} alt={block.meta?.name || 'Note image'} style={{ width: '100%', maxHeight: '384px', objectFit: 'contain', display: 'block' }} />
                        ) : (
                            <div style={{ width: '100%', height: '160px', background: 'var(--bg-hover)' }} />
                        )}
                    </div>
                ) : (
                    <div style={mediaStyles.empty}>
                        <ImageIcon size={32} style={{ color: 'var(--text-muted)' }} />
                        <p style={mediaStyles.emptyLabel}>Add an image</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '360px' }}>
                            <UploadButton id={`img-upload-${block.id}`} accept="image/*" label="Upload from device" onFile={handleFile} />
                            <input
                                type="text"
                                placeholder="Or paste an image URL and press Enter"
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
                {!readOnly ? (
                    <MediaToolbar actions={[
                        block.content && { Icon: Download, title: 'Download image', onClick: handleDownload },
                        block.content && { Icon: RefreshCw, title: 'Replace image', onClick: () => onBlockChange(block.id, '', {}) },
                        { Icon: Trash2, title: 'Delete image', onClick: () => onRemoveBlock(block.id), danger: true },
                    ]} />
                ) : (
                    <MediaToolbar actions={[{ Icon: Download, title: 'Download image', onClick: handleDownload }]} />
                )}
                <UploadProgress value={uploadProgress[block.id]} />
            </div>
        </div>
    );
};

export default ImageBlock;
