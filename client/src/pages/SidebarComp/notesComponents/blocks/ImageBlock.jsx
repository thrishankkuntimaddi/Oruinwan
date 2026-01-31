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
            <div className="w-full max-w-2xl rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 relative group-hover:shadow-sm transition-all">
                <div className="min-h-64 flex items-center justify-center text-gray-400 dark:text-gray-500 relative">
                    {block.content ? (
                        <img src={block.content} alt="Note" className="w-full h-full object-contain max-h-96" />
                    ) : (
                        <div className="flex flex-col items-center p-8">
                            <ImageIcon size={48} className="mb-4 text-gray-300" />
                            <p className="text-sm font-medium text-gray-600 mb-4">Add an image</p>
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
                                    className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors text-center"
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
                        className="absolute top-2 right-2 p-1.5 bg-white/80 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                        title="Delete image"
                    >
                        <Trash2 size={16} />
                    </button>
                    {block.content && !block.content.startsWith('data:') && (
                        <button
                            onClick={handleDownload}
                            className="absolute top-2 right-12 p-1.5 bg-white/80 hover:bg-green-50 text-gray-500 hover:text-green-600 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                            title="Download image"
                        >
                            <Download size={16} />
                        </button>
                    )}
                    {block.content && (
                        <button
                            onClick={() => onBlockChange(block.id, '')}
                            className="absolute top-2 left-2 p-1.5 bg-white/80 hover:bg-blue-50 text-gray-500 hover:text-blue-600 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
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
                                        className="h-full bg-blue-500 transition-all duration-300"
                                        style={{ width: `${uploadProgress[block.id]}%` }}
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
