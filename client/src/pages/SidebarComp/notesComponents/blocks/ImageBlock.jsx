import React from 'react';
import { Trash2, Download, Image as ImageIcon } from 'lucide-react';
import { uploadNoteAttachment } from '../../../../utils/uploadHelpers';

const ImageBlock = ({
    block,
    onBlockChange,
    onRemoveBlock,
    workspaceId,
    noteId,
    uploadProgress,
    setUploadProgress,
    showToast
}) => {
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                // Show upload progress
                setUploadProgress(prev => ({ ...prev, [block.id]: 0 }));

                // Upload file
                const result = await uploadNoteAttachment(
                    file,
                    workspaceId,
                    noteId,
                    (progress) => {
                        setUploadProgress(prev => ({ ...prev, [block.id]: progress }));
                    }
                );

                // Update block with file URL
                onBlockChange(block.id, result.url);

                // Clear upload progress
                setUploadProgress(prev => {
                    const newProgress = { ...prev };
                    delete newProgress[block.id];
                    return newProgress;
                });

                showToast('Image uploaded successfully', 'success');
            } catch (error) {
                console.error('Upload error:', error);
                showToast('Failed to upload image', 'error');
                setUploadProgress(prev => {
                    const newProgress = { ...prev };
                    delete newProgress[block.id];
                    return newProgress;
                });
            }
        }
    };

    const handleDownload = async () => {
        try {
            const filename = block.content.split('/').pop();
            const link = document.createElement('a');
            link.href = block.content;
            link.download = filename;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('Download started', 'success');
        } catch (error) {
            console.error('Download error:', error);
            showToast('Failed to download image', 'error');
        }
    };

    return (
        <div className="group relative mb-4">
            <div style={{ width: '100%', maxWidth: '672px', overflow: 'hidden', background: '#111', border: '1px solid rgba(255,255,255,0.08)', position: 'relative' }} className="group">
                <div className="min-h-64 flex items-center justify-center text-gray-400 dark:text-gray-500 relative">
                    {block.content ? (
                        <img src={block.content} alt="Note" className="w-full h-full object-contain max-h-96" />
                    ) : (
                        <div className="flex flex-col items-center p-8">
                            <ImageIcon size={48} className="mb-4 text-gray-300" />
                            <p style={{ fontSize: '12px', fontWeight: 500, color: 'rgba(228,228,228,0.35)', marginBottom: '16px' }}>Add an image</p>
                            <div className="flex flex-col gap-3 w-full max-w-md">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    id={`img-upload-${block.id}`}
                                />
                                <label
                                    htmlFor={`img-upload-${block.id}`}
                                    style={{ display: 'block', width: '100%', padding: '8px 20px', background: '#b8956a', color: '#0c0c0c', fontSize: '12px', fontWeight: 700, textAlign: 'center', cursor: 'pointer', border: 'none', fontFamily: 'Inter, system-ui, sans-serif', transition: 'opacity 150ms ease' }}
                                    onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                                >
                                    Upload from device
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Or paste image URL..."
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm theme-input outline-none"
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter' && e.target.value.trim()) {
                                                onBlockChange(block.id, e.target.value.trim());
                                                e.target.value = '';
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => onRemoveBlock(block.id)}
                        style={{ position: 'absolute', top: '8px', right: '8px', padding: '6px', background: 'rgba(0,0,0,0.55)', color: 'rgba(228,228,228,0.6)', border: 'none', cursor: 'pointer', opacity: 0, transition: 'all 150ms ease', backdropFilter: 'blur(4px)' }}
                        className="group-hover:!opacity-100"
                        onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.6)'}
                        title="Delete image"
                    >
                        <Trash2 size={16} />
                    </button>
                    {block.content && !block.content.startsWith('data:') && (
                        <button
                            onClick={handleDownload}
                        style={{ position: 'absolute', top: '8px', right: '44px', padding: '6px', background: 'rgba(0,0,0,0.55)', color: 'rgba(228,228,228,0.6)', border: 'none', cursor: 'pointer', opacity: 0, transition: 'all 150ms ease', backdropFilter: 'blur(4px)' }}
                        className="group-hover:!opacity-100"
                        onMouseEnter={e => e.currentTarget.style.color = '#34d399'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.6)'}
                            title="Download image"
                        >
                            <Download size={16} />
                        </button>
                    )}
                    {block.content && (
                        <button
                            onClick={() => onBlockChange(block.id, '')}
                        style={{ position: 'absolute', top: '8px', left: '8px', padding: '6px', background: 'rgba(0,0,0,0.55)', color: 'rgba(228,228,228,0.6)', border: 'none', cursor: 'pointer', opacity: 0, transition: 'all 150ms ease', backdropFilter: 'blur(4px)' }}
                        className="group-hover:!opacity-100"
                        onMouseEnter={e => { e.currentTarget.style.color = '#b8956a'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(228,228,228,0.6)'; }}
                            title="Change image"
                        >
                            <ImageIcon size={16} />
                        </button>
                    )}
                    {uploadProgress[block.id] !== undefined && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
                            <div className="text-white text-center">
                                <div className="mb-2">Uploading...</div>
                                <div className="w-48 h-2 bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full transition-all duration-300"
                                        style={{ width: `${uploadProgress[block.id]}%`, background: '#b8956a' }}
                                    />
                                </div>
                                <div className="mt-2 text-sm">{uploadProgress[block.id]}%</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImageBlock;
