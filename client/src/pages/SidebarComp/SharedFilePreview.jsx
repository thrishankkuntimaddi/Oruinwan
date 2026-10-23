import React, { useMemo, useState } from 'react';
import { X, Download, MessageSquareText, Hash, AtSign, Users } from 'lucide-react';
import { Btn, IconBtn, errorMessage, timeAgo } from '../../components/ui/page';
import { useToast } from '../../contexts/ToastContext';
import { downloadAttachment } from '../../utils/uploadFile';
import { fileKind, formatSize } from './fileKinds';
import AttachmentPreview from './AttachmentPreview';
import { toAttachment, whereLabel } from '../../hooks/useSharedFiles';

export function WhereIcon({ item, size = 12 }) {
    const c = item?.conversation;
    if (!c) return null;
    if (c.type === 'channel') return <Hash size={size} aria-hidden="true" />;
    return c.isGroup ? <Users size={size} aria-hidden="true" /> : <AtSign size={size} aria-hidden="true" />;
}

/**
 * Side panel for a file sent in a conversation: the conversation's own viewer
 * (image lightbox, players, PDF / text preview), the facts, Download and Go to message.
 */
export default function SharedFilePreview({ item, onClose, onGoToMessage }) {
    const { showToast } = useToast();
    const [downloading, setDownloading] = useState(false);
    const attachment = useMemo(() => toAttachment(item), [item]);
    const { Icon, label } = fileKind(item.mimeType);
    const who = item.sharedBy?.username || 'Someone';

    const download = async () => {
        setDownloading(true);
        try {
            await downloadAttachment(attachment);
        } catch (err) {
            showToast(errorMessage(err, 'Couldn’t download the file'), 'error');
        } finally {
            setDownloading(false);
        }
    };

    const facts = [
        ['Type', label],
        ['Size', formatSize(item.size)],
        ['Shared by', who],
        ['Shared', timeAgo(item.sharedAt)],
    ];

    return (
        <aside className="fl-preview" aria-label={`Preview of ${item.name}`}>
            <div className="fl-preview-head">
                <span className="gl-empty-mark" style={{ margin: 0, width: 30, height: 30 }}><Icon size={15} /></span>
                <strong className="fl-name" style={{ flex: 1, fontSize: 14 }} title={item.name}>{item.name}</strong>
                <IconBtn label="Close preview" onClick={onClose}><X size={16} /></IconBtn>
            </div>
            <div className="fl-preview-body">
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="fl-media fl-media--viewer">
                        <AttachmentPreview attachment={attachment} />
                    </div>
                    <p className="fl-where">
                        <span>Shared in <strong>{whereLabel(item)}</strong>{item.parentId ? ' (in a thread)' : ''}</span>
                    </p>
                    <dl className="fl-facts">
                        {facts.map(([k, v]) => (
                            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
                        ))}
                    </dl>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Btn variant="primary" icon={Download} loading={downloading} onClick={download} style={{ flex: 1, justifyContent: 'center' }}>Download</Btn>
                        <Btn variant="ghost" icon={MessageSquareText} onClick={() => onGoToMessage(item)}>Go to message</Btn>
                    </div>
                </div>
            </div>
        </aside>
    );
}
