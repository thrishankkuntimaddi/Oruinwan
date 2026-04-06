import React from 'react';
import { Trash2, Download, Video } from 'lucide-react';
import { uploadNoteAttachment } from '../../../../utils/uploadHelpers';

const VideoBlock = ({
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
                setUploadProgress(prev => ({ ...prev, [block.id]: 0 }));

                const result = await uploadNoteAttachment(
                    file,
                    workspaceId,
                    noteId,
                    (progress) => {
                        setUploadProgress(prev => ({ ...prev, [block.id]: progress }));
                    }
                );

                onBlockChange(block.id, result.url);

                setUploadProgress(prev => {
                    const newProgress = { ...prev };
                    delete newProgress[block.id];
                    return newProgress;
                });

                showToast('Video uploaded successfully', 'success');
            } catch (error) {
                console.error('Upload error:', error);
                showToast('Failed to upload video', 'error');
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
            showToast('Failed to download video', 'error');
        }
    };

    const isEmbeddedVideo = block.content && (
        block.content.includes('youtube.com') ||
        block.content.includes('youtu.be') ||
        block.content.includes('vimeo.com')
    );

    return (
        <div className="group relative mb-4">
            <div className="w-full max-w-2xl rounded-xl overflow-hidden bg-gray-900 border border-gray-200 relative group">
                <div className="min-h-64 flex items-center justify-center text-gray-500 relative">
                    {block.content ? (
                        <div className="w-full">
                            {block.content.includes('youtube.com') || block.content.includes('youtu.be') ? (
                                <iframe
                                    className="w-full aspect-video"
                                    src={block.content.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                                    title="YouTube video"
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                ></iframe>
                            ) : block.content.includes('vimeo.com') ? (
                                <iframe
                                    className="w-full aspect-video"
                                    src={`https://player.vimeo.com/video/${block.content.split('/').pop()}`}
                                    title="Vimeo video"
                                    frameBorder="0"
                                    allow="autoplay; fullscreen; picture-in-picture"
                                    allowFullScreen
                                ></iframe>
                            ) : (
                                <video className="w-full max-h-96" controls>
                                    <source src={block.content} />
                                    Your browser does not support the video tag.
                                </video>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center p-8">
                            <Video size={48} className="mb-4 text-gray-400" />
                            <p className="text-sm font-medium text-gray-300 mb-4">Add a video</p>
                            <div className="flex flex-col gap-3 w-full max-w-md">
                                <input
                                    type="text"
                                    placeholder="Paste YouTube, Vimeo, or video URL..."
                                    className="w-full px-4 py-2 border border-gray-600 bg-gray-800 text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter' && e.target.value.trim()) {
                                            onBlockChange(block.id, e.target.value.trim());
                                            e.target.value = '';
                                        }
                                    }}
                                />
                                <input
                                    type="file"
                                    accept="video/*"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    id={`video-upload-${block.id}`}
                                />
                                <label
                                    htmlFor={`video-upload-${block.id}`}
                                    style={{ display: 'block', width: '100%', padding: '8px 20px', background: '#b8956a', color: '#0c0c0c', fontSize: '12px', fontWeight: 700, textAlign: 'center', cursor: 'pointer', border: 'none', fontFamily: 'Inter, system-ui, sans-serif', transition: 'opacity 150ms ease' }}
                                    onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                                >
                                    Upload video file
                                </label>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => onRemoveBlock(block.id)}
                        className="absolute top-2 right-2 p-1.5 bg-white/10 hover:bg-red-500/20 text-white/70 hover:text-red-400 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                        title="Delete video"
                    >
                        <Trash2 size={16} />
                    </button>
                    {block.content && !isEmbeddedVideo && (
                        <button
                            onClick={handleDownload}
                            className="absolute top-2 right-12 p-1.5 bg-white/10 hover:bg-green-500/20 text-white/70 hover:text-green-400 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                            title="Download video"
                        >
                            <Download size={16} />
                        </button>
                    )}
                    {block.content && (
                        <button
                            onClick={() => onBlockChange(block.id, '')}
                            className="absolute top-2 left-2 p-1.5 bg-white/10 hover:bg-blue-500/20 text-white/70 hover:text-blue-400 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                            title="Change video"
                        >
                            <Video size={16} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VideoBlock;
