import React from 'react';
import { Trash2, Download, Mic } from 'lucide-react';
import { uploadNoteAttachment } from '../../../../utils/uploadHelpers';

const AudioBlock = ({
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

                showToast('Audio uploaded successfully', 'success');
            } catch (error) {
                console.error('Upload error:', error);
                showToast('Failed to upload audio', 'error');
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
            showToast('Failed to download audio', 'error');
        }
    };

    const handleRecord = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            const audioChunks = [];

            mediaRecorder.addEventListener("dataavailable", event => {
                audioChunks.push(event.data);
            });

            mediaRecorder.addEventListener("stop", () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                const reader = new FileReader();
                reader.onload = () => {
                    onBlockChange(block.id, reader.result);
                };
                reader.readAsDataURL(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            });

            // Start recording
            mediaRecorder.start();

            // Stop after 60 seconds or on user action
            showToast("Recording... Click again to stop", "info");

            // Store the recorder on the button for stopping
            const stopRecording = () => {
                mediaRecorder.stop();
            };

            // Auto-stop after 60 seconds
            setTimeout(stopRecording, 60000);

        } catch (err) {
            showToast("Microphone access denied", "error");
        }
    };

    return (
        <div className="group relative mb-4">
            <div className="w-full max-w-2xl rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 relative group">
                {block.content ? (
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
                            <Mic size={24} />
                        </div>
                        <audio
                            src={block.content}
                            controls
                            className="flex-1"
                            style={{ height: '40px' }}
                        />
                        <button
                            onClick={handleDownload}
                            className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                            title="Download audio"
                        >
                            <Download size={18} />
                        </button>
                        <button
                            onClick={() => onRemoveBlock(block.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Delete audio"
                        >
                            <Trash2 size={18} />
                        </button>
                        <button
                            onClick={() => onBlockChange(block.id, '')}
                            className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Change audio"
                        >
                            <Mic size={18} />
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4">
                        <Mic size={48} className="text-gray-400" />
                        <p className="text-sm font-medium text-gray-600">Add audio</p>
                        <div className="flex gap-3">
                            <button
                                onClick={handleRecord}
                                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                            >
                                <Mic size={16} />
                                Record Audio
                            </button>
                            <input
                                type="file"
                                accept="audio/*"
                                onChange={handleFileUpload}
                                className="hidden"
                                id={`audio-upload-${block.id}`}
                            />
                            <label
                                htmlFor={`audio-upload-${block.id}`}
                                className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                                Upload Audio
                            </label>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AudioBlock;
