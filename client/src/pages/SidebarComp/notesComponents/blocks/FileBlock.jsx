import React from 'react';
import { Trash2, Download, Paperclip, FileText, RefreshCw } from 'lucide-react';
import logger from '../../../../utils/logger';
import { uploadBlockFile, downloadBlockFile, mediaStyles, fileNameOf, formatBytes } from './mediaUtils';
import { MediaToolbar, UploadProgress, UploadButton } from './MediaChrome';

// Matches the document types the upload API accepts.
const ACCEPT = '.pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';

const FileBlock = ({
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
    const handleFile = async (file) => {
        try {
            const res = await uploadBlockFile(file, { workspaceId, noteId, blockId: block.id, setUploadProgress });
            onBlockChange(block.id, res.url, { ...block.meta, name: res.name, size: res.size, mimeType: res.mimeType });
            showToast('File uploaded', 'success');
        } catch (err) {
            logger.error('File upload error:', err);
            showToast(err.message || 'Failed to upload file', 'error');
        }
    };

    const handleDownload = async () => {
        try { await downloadBlockFile(block); } catch (err) {
            logger.error('File download error:', err);
            showToast('Failed to download file', 'error');
        }
    };

    if (readOnly && !block.content) return null;

    return (
        <div className="group relative mb-4">
            <div style={mediaStyles.frame}>
                {block.content ? (
                    <button type="button" onClick={handleDownload} title="Download"
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', paddingRight: readOnly ? '16px' : '96px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)' }}>
                        <span style={{ width: '36px', height: '36px', borderRadius: '2px', background: 'var(--accent-dim)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <FileText size={18} />
                        </span>
                        <span style={{ minWidth: 0, flex: 1 }}>
                            <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileNameOf(block)}</span>
                            <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>{[formatBytes(block.meta?.size), 'Click to download'].filter(Boolean).join(' · ')}</span>
                        </span>
                    </button>
                ) : (
                    <div style={mediaStyles.empty}>
                        <Paperclip size={32} style={{ color: 'var(--text-muted)' }} />
                        <p style={mediaStyles.emptyLabel}>Attach a file (PDF, Word or text, up to 10 MB)</p>
                        <UploadButton id={`file-upload-${block.id}`} accept={ACCEPT} label="Choose file" onFile={handleFile} />
                    </div>
                )}
                {!readOnly && (
                    <MediaToolbar actions={[
                        block.content && { Icon: Download, title: 'Download file', onClick: handleDownload },
                        block.content && { Icon: RefreshCw, title: 'Replace file', onClick: () => onBlockChange(block.id, '', {}) },
                        { Icon: Trash2, title: 'Delete file', onClick: () => onRemoveBlock(block.id), danger: true },
                    ]} />
                )}
                <UploadProgress value={uploadProgress[block.id]} />
            </div>
        </div>
    );
};

export default FileBlock;
