import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Download, Mic, Square, RefreshCw } from 'lucide-react';
import logger from '../../../../utils/logger';
import { useBlockMediaUrl, uploadBlockFile, downloadBlockFile, mediaStyles } from './mediaUtils';
import { MediaToolbar, UploadProgress, UploadButton } from './MediaChrome';

// The upload API accepts audio/mpeg|wav|ogg|mp4|x-m4a and video/webm. Chrome records
// WebM only, so a WebM recording is uploaded as video/webm (an <audio> element plays it).
function pickRecordingFormat() {
    const candidates = [
        { mime: 'audio/mp4', upload: 'audio/mp4', ext: 'm4a' },
        { mime: 'audio/ogg;codecs=opus', upload: 'audio/ogg', ext: 'ogg' },
        { mime: 'audio/webm;codecs=opus', upload: 'video/webm', ext: 'webm' },
        { mime: 'audio/webm', upload: 'video/webm', ext: 'webm' },
    ];
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return null;
    return candidates.find(c => MediaRecorder.isTypeSupported(c.mime)) || null;
}

const AudioBlock = ({
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
    const [isRecording, setIsRecording] = useState(false);
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const mediaRecorderRef = useRef(null);
    const timerRef = useRef(null);
    const autoStopRef = useRef(null);
    const { url, error, onMediaError } = useBlockMediaUrl(block.content);

    useEffect(() => () => {
        clearInterval(timerRef.current);
        clearTimeout(autoStopRef.current);
        if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    }, []);

    const uploadFile = async (file, okMessage = 'Audio uploaded') => {
        try {
            const res = await uploadBlockFile(file, { workspaceId, noteId, blockId: block.id, setUploadProgress });
            onBlockChange(block.id, res.url, { ...block.meta, name: res.name, size: res.size, mimeType: res.mimeType });
            showToast(okMessage, 'success');
        } catch (err) {
            logger.error('Audio upload error:', err);
            showToast(err.message || 'Failed to upload audio', 'error');
        }
    };

    const handleFile = (file) => {
        if (!file.type.startsWith('audio/')) { showToast('Please choose an audio file', 'error'); return; }
        uploadFile(file);
    };

    const handleDownload = async () => {
        try { await downloadBlockFile(block); } catch (err) {
            logger.error('Audio download error:', err);
            showToast('Failed to download audio', 'error');
        }
    };

    const startRecording = async () => {
        const format = pickRecordingFormat();
        if (!format) { showToast('Recording is not supported in this browser', 'error'); return; }
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
            showToast('Microphone access denied', 'error');
            return;
        }
        const mediaRecorder = new MediaRecorder(stream, { mimeType: format.mime });
        mediaRecorderRef.current = mediaRecorder;
        const chunks = [];
        mediaRecorder.addEventListener('dataavailable', event => { if (event.data?.size) chunks.push(event.data); });
        mediaRecorder.addEventListener('stop', () => {
            stream.getTracks().forEach(track => track.stop());
            clearInterval(timerRef.current);
            clearTimeout(autoStopRef.current);
            setIsRecording(false);
            setRecordingSeconds(0);
            if (!chunks.length) return;
            const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
            const file = new File(chunks, `recording-${stamp}.${format.ext}`, { type: format.upload });
            uploadFile(file, 'Recording saved');
        });

        mediaRecorder.start();
        setIsRecording(true);
        setRecordingSeconds(0);
        timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
        autoStopRef.current = setTimeout(() => {
            if (mediaRecorderRef.current?.state === 'recording') {
                mediaRecorderRef.current.stop();
                showToast('Recording stopped (60s limit)', 'info');
            }
        }, 60000);
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    };

    const formatTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

    if (readOnly && !block.content) return null;

    return (
        <div className="group relative mb-4">
            <div style={{ ...mediaStyles.frame, padding: block.content ? '14px 16px' : 0 }}>
                {block.content ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingRight: readOnly ? '40px' : '112px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '2px', background: 'var(--accent-dim)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Mic size={18} />
                        </div>
                        {error ? (
                            <p style={{ ...mediaStyles.error, padding: 0 }}>This audio could not be loaded.</p>
                        ) : (
                            <audio src={url || undefined} onError={onMediaError} controls style={{ flex: 1, height: '36px', minWidth: 0 }} />
                        )}
                    </div>
                ) : (
                    <div style={mediaStyles.empty}>
                        <Mic size={32} style={{ color: isRecording ? 'var(--state-danger)' : 'var(--text-muted)' }} className={isRecording ? 'animate-pulse' : ''} />
                        {isRecording ? (
                            <>
                                <p style={{ ...mediaStyles.emptyLabel, color: 'var(--state-danger)', fontWeight: 600 }}>Recording {formatTime(recordingSeconds)}</p>
                                <button type="button" onClick={stopRecording} style={{ ...mediaStyles.primaryBtn, background: 'var(--state-danger)', color: '#fff' }}>
                                    <Square size={12} fill="currentColor" /> Stop recording
                                </button>
                            </>
                        ) : (
                            <>
                                <p style={mediaStyles.emptyLabel}>Add audio</p>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button type="button" onClick={startRecording} style={mediaStyles.primaryBtn}>
                                        <Mic size={13} /> Record audio
                                    </button>
                                    <UploadButton id={`audio-upload-${block.id}`} accept="audio/*" label="Upload audio" onFile={handleFile} secondary />
                                </div>
                            </>
                        )}
                    </div>
                )}
                <MediaToolbar actions={readOnly ? [
                    block.content && { Icon: Download, title: 'Download audio', onClick: handleDownload },
                ] : [
                    block.content && { Icon: Download, title: 'Download audio', onClick: handleDownload },
                    block.content && { Icon: RefreshCw, title: 'Replace audio', onClick: () => onBlockChange(block.id, '', {}) },
                    { Icon: Trash2, title: 'Delete audio', onClick: () => onRemoveBlock(block.id), danger: true },
                ]} />
                <UploadProgress value={uploadProgress[block.id]} />
            </div>
        </div>
    );
};

export default AudioBlock;
