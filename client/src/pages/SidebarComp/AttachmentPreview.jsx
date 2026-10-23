import React, { useMemo } from 'react';
import ImageMessage from '../../features/messaging/chatWindowComp/messages/types/ImageMessage';
import VideoMessage from '../../features/messaging/chatWindowComp/messages/types/VideoMessage';
import VoiceMessage from '../../features/messaging/chatWindowComp/messages/types/VoiceMessage';
import FileMessage from '../../features/messaging/chatWindowComp/messages/types/FileMessage';

/** Which chat viewer shows this file: 'image' | 'video' | 'audio' | 'file'. */
export function viewerFor({ mimeType = '', type = '' } = {}) {
    const m = String(mimeType || '').toLowerCase();
    if (type === 'image' || m.startsWith('image/')) return 'image';
    if (type === 'video' || m.startsWith('video/')) return 'video';
    if (type === 'voice' || type === 'audio' || m.startsWith('audio/')) return 'audio';
    return 'file';
}

/**
 * Preview of a stored file with the same viewers a conversation uses: signed links,
 * the image lightbox, video and voice players, PDF / text previews and download.
 * Works for chat attachments and library files alike (both are served by
 * /api/v2/uploads/file and need a signed link to load in the browser).
 */
export default function AttachmentPreview({ attachment }) {
    const msg = useMemo(() => ({ attachment }), [attachment]);
    if (!attachment?.url && !attachment?.gcsPath) return null;
    const viewer = viewerFor(attachment);
    return (
        <div className="fl-viewer" data-testid="attachment-preview" data-viewer={viewer}>
            {viewer === 'image' && <ImageMessage msg={msg} />}
            {viewer === 'video' && <VideoMessage msg={msg} />}
            {viewer === 'audio' && <VoiceMessage msg={msg} />}
            {viewer === 'file' && <FileMessage msg={msg} />}
        </div>
    );
}
