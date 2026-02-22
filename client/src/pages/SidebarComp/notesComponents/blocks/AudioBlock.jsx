import React, { useState, useRef } from 'react';
import { Trash2, Download, Mic, Square } from 'lucide-react';
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
    const [isRecording, setIsRecording] = useState(false);
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const mediaRecorderRef = useRef(null);
    const timerRef = useRef(null);
    const autoStopRef = useRef(null);

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

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            const audioChunks = [];

            mediaRecorder.addEventListener('dataavailable', event => {
                audioChunks.push(event.data);
            });

            mediaRecorder.addEventListener('stop', () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                const reader = new FileReader();
                reader.onload = () => {
                    onBlockChange(block.id, reader.result);
                };
                reader.readAsDataURL(audioBlob);
                stream.getTracks().forEach(track => track.stop());

                // Clear timers
                clearInterval(timerRef.current);
                clearTimeout(autoStopRef.current);
                setIsRecording(false);
                setRecordingSeconds(0);
            });

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingSeconds(0);

            // Ticker
            timerRef.current = setInterval(() => {
                setRecordingSeconds(s => s + 1);
            }, 1000);

            // Auto-stop after 60 seconds
            autoStopRef.current = setTimeout(() => {
                if (mediaRecorderRef.current?.state === 'recording') {
                    mediaRecorderRef.current.stop();
                    showToast('Recording stopped (60s limit)', 'info');
                }
            }, 60000);

            showToast('Recording... click Stop when done', 'info');
        } catch (err) {
            showToast('Microphone access denied', 'error');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
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
                            title="Re-record audio"
                        >
                            <Mic size={18} />
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4">
                        <Mic size={48} className={`${isRecording ? 'text-red-500 animate-pulse' : 'text-gray-400'}`} />

                        {isRecording ? (
                            /* Recording in progress UI */
                            <div className="flex flex-col items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                                    <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                                        Recording {formatTime(recordingSeconds)}
                                    </span>
                                </div>
                                <button
                                    onClick={stopRecording}
                                    className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-md"
                                >
                                    <Square size={14} fill="white" />
                                    Stop Recording
                                </button>
                            </div>
                        ) : (
                            /* Idle UI */
                            <div className="flex flex-col items-center gap-2">
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Add audio</p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={startRecording}
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

                        {/* Upload progress */}
                        {uploadProgress[block.id] !== undefined && (
                            <div className="w-full max-w-xs">
                                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 transition-all duration-300"
                                        style={{ width: `${uploadProgress[block.id]}%` }}
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-1 text-center">{uploadProgress[block.id]}%</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AudioBlock;
